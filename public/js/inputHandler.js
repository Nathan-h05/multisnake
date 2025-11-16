// Keyboard input handling for game controls
import { getGameState, getUserId, getLastDirectionSent, setLastDirectionSent, getSocket, getRoomCode } from './state.js';

function handleKeydown(e) {
    const localGameState = getGameState();
    const userId = getUserId();
    
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

    const lastDirectionSent = getLastDirectionSent();
    // Only send if the direction has changed and is valid
    if (newDir && (lastDirectionSent === null || newDir.x !== lastDirectionSent.x || newDir.y !== lastDirectionSent.y)) {
        setLastDirectionSent(newDir);
        const socket = getSocket();
        const roomCode = getRoomCode();
        socket.emit('directionUpdate', { roomCode: roomCode, direction: newDir });
    }
}

export function addInputListeners() {
    document.removeEventListener('keydown', handleKeydown);
    document.addEventListener('keydown', handleKeydown);
}
