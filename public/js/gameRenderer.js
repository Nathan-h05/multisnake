// Canvas rendering logic for the multiplayer snake game
import { getGameState, getUserId } from './state.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

export function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    if (container) {
        const size = container.clientWidth;
        canvas.width = size; 
        canvas.height = size;
        const gameState = getGameState();
        if (gameState) drawGame();
    }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawApple(ctx, gridX, gridY, tileSize) {
    const cx = gridX * tileSize + tileSize / 2;
    const cy = gridY * tileSize + tileSize / 2;
    const radius = tileSize * 0.35;

    // Apple body
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Small highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = Math.max(2, tileSize * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy - radius - tileSize * 0.2);
    ctx.stroke();

    // Leaf
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(
        cx + tileSize * 0.12,
        cy - radius - tileSize * 0.1,
        tileSize * 0.12,
        tileSize * 0.2,
        -Math.PI / 4,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

export function drawGame() {
    const localGameState = getGameState();
    if (!localGameState) return;

    const { players, food, gridSize } = localGameState;
    const GRID_SIZE = gridSize;
    const tileSize = canvas.width / GRID_SIZE;

    if (tileSize <= 0 || !GRID_SIZE) {
        console.warn("Canvas size or Grid size is invalid. Cannot draw.");
        return;
    }

    // Clear canvas background
    ctx.fillStyle = '#020617'; // very dark background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Optional: faint grid for style
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'; // slate-400 with low opacity
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
        const pos = i * tileSize;
        // vertical
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, canvas.height);
        ctx.stroke();
        // horizontal
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(canvas.width, pos);
        ctx.stroke();
    }

    // Draw apple (fancy)
    drawApple(ctx, food.x, food.y, tileSize);

    // Draw snakes
    Object.values(players).forEach(p => {
        const isDead = !p.isAlive;

        // Make dead snakes more transparent
        ctx.globalAlpha = isDead ? 0.35 : 1.0;

        // Slight padding to make segments rounded & separated
        const segPadding = tileSize * 0.15;
        const segSize = tileSize - segPadding * 2;
        const radius = segSize * 0.4;

        p.snake.forEach((segment, index) => {
            const x = segment.x * tileSize + segPadding;
            const y = segment.y * tileSize + segPadding;

            // Body color
            ctx.fillStyle = p.color;

            // Draw rounded segment
            drawRoundedRect(ctx, x, y, segSize, segSize, radius);
            ctx.fill();

            // Head gets extra outline & eyes
            if (index === 0) {
                // White border
                ctx.lineWidth = Math.max(2, tileSize * 0.08);
                ctx.strokeStyle = isDead ? 'rgba(248,250,252,0.4)' : '#f9fafb';
                ctx.stroke();

                // Eyes
                const eyeOffsetX = segSize * 0.18;
                const eyeOffsetY = segSize * 0.18;
                const eyeRadius = segSize * 0.09;

                let eye1x = x + segSize / 2 - eyeOffsetX;
                let eye2x = x + segSize / 2 + eyeOffsetX;
                let eyeY = y + segSize / 2 - eyeOffsetY;

                ctx.fillStyle = isDead ? '#94a3b8' : '#0f172a';
                ctx.beginPath();
                ctx.arc(eye1x, eyeY, eyeRadius, 0, Math.PI * 2);
                ctx.arc(eye2x, eyeY, eyeRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // --- Draw Player Name Above Head ---
        const head = p.snake[0];
        if (head && p.name) {
            const nameX = head.x * tileSize + tileSize / 2;
            const nameY = head.y * tileSize - tileSize * 0.2;

            ctx.globalAlpha = isDead ? 0.5 : 0.9;
            ctx.font = `${Math.max(12, tileSize * 0.5)}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            // Shadow behind name for visibility
            ctx.fillStyle = 'rgba(15,23,42,0.8)';
            ctx.fillText(p.name, nameX + 1.5, nameY + 1.5);

            ctx.fillStyle = '#e5e7eb';
            ctx.fillText(p.name, nameX, nameY);
        }

        // Reset alpha for next player
        ctx.globalAlpha = 1.0;
    });
}
