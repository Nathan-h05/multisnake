// New modular server: express + socket handlers
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const express = require('express');
const mongoose = require('mongoose');
const GameResult = require('./models/GameResult');

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
const server = http.createServer(app);
const io = new Server(server);


// MongoDB connection
const MONGO_URI = process.env.MONGO_URI ||
    'mongodb+srv://ubc_hackathon_multisnake:dyZR5IcBKYTXL6M5@cluster0.xvu2dno.mongodb.net/';


mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));


// Serve index.html explicitly
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
// Public API to get leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const results = await GameResult
            .find({})
            .sort({ score: -1, createdAt: -1 }) // highest score first, then newest
            .limit(20)
            .lean();

        res.json(results);
    } catch (err) {
        console.error('Failed to load leaderboard:', err);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// Initialize socket handlers (delegates to backend/socketHandlers.js)
const { initSocket } = require('./socketHandlers');
initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
