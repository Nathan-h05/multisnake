# 🐍 Multisnake – Realtime Multiplayer Snake Game

## 🛠 Tech Stack

- Node.js
- Express
- Socket.IO
- HTML5 Canvas
- Vanilla JavaScript
- Tailwind CSS

Backend uses **gameManager.js** for logic and **socketHandlers.js** for networking.

---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone <YOUR-REPO-URL> multisnake
cd multisnake
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the server
```bash
npm start
```

Then visit:  
👉 **http://localhost:3000**

---

## 🎮 How to Play

### 1️⃣ Home Screen
- Enter **Your Name**
- (Host only) Choose:
  - Grid Size (10–60)
  - Game Timer (minutes)
  - Game Speed (Slow / Normal / Fast / Blazing)
- Click **Create New Room**

A **4-letter room code** appears.

---

### 2️⃣ Joining a Room
Friends:
- Enter their **name**
- Enter the **room code**
- Click **Join Room**

---

### 3️⃣ Waiting Room
- View list of connected players  
- Host has 👑 crown  
- Host clicks **Start Game**

---

### 4️⃣ Gameplay
- Move with **WASD** or **Arrow Keys**
- Eat red food → grow and score  
- Avoid collisions  
- Your **name floats above your snake head**

---

### 5️⃣ Game Over
Final leaderboard shows:
- Winner 🏆
- Ranking
- Scores

Host can click **Play Again** to restart with same players & settings.

---

## 🧠 Game Logic Details

- Each room has a unique game state (`gameStates[roomCode]`)
- Game tick cycle:
  1. Compute next positions  
  2. Detect collisions  
  3. Apply deaths  
  4. Grow snakes if food eaten  
  5. Respawn food
- Timer decreases every tick
- Game ends when:
  - Only 0–1 player alive, or  
  - Timer reaches 0  

---

## 👥 Contributors
(Modify this for your team)

- **Guido He**
- **Donghoon Oh** 
- **Radman Mohammadi**
- **Nathan Hilde**

---

## 🔮 Future Improvements
- Power-ups  
- Mobile touch controls  
- In-room chat  
- Persistent high scores  
- Spectator mode  

---

## 📄 License
This project is for educational and hackathon use.  
Feel free to fork, improve, and customize it.
