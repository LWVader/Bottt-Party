# 🤖 Bottt-Party
An Avatar-Driven Real-Time Puzzle Game

Bottt-Party is a browser-based multiplayer word puzzle experience built on Node.js, Express, and Socket.io. Players connect to a shared room using a six-character room code and solve word puzzles together while watching robot-style avatar art and leaderboard updates in real time.

---

## 🚀 What the App Actually Does

* Starts a local Express server and serves the Vault Access landing page at `/` and the game arena at `/game`.
* Uses Socket.io for live multiplayer room join, round progression, and score updates.
* Persists room state and player scores using SQLite via `better-sqlite3`.
* Automatically selects puzzles from a built-in bank with DiceBear-generated avatar art and fallback image URLs.
* Scrambles letters for each puzzle and awards points for correct guesses.
* Advances to the next round automatically after all connected players finish.

---

## 🧩 Key Features

* **Real-Time Multiplayer:** room join, scoreboards, and puzzle updates happen instantly over WebSockets.
* **Two-page game interface:** the Vault Access landing page at `/` leads into the game arena at `/game`, with lobby and puzzle screens separated by route.
* **Persistent SQLite backing store:** room progress, puzzles used, and player scores are stored in `database.db`.
* **DiceBear avatar generation:** puzzles use DiceBear avatar styles like `bottts`, `avataaars`, and more.
* **Automatic round progression:** new puzzles start when every active player finishes or exhausts their attempts.
* **Save progress button:** players can save and recall a room code during play.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express, Socket.io, better-sqlite3
* **Frontend:** HTML, JavaScript, CSS
* **Avatar Engine:** DiceBear API (`10.x/*/svg`) and hosted image fallbacks

---

## 📦 Installation & Setup

Clone the repository, install dependencies, and run the server:

```bash
git clone https://github.com/LWVader/Bottt-Party.git
cd Bottt-Party
npm install
node server.js
```

If you forked the repo, clone your fork instead:

```bash
git clone https://github.com/<your-username>/Bottt-Party.git
cd Bottt-Party
npm install
node server.js
```

Then open your browser to:

```text
http://localhost:3000
```

---

## ▶️ How to Play

1. Open `http://localhost:3000` in your browser.
2. Enter a nickname and create a new room, or enter an existing room code to rejoin.
3. The app will generate a puzzle with scrambled letters, a hint, and a avatar.
4. Submit your guess, then retry until you solve it or use all attempts.
5. Scores update live and the next round begins automatically once everyone finishes.

---


## File Structure

* `server.js` — Express server, Socket.io handlers, SQLite persistence, game round logic
* `PUBLIC/index.html` — Vault Access landing page served at `/`
* `PUBLIC/game.html` — game arena served at `/game`
* `PUBLIC/client.js` — client socket event logic, UI updates, input handling
* `PUBLIC/style.css` — game styling and layout
* `package.json` — dependencies and project metadata

---

## Notes

* The current game flow is based on a shared lobby and puzzle screen powered by Socket.io.
* The room code is generated server-side and used for joining/rejoining sessions.

