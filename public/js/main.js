// Main application entry point - wires all modules together
import { connectToServer, handleCreateRoom, handleJoinRoom, handleLeaveRoom, handleStartGame, handlePlayAgain } from './socketManager.js';
import { resizeCanvas } from './gameRenderer.js';
import { getIsHost, getRoomCode } from './state.js';

// --- Initialization and Event Listeners ---

window.addEventListener('load', () => {
    connectToServer();
    resizeCanvas();
});
window.addEventListener('resize', resizeCanvas);

// Button listeners
document.getElementById('create-room-btn').addEventListener('click', handleCreateRoom);
document.getElementById('join-room-btn').addEventListener('click', handleJoinRoom);
document.getElementById('leave-room-btn').addEventListener('click', handleLeaveRoom);
document.getElementById('leave-room-gameover-btn').addEventListener('click', handleLeaveRoom);

// Start Game and Play Again buttons (Host Only actions)
document.getElementById('start-game-btn').addEventListener('click', () => {
    if (getIsHost() && getRoomCode()) {
        handleStartGame();
    }
});

document.getElementById('play-again-btn').addEventListener('click', () => {
    if (getIsHost() && getRoomCode()) {
        handlePlayAgain();
    }
});
