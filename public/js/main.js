// --- Client Game State ---
// Removed GRID_SIZE constant. It will now be read from localGameState.
let socket = null;
let currentRoomCode = null;
let localGameState = null;
let userId = null;
let isHost = false;
let lastDirectionSent = null;

// --- UI Element Refs ---
const loadingScreen = document.getElementById('loading-screen');
const homeScreen = document.getElementById('home-screen');
const waitingRoomScreen = document.getElementById('waiting-room-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const screens = {
    'loading': loadingScreen,
    'home': homeScreen,
    'waiting': waitingRoomScreen,
    'game': gameScreen,
    'gameover': gameOverScreen
};

const roomCodeInput = document.getElementById('room-code-input');
const gridSizeInput = document.getElementById('grid-size-input');
const durationInput = document.getElementById('game-duration-input'); // minutes input
const gameSpeedSelector = document.getElementById('game-speed-selector');
const roomCodeDisplay = document.getElementById('room-code-display');
const playerList = document.getElementById('player-list');
const scoreBoard = document.getElementById('score-board');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const finalScores = document.getElementById('final-scores');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const startGameBtn = document.getElementById('start-game-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const timerDisplay = document.getElementById('timer-display');
let timerIntervalId = null;

const nameInput = document.getElementById('name-input');
let userName = null;

// --- UI/Helper Functions ---

function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    if (screens[screenId]) {
        screens[screenId].classList.remove('hidden');
    }
}

function showError(message) {
    console.error("Error:", message);
    errorMessage.textContent = message;
    errorToast.classList.remove('opacity-0', 'translate-y-4');
    setTimeout(() => {
        errorToast.classList.add('opacity-0', 'translate-y-4');
    }, 3000);
}

function resizeCanvas() {
    const container = document.getElementById('canvas-container'); // Use container for aspect ratio
    if (container) {
        // Use the width of the container to set the canvas size, enforcing a square aspect
        const size = container.clientWidth;
        canvas.width = size; 
        canvas.height = size;
        if (localGameState) drawGame();
    }
}

// --- Socket.IO Handlers ---

function connectToServer() {
    showScreen('loading');
    socket = io();

    socket.on('connect', () => {
        userId = socket.id;
        showScreen('home');
        console.log("Connected to server. User ID:", userId);
    });

    socket.on('disconnect', () => {
        showError("Disconnected from server. Check if server is running.");
        showScreen('loading');
    });

    socket.on('gameState', (state) => {
        localGameState = state;
        
        // Check if we are the host
        isHost = (userId === state.hostId);
        
        switch (state.gameState) {
            case 'waiting':
                showScreen('waiting');
                updateWaitingRoomUI(state.players, state.hostId);
                // Clear any running client timer while waiting
                clearClientTimer();
                break;
            case 'playing':
                showScreen('game');
                // Ensure canvas is sized immediately before drawing
                resizeCanvas(); 
                updateScoreboard(state.players);
                drawGame();
                // If server provided an endTime, start a local countdown display
                if (state.endTime) {
                    startClientTimer(state.endTime);
                } else {
                    // No timer configured
                    clearClientTimer();
                    if (timerDisplay) timerDisplay.textContent = 'Time: --:--';
                }
                break;
            case 'gameover':
                showScreen('gameover');
                updateFinalScores(state.players);
                // Clear countdown on game over
                clearClientTimer();
                break;
        }
    });
}

function handleCreateRoom() {
    const gridSize = parseInt(gridSizeInput.value, 10);
    const name = nameInput.value.trim() || "Player";
    userName = name;

    const gameSpeed = gameSpeedSelector.value;
    if (!gameSpeed) {
        showError("Invalid game speed selected.");
        return;
    }

    if (isNaN(gridSize) || gridSize < 10 || gridSize > 60 || gridSize % 10 !== 0) {
        showError("Grid size must be a number between 10 and 60, in multiples of 10.");
        return;
    }
    
    createRoomBtn.disabled = true;
    
    // Read duration (minutes) and convert to seconds
    const durationMinutes = parseFloat(durationInput.value);
    const durationSeconds = Math.max(10, Math.min(3600, Math.floor((isNaN(durationMinutes) ? 2 : durationMinutes) * 60)));

    // Send the desired grid size and duration to the server
    socket.emit('createRoom', { gridSize: gridSize, durationSeconds: durationSeconds, speed: gameSpeed, name}, (response) => {
        createRoomBtn.disabled = false;
        if (response.success) {
            currentRoomCode = response.roomCode;
            localGameState = response.state;
            lastDirectionSent = null;
            addInputListeners();
            
            // Manually transition UI
            showScreen('waiting'); 
            updateWaitingRoomUI(response.state.players, response.state.hostId);
        } else {
            showError(response.message || "Failed to create room.");
        }
    });
}

function handleJoinRoom() {
    const roomCode = roomCodeInput.value.toUpperCase();
    const name = nameInput.value.trim() || "Player";

    userName = name;
    if (roomCode.length !== 4) {
        showError("Please enter a 4-letter room code.");
        return;
    }
    
    joinRoomBtn.disabled = true;
    socket.emit('joinRoom', { roomCode, name }, (response) => {
        console.log("Join room response:", response);
        joinRoomBtn.disabled = false;
        if (response.success) {
            currentRoomCode = roomCode;
            localGameState = response.state;
            lastDirectionSent = null;
            addInputListeners();
            // Screen transition for joining is handled by the server's 'gameState' broadcast
        } else {
            showError(response.message || "Failed to join room.");
        }
    });
}

function handleLeaveRoom() {
    if (socket) {
        currentRoomCode = null;
        localGameState = null;
        socket.disconnect(); 
        connectToServer();
    }
}

// --- Input Handling ---

function handleKeydown(e) {
    if (!localGameState || localGameState.gameState !== 'playing' || !localGameState.players[userId].isAlive) {
        return;
    }
    
    const playerState = localGameState.players[userId];
    const currentDir = playerState.direction;
    let newDir = null;
    
    switch (e.key) {
        case 'ArrowUp': case 'w':
            if (currentDir.y === 0) newDir = { x: 0, y: -1 };
            break;
        case 'ArrowDown': case 's':
            if (currentDir.y === 0) newDir = { x: 0, y: 1 };
            break;
        case 'ArrowLeft': case 'a':
            if (currentDir.x === 0) newDir = { x: -1, y: 0 };
            break;
        case 'ArrowRight': case 'd':
            if (currentDir.x === 0) newDir = { x: 1, y: 0 };
            break;
    }

    // Only send if the direction has changed and is valid (not turning 180 degrees)
    if (newDir && (lastDirectionSent === null || newDir.x !== lastDirectionSent.x || newDir.y !== lastDirectionSent.y)) {
        lastDirectionSent = newDir;
        socket.emit('directionUpdate', { roomCode: currentRoomCode, direction: newDir });
    }
}

function addInputListeners() {
    document.removeEventListener('keydown', handleKeydown);
    document.addEventListener('keydown', handleKeydown);
}

// --- UI Rendering ---

function updateWaitingRoomUI(players, hostId) {
    playerList.innerHTML = '';
    const playerArray = Object.values(players);
    
    playerArray.forEach(player => {
        const isMe = player.socketId === userId;
        const playerEl = document.createElement('div');
        playerEl.className = `flex items-center justify-between p-3 bg-gray-700 rounded-lg ${isMe ? 'border-2 border-blue-400' : ''}`;
        
        playerEl.innerHTML = `
            <div class="flex items-center">
                <span class="player-color-dot" style="background-color: ${player.color}"></span>
                <span class="font-medium truncate" style="max-width: 200px;">
  ${player.name || player.id} ${isMe ? '(You)' : ''} ${player.socketId === hostId ? '👑' : ''}
</span>
            </div>
            <span class="font-bold text-green-400">${player.socketId === hostId ? 'Host' : 'Ready'}</span>
        `;
        playerList.appendChild(playerEl);
    });
    
    // Show Start Game button only if host and at least one player (the host)
    if (userId === hostId && playerArray.length >= 1) { 
        startGameBtn.classList.remove('hidden');
    } else {
        startGameBtn.classList.add('hidden');
    }
    
    roomCodeDisplay.textContent = currentRoomCode;
}

function drawGame() {
    if (!localGameState) return;
    
    const { players, food, gridSize } = localGameState;
    const GRID_SIZE = gridSize; 
    const tileSize = canvas.width / GRID_SIZE; 
    
    if (tileSize <= 0 || !GRID_SIZE) {
        console.warn("Canvas size or Grid size is invalid. Cannot draw.");
        return; 
    }

    // Clear canvas
    ctx.fillStyle = '#1a202c'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw food
    ctx.fillStyle = '#EF4444'; 
    ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize, tileSize);
    
    // Draw snakes
    Object.values(players).forEach(p => {
        // Set transparency if player is dead
        if (!p.isAlive) {
            ctx.globalAlpha = 0.3;
        } else {
            ctx.globalAlpha = 1.0;
        }
        
        ctx.fillStyle = p.color;

        // Draw each segment
        p.snake.forEach((segment, index) => {
            ctx.fillRect(segment.x * tileSize, segment.y * tileSize, tileSize, tileSize);
            
            // Draw head outline
            if (index === 0) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.strokeRect(segment.x * tileSize, segment.y * tileSize, tileSize, tileSize);
            }
        });

        // --- ⭐ Draw Player Name Above Head ---
        const head = p.snake[0];
        if (head && p.name) {
            ctx.font = `${Math.max(12, tileSize * 0.6)}px Inter`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            ctx.fillText(
                p.name,
                head.x * tileSize + tileSize / 2,   // center horizontally
                head.y * tileSize - 2               // slightly above the head
            );
        }

    });

    // Reset global alpha
    ctx.globalAlpha = 1.0;
}


function updateScoreboard(players) {
    scoreBoard.innerHTML = '';
    
    // --- CRITICAL FIX: Implement two-level sorting ---
    const sortedPlayers = Object.values(players).sort((a, b) => {
        // 1. Primary Sort: Alive status (true = -1, false = 1). Alive players first.
        if (a.isAlive !== b.isAlive) {
            return a.isAlive ? -1 : 1; 
        }
        // 2. Secondary Sort: Score (descending). Higher score first.
        return b.score - a.score;
    });
    // --- END CRITICAL FIX ---

    sortedPlayers.forEach(p => {
        const isMe = p.socketId === userId;
        const scoreEl = document.createElement('div');
        scoreEl.className = 'flex items-center text-lg font-bold justify-between'; // Added justify-between
        
        let colorClass = '';
        let statusText = '';
        
        if (!p.isAlive) {
            // Apply gray color and line-through for dead snakes
            scoreEl.classList.add('line-through', 'opacity-50', 'text-gray-400');
            statusText = '(DEAD)';
        } else if (isMe) {
            // Highlight self if alive
            colorClass = 'text-green-400';
            statusText = '(You)';
        }
        
        // Use a <span> for the score to allow for the status text
        scoreEl.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="player-color-dot" style="background-color: ${p.color}"></span>
                <span class="${colorClass}">${p.name} ${statusText}</span>
            </div>
            <span>${p.score}</span>
        `;
        scoreBoard.appendChild(scoreEl);
    });
}

function updateFinalScores(players) {
    if (!localGameState || localGameState.gameState !== 'gameover') return;

    finalScores.innerHTML = '';
    
    // 1. Determine the winner among ALIVE players
    const alivePlayers = Object.values(players).filter(p => p.isAlive);
    
    // Sort alive players by score to find the true winner
    alivePlayers.sort((a, b) => b.score - a.score);
    const winnerId = alivePlayers.length > 0 ? alivePlayers[0].socketId : null;

    // 2. Sort all players for the scoreboard: Alive first, then score
    const sortedPlayers = Object.values(players).sort((a, b) => {
        // Primary Sort: Alive status (true = -1, false = 1). Alive players first.
        if (a.isAlive !== b.isAlive) {
            return a.isAlive ? -1 : 1; 
        }
        // Secondary Sort: Score (descending). Higher score first.
        return b.score - a.score;
    });

    // 3. Render the sorted list
    sortedPlayers.forEach((p, index) => {
        const isMe = p.socketId === userId;
        const isWinner = p.socketId === winnerId;
        
        let emoji = '';
        let colorClass = 'text-slate-300';
        let statusText = '';

        if (p.isAlive) {
            if (index === 0) emoji = ' 🏆';
            if (index === 1) emoji = ' 🥈';
            if (index === 2) emoji = ' 🥉';
        }
        
        if (isWinner) {
            if (isMe) {
                statusText = '(Winner - You!)';
            } else {
                statusText = '(Winner)';
            }
            colorClass = 'text-yellow-400';
        } else if (!p.isAlive) {
            statusText = `(Eliminated)${isMe ? ' (You)' : ''}`;
            colorClass = 'text-gray-500'; // Darker gray for dead players
        } else if (isMe) {
            statusText = '(You)';
            colorClass = 'text-blue-400';
        }
        
        const scoreEl = document.createElement('div');
        scoreEl.className = `flex items-center text-lg justify-between p-2 rounded-lg ${!p.isAlive ? 'line-through opacity-70' : 'bg-slate-700/50'}`;
        
        scoreEl.innerHTML = `
            <div class="flex items-center">
                <span class="player-color-dot" style="background-color: ${p.color}"></span>
                <span class="font-medium ${colorClass}">${p.name} ${statusText}</span>
            </div>
            <span class="font-bold text-xl ${colorClass}">${p.score}${emoji}</span>
        `;
        finalScores.appendChild(scoreEl);
    });
    
    // Show "Play Again" button only to host
    if (localGameState.hostId === userId) {
        playAgainBtn.classList.remove('hidden');
    } else {
        playAgainBtn.classList.add('hidden');
    }
}

// --- Timer helpers (client) ---
function formatTimeSeconds(sec) {
    if (sec <= 0) return '00:00';
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function startClientTimer(endTime) {
    clearClientTimer();
    if (!timerDisplay) return;
    function tick() {
        const remainingMs = endTime - Date.now();
        const remainingSec = Math.ceil(remainingMs / 1000);
        if (remainingSec <= 0) {
            timerDisplay.textContent = 'Time: 00:00';
            clearClientTimer();
            return;
        }
        timerDisplay.textContent = 'Time: ' + formatTimeSeconds(remainingSec);
    }
    tick();
    timerIntervalId = setInterval(tick, 1000);
}

function clearClientTimer() {
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
}


// --- Initialization and Event Listeners ---

window.addEventListener('load', () => {
    connectToServer();
    resizeCanvas();
});
window.addEventListener('resize', resizeCanvas);

// Button listeners
createRoomBtn.addEventListener('click', handleCreateRoom);
joinRoomBtn.addEventListener('click', handleJoinRoom);
document.getElementById('leave-room-btn').addEventListener('click', handleLeaveRoom);
document.getElementById('leave-room-gameover-btn').addEventListener('click', handleLeaveRoom);

// Start Game and Play Again buttons (Host Only actions)
startGameBtn.addEventListener('click', () => {
    if (isHost && currentRoomCode) {
        socket.emit('startGame', currentRoomCode);
    }
});

playAgainBtn.addEventListener('click', () => {
    if (isHost && currentRoomCode) {
        socket.emit('requestReset', currentRoomCode);
    }
});
