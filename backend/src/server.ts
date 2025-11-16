import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",   // good for hackathon
        methods: ["GET", "POST"]
    }

});

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);
    // Keep a simple in-memory map of player states
    // Players will send their local snake positions to the server and the server will broadcast
    // the aggregated player list to all clients. This is a simple sync for hackathon use.
    socket.on("state", (state) => {
        // attach id so clients can distinguish
        (io as any).players = (io as any).players || {};
        (io as any).players[socket.id] = { id: socket.id, ...state };
        // broadcast updated players to everyone
        io.emit("players", (io as any).players);
    });

    socket.on("ping", () => {
        console.log("Received ping from client");
        socket.emit("pong");
    });

    socket.on("disconnect", () => {
        // remove player and notify others
        (io as any).players = (io as any).players || {};
        delete (io as any).players[socket.id];
        io.emit("players", (io as any).players);
        console.log("A player disconnected:", socket.id);
    });
});


const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on :${PORT}`);
});
