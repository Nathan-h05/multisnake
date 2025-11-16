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

function drawPowerup(ctx, powerup, tileSize) {
    const cx = powerup.x * tileSize + tileSize / 2;
    const cy = powerup.y * tileSize + tileSize / 2;
    const radius = tileSize * 0.4;

    if (powerup.type === 'invincible') {
        // Gold glowing circle
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
        gradient.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
        gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.4)');
        gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Star shape
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(cx - radius * 0.2, cy - radius * 0.2, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

    } else if (powerup.type === 'speed_boost') {
        // Blue glowing circle
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Lightning bolt
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        const boltWidth = radius * 0.8;
        const boltHeight = radius * 1.4;
        ctx.moveTo(cx + boltWidth * 0.1, cy - boltHeight * 0.5);
        ctx.lineTo(cx - boltWidth * 0.3, cy);
        ctx.lineTo(cx + boltWidth * 0.1, cy);
        ctx.lineTo(cx - boltWidth * 0.1, cy + boltHeight * 0.5);
        ctx.lineTo(cx + boltWidth * 0.3, cy);
        ctx.lineTo(cx - boltWidth * 0.1, cy);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(cx - radius * 0.2, cy - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }
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

    // Draw powerups
    if (localGameState.powerups && Array.isArray(localGameState.powerups)) {
        localGameState.powerups.forEach(powerup => {
            drawPowerup(ctx, powerup, tileSize);
        });
    }

    // Draw snakes
    Object.values(players).forEach(p => {
        const isDead = !p.isAlive;

        // Check for active powerups
        const hasInvincible = p.activePowerups && p.activePowerups.some(pu => pu.type === 'invincible');
        const hasSpeedBoost = p.activePowerups && p.activePowerups.some(pu => pu.type === 'speed_boost');

        // Make dead snakes more transparent
        ctx.globalAlpha = isDead ? 0.35 : 1.0;

        // Draw powerup glow around entire snake if active
        if (!isDead && (hasInvincible || hasSpeedBoost)) {
            const head = p.snake[0];
            const glowColor = hasInvincible ? 'rgba(251, 191, 36, 0.4)' : 'rgba(59, 130, 246, 0.4)';
            const glowRadius = tileSize * 0.8;
            
            const gradient = ctx.createRadialGradient(
                head.x * tileSize + tileSize / 2,
                head.y * tileSize + tileSize / 2,
                0,
                head.x * tileSize + tileSize / 2,
                head.y * tileSize + tileSize / 2,
                glowRadius
            );
            gradient.addColorStop(0, glowColor);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(
                head.x * tileSize + tileSize / 2,
                head.y * tileSize + tileSize / 2,
                glowRadius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

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
            let nameY = head.y * tileSize - tileSize * 0.2;

            ctx.globalAlpha = isDead ? 0.5 : 0.9;
            ctx.font = `${Math.max(12, tileSize * 0.5)}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            // Shadow behind name for visibility
            ctx.fillStyle = 'rgba(15,23,42,0.8)';
            ctx.fillText(p.name, nameX + 1.5, nameY + 1.5);

            ctx.fillStyle = '#e5e7eb';
            ctx.fillText(p.name, nameX, nameY);

            // Draw powerup icon(s) above name
            if (!isDead && (hasInvincible || hasSpeedBoost)) {
                const iconSize = Math.max(16, tileSize * 0.6);
                const iconY = nameY - iconSize * 0.8;
                ctx.font = `${iconSize}px Inter`;
                ctx.textBaseline = 'middle';
                
                if (hasInvincible && hasSpeedBoost) {
                    // Both powerups - draw side by side
                    ctx.fillText('⭐', nameX - iconSize * 0.6, iconY);
                    ctx.fillText('⚡', nameX + iconSize * 0.6, iconY);
                } else if (hasInvincible) {
                    ctx.fillText('⭐', nameX, iconY);
                } else if (hasSpeedBoost) {
                    ctx.fillText('⚡', nameX, iconY);
                }
            }
        }

        // Reset alpha for next player
        ctx.globalAlpha = 1.0;
    });
}
