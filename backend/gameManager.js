// Pure game logic and in-memory state. No Socket.IO or HTTP here.
const {
    trySpawnPowerup,
    checkPowerupCollection,
    applyPowerupToPlayer,
    cleanupPlayerEffects,
    hasActivePowerup,
    initPowerupsForRoom,
    cleanupPowerupsForRoom,
} = require('./powerupManager');

// Extracted modules for cleaner organization
const { generateFood, calculateAppleCount, generateMultipleFood, checkFood } = require('./game/foodManager');
const { detectFatalCollisions, checkBodyCollision } = require('./game/collisionHandler');

const DEFAULT_GRID_SIZE = 20;

const gameStates = {};

function applyFreezeToOthers(roomCode, immunePlayerId) {
    const state = gameStates[roomCode];
    if (!state) return;
    const now = Date.now();
    const duration = 5000; // From POWERUP_TYPES.FREEZE.duration
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (playerId !== immunePlayerId && player.isAlive) {
            player.frozenUntil = now + duration;
        }
    });
    console.log(`[FREEZE] ${immunePlayerId.substring(0,5)} froze others in ${roomCode}`);
}

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

// Food functions now imported from game/foodManager.js

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

function createGameState(roomCode, hostId, gridSize, hostName, appleCountSetting = 'EQUAL') {
    const playerColor = getAvailableColor({});
    const initialState = {
        roomCode,
        hostId,
        gameState: 'waiting',
        gridSize: gridSize || DEFAULT_GRID_SIZE,
        players: {},
        food: [], // Will be populated after players join
        appleCountSetting: appleCountSetting,
    };
    initialState.players[hostId] = initPlayer(hostId, playerColor, initialState.gridSize, 0, hostName);
    
    // Initialize powerup tracking for this room
    initPowerupsForRoom(roomCode);
    
    return initialState;
}

// Collision detection functions now imported from game/collisionHandler.js

// updateGameState is pure-ish: modifies state but does not emit sockets or manage intervals
function updateGameState(roomCode) {
    const state = gameStates[roomCode];
    if (!state || state.gameState !== 'playing') return false;

    // SPEED BOOST: Process speed-boosted players twice per tick
    const speedBoostedPlayers = Object.values(state.players)
        .filter(p => p.isAlive && hasActivePowerup(p, 'speed_boost'))
        .map(p => p.socketId);
    
    // First tick (all players including speed-boosted)
    const firstTickResult = processSingleTick(roomCode, state);
    if (firstTickResult.isGameOver) return true;
    
    // Second tick (only speed-boosted players)
    if (speedBoostedPlayers.length > 0) {
        const secondTickResult = processSingleTick(roomCode, state, speedBoostedPlayers);
        if (secondTickResult.isGameOver) return true;
    }
    
    return false;
}

// Process a single game tick (all players or subset)
function processSingleTick(roomCode, state, onlyPlayerIds = null) {
    const diedThisTick = new Set();
    let isGameOver = false;
    const now = Date.now();

    // 1. Pass 1: Compute next heads for NON-FROZEN alive players only
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (!player.isAlive) return;
        if (onlyPlayerIds && !onlyPlayerIds.includes(playerId)) return;
        if (player.frozenUntil && player.frozenUntil > now) return; // Skip frozen

        const nextX = player.snake[0].x + player.direction.x;
        const nextY = player.snake[0].y + player.direction.y;
        let wrappedX = nextX % state.gridSize; if (wrappedX < 0) wrappedX += state.gridSize;
        let wrappedY = nextY % state.gridSize; if (wrappedY < 0) wrappedY += state.gridSize;
        player.nextHead = { x: wrappedX, y: wrappedY, socketId: playerId };
    });

    // 2. Pass 2: Detect fatal collisions (only moving heads)
    const fatalities = detectFatalCollisions(state);

    // 3. Pass 3: Apply movement/food/powerups/deaths
    let foodWasEaten = false;
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (!player.isAlive) return;
        if (onlyPlayerIds && !onlyPlayerIds.includes(playerId)) return;
        if (player.frozenUntil && player.frozenUntil > now) return; // Already skipped

        if (fatalities.has(playerId)) {
            player.isAlive = false;
            diedThisTick.add(playerId);
            delete player.nextHead;
            return;
        }

        // Move: grow temporarily
        const newHead = player.nextHead;
        player.snake.unshift(newHead);

        const foodIndex = checkFood(newHead, state);
        if (foodIndex !== -1) {
            let points = state.food.score || 1;
            if (hasActivePowerup(player, 'multiplier')) points *= 2;
            player.score += points;
            foodWasEaten = true;

            // Remove the eaten food
            state.food.splice(foodIndex, 1);
            
            // Generate new food to maintain apple count
            const targetAppleCount = calculateAppleCount(state.appleCountSetting, Object.keys(state.players).length);
            state.food = generateMultipleFood(state.gridSize, targetAppleCount, state.players, state.food);

            // Net growth?
            const shouldGrow = state.food.grow !== false;
            if (!shouldGrow) player.snake.pop();
        } else {
            player.snake.pop(); // Normal move
        }

        // Powerup collection (only main tick)
        if (!onlyPlayerIds) {
            const collected = checkPowerupCollection(newHead, roomCode);
            if (collected) {
                if (collected.type === 'freeze') {
                    applyFreezeToOthers(roomCode, player.socketId);
                } else {
                    applyPowerupToPlayer(player, collected.type);
                }
            }
        }

        delete player.nextHead;
    });

    // Powerup spawn + cleanup (main tick only)
    if (!onlyPlayerIds) {
        if (foodWasEaten) trySpawnPowerup(roomCode, state.gridSize, state.players, state.food);
        cleanupPlayerEffects(state.players);
    }

    const aliveCount = Object.values(state.players).filter(p => p.isAlive).length;
    if (aliveCount <= 1) {
        state.gameState = 'gameover';
        isGameOver = true;
    } else if (state.endTime && now >= state.endTime) {
        state.gameState = 'gameover';
        isGameOver = true;
    }

    return { isGameOver, diedThisTick };
}

module.exports = {
    gameStates,
    generateRoomCode,
    getAvailableColor,
    generateFood,
    generateMultipleFood,
    calculateAppleCount,
    initPlayer,
    createGameState,
    updateGameState,
    cleanupPowerupsForRoom,
};