let currentRoomCode = "";
let currentPuzzleClue = "";
const socket = io();

const $ = id => document.getElementById(id);

// DOM Elements
const roomHeader = $('roomHeader'),
      roomCodeBadge = $('roomCodeBadge'),
      copyRoomBtn = $('copyRoomBtn'),
      joinForm = $('joinForm'),
      waitingScreen = $('waitingScreen'),
      playerPuzzleScreen = $('playerPuzzleScreen'),
      resultsScreen = $('resultsScreen'),
      topDashboard = $('topDashboard'),
      championName = $('championName'),
      playerScoreboardList = $('playerScoreboardList'),
      createRoomBtn = $('createRoomBtn'),
      creatorNickInput = $('creatorNickInput'),
      joinBtn = $('joinBtn'),
      leaveRoomBtn = $('leaveRoomBtn'),
      roomInput = $('roomInput'),
      nickInput = $('nickInput'),
      puzzleImg = $('puzzleImg'),
      clueText = $('clueText'),
      letterBank = $('letterBank'),
      guessInput = $('guessInput'),
      submitGuessBtn = $('submitGuessBtn'),
      correctWordDisplay = $('correctWordDisplay'),
      resultsBox = $('resultsBox');

// Parameter for auto-filling room code from shared link
const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom && roomInput) roomInput.value = urlRoom.toUpperCase();

// Render live standings in top dashboard
function renderStandings(players) {
    return players.map((p, index) => {
        const score = p.total_score ?? p.score ?? 0;
        const rank = index + 1;
        let rankClass = 'rank-other';
        let badgeText = `#${rank}`;
        
        if (rank === 1) { rankClass = 'rank-1'; badgeText = '👑 1ST'; }
        else if (rank === 2) { rankClass = 'rank-2'; badgeText = '⚡ 2ND'; }
        else if (rank === 3) { rankClass = 'rank-3'; badgeText = '🔥 3RD'; }

        return `
            <div class="standings-row ${rankClass} font-orbitron">
                <div class="row-rank-badge"><span>${badgeText}</span></div>
                <div class="row-player-info"><span class="player-name">${p.nickname}</span></div>
                <div class="row-score"><span class="score-num">${score}</span><span class="score-label">PTS</span></div>
                <div class="row-accent-line"></div>
            </div>
        `;
    }).join('');
}

// Copy Room Link Action
copyRoomBtn.addEventListener('click', () => {
    if (!currentRoomCode) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        const btnSpan = copyRoomBtn.querySelector('span');
        if (btnSpan) {
            btnSpan.innerText = 'Copied! ✅';
            setTimeout(() => btnSpan.innerText = 'Copy Link', 2000);
        }
    });
});

// Create & Join Handlers
createRoomBtn.addEventListener('click', () => {
    const nickname = creatorNickInput.value.trim().toUpperCase();
    nickname ? socket.emit('hostless-create-room', { nickname }) : alert("Please type a nickname!");
});

joinBtn.addEventListener('click', () => {
    const roomCode = roomInput.value.trim().toUpperCase();
    const nickname = nickInput.value.trim().toUpperCase();
    if (roomCode && nickname) socket.emit('join-room', { roomCode, nickname });
});

leaveRoomBtn.addEventListener('click', () => {
    if (confirm("Leave game session? Your scores will be lost.")) {
        window.location.href = window.location.pathname;
    }
});

// Submit Guess Logic
const submitGuess = () => {
    const answer = guessInput.value.trim().toUpperCase();
    if (!answer || guessInput.disabled) return;

    socket.emit('submit-guess', { guess: answer });
    guessInput.disabled = true;
    submitGuessBtn.disabled = true;
    submitGuessBtn.innerText = "Checking... ⏳";
    submitGuessBtn.className = "btn-locked font-orbitron";
};

submitGuessBtn.addEventListener('click', submitGuess);
guessInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') submitGuess(); 
});

// Clickable Letter Bank Handler
if (letterBank) {
    letterBank.addEventListener('click', (e) => {
        if (e.target.classList.contains('letter-tile') && !guessInput.disabled) {
            guessInput.value += e.target.innerText;
            guessInput.focus();
        }
    });
}

// ==========================================
// SOCKET LISTENERS
// ==========================================

socket.on('player-joined-success', ({ roomCode }) => {
    currentRoomCode = roomCode;
    roomCodeBadge.innerText = `[${roomCode}]`;
    
    joinForm.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    
    roomHeader.classList.remove('hidden');
    waitingScreen.classList.remove('hidden');
    topDashboard.classList.remove('hidden');
    leaveRoomBtn.classList.remove('hidden');
});

socket.on('player-start-puzzle', ({ scrambledLetters, avatarUrl, clue }) => {
    currentPuzzleClue = clue || '';

 // Screen State Transition
    waitingScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    playerPuzzleScreen.classList.remove('hidden');
    
 // Reset Controls
    guessInput.value = '';
    guessInput.disabled = false;
    submitGuessBtn.disabled = false;
    submitGuessBtn.innerText = "Submit Guess 🎯";
    submitGuessBtn.className = "btn-primary font-orbitron";

 // Set Avatar & Clue
    if (puzzleImg && avatarUrl) puzzleImg.src = avatarUrl;
    if (clueText) clueText.innerText = `Clue: ${currentPuzzleClue}`;

    // Render Scrambled Letter Tiles
    if (letterBank && scrambledLetters) {
        letterBank.innerHTML = scrambledLetters.split('').map(char => `
            <span class="letter-tile font-orbitron" style="cursor: pointer; user-select: none;">${char}</span>
        `).join('');
    }
});

// Attempt Feedback Listener
socket.on('guess-result', ({ success, locked, feedback }) => {
    // Show guess feedback without losing original clue reference
    if (clueText) {
        clueText.innerText = `${feedback} | Clue: ${currentPuzzleClue}`;
    } 

    if (locked) {
        guessInput.disabled = true;
        submitGuessBtn.disabled = true;
        submitGuessBtn.innerText = success ? "Correct! 🎉" : "Locked Out 🔒";
        submitGuessBtn.className = "btn-locked font-orbitron";
    } else {
        guessInput.disabled = false;
        submitGuessBtn.disabled = false;
        submitGuessBtn.innerText = "Submit Guess 🎯";
        submitGuessBtn.className = "btn-primary font-orbitron";
        guessInput.value = '';
        guessInput.focus();
    }
});

// Live Updates for Standings & Champion Badge
socket.on('update-player-scores', ({ standings }) => {
    if (standings && standings.length > 0) {
        if (championName) {
            championName.innerText = standings[0].nickname;
        }
        if (playerScoreboardList) {
            playerScoreboardList.innerHTML = renderStandings(standings);
        }
    }
});

// Round End Screen
socket.on('reveal-results', ({ scoreboard, correctWord }) => {
    playerPuzzleScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    resultsScreen.classList.remove('hidden');
    
    if (correctWordDisplay) {
        correctWordDisplay.innerText = correctWord;
    }

    if (resultsBox && scoreboard) {
        resultsBox.innerHTML = scoreboard.map((p, idx) => {
            const score = p.total_score ?? p.score ?? 0;
            return `
                <div class="result-row font-orbitron" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #e5e7eb;">#${idx + 1} ${p.nickname}</span>
                    <span class="neon-text-pink" style="color: #f43f5e; font-weight: bold;">${score} PTS</span>
                </div>
            `;
        }).join('');
    }
});

socket.on('error-message', alert);