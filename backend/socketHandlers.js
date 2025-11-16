const { gameStates, generateRoomCode, getAvailableColor, createGameState, initPlayer, updateGameState, cleanupPowerupsForRoom } = require('./gameManager');
const { getActivePowerups } = require('./powerupManager');
const GameResult = require('./models/GameResult');

// Map roomCode -> intervalId for game loops
const gameIntervals = {};

// NEW: Define speed settings (ticks per second -> interval delay in ms)
const SPEED_SETTINGS = {
    'SLOW': { ticksPerSecond: 4, label: 'Slow' },
    'NORMAL': { ticksPerSecond: 8, label: 'Normal' },
    'FAST': { ticksPerSecond: 12, label: 'Fast' },
    'BLAZING': { ticksPerSecond: 16, label: 'Blazing' },
};

function getIntervalDelay(speedKey) {
    const setting = SPEED_SETTINGS[speedKey] || SPEED_SETTINGS.NORMAL;
    // Calculate interval delay in milliseconds
    return 1000 / setting.ticksPerSecond;
}

function saveGameResult(state) {
    try {
        const players = Object.values(state.players);
        if (players.length === 0) return;

        // Winner = alive with highest score, otherwise highest score overall
        const alive = players.filter(p => p.isAlive);
        let winnerList = alive.length > 0 ? alive : players;
        winnerList.sort((a, b) => b.score - a.score);

        const winner = winnerList[0];

        // Actual duration in seconds (fallback = configured duration)
        let durationSeconds = state.gameDurationSeconds || 0;
        if (state.startTime) {
            durationSeconds = Math.round((Date.now() - state.startTime) / 1000);
        }

        const doc = new GameResult({
            winnerName: winner.name || winner.id,
            score: winner.score || 0,
            durationSeconds,
            playersCount: players.length,
        });

        doc.save()
            .then(() => console.log(`💾 Saved game result for winner ${winner.name}`))
            .catch(err => console.error('Error saving game result:', err));

    } catch (err) {
        console.error('Unexpected error in saveGameResult:', err);
    }
}


function startGameLoop(io, roomCode) {
    const state = gameStates[roomCode];
    if (!state || gameIntervals[roomCode]) return;
    
    // Use the speed setting stored in the game state
    const delay = getIntervalDelay(state.gameSpeed);

    gameIntervals[roomCode] = setInterval(() => {
        const isGameOver = updateGameState(roomCode);
        const currentState = gameStates[roomCode];
        
        // Include powerups in the state emission
        const powerups = getActivePowerups(roomCode);
        const stateWithPowerups = { ...currentState, powerups };
        
        // emit to room
        io.to(roomCode).emit('gameState', stateWithPowerups);
        if (isGameOver) {
            clearInterval(gameIntervals[roomCode]);
            delete gameIntervals[roomCode];

            // 🔥 Save result to MongoDB
            saveGameResult(currentState);

            console.log(`Game loop stopped for room ${roomCode}`);
        }
    }, delay);

}

function stopGameLoop(roomCode) {
    if (gameIntervals[roomCode]) {
        clearInterval(gameIntervals[roomCode]);
        delete gameIntervals[roomCode];
    }
}

function initSocket(io) {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('createRoom', (data, callback) => {
            const DEFAULT_GRID_SIZE = 20;
            const requestedSize = (data && data.gridSize) ? parseInt(data.gridSize, 10) : DEFAULT_GRID_SIZE;
            const hostName = data && data.name ? data.name : 'Player';
            let gridSize = Math.max(10, Math.min(60, requestedSize));
            gridSize = Math.floor(gridSize / 10) * 10;

            const DEFAULT_DURATION_SECONDS = 120;
            const requestedDuration = (data && data.durationSeconds) ? parseInt(data.durationSeconds, 10) : DEFAULT_DURATION_SECONDS;
            const durationSeconds = Math.max(10, Math.min(3600, requestedDuration));
            
            // NEW: Handle speed setting
            const DEFAULT_SPEED = 'NORMAL';
            const requestedSpeed = (data && data.speed) ? data.speed.toUpperCase() : DEFAULT_SPEED;
            const gameSpeed = SPEED_SETTINGS[requestedSpeed] ? requestedSpeed : DEFAULT_SPEED;


            if (typeof callback !== 'function') { console.error('createRoom callback missing'); return; }

            const roomCode = generateRoomCode();
            if (gameStates[roomCode]) { callback({ success: false, message: 'Room code collision' }); return; }

            const state = createGameState(roomCode, socket.id, gridSize, hostName);
            state.gameDurationSeconds = durationSeconds;
            state.gameSpeed = gameSpeed; // Save the selected speed key
            gameStates[roomCode] = state;
            socket.join(roomCode);
            console.log(`[CREATE] Room created: ${roomCode} by ${socket.id} with speed ${gameSpeed}`);
            callback({ success: true, roomCode, state });
        });

        socket.on('joinRoom', (data, callback) => {
            const roomCode = data && data.roomCode ? data.roomCode : '';
            const playerName = data && data.name ? data.name : 'Player';
            const code = roomCode.toUpperCase();
            const state = gameStates[code];
            if (!state) { if (typeof callback === 'function') callback({ success: false, message: 'Room not found' }); return; }
            if (state.gameState !== 'waiting') { if (typeof callback === 'function') callback({ success: false, message: 'Game already started' }); return; }
            if (Object.keys(state.players).length >= 4) { if (typeof callback === 'function') callback({ success: false, message: 'Room full' }); return; }

            const newPlayerIndex = Object.keys(state.players).length;
            const playerColor = getAvailableColor(state.players);
            state.players[socket.id] = initPlayer(socket.id, playerColor, state.gridSize, newPlayerIndex, playerName);
            socket.join(code);
            io.to(code).emit('gameState', state);
            if (typeof callback === 'function') callback({ success: true, state });
        });

        socket.on('startGame', (roomCode) => {
            const state = gameStates[roomCode];
            if (!state || state.hostId !== socket.id || state.gameState !== 'waiting') return;
            if (Object.keys(state.players).length < 1) { console.log(`Cannot start room ${roomCode}: not enough players.`); return; }
            state.gameState = 'playing';
            state.startTime = Date.now(); // track when this game started
            if (state.gameDurationSeconds && Number.isFinite(state.gameDurationSeconds)) state.endTime = Date.now() + state.gameDurationSeconds * 1000;
            console.log(`Game started in room ${roomCode}`);
            // start loop
            startGameLoop(io, roomCode);
            io.to(roomCode).emit('gameState', state);
        });

        socket.on('directionUpdate', (data) => {
            const { roomCode, direction } = data;
            const state = gameStates[roomCode];
            if (!state || state.gameState !== 'playing' || !state.players[socket.id]) return;
            const player = state.players[socket.id];
            const currentDir = player.direction;
            if (currentDir.x !== -direction.x || currentDir.y !== -direction.y) player.direction = direction;
        });

        socket.on('requestReset', (roomCode) => {
            const state = gameStates[roomCode];
            if (!state || state.hostId !== socket.id || state.gameState !== 'gameover') return;
            console.log(`Resetting room ${roomCode}`);
            const newPlayers = {};
            Object.keys(state.players).forEach((playerId, index) => {
                const oldPlayer = state.players[playerId];
                newPlayers[playerId] = initPlayer(playerId, oldPlayer.color, state.gridSize, index, oldPlayer.name);
            });
            const newState = {
                roomCode,
                hostId: state.hostId,
                gameState: 'waiting',
                gridSize: state.gridSize,
                players: newPlayers,
                food: state.food,
                gameDurationSeconds: state.gameDurationSeconds || 120,
                gameSpeed: state.gameSpeed || 'NORMAL', // Persist game speed
            };
            // remove any running loop
            stopGameLoop(roomCode);
            gameStates[roomCode] = newState;
            io.to(roomCode).emit('gameState', newState);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            // find room
            let roomToClean = null;
            for (const code in gameStates) if (gameStates[code].players[socket.id]) { roomToClean = code; break; }
            if (roomToClean) {
                const state = gameStates[roomToClean];
                delete state.players[socket.id];
                if (Object.keys(state.players).length === 0) {
                    stopGameLoop(roomToClean);
                    cleanupPowerupsForRoom(roomToClean);
                    delete gameStates[roomToClean];
                    console.log(`Room ${roomToClean} deleted.`);
                    return;
                }
                if (state.hostId === socket.id) {
                    const remainingPlayers = Object.keys(state.players);
                    state.hostId = remainingPlayers[0];
                    console.log(`Host of ${roomToClean} reassigned to ${state.hostId}`);
                }
                if (state.gameState !== 'playing') delete state.endTime;
                io.to(roomToClean).emit('gameState', state);
            }
        });
    });
}

module.exports = { initSocket };