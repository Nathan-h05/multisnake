// UI management for screens, toasts, scoreboards, and player lists
import { getUserId, getGameState, getRoomCode, getTimerIntervalId, setTimerIntervalId } from './state.js';

function getPowerupHtml(player) {
    if (!player.activePowerups || player.activePowerups.length === 0) return '';
    return player.activePowerups.map(effect => {
        switch (effect.type) {
            case 'invincible':
                return '<span class="text-yellow-400 text-xl ml-1 animate-pulse">⭐</span>';
            case 'speed_boost':
                return '<span class="text-blue-400 text-xl ml-1 animate-pulse">⚡</span>';
            default:
                return '';
        }
    }).join('');
}

// Screen elements
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

// UI element refs
const roomCodeDisplay = document.getElementById('room-code-display');
const playerList = document.getElementById('player-list');
const scoreBoard = document.getElementById('score-board');
const finalScores = document.getElementById('final-scores');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const startGameBtn = document.getElementById('start-game-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const timerDisplay = document.getElementById('timer-display');

export function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    if (screens[screenId]) {
        screens[screenId].classList.remove('hidden');
    }
}

export function showError(message) {
    console.error("Error:", message);
    errorMessage.textContent = message;
    errorToast.classList.remove('opacity-0', 'translate-y-4');
    setTimeout(() => {
        errorToast.classList.add('opacity-0', 'translate-y-4');
    }, 3000);
}

export function updateWaitingRoomUI(players, hostId) {
    playerList.innerHTML = '';
    const playerArray = Object.values(players);
    const userId = getUserId();
    
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
    
    // Show Start Game button only if host and at least one player
    if (userId === hostId && playerArray.length >= 1) { 
        startGameBtn.classList.remove('hidden');
    } else {
        startGameBtn.classList.add('hidden');
    }
    
    roomCodeDisplay.textContent = getRoomCode();
}

export function updateScoreboard(players) {
    scoreBoard.innerHTML = '';
    const userId = getUserId();
    
    const sortedPlayers = Object.values(players).sort((a, b) => {
        if (a.isAlive !== b.isAlive) {
            return a.isAlive ? -1 : 1; 
        }
        return b.score - a.score;
    });

    sortedPlayers.forEach(p => {
        const isMe = p.socketId === userId;
        const scoreEl = document.createElement('div');
        scoreEl.className = 'flex items-center text-lg font-bold justify-between';
        
        let colorClass = '';
        let statusText = '';
        
        if (!p.isAlive) {
            scoreEl.classList.add('line-through', 'opacity-50', 'text-gray-400');
            statusText = '(DEAD)';
        } else if (isMe) {
            colorClass = 'text-green-400';
            statusText = '(You)';
        }
        
        const powerupHtml = getPowerupHtml(p);
        
        scoreEl.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="player-color-dot" style="background-color: ${p.color}"></span>
                <span class="${colorClass}">${p.name} ${statusText}</span>
                ${powerupHtml}
            </div>
            <span>${p.score}</span>
        `;
        scoreBoard.appendChild(scoreEl);
    });
}

export function updateFinalScores(players) {
    const localGameState = getGameState();
    if (!localGameState || localGameState.gameState !== 'gameover') return;

    finalScores.innerHTML = '';
    const userId = getUserId();
    
    // Determine the winner among ALIVE players
    const alivePlayers = Object.values(players).filter(p => p.isAlive);
    alivePlayers.sort((a, b) => b.score - a.score);
    const winnerId = alivePlayers.length > 0 ? alivePlayers[0].socketId : null;

    // Sort all players: Alive first, then score
    const sortedPlayers = Object.values(players).sort((a, b) => {
        if (a.isAlive !== b.isAlive) {
            return a.isAlive ? -1 : 1; 
        }
        return b.score - a.score;
    });

    // Render the sorted list
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
            colorClass = 'text-gray-500';
        } else if (isMe) {
            statusText = '(You)';
            colorClass = 'text-blue-400';
        }
        
        const powerupHtml = getPowerupHtml(p);
    
        const scoreEl = document.createElement('div');
        scoreEl.className = `flex items-center text-lg justify-between p-2 rounded-lg ${!p.isAlive ? 'line-through opacity-70' : 'bg-slate-700/50'}`;
        
        scoreEl.innerHTML = `
            <div class="flex items-center">
                <span class="player-color-dot" style="background-color: ${p.color}"></span>
                <span class="font-medium ${colorClass}">${p.name} ${statusText}</span>
                ${powerupHtml}
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

// Timer helpers
function formatTimeSeconds(sec) {
    if (sec <= 0) return '00:00';
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

export function startClientTimer(endTime) {
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
    const intervalId = setInterval(tick, 1000);
    setTimerIntervalId(intervalId);
}

export function clearClientTimer() {
    const intervalId = getTimerIntervalId();
    if (intervalId) {
        clearInterval(intervalId);
        setTimerIntervalId(null);
    }
}
