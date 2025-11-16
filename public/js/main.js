// Main application entry point - wires all modules together
import { connectToServer, handleCreateRoom, handleJoinRoom, handleLeaveRoom, handleStartGame, handlePlayAgain } from './socketManager.js';
import { resizeCanvas } from './gameRenderer.js';
import { getIsHost, getRoomCode } from './state.js';

// === Leaderboard state ===
let leaderboardEntries = [];          // all entries with score >= 1
let leaderboardShowingAll = false;    // false = top 10, true = show all

const leaderboardSeeMoreBtn = document.getElementById('leaderboard-see-more');
const mainLeaderboardBody = document.getElementById('leaderboard-body-main');
const gameoverLeaderboardBody = document.getElementById('leaderboard-body-gameover');

// Helpers for sorting
function eScore(e) {
    return e.score ?? 0;
}
function eDuration(e) {
    return e.durationSeconds ?? Number.MAX_SAFE_INTEGER;
}

// Render leaderboard into BOTH tables (home + game over)
function renderLeaderboardTable() {
    const bodies = [mainLeaderboardBody, gameoverLeaderboardBody].filter(Boolean);

    bodies.forEach((tbody) => {
        tbody.innerHTML = '';

        if (!leaderboardEntries || leaderboardEntries.length === 0) {
            tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-2 text-center text-slate-400 text-xs">
            No finished games with score yet. Play to fill the leaderboard!
          </td>
        </tr>`;
            return;
        }

        const visible = leaderboardShowingAll
            ? leaderboardEntries
            : leaderboardEntries.slice(0, 10);

        visible.forEach((entry, index) => {
            const winnerName = entry.winnerName || 'Unknown';
            const score = entry.score ?? 0;

            const durationSeconds = entry.durationSeconds ?? 0;
            const minutes = Math.floor(durationSeconds / 60);
            const seconds = durationSeconds % 60;
            const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            const playerCount =
                entry.playerCount ??
                entry.playersCount ??
                entry.numPlayers ??
                '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td class="py-1 pr-2 text-slate-400">${index + 1}</td>
        <td class="py-1 pr-2 font-semibold text-slate-100">${winnerName}</td>
        <td class="py-1 pr-2">${score}</td>
        <td class="py-1 pr-2">${timeStr}</td>
        <td class="py-1 pr-2">${playerCount}</td>
      `;
            tbody.appendChild(tr);
        });
    });

    // Button state (only visible on home screen)
    if (leaderboardSeeMoreBtn) {
        if (leaderboardEntries.length > 10) {
            leaderboardSeeMoreBtn.classList.remove('hidden');
            leaderboardSeeMoreBtn.textContent = leaderboardShowingAll
                ? 'Show top 10'
                : 'See more';
        } else {
            leaderboardSeeMoreBtn.classList.add('hidden');
        }
    }
}

async function loadLeaderboard() {
    // We only rely on the main table to exist; game-over is optional
    if (!mainLeaderboardBody) return;

    mainLeaderboardBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-2 text-center text-slate-400 text-xs">
          Loading leaderboard...
        </td>
      </tr>`;

    try {
        const res = await fetch('/api/leaderboard');
        if (!res.ok) {
            console.error('HTTP error loading leaderboard:', res.status);
            mainLeaderboardBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-2 text-center text-slate-400 text-xs">
            Could not load leaderboard.
          </td>
        </tr>`;
            return;
        }

        const entries = (await res.json()) || [];

        // Keep only entries with score >= 1
        leaderboardEntries = entries
            .filter(e => (e.score ?? 0) > 0)
            .sort((a, b) => {
                const scoreA = eScore(a);
                const scoreB = eScore(b);
                if (scoreA !== scoreB) return scoreB - scoreA;

                const durA = eDuration(a);
                const durB = eDuration(b);
                return durA - durB;
            });

        leaderboardShowingAll = false; // reset to top 10
        renderLeaderboardTable();
    } catch (err) {
        console.error('Failed to load leaderboard:', err);
        mainLeaderboardBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-2 text-center text-slate-400 text-xs">
          Error loading leaderboard.
        </td>
      </tr>`;
    }
}


// --- Initialization and Event Listeners ---

window.addEventListener('load', () => {
    connectToServer();
    resizeCanvas();
    loadLeaderboard();
});

// Toggle between top 10 and all results (score >= 1)
if (leaderboardSeeMoreBtn) {
    leaderboardSeeMoreBtn.addEventListener('click', () => {
        leaderboardShowingAll = !leaderboardShowingAll;
        renderLeaderboardTable();
    });
}

// Refresh leaderboard each time a game finishes
window.addEventListener('game-finished', () => {
    loadLeaderboard();
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
