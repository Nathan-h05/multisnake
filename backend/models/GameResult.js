// backend/models/GameResult.js
const mongoose = require('mongoose');

const gameResultSchema = new mongoose.Schema({
    winnerName: { type: String, required: true },
    score: { type: Number, required: true },
    durationSeconds: { type: Number, required: true }, // how long the game actually lasted
    playersCount: { type: Number, required: true }, // number of players in that game
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('GameResult', gameResultSchema);
