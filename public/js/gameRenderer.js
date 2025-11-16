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

    // Common: Pulsing glow + scale
    const pulse = 1 + 0.15 * Math.sin(Date.now() / 400);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

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
    } else if (powerup.type === 'multiplier') {
        // Green GEM (diamond + shine)
        ctx.fillStyle = powerup.color;
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.9);
        ctx.lineTo(radius * 0.7, 0);
        ctx.lineTo(0, radius * 0.9);
        ctx.lineTo(-radius * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Shine
        const grad = ctx.createRadialGradient(-radius * 0.25, -radius * 0.35, 0, -radius * 0.15, -radius * 0.2, radius * 0.4);
        grad.addColorStop(0, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(-radius * 0.25, -radius * 0.35, radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
    } else if (powerup.type === 'freeze') {
        // Snowflake (6 arms + branches)
        ctx.strokeStyle = powerup.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const arms = 6, armLen = radius * 0.85;
        for (let i = 0; i < arms; i++) {
            ctx.save();
            ctx.rotate(i * Math.PI / 3);
            // Main arm
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, armLen);
            ctx.stroke();
            // Branches
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(0, armLen * 0.3);
            ctx.lineTo(-armLen * 0.18, armLen * 0.15);
            ctx.moveTo(0, armLen * 0.3);
            ctx.lineTo(armLen * 0.18, armLen * 0.15);
            ctx.moveTo(0, armLen * 0.7);
            ctx.lineTo(-armLen * 0.12, armLen * 0.85);
            ctx.moveTo(0, armLen * 0.7);
            ctx.lineTo(armLen * 0.12, armLen * 0.85);
            ctx.stroke();
            ctx.restore();
        }
        // Center
        ctx.fillStyle = powerup.color;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
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

        // Explicitly compute active powerups (with time check for safety)
        const now = Date.now();
        const hasInvincible = p.activePowerups?.some(effect => effect.type === 'invincible' && effect.endTime > now) || false;
        const hasSpeedBoost = p.activePowerups?.some(effect => effect.type === 'speed_boost' && effect.endTime > now) || false;
        const isFrozen = p.frozenUntil && p.frozenUntil > now;
        let glowRgb = null;
        const glowTypes = {
            invincible: [251, 191, 36],
            speed_boost: [59, 130, 246],
            multiplier: [16, 185, 129],
            freeze: [14, 165, 233]
        };
        for (const effect of (p.activePowerups || [])) {
            if (effect.endTime > now && glowTypes[effect.type]) {
                glowRgb = glowTypes[effect.type];
                break;
            }
        }

        // Enhanced glow (if any active)
        if (!isDead && glowRgb) {
            const head = p.snake[0];
            const hcx = head.x * tileSize + tileSize / 2;
            const hcy = head.y * tileSize + tileSize / 2;
            const pulseAlpha = 0.3 + 0.4 * (Math.sin(now / 250) * 0.5 + 0.5);

            // Inner core
            ctx.fillStyle = `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},0.85)`;
            ctx.beginPath();
            ctx.arc(hcx, hcy, tileSize * 0.55, 0, Math.PI * 2);
            ctx.fill();

            // Pulsing outer
            const grad = ctx.createRadialGradient(hcx, hcy, 0, hcx, hcy, tileSize * 1.9);
            grad.addColorStop(0, `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},${pulseAlpha})`);
            grad.addColorStop(0.5, `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},${pulseAlpha * 0.5})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(hcx, hcy, tileSize * 1.9, 0, Math.PI * 2);
            ctx.fill();
        }

        // Snake segments + frozen effects

        // Slight padding to make segments rounded & separated
        const segPadding = tileSize * 0.15;
        const segSize = tileSize - segPadding * 2;
        const radius = segSize * 0.4;

        p.snake.forEach((segment, index) => {
            let x = segment.x * tileSize + segPadding;
            let y = segment.y * tileSize + segPadding;

            // FROZEN HEAD JITTER (visual only)
            if (isFrozen && index === 0) {
                const jitterSeed = parseInt(p.id, 36) || 0;
                const time = now / 120;
                x += Math.sin(time * 4.7 + jitterSeed) * 1.8;
                y += Math.cos(time * 5.3 + jitterSeed) * 1.8;
            }

            ctx.fillStyle = p.color;
            drawRoundedRect(ctx, x, y, segSize, segSize, radius);
            ctx.fill();

            // FROZEN: Frost tint overlay per segment
            if (isFrozen) {
                const frostGrad = ctx.createLinearGradient(x, y, x + segSize, y + segSize);
                frostGrad.addColorStop(0, 'rgba(0,0,0,0)');
                frostGrad.addColorStop(1, 'rgba(147, 197, 253, 0.35)');
                ctx.fillStyle = frostGrad;
                drawRoundedRect(ctx, x + 1, y + 1, segSize - 2, segSize - 2, radius - 0.5);
                ctx.fill();
            }

            // Head extras (eyes, outline) + FROZEN CRYSTALS
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

                // FROZEN: Ice shards on head
                if (isFrozen) {
                    const hcx = x + segSize / 2;
                    const hcy = y + segSize / 2;
                    ctx.fillStyle = '#e0f2fe';
                    ctx.strokeStyle = '#0ea5e9';
                    ctx.lineWidth = 1.2;
                    ctx.lineJoin = 'round';
                    const shardLen = 7;
                    for (let i = 0; i < 6; i++) {
                        ctx.save();
                        ctx.translate(hcx, hcy);
                        ctx.rotate(i * Math.PI / 3);
                        ctx.beginPath();
                        ctx.moveTo(shardLen * 0.3, 0);
                        ctx.lineTo(0, -shardLen);
                        ctx.lineTo(-shardLen * 0.3, 0);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                        ctx.restore();
                    }
                }
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
