// Pure game logic and in-memory state. No Socket.IO or HTTP here.
const DEFAULT_GRID_SIZE = 20;

const gameStates = {};

// Helper utilities
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

function getAvailableColor(players) {
    const usedColors = Object.values(players).map(p => p.color);
    const availableColors = ['#059669', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'].filter(
        color => !usedColors.includes(color)
    );
    return availableColors[0] || '#64748b';
}

function generateFood(gridSize) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);

    // 80% normal food, 10% double-score, 10% speed-boost
    const r = Math.random();
    let type = 'normal';
    let grow = true;      // whether eating this increases snake length
    let score = 1;        // how many points

    if (r > 0.8 && r <= 0.9) {
        type = 'doubleScore';
        score = 2;
        grow = true;      // still grows
    } else if (r > 0.9) {
        type = 'speedBoost';
        score = 1;
        grow = false;     // no extra length, just buff
    }

    return { x, y, type, grow, score };
}

function initPlayer(socketId, color, gridSize, playerIndex, name) {
    const q = Math.floor(gridSize / 4);
    const tq = Math.floor(gridSize * 3 / 4);
    let startX, startY, directionX, directionY;
    switch (playerIndex % 4) {
        case 0: startX = q; startY = q; directionX = 1; directionY = 0; break;
        case 1: startX = tq; startY = tq; directionX = -1; directionY = 0; break;
        case 2: startX = tq; startY = q; directionX = -1; directionY = 0; break;
        case 3: startX = q; startY = tq; directionX = 1; directionY = 0; break;
        default: startX = q; startY = q; directionX = 1; directionY = 0;
    }
    const snake = [
        { x: startX, y: startY },
        { x: startX - directionX, y: startY - directionY },
        { x: startX - (2 * directionX), y: startY - (2 * directionY) },
    ];
    return {
        id: socketId.substring(0, 5),
        socketId,
        name: name || socketId.substring(0, 5),
        color,
        score: 0,
        isAlive: true,
        direction: { x: directionX, y: directionY },
        snake,
    };
}

function createGameState(roomCode, hostId, gridSize, hostName) {
    const playerColor = getAvailableColor({});
    const initialState = {
        roomCode,
        hostId,
        gameState: 'waiting',
        gridSize: gridSize || DEFAULT_GRID_SIZE,
        players: {},
        food: generateFood(gridSize || DEFAULT_GRID_SIZE),
    };
    initialState.players[hostId] = initPlayer(hostId, playerColor, initialState.gridSize, 0, hostName);
    return initialState;
}

/**
 * Checks if a head position collides with any snake body segment (including its own, 
 * but excluding the segment it's about to leave).
 * Note: Head-on collision is handled in detectFatalCollisions.
 */
function checkBodyCollision(head, state) {
    const { players } = state;
    // Check against ALL snake bodies
    for (const playerId of Object.keys(players)) {
        const otherSnake = players[playerId].snake;
        // Skip collision against dead snakes
        if (!players[playerId].isAlive) continue; 
        
        // Loop over all segments of the other snake
        for (let i = 0; i < otherSnake.length; i++) {
            // Self-collision: skip the current tail and the current head
            if (playerId === head.socketId && i > 0 && i === otherSnake.length - 1 && !checkFood(head, state)) {
                // Skip the tail segment if the snake is NOT growing (not eating food)
                continue;
            }
            if (playerId === head.socketId && i === 0) {
                // Skip the current head segment
                continue;
            }

            // Standard segment collision
            if (head.x === otherSnake[i].x && head.y === otherSnake[i].y) return true;
        }
    }
    return false;
}

/**
 * NEW: Detects collisions based on pre-calculated nextHead positions.
 * Returns a Set of socketIds that must die this tick.
 */
function detectFatalCollisions(state) {
    const fatalities = new Set();
    const activePlayerHeads = Object.values(state.players)
        .filter(p => p.isAlive)
        .map(p => p.nextHead);
    
    // --- 1. Check Head-to-Head Collisions ---
    // Create a map of positions to the number of heads moving there
    const headCounts = {};
    activePlayerHeads.forEach(head => {
        const posKey = `${head.x},${head.y}`;
        headCounts[posKey] = headCounts[posKey] || [];
        headCounts[posKey].push(head.socketId);
    });

    // If more than one head lands on the same tile, they all die
    Object.values(headCounts).forEach(socketIds => {
        if (socketIds.length > 1) {
            socketIds.forEach(id => fatalities.add(id));
        }
    });

    // --- 2. Check Head-to-Body/Wall Collisions (and other snake heads) ---
    activePlayerHeads.forEach(head => {
        // Check map boundaries
        if (head.x < 0 || head.x >= state.gridSize || head.y < 0 || head.y >= state.gridSize) {
            fatalities.add(head.socketId);
            return;
        }
        
        // Check collision against all snake bodies (excluding simultaneous head-on hits already caught)
        if (checkBodyCollision(head, state)) {
            fatalities.add(head.socketId);
        }
    });
    
    return fatalities;
}

function checkFood(head, state) {
    return head.x === state.food.x && head.y === state.food.y;
}

// updateGameState is pure-ish: modifies state but does not emit sockets or manage intervals
function updateGameState(roomCode) {
    const state = gameStates[roomCode];
    if (!state || state.gameState !== 'playing') return false;

    // A Set to track players that died this tick
    const diedThisTick = new Set();
    let isGameOver = false;

    // 1. Pass 1: Compute next heads
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (!player.isAlive) return;
        const nextX = player.snake[0].x + player.direction.x;
        const nextY = player.snake[0].y + player.direction.y;
        
        // Note: Map wrapping is NOT applied here, letting collision detection handle walls/edges naturally.
        // The checkBodyCollision is simpler if we let it handle the collision and apply death.
        // However, since we are handling boundary collision in detectFatalCollisions, we should calculate 
        // the wrapped position here to correctly check for internal body collisions.
        let wrappedX = nextX % state.gridSize; if (wrappedX < 0) wrappedX += state.gridSize;
        let wrappedY = nextY % state.gridSize; if (wrappedY < 0) wrappedY += state.gridSize;
        
        player.nextHead = { x: wrappedX, y: wrappedY, socketId: player.socketId };
    });

    // 2. Pass 2: Detect ALL Fatal Collisions simultaneously
    const fatalities = detectFatalCollisions(state);
    
    // 3. Pass 3: Apply movement, food, and deaths
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (!player.isAlive) return;
        
        // Check if player died in the collision detection phase
        if (fatalities.has(playerId)) {
            player.isAlive = false;
            diedThisTick.add(playerId);
            delete player.nextHead;
            return;
        }

        // Apply movement
        const newHead = player.nextHead;
        player.snake.unshift(newHead);

        // Check for food
        if (checkFood(newHead, state)) {
            player.score += 1;
            // generate new food not overlapping any snake
            let newFood, overlap;
            do {
                overlap = false;
                newFood = generateFood(state.gridSize);
                Object.values(state.players).forEach(p => p.snake.forEach(seg => { if (seg.x === newFood.x && seg.y === newFood.y) overlap = true; }));
            } while (overlap);
            state.food = newFood;
        } else {
            // Remove tail if no food was eaten
            player.snake.pop();
        }
        delete player.nextHead;
    });

    const activePlayers = Object.values(state.players).filter(p => p.isAlive).length;
    if (activePlayers <= 1) {
        state.gameState = 'gameover';
        isGameOver = true;
    }

    // time-based check (if endTime present)
    if (!isGameOver && state.endTime && Date.now() >= state.endTime) {
        state.gameState = 'gameover';
        isGameOver = true;
    }

    return isGameOver;
}

module.exports = {
    gameStates,
    generateRoomCode,
    getAvailableColor,
    generateFood,
    initPlayer,
    createGameState,
    updateGameState,
};