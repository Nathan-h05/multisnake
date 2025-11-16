// Collision detection logic with powerup integration

const { hasActivePowerup } = require('../powerupManager');
const { checkFood } = require('./foodManager');

/**
 * Check if a head position collides with any snake body segment
 * POWERUP: Invincible players pass through all bodies
 */
function checkBodyCollision(head, state) {
    const { players } = state;
    const attackingPlayer = players[head.socketId];
    
    // Invincible players pass through all bodies
    if (attackingPlayer && hasActivePowerup(attackingPlayer, 'invincible')) {
        return false;
    }
    
    // Check against ALL snake bodies
    for (const playerId of Object.keys(players)) {
        const otherSnake = players[playerId].snake;
        // Skip collision against dead snakes
        if (!players[playerId].isAlive) continue; 
        
        // Loop over all segments of the other snake
        for (let i = 0; i < otherSnake.length; i++) {
            // Self-collision: skip the current tail and the current head
            if (playerId === head.socketId && i > 0 && i === otherSnake.length - 1 && checkFood(head, state) === -1) {
                // Skip the tail segment if the snake is NOT growing (not eating food)
                continue;
            }
            if (playerId === head.socketId && i === 0) {
                // Skip the current head segment
                continue;
            }

            // Standard segment collision
            if (head.x === otherSnake[i].x && head.y === otherSnake[i].y) return true;
        }
    }
    return false;
}

/**
 * Detect all fatal collisions based on pre-calculated nextHead positions
 * Returns a Set of socketIds that must die this tick
 * POWERUP: Invincible players survive all collisions
 */
function detectFatalCollisions(state) {
    const fatalities = new Set();
    const activePlayerHeads = Object.values(state.players)
        .filter(p => p.isAlive && p.nextHead)
        .map(p => p.nextHead);
    
    // --- 1. Check Head-to-Head Collisions ---
    const headCounts = {};
    activePlayerHeads.forEach(head => {
        const posKey = `${head.x},${head.y}`;
        headCounts[posKey] = headCounts[posKey] || [];
        headCounts[posKey].push(head.socketId);
    });

    // If more than one head lands on the same tile, check invincibility
    Object.values(headCounts).forEach(socketIds => {
        if (socketIds.length > 1) {
            // Find invincible players in this collision
            const invincibleIds = socketIds.filter(id => hasActivePowerup(state.players[id], 'invincible'));
            
            if (invincibleIds.length > 0) {
                // Invincible players survive, others die
                socketIds.forEach(id => {
                    if (!invincibleIds.includes(id)) {
                        fatalities.add(id);
                    }
                });
            } else {
                // No invincible players - all die
                socketIds.forEach(id => fatalities.add(id));
            }
        }
    });

    // --- 2. Check Head-to-Body/Wall Collisions ---
    activePlayerHeads.forEach(head => {
        const attackingPlayer = state.players[head.socketId];
        
        // Invincible players ignore boundaries
        if (!hasActivePowerup(attackingPlayer, 'invincible')) {
            // Check map boundaries
            if (head.x < 0 || head.x >= state.gridSize || head.y < 0 || head.y >= state.gridSize) {
                fatalities.add(head.socketId);
                return;
            }
        }
        
        // Check collision against all snake bodies
        // checkBodyCollision already handles invincible attacker logic
        if (checkBodyCollision(head, state)) {
            fatalities.add(head.socketId);
        }
    });
    
    return fatalities;
}

module.exports = {
    checkBodyCollision,
    detectFatalCollisions,
};
