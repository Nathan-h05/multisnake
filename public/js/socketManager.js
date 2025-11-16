// Socket.IO connection and event management
import { 
    getSocket, setSocket, setUserId, setRoomCode, setGameState, 
    setLastDirectionSent, setIsHost, getUserId, getRoomCode, 
    getGameState, setUserName 
} from './state.js';
import { showScreen, showError, updateWaitingRoomUI, updateScoreboard, updateFinalScores, startClientTimer, clearClientTimer } from './uiManager.js';
import { resizeCanvas, drawGame } from './gameRenderer.js';
import { addInputListeners } from './inputHandler.js';

// UI element refs for button disable/enable
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const nameInput = document.getElementById('name-input');
const gridSizeInput = document.getElementById('grid-size-input');
const durationInput = document.getElementById('game-duration-input');
const gameSpeedSelector = document.getElementById('game-speed-selector');
const roomCodeInput = document.getElementById('room-code-input');
const timerDisplay = document.getElementById('timer-display');

export function connectToServer() {
    showScreen('loading');
    const socket = io();
    setSocket(socket);

    socket.on('connect', () => {
        setUserId(socket.id);
        showScreen('home');
        console.log("Connected to server. User ID:", socket.id);
    });

    socket.on('disconnect', () => {
        showError("Disconnected from server. Check if server is running.");
        showScreen('loading');
    });

    socket.on('gameState', (state) => {
        setGameState(state);
        
        // Check if we are the host
        const userId = getUserId();
        setIsHost(userId === state.hostId);
        
        switch (state.gameState) {
            case 'waiting':
                showScreen('waiting');
                updateWaitingRoomUI(state.players, state.hostId);
                clearClientTimer();
                break;
            case 'playing':
                showScreen('game');
                resizeCanvas(); 
                updateScoreboard(state.players);
                drawGame();
                if (state.endTime) {
                    startClientTimer(state.endTime);
                } else {
                    clearClientTimer();
                    if (timerDisplay) timerDisplay.textContent = 'Time: --:--';
                }
                break;
            case 'gameover':
                showScreen('gameover');
                updateFinalScores(state.players);
                clearClientTimer();
                break;
        }
    });
}

export function handleCreateRoom() {
    const gridSize = parseInt(gridSizeInput.value, 10);
    const name = nameInput.value.trim() || "Player";
    setUserName(name);

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
    
    const durationMinutes = parseFloat(durationInput.value);
    const durationSeconds = Math.max(10, Math.min(3600, Math.floor((isNaN(durationMinutes) ? 2 : durationMinutes) * 60)));

    const socket = getSocket();
    socket.emit('createRoom', { gridSize: gridSize, durationSeconds: durationSeconds, speed: gameSpeed, name}, (response) => {
        createRoomBtn.disabled = false;
        if (response.success) {
            setRoomCode(response.roomCode);
            setGameState(response.state);
            setLastDirectionSent(null);
            addInputListeners();
            
            showScreen('waiting'); 
            updateWaitingRoomUI(response.state.players, response.state.hostId);
        } else {
            showError(response.message || "Failed to create room.");
        }
    });
}

export function handleJoinRoom() {
    const roomCode = roomCodeInput.value.toUpperCase();
    const name = nameInput.value.trim() || "Player";
    setUserName(name);

    if (roomCode.length !== 4) {
        showError("Please enter a 4-letter room code.");
        return;
    }
    
    joinRoomBtn.disabled = true;
    const socket = getSocket();
    socket.emit('joinRoom', { roomCode, name }, (response) => {
        console.log("Join room response:", response);
        joinRoomBtn.disabled = false;
        if (response.success) {
            setRoomCode(roomCode);
            setGameState(response.state);
            setLastDirectionSent(null);
            addInputListeners();
        } else {
            showError(response.message || "Failed to join room.");
        }
    });
}

export function handleLeaveRoom() {
    const socket = getSocket();
    if (socket) {
        setRoomCode(null);
        setGameState(null);
        socket.disconnect(); 
        connectToServer();
    }
}

export function handleStartGame() {
    const socket = getSocket();
    const roomCode = getRoomCode();
    if (socket && roomCode) {
        socket.emit('startGame', roomCode);
    }
}

export function handlePlayAgain() {
    const socket = getSocket();
    const roomCode = getRoomCode();
    if (socket && roomCode) {
        socket.emit('requestReset', roomCode);
    }
}
