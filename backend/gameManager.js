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
    return { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
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

function checkCollision(head, state) {
    const { players } = state;
    const selfSnake = players[head.socketId].snake;
    for (let i = 1; i < selfSnake.length; i++) if (head.x === selfSnake[i].x && head.y === selfSnake[i].y) return true;
    for (const playerId of Object.keys(players)) {
        const otherSnake = players[playerId].snake;
        // skip collision against dead snakes for clearer gameplay
        if (!players[playerId].isAlive) continue;
        for (let i = 0; i < otherSnake.length; i++) {
            if (playerId === head.socketId && i === 0) continue;
            if (head.x === otherSnake[i].x && head.y === otherSnake[i].y) return true;
        }
    }
    return false;
}

function checkFood(head, state) {
    return head.x === state.food.x && head.y === state.food.y;
}

// updateGameState is pure-ish: modifies state but does not emit sockets or manage intervals
function updateGameState(roomCode) {
    const state = gameStates[roomCode];
    if (!state || state.gameState !== 'playing') return false;

    let isGameOver = false;

    // first pass: compute next heads
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (!player.isAlive) return;
        const nextX = player.snake[0].x + player.direction.x;
        const nextY = player.snake[0].y + player.direction.y;
        let wrappedX = nextX % state.gridSize; if (wrappedX < 0) wrappedX += state.gridSize;
        let wrappedY = nextY % state.gridSize; if (wrappedY < 0) wrappedY += state.gridSize;
        player.nextHead = { x: wrappedX, y: wrappedY, socketId: player.socketId };
    });

    // second pass: apply movement and collisions
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (!player.isAlive) return;
        const newHead = player.nextHead;
        if (checkCollision(newHead, state)) { player.isAlive = false; delete player.nextHead; return; }
        player.snake.unshift(newHead);
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
