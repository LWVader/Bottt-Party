# 🤖 Word Bottts (An Avatar-Driven Real-Time Puzzle Game)

> **Code:You Web Development Capstone Project | January 2026 Cohort**  
> *A real-time, zero-install, multi-route web application powered by WebSockets, dynamic API art, and SQLite persistence.*

---

## 📌 Table of Contents
* [App Overview & Problem Solved](#-app-overview--problem-solved)
* [Tech Stack](#-tech-stack)
* [Capstone Table Features Integration](#-capstone-table-features-integration)
* [Key Routes & Architecture](#-key-routes--architecture)
* [Installation & Setup](#-installation--setup)
  * [Level 1: Local Machine Setup](#level-1-local-machine-setup)
  * [Level 2: Playing on Smartphones (Local Wi-Fi Network)](#level-2-playing-on-smartphones-local-wi-fi-network)
  * [Level 3: Fresh Installation Troubleshooting](#level-3-fresh-installation-troubleshooting)
* [🎮 How to Play](#-how-to-play)
* [📁 Directory & File Structure](#-directory--file-structure)
* [🤖 AI Citation & Ethical Usage Statement](#-ai-citation--ethical-usage-statement)

---

## 🚀 App Overview & Problem Solved

Traditional party and trivia games often require bulky console hardware, complex downloads, or invasive account registrations. **Word Bottts** addresses this barrier by delivering a lightweight, zero-install multiplayer experience accessible instantly through any modern desktop or smartphone browser.

The game combines dynamic vector avatar generation via the **DiceBear API** with high-speed **Socket.io** WebSocket synchronization. Players join a shared game lobby using a 6-character room access code, decode scrambled letter banks, guess secret blueprint characters, and compete live on an auto-updating leaderboard backed by a persistent **SQLite** database.

---

## 🛠️ Tech Stack

* **Backend Environment:** Node.js (`v18.0.0+`)
* **Server Framework:** Express.js
* **Real-Time Communication:** Socket.io
* **Database / Persistence:** `better-sqlite3` (SQLite)
* **Frontend:** HTML5, CSS3 (Custom CSS Variables, Keyframe Animations, Flexbox/Grid), JavaScript (ES6+ Modules, Fetch API, Async/Await)
* **Generative Art Engine:** DiceBear Avatar API (`10.x/*/svg`)
* **Typography:** Google Orbitron Font Stack

---

## 🌟 Capstone Table Features Integration

In accordance with the Code:You Web Development Capstone guidelines, this project explicitly implements and documents the following required technical features:

### 1. External API Integration (Mandatory Requirement)
* **API Used:** DiceBear Generative Avatar API (`https://api.dicebear.com/10.x/bottts/svg`)
* **Details:** Dynamically fetches and renders vector SVG robot art on the fly based on randomized puzzle seed strings.

### 2. Node.js Express Web Server (Section 2 Table — Easy/Intermediate)
* **Implementation:** Built on Express.js in `server.js`.
* **Details:** Serves static assets, manages WebSocket lifecycle protocols, and hosts two distinct HTML page routes (`/` and `/game`).

### 3. SQLite Database Integration (Section 2 Table — Hard)
* **Implementation:** Powered by `better-sqlite3` persisting to `database.db`.
* **Details:** Stores active room sessions, tracks used blueprint IDs to prevent repetition, and saves player scoreboards across server reboots.

### 4. Data Analysis & Array Manipulation (Section 1 Table — Easy)
* **Implementation:** Server-side and client-side processing of puzzle data objects and character arrays.
* **Details:** Programmatically scrambles secret word strings into letter bank arrays, ranks players dynamically by score totals, and filters out exhausted puzzle entries.

### 5. Data Persistence Across Reloads (Section 1 Table — Intermediate - *Backup Feature*)
* **Implementation:** Game state saved in SQLite and recalled via 6-character room codes.
* **Details:** If a player accidentally refreshes or loses connection, re-entering their room code restores their exact score, player identity, and current match progress.

---

## 🧩 Key Routes & Architecture

This application fulfills the **minimum 2-route requirement** by splitting the experience into two dedicated page handlers:

* **Route 1 — `GET /` (`PUBLIC/index.html`):** The Vault Access landing page featuring animated sci-fi blast doors, status indicator light sequences, and user name/room entry controls.
* **Route 2 — `GET /game` (`PUBLIC/game.html`):** The main interactive game arena housing the player standings leaderboard, generative DiceBear avatar display, scrambled letter bank, guess submitter, and round results overlay.

---

## 📦 Installation & Setup

### Prerequisites
* **Node.js:** `v18.0.0` or higher installed.
* **NPM:** `v9.0.0` or higher (comes bundled with Node.js).
* **Git:** Installed on your local operating system.

---

### Level 1: Local Machine Setup

1. **Clone the repository:**
   ```bash
git clone https://github.com/LWVader/Bottt-Party.git
cd Bottt-Party
```
2. **Install dependencies:**
   ```bash
npm install
```
3. **Start the Express server:**
   ```bash
node server.js
```
4. **Open the game:**
   ```text
http://localhost:3000
```

---

### Level 2: Playing on Smartphones (Local Wi-Fi Network)

To use smartphones as wireless controllers while hosting the game on your computer:

1. Connect your host computer and mobile devices to the same Wi-Fi network.
2. Find your computer's local IP address.

**Windows (Command Prompt):**
```bash
ipconfig
```
Look for the `IPv4 Address` entry (for example `192.168.1.45`).

**Mac / Linux (Terminal):**
```bash
ifconfig
```
Look for the `inet` address under `en0`, `wlan0`, or the active network adaptor.

3. On mobile phones, open a browser and enter:
```text
http://<YOUR-LOCAL-IP>:3000
```
Example:
```text
http://192.168.1.45:3000
```

---

### Level 3: Fresh Installation Troubleshooting

* **Missing Node modules:**
  ```bash
rm -rf node_modules package-lock.json
npm install
```

* **Port 3000 in use:**
  ```bash
PORT=8080 node server.js
```

* **Database permissions:** Ensure `database.db` is writable so `better-sqlite3` can create tables and persist state.

🎮 How to Play
Enter the Vault: Visit http://localhost:3000 on Route 1.

Authenticate: Type your nickname into the input box and click ENTER GAME 🪄. Watch the sci-fi blast doors slide open!

Launch or Join a Room:

Create: Click CREATE & LAUNCH ROOM on Route 2 to generate a new 6-character room code (e.g., X7K9).

Join: Friends enter the 6-character code on their devices to enter your lobby.

Solve the Blueprint:

An avatar image generates from the DiceBear API.

Unscramble the letters in the Letter Bank to guess the secret word.

Type your answer into the guess box and hit Submit Guess 🎯.

Win & Score: Correct answers award points. Scores update immediately across all connected displays on the Player Standings leaderboard.

📁 Directory & File Structure

Bottt-Party/
├── server.js              # Express Web Server, Socket.io Handler, SQLite Engine
├── database.db            # SQLite Persistent Storage File
├── package.json           # Application Metadata & Dependencies
└── PUBLIC/
    ├── index.html         # Route 1: Vault Door / Access Login Interface
    ├── game.html          # Route 2: Game Arena, Leaderboard & Puzzle Canvas
    ├── client.js          # Client Socket Listeners, UI Renders & Event Logic
    └── style.css          # Sci-Fi Theme Styling, Keyframes & Responsive Media Queries
```
🤖 AI Citation & Ethical Usage Statement
In compliance with Code:You Capstone guidelines regarding machine learning and generative tools, artificial intelligence assistants (ChatGPT / Gemini) were utilized strictly as learning aids and code design consultants during development.

Specific Usage Areas:
Images served from postimg are AI generated as dicebear did not have sufficient options for some areas. 

SQLite Prepared Statements: Provided guidance ONLY on better-sqlite3 syntax for transaction safety during score updating.

All AI-assisted logic was scrutinized, manually refactored, encapsulated into modular functions, and commented inline throughout server.js.