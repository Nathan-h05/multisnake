// Powerup management system for multiplayer snake game

// Powerup types configuration
const POWERUP_TYPES = {
    INVINCIBLE: {
        id: 'invincible',
        name: 'Invincible',
        duration: 6000, // 6 seconds
        color: '#fbbf24', // amber/gold
        emoji: '⭐',
        spawnWeight: 1 // relative spawn probability
    },
    SPEED_BOOST: {
        id: 'speed_boost',
        name: 'Speed Boost',
        duration: 6000, 
        color: '#3b82f6', // blue
        emoji: '⚡',
        spawnWeight: 1
    },
    MULTIPLIER: {
        id: 'multiplier',
        name: '2x Points',
        duration: 6000, 
        color: '#10b981', // emerald green
        emoji: '💎',
        spawnWeight: 1
    },
    FREEZE: {
        id: 'freeze',
        name: 'Freeze Others',
        duration: 4000, 
        color: '#0ea5e9', // sky blue
        emoji: '❄️',
        spawnWeight: 1
    }
};

// Powerup spawn configuration
const POWERUP_CONFIG = {
    spawnChance: 0.90, // 15% chance per food eaten
    maxActivePowerups: 2, // max powerups on map at once
    minSpawnInterval: 5000, // minimum 1 second between spawns
};

// Active powerups in each game room
const activePowerups = {}; // roomCode -> { powerups: [...], lastSpawnTime: timestamp }

/**
 * Initialize powerup state for a room
 */
function initPowerupsForRoom(roomCode) {
    activePowerups[roomCode] = {
        powerups: [],
        lastSpawnTime: 0
    };
}

/**
 * Clean up powerup state when room is deleted
 */
function cleanupPowerupsForRoom(roomCode) {
    delete activePowerups[roomCode];
}

/**
 * Generate a random powerup position that doesn't overlap with snakes or food
 */
function generatePowerupPosition(gridSize, players, food, existingPowerups) {
    let position;
    let overlap;
    let attempts = 0;
    const maxAttempts = 100;

    do {
        overlap = false;
        position = {
            x: Math.floor(Math.random() * gridSize),
            y: Math.floor(Math.random() * gridSize)
        };

        // Check food overlap
        if (position.x === food.x && position.y === food.y) {
            overlap = true;
            continue;
        }

        // Check existing powerups overlap
        for (const powerup of existingPowerups) {
            if (position.x === powerup.x && position.y === powerup.y) {
                overlap = true;
                break;
            }
        }
        if (overlap) continue;

        // Check snake overlap
        for (const player of Object.values(players)) {
            for (const segment of player.snake) {
                if (position.x === segment.x && position.y === segment.y) {
                    overlap = true;
                    break;
                }
            }
            if (overlap) break;
        }

        attempts++;
    } while (overlap && attempts < maxAttempts);

    return overlap ? null : position;
}

/**
 * Select a random powerup type based on spawn weights
 */
function selectRandomPowerupType() {
    const types = Object.values(POWERUP_TYPES);
    const totalWeight = types.reduce((sum, type) => sum + type.spawnWeight, 0);
    let random = Math.random() * totalWeight;

    for (const type of types) {
        random -= type.spawnWeight;
        if (random <= 0) {
            return type;
        }
    }
    return types[0]; // fallback
}

/**
 * Attempt to spawn a powerup (called when food is eaten)
 */
function trySpawnPowerup(roomCode, gridSize, players, food) {
    const roomPowerups = activePowerups[roomCode];
    if (!roomPowerups) return null;

    const now = Date.now();
    const timeSinceLastSpawn = now - roomPowerups.lastSpawnTime;

    // Check spawn conditions
    if (roomPowerups.powerups.length >= POWERUP_CONFIG.maxActivePowerups) return null;
    if (timeSinceLastSpawn < POWERUP_CONFIG.minSpawnInterval) return null;
    if (Math.random() > POWERUP_CONFIG.spawnChance) return null;

    // Generate powerup
    const position = generatePowerupPosition(gridSize, players, food, roomPowerups.powerups);
    if (!position) return null;

    const type = selectRandomPowerupType();
    const powerup = {
        id: `${type.id}_${now}_${Math.random()}`,
        type: type.id,
        x: position.x,
        y: position.y,
        spawnTime: now,
        ...type // include color, emoji, name for client rendering
    };

    roomPowerups.powerups.push(powerup);
    roomPowerups.lastSpawnTime = now;

    console.log(`[POWERUP] Spawned ${type.name} at (${position.x}, ${position.y}) in room ${roomCode}`);
    return powerup;
}

/**
 * Check if a player's head collects a powerup
 */
function checkPowerupCollection(head, roomCode) {
    const roomPowerups = activePowerups[roomCode];
    if (!roomPowerups) return null;

    const collectedIndex = roomPowerups.powerups.findIndex(
        p => p.x === head.x && p.y === head.y
    );

    if (collectedIndex === -1) return null;

    const collected = roomPowerups.powerups.splice(collectedIndex, 1)[0];
    console.log(`[POWERUP] Player collected ${collected.name} in room ${roomCode}`);
    return collected;
}

/**
 * Apply a powerup effect to a player
 */
function applyPowerupToPlayer(player, powerupType) {
    const now = Date.now();
    const type = POWERUP_TYPES[powerupType.toUpperCase()];
    if (!type) return;

    if (!player.activePowerups) {
        player.activePowerups = [];
    }

    const effect = {
        type: type.id,
        startTime: now,
        endTime: now + type.duration,
        duration: type.duration
    };

    player.activePowerups.push(effect);
    console.log(`[POWERUP] Applied ${type.name} to player ${player.socketId} for ${type.duration}ms`);
}

/**
 * Update and remove expired powerup effects from players
 */
function cleanupPlayerEffects(players) {
    const now = Date.now();

    for (const player of Object.values(players)) {
        if (player.activePowerups) {
            const before = player.activePowerups.length;
            player.activePowerups = player.activePowerups.filter(effect => effect.endTime > now);
            if (player.activePowerups.length < before) {
                console.log(`[POWERUP] Expired effects removed from ${player.socketId.substring(0,5)}`);
            }
        }
        if (player.frozenUntil && player.frozenUntil <= now) {
            delete player.frozenUntil;
            console.log(`[FREEZE] ${player.socketId.substring(0,5)} thawed`);
        }
    }
}

/**
 * Check if a player has a specific active powerup
 */
function hasActivePowerup(player, powerupType) {
    if (!player.activePowerups || player.activePowerups.length === 0) return false;
    return player.activePowerups.some(effect => effect.type === powerupType);
}

/**
 * Get all active powerups on the map for a room
 */
function getActivePowerups(roomCode) {
    const roomPowerups = activePowerups[roomCode];
    return roomPowerups ? roomPowerups.powerups : [];
}

module.exports = {
    POWERUP_TYPES,
    initPowerupsForRoom,
    cleanupPowerupsForRoom,
    trySpawnPowerup,
    checkPowerupCollection,
    applyPowerupToPlayer,
    cleanupPlayerEffects,
    hasActivePowerup,
    getActivePowerups
};
