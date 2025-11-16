// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve the /public folder
app.use(express.static("public"));

const GRID_W = 40;
const GRID_H = 30;
const TICK_MS = 100; // 10 FPS

let players = {}; // socketId -> player
let snacks = [];

// ---------- helpers ----------
function allPlayers() {
    return Object.values(players);
}

function randomEmptyCell() {
    return {
        x: Math.floor(Math.random() * GRID_W),
        y: Math.floor(Math.random() * GRID_H),
    };
}

function spawnSnack() {
    snacks.push(randomEmptyCell());
}

// ---------- game logic ----------
function moveAllSnakes() {
    for (const p of allPlayers()) {
        if (!p.alive) continue;

        const head = p.snake[0];
        const dir = p.direction;
        const newHead = { x: head.x + dir.x, y: head.y + dir.y };

        // add new head at the front
        p.snake.unshift(newHead);
        // tail removal is handled later in handleSnacksAndTail()
    }
}

function handleWallAndSelf(p) {
    if (!p.alive) return;

    const [head, ...body] = p.snake;

    // wall collision (no wrap)
    if (head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H) {
        p.alive = false;
        return;
    }

    // self collision
    const hitSelf = body.some(seg => seg.x === head.x && seg.y === head.y);
    if (hitSelf) {
        p.alive = false;
    }
}

// head-on-head: if 2+ heads end in same cell → all those players die
function handleHeadOnHead() {
    const alive = allPlayers().filter(p => p.alive);
    const positions = {};

    for (const p of alive) {
        const h = p.snake[0];
        if (!h) continue;
        const key = `${h.x},${h.y}`;
        if (!positions[key]) positions[key] = [];
        positions[key].push(p);
    }

    for (const key in positions) {
        const list = positions[key];
        if (list.length > 1) {
            list.forEach(p => (p.alive = false));
        }
    }
}

// your special rule: if attacker head hits ANY part of another snake → attacker dies
function handleSnakeVsSnake() {
    const alive = allPlayers().filter(p => p.alive);

    for (const attacker of alive) {
        if (!attacker.alive) continue;
        const head = attacker.snake[0];
        if (!head) continue;

        for (const victim of alive) {
            if (attacker.id === victim.id) continue; // skip self

            const hit = victim.snake.some(
                seg => seg.x === head.x && seg.y === head.y
            );
            if (hit) {
                attacker.alive = false; // attacker eliminated
                // optional: reward victim
                // victim.score += 2;
                break;
            }
        }
    }
}

// snacks + tail handling (grow or move normally)
function handleSnacksAndTail(p) {
    if (!p.alive) return;

    const head = p.snake[0];
    if (!head) return;

    const idx = snacks.findIndex(s => s.x === head.x && s.y === head.y);

    if (idx !== -1) {
        // ate snack → grow (keep tail)
        p.score += 1;
        snacks.splice(idx, 1);
        spawnSnack();
    } else {
        // normal move → remove tail segment
        p.snake.pop();
    }
}

// ---------- sockets ----------
io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    // random starting position
    const start = randomEmptyCell();
    const baseX = Math.max(start.x, 2); // so body not negative

    players[socket.id] = {
        id: socket.id,
        name: "P-" + socket.id.slice(0, 4),
        snake: [
            { x: baseX, y: start.y }, // head
            { x: baseX - 1, y: start.y },
            { x: baseX - 2, y: start.y },
        ],
        direction: { x: 1, y: 0 }, // moving right
        alive: true,
        score: 0,
    };

    // change direction from client
    socket.on("changeDirection", (dir) => {
        const p = players[socket.id];
        if (!p || !p.alive) return;

        const curr = p.direction;
        // prevent direct reverse
        if (curr.x + dir.x === 0 && curr.y + dir.y === 0) return;

        p.direction = dir;
    });

    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);
        delete players[socket.id];
    });
});

// initialize some snacks
for (let i = 0; i < 3; i++) spawnSnack();

// ---------- game loop ----------
setInterval(() => {
    const currentPlayers = allPlayers();
    if (currentPlayers.length === 0) return;

    // 1) move snakes
    moveAllSnakes();

    // 2) wall + self collision
    for (const p of currentPlayers) {
        handleWallAndSelf(p);
    }

    // 3) head-on-head
    handleHeadOnHead();

    // 4) snake vs snake (attacker dies)
    handleSnakeVsSnake();

    // 5) snacks + tail trimming
    for (const p of currentPlayers) {
        handleSnacksAndTail(p);
    }

    // 6) broadcast the state
    io.emit("state", {
        grid: { w: GRID_W, h: GRID_H },
        players,
        snacks,
    });
}, TICK_MS);

// ---------- start server ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
