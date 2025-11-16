# 🐍 Multisnake – Realtime Multiplayer Snake Game

Multisnake is a realtime, browser-based multiplayer Snake game built with **Node.js**, **Express**, and **Socket.IO**.

Players can:

- Host a room with a **4-letter room code**
- Choose their **player name**
- Configure **grid size**, **game duration**, and **game speed**
- Share the room code with friends to play together (up to 4 players)
- See **names above snakes**, a live **scoreboard**, and a **countdown timer**

---

## 🚀 Features

- **Realtime Multiplayer** using Socket.IO
- **Room System**
  - Random 4-letter room codes
  - Host creates a room, others join via code
  - Up to 4 players per room
- **Customizable Game Settings** (host chooses):
  - Grid size (10–60, multiples of 10)
  - Game length in minutes (timer)
  - Game speed: `SLOW`, `NORMAL`, `FAST`, `BLAZING`
- **Player Experience**
  - Each player chooses a display name
  - Each snake has its own color
  - Names rendered above snake heads on the canvas
  - Scoreboard with:
    - Alive players at the top
    - Your own name highlighted
    - Dead players greyed out
- **Game Mechanics**
  - Toroidal/wrap-around map movement
  - Food spawns in random free tiles
  - Snake grows and score increases when eating
  - Collision handling:
    - Self-collision
    - Head-to-body collision
    - Head-to-head collision (all involved die)
  - Game ends when:
    - Only 0 or 1 player is alive, **or**
    - The game timer reaches zero
- **UI / UX**
  - Tailwind-styled lobby & game screens
  - Responsive square canvas that scales with the container
  - Toast error messages for invalid actions

---

## 🧱 Project Structure

```text
project-root/
├── backend/
│   ├── server.js          # Express + Socket.IO bootstrap
│   ├── socketHandlers.js  # Socket.IO events & game loop
│   └── gameManager.js     # Pure game logic & in-memory game states
├── public/
│   ├── index.html         # Frontend UI + client-side game logic
│   └── styles.css         # Custom styles on top of Tailwind
├── package.json
└── README.md

🛠 Tech Stack

Backend

Node.js

Express

Socket.IO

Frontend

Vanilla JavaScript

HTML5 Canvas

Tailwind CSS + custom CSS

Architecture

gameManager.js → pure game logic & state

socketHandlers.js → Socket.IO events + game loop

server.js → Express + Socket.IO server bootstrap

⚙️ Installation & Setup
1. Clone the repository
git clone <YOUR-REPO-URL> multisnake
cd multisnake

2. Install dependencies
npm install

3. Run the server
npm start


By default the server runs on http://localhost:3000
.

🎮 How to Play

Open the game in your browser:
http://localhost:3000

On the Home Screen:

Enter your name in “Your Name”

(Host only) Adjust:

Grid Size (Tiles) – between 10 and 60, multiples of 10

Game Length (minutes)

Game Speed – Slow / Normal / Fast / Blazing

Click “Create New Room” (host):

A unique 4-letter room code is created.

The host is shown in the Waiting Room with a 👑.

Friends join:

Open the same URL

Enter their name

Enter the room code

Click “Join Room”

In the Waiting Room:

See all players with colors, names, and host badge.

When everyone is ready, the host clicks “Start Game”.

In the Game Screen:

Move using:

Arrow keys ↑ ↓ ← →

or W A S D

Eat red food squares to grow and gain score.

Avoid collisions with yourself or other snakes.

Game Over:

Final scores with ranking and emojis 🏆🥈🥉

Host can click “Play Again (Host Only)” to reset snakes and replay with the same settings.

🧪 Game Logic Highlights

Each room has its own game state in gameManager.js:

gameStates[roomCode] stores players, food, gridSize, etc.

The game loop:

Runs per room, interval based on selected gameSpeed.

Update tick:

Compute all players’ nextHead positions.

Detect collisions:

Head-to-head collisions (multiple heads on same tile).

Head-to-body collisions.

Mark dead players for this tick.

Move surviving snakes, grow if food eaten.

Respawn food on free tiles.

👥 Contributors

Guido He

Donghoon Oh

Radman Mohammadi

Nathan Hilde

🧰 Future Improvements

In-game chat per room

Power-ups (e.g., speed boost, ghost mode)

Mobile-friendly touch controls

Persistent high scores & player stats

📄 License

This project is for educational and hackathon use.
Feel free to fork and extend it for your own learning or projects.