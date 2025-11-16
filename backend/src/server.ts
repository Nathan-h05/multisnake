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

    socket.on("ping", () => {
        console.log("Received ping from client");
        socket.emit("pong");
    });
});


const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on :${PORT}`);
});
