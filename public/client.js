// public/client.js
const socket = io();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let state = null;
const CELL_SIZE = 20;

// simple color palette for players
const COLORS = ["#00ff00", "#00ffff", "#ff00ff", "#ff0000", "#0000ff", "#ffa500"];

function getColorForPlayer(id) {
    // stable color based on socket id
    let sum = 0;
    for (let i = 0; i < id.length; i++) {
        sum += id.charCodeAt(i);
    }
    return COLORS[sum % COLORS.length];
}

// listen to state updates from server
socket.on("state", (s) => {
    state = s;
});

// keyboard controls
window.addEventListener("keydown", (e) => {
    let dir = null;
    if (e.key === "ArrowUp") dir = { x: 0, y: -1 };
    if (e.key === "ArrowDown") dir = { x: 0, y: 1 };
    if (e.key === "ArrowLeft") dir = { x: -1, y: 0 };
    if (e.key === "ArrowRight") dir = { x: 1, y: 0 };

    if (dir) {
        socket.emit("changeDirection", dir);
    }
});

function draw() {
    requestAnimationFrame(draw);
    if (!state) return;

    const { grid, players, snacks } = state;

    const w = grid.w * CELL_SIZE;
    const h = grid.h * CELL_SIZE;
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }

    // clear background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw snacks
    ctx.fillStyle = "#ffff00";
    snacks.forEach(s => {
        ctx.fillRect(
            s.x * CELL_SIZE,
            s.y * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE
        );
    });

    // draw snakes
    Object.values(players).forEach((p) => {
        const color = p.alive ? getColorForPlayer(p.id) : "#555555";
        ctx.fillStyle = color;

        p.snake.forEach(seg => {
            ctx.fillRect(
                seg.x * CELL_SIZE,
                seg.y * CELL_SIZE,
                CELL_SIZE,
                CELL_SIZE
            );
        });

        // player name + score near head
        const head = p.snake[0];
        if (head) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "10px Arial";
            ctx.fillText(
                `${p.name} (${p.score})`,
                head.x * CELL_SIZE + 2,
                head.y * CELL_SIZE + 10
            );
        }
    });
}

draw();
