const { gameStates, generateRoomCode, getAvailableColor, createGameState, initPlayer, updateGameState } = require('./gameManager');

// Map roomCode -> intervalId for game loops
const gameIntervals = {};

function startGameLoop(io, roomCode) {
    if (gameIntervals[roomCode]) return;
    gameIntervals[roomCode] = setInterval(() => {
        const isGameOver = updateGameState(roomCode);
        const state = gameStates[roomCode];
        // emit to room
        io.to(roomCode).emit('gameState', state);
        if (isGameOver) {
            clearInterval(gameIntervals[roomCode]);
            delete gameIntervals[roomCode];
            console.log(`Game loop stopped for room ${roomCode}`);
        }
    }, 1000 / 8);
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

            if (typeof callback !== 'function') { console.error('createRoom callback missing'); return; }

            const roomCode = generateRoomCode();
            if (gameStates[roomCode]) { callback({ success: false, message: 'Room code collision' }); return; }

            const state = createGameState(roomCode, socket.id, gridSize, hostName);
            state.gameDurationSeconds = durationSeconds;
            gameStates[roomCode] = state;
            socket.join(roomCode);
            console.log(`[CREATE] Room created: ${roomCode} by ${socket.id}`);
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
                food: generateRoomCode() ? state.food : state.food, // noop but keep field
                gameDurationSeconds: state.gameDurationSeconds || 120,
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
