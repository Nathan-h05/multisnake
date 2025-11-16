// New modular server: express + socket handlers
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const express = require('express');

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
const server = http.createServer(app);
const io = new Server(server);

// Serve index.html explicitly
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// Initialize socket handlers (delegates to backend/socketHandlers.js)
const { initSocket } = require('./socketHandlers');
initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
