const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
// Serve static files from the public folder (frontend build / static assets)
app.use(express.static(path.join(__dirname, '..', 'public')));
// IMPORTANT: Adjust port if needed, but 3000 is standard
const server = http.createServer(app);
const io = new Server(server);

// Serve the client file (index.html) from the public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Function to generate a random 4-letter room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Global map to hold game states (RoomCode -> GameState)
const gameStates = {};
// Global map to hold game intervals (RoomCode -> IntervalId)
const gameIntervals = {};

// --- Helper Functions ---

// Function to get a unique color for a new player
function getAvailableColor(players) {
    const usedColors = Object.values(players).map(p => p.color);
    // Use a fixed set of visible, distinct colors
    const availableColors = ['#059669', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'].filter(
        color => !usedColors.includes(color)
    );
    return availableColors[0] || '#64748b'; // Default gray if all primary colors are used
}

// Generate random food position
function generateFood(gridSize) {
    return {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
    };
}

// Initialize player state with distinct starting positions based on index
function initPlayer(socketId, color, gridSize, playerIndex, name) {
    const q = Math.floor(gridSize / 4); // Quarter distance
    const tq = Math.floor(gridSize * 3 / 4); // Three-quarter distance

    let startX, startY, directionX, directionY;
    
    // Define 4 distinct starting positions and initial directions
    switch (playerIndex % 4) {
        case 0: // Player 1 (Host): Top-Left, moving Right
            startX = q; startY = q;
            directionX = 1; directionY = 0;
            break;
        case 1: // Player 2: Bottom-Right, moving Left
            startX = tq; startY = tq;
            directionX = -1; directionY = 0;
            break;
        case 2: // Player 3: Top-Right, moving Left
            startX = tq; startY = q;
            directionX = -1; directionY = 0;
            break;
        case 3: // Player 4: Bottom-Left, moving Right
            startX = q; startY = tq;
            directionX = 1; directionY = 0;
            break;
        default:
            // Fallback to Player 1 position if more than 4 players somehow
            startX = q; startY = q;
            directionX = 1; directionY = 0;
    }
    
    // Create the initial snake segments based on the calculated direction
    const snake = [
        { x: startX, y: startY },
        { x: startX - directionX, y: startY - directionY },
        { x: startX - (2 * directionX), y: startY - (2 * directionY) },
    ];

    return {
        id: socketId.substring(0, 5),
        socketId: socketId,
        name: name || socketId.substring(0, 5),
        color: color,
        score: 0,
        isAlive: true,
        direction: { x: directionX, y: directionY },
        snake: snake,
    };
}

// Create the initial game state for a new room
function createGameState(roomCode, hostId, gridSize, hostName) {
    const playerColor = getAvailableColor({});
    const initialState = {
        roomCode: roomCode,
        hostId: hostId,
        gameState: 'waiting',
        gridSize: gridSize, // CRITICAL: Storing the grid size
        players: {},
        food: generateFood(gridSize),
    };
    // Host is always player index 0
    initialState.players[hostId] = initPlayer(hostId, playerColor, gridSize, 0, hostName); 
    return initialState;
}

// --- Core Game Logic (move, check collision, check food) ---

function checkCollision(head, state) {
    const { gridSize, players } = state;
    const playerKeys = Object.keys(players);

    // 1. Self Collision
    const selfSnake = players[head.socketId].snake;
    for (let i = 1; i < selfSnake.length; i++) {
        if (head.x === selfSnake[i].x && head.y === selfSnake[i].y) {
            return true;
        }
    }

    // 2. Other Snake Collision (checks active and stationary bodies)
    for (const playerId of playerKeys) {
        const otherSnake = players[playerId].snake;
        // Check collision against the whole body of every other snake
        for (let i = 0; i < otherSnake.length; i++) {
            // Skip checking our own head against itself
            if (playerId === head.socketId && i === 0) continue; 
            
            if (head.x === otherSnake[i].x && head.y === otherSnake[i].y) {
                return true;
            }
        }
    }
    return false;
}

function checkFood(head, state) {
    const { food } = state;
    return head.x === food.x && head.y === food.y;
}

function updateGameState(roomCode) {
    const state = gameStates[roomCode];
    if (!state || state.gameState !== 'playing') return;

    let isGameOver = false;

    // First pass: Calculate next position and check for collisions/food
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (!player.isAlive) return;

        // Calculate next potential position
        const nextX = player.snake[0].x + player.direction.x;
        const nextY = player.snake[0].y + player.direction.y;
        
        // --- WRAP-AROUND LOGIC (TOROIDAL GEOMETRY) ---
        // Calculate the wrapped X coordinate
        let wrappedX = nextX % state.gridSize;
        if (wrappedX < 0) {
            wrappedX += state.gridSize; // Handles moving off the left edge (e.g., -1 becomes 19 on a 20x20 grid)
        }

        // Calculate the wrapped Y coordinate
        let wrappedY = nextY % state.gridSize;
        if (wrappedY < 0) {
            wrappedY += state.gridSize; // Handles moving off the top edge
        }
        
        // The new head position is the wrapped position
        const newHead = {
            x: wrappedX,
            y: wrappedY,
            socketId: player.socketId // Add socketId for collision check context
        };
        
        // Temporarily store the next head position for movement
        player.nextHead = newHead;
    });
    
    // Second pass: Final collision check and movement
    Object.keys(state.players).forEach(playerId => {
        const player = state.players[playerId];
        if (!player.isAlive) return;
        
        const newHead = player.nextHead;
        
        // Check collision *against all* new potential positions and existing bodies
        if (checkCollision(newHead, state)) {
            player.isAlive = false;
            return; // Player is dead this tick
        }

        // Move snake: add new head
        player.snake.unshift(newHead);

        // Check food collision
        if (checkFood(newHead, state)) {
            player.score += 1;
            
            // Generate new food (ensuring it doesn't overlap)
            let newFood;
            let overlap;
            do {
                overlap = false;
                newFood = generateFood(state.gridSize);
                Object.values(state.players).forEach(p => {
                    p.snake.forEach(segment => {
                        if (newFood.x === segment.x && newFood.y === segment.y) {
                            overlap = true;
                        }
                    });
                });
            } while (overlap);
            state.food = newFood;
        } else {
            // No food: pop tail
            player.snake.pop();
        }
        
        // Clear temporary next head
        delete player.nextHead;
    });

    // Final check for game end
    const activePlayers = Object.values(state.players).filter(p => p.isAlive).length;
    
    // If 0 or 1 player remains, game is over
    if (activePlayers <= 1) {
        state.gameState = 'gameover';
        isGameOver = true;
        clearInterval(gameIntervals[roomCode]);
        delete gameIntervals[roomCode];
    }
    
    return isGameOver;
}

// Main game loop
function gameLoop(roomCode) {
    const state = gameStates[roomCode];
    if (!state) return;

    updateGameState(roomCode);
    io.to(roomCode).emit('gameState', state);

    if (state.gameState === 'gameover') {
        console.log(`Game over in room ${roomCode}`);
    }
}

// --- Socket Event Handlers ---

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createRoom', (data, callback) => {
        const DEFAULT_GRID_SIZE = 20; 
        
        // Extract and validate gridSize
        const requestedSize = (data && data.gridSize) ? parseInt(data.gridSize, 10) : DEFAULT_GRID_SIZE;
        const hostName = data && data.name ? data.name : 'Player';
        let gridSize = Math.max(10, Math.min(60, requestedSize));
        gridSize = Math.floor(gridSize / 10) * 10; // Ensure multiple of 10
        
        if (typeof callback !== 'function') {
             console.error('Callback function is missing in createRoom event.');
             return;
        }

        const roomCode = generateRoomCode();
        if (gameStates[roomCode]) {
            callback({ success: false, message: 'Room code collision, try again.' });
            return;
        }

        const state = createGameState(roomCode, socket.id, gridSize, hostName);
        gameStates[roomCode] = state;
        socket.join(roomCode);
        
        // *** DEBUG LOG ***
        console.log(`[CREATE] Room created: ${roomCode} by ${socket.id}. Current rooms: ${Object.keys(gameStates).join(', ')}`);
        
        callback({ success: true, roomCode, state });
    });


    socket.on('joinRoom', (data, callback) => {
        // data = { roomCode, name }
        const roomCode = data && data.roomCode ? data.roomCode : '';
        const playerName = data && data.name ? data.name : 'Player';

        const code = roomCode.toUpperCase();

        console.log(`[JOIN] User ${socket.id} attempting to join room: ${roomCode} (Look up key: ${code})`);
        console.log(`[JOIN] Available rooms for lookup: ${Object.keys(gameStates).join(', ')}`);

        const state = gameStates[code];
        if (!state) {
            console.log(`[JOIN FAIL] Room ${code} not found in state map.`);
            if (typeof callback === 'function') {
                callback({ success: false, message: `Room ${code} not found.` });
            }
            return;
        }

        if (state.gameState !== 'waiting') {
            if (typeof callback === 'function') {
                callback({ success: false, message: 'Game has already started.' });
            }
            return;
        }

        if (Object.keys(state.players).length >= 4) {
            if (typeof callback === 'function') {
                callback({ success: false, message: 'Room is full.' });
            }
            return;
        }

        const newPlayerIndex = Object.keys(state.players).length;
        const playerColor = getAvailableColor(state.players);

        state.players[socket.id] =
            initPlayer(socket.id, playerColor, state.gridSize, newPlayerIndex, playerName);

        socket.join(code);

        console.log(`[JOIN SUCCESS] User ${socket.id} joined room ${code}`);

        io.to(code).emit('gameState', state);
        if (typeof callback === 'function') {
            callback({ success: true, state });
        }
    });



    socket.on('startGame', (roomCode) => {
        const state = gameStates[roomCode];
        if (!state || state.hostId !== socket.id || state.gameState !== 'waiting') return;

        if (Object.keys(state.players).length < 1) { 
            console.log(`Cannot start room ${roomCode}: not enough players.`);
            return;
        }

        state.gameState = 'playing';
        console.log(`Game started in room ${roomCode}`);
        
        // Start the game loop (e.g., 8 FPS)
        gameIntervals[roomCode] = setInterval(() => gameLoop(roomCode), 1000 / 8); 
        
        // Send initial state update
        io.to(roomCode).emit('gameState', state);
    });

    socket.on('directionUpdate', (data) => {
        const { roomCode, direction } = data;
        const state = gameStates[roomCode];
        if (!state || state.gameState !== 'playing' || !state.players[socket.id]) return;

        const player = state.players[socket.id];
        
        // Basic check to prevent 180-degree turn
        const currentDir = player.direction;
        if (currentDir.x !== -direction.x || currentDir.y !== -direction.y) {
            player.direction = direction;
        }
    });

    socket.on('requestReset', (roomCode) => {
        const state = gameStates[roomCode];
        if (!state || state.hostId !== socket.id || state.gameState !== 'gameover') return;

        console.log(`Resetting room ${roomCode}`);

        const newPlayers = {};

        Object.keys(state.players).forEach((playerId, index) => {
            const oldPlayer = state.players[playerId];
            newPlayers[playerId] = initPlayer(
                playerId,
                oldPlayer.color,
                state.gridSize,
                index,
                oldPlayer.name       // ⭐ keep player name
            );
        });

        const newState = {
            roomCode: roomCode,
            hostId: state.hostId,
            gameState: 'waiting',
            gridSize: state.gridSize,
            players: newPlayers,
            food: generateFood(state.gridSize),
        };

        gameStates[roomCode] = newState;
        io.to(roomCode).emit('gameState', newState);
    });


    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find if the user was in any room and handle cleanup
        let roomToClean = null;
        for (const code in gameStates) {
            if (gameStates[code].players[socket.id]) {
                roomToClean = code;
                break;
            }
        }

        if (roomToClean) {
            const state = gameStates[roomToClean];
            
            // 1. Remove player from the state object
            delete state.players[socket.id];

            // 2. Check if the room is empty
            if (Object.keys(state.players).length === 0) {
                // Room empty: stop interval, delete state
                if (gameIntervals[roomToClean]) {
                    clearInterval(gameIntervals[roomToClean]);
                    delete gameIntervals[roomToClean];
                }
                delete gameStates[roomToClean];
                console.log(`Room ${roomToClean} deleted.`);
                return;
            }
            
            // 3. Handle Host change if the host disconnected
            if (state.hostId === socket.id) {
                const remainingPlayers = Object.keys(state.players);
                state.hostId = remainingPlayers[0]; // Assign host to the first remaining player
                console.log(`Host of ${roomToClean} reassigned to ${state.hostId}`);
            }
            
            // Broadcast update
            io.to(roomToClean).emit('gameState', state);
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
