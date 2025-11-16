// Food generation and collection logic

/**
 * Generate a single food item at random position
 */
function generateFood(gridSize) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);

    const r = Math.random();
    let type = 'normal';
    let grow = true;      // whether eating this increases snake length
    let score = 1;        // how many points

    return { x, y, type, grow, score };
}

/**
 * Calculate how many apples should be on the map based on setting
 */
function calculateAppleCount(setting, playerCount) {
    switch (setting) {
        case 'EQUAL':
            return playerCount;
        case 'HALF':
            return Math.max(1, Math.floor(playerCount / 2));
        default:
            // Fixed number (1, 2, 3, or 4)
            return parseInt(setting) || 1;
    }
}

/**
 * Generate multiple food items without overlap with snakes or existing food
 */
function generateMultipleFood(gridSize, count, players, existingFood = []) {
    const foodArray = [...existingFood];
    let attempts = 0;
    const maxAttempts = 100;

    while (foodArray.length < count && attempts < maxAttempts) {
        const newFood = generateFood(gridSize);
        let overlap = false;

        // Check overlap with existing food
        for (const food of foodArray) {
            if (food.x === newFood.x && food.y === newFood.y) {
                overlap = true;
                break;
            }
        }

        // Check overlap with snake segments
        if (!overlap) {
            for (const player of Object.values(players)) {
                for (const segment of player.snake) {
                    if (segment.x === newFood.x && segment.y === newFood.y) {
                        overlap = true;
                        break;
                    }
                }
                if (overlap) break;
            }
        }

        if (!overlap) {
            foodArray.push(newFood);
        }
        attempts++;
    }

    return foodArray;
}

/**
 * Check if a head position collides with any food in the array
 * Returns the index of the collected food, or -1 if none
 */
function checkFood(head, state) {
    // Check if head collides with any food in the array
    for (let i = 0; i < state.food.length; i++) {
        if (head.x === state.food[i].x && head.y === state.food[i].y) {
            return i; // Return the index of the collected food
        }
    }
    return -1; // No food collected
}

module.exports = {
    generateFood,
    calculateAppleCount,
    generateMultipleFood,
    checkFood,
};
