// ==========================================
// Global State & Helper Functions
// ==========================================
let currentRoomCode = "";
let currentPuzzleClue = "";
let socketListenersInitialized = false;

// Attach socket globally to window
window.socket = window.socket || (typeof io !== "undefined" ? io() : null);

const $ = (id) => document.getElementById(id);

// DOM Elements
const roomHeader = $('roomHeader');
const roomCodeBadge = $('roomCodeBadge');
const copyRoomBtn = $('copyRoomBtn');
const waitingScreen = $('waitingScreen');
const playerPuzzleScreen = $('playerPuzzleScreen');
const resultsScreen = $('resultsScreen');
const topDashboard = $('topDashboard');
const championName = $('championName');
const playerScoreboardList = $('playerScoreboardList');

// Lobby & Form Controls (Matched with HTML IDs)
const btnCreateRoom = $('btnCreateRoom');
const btnJoinRoom = $('btnJoinRoom');
const leaveRoomBtn = $('leaveRoomBtn');
const joinRoomCodeInput = $('joinRoomCode');
const joinNicknameInput = $('joinNickname');

// Gameplay Elements
const puzzleImg = $('puzzleImg');
const clueText = $('clueText');
const letterBank = $('letterBank');
const guessInput = $('guessInput');
const submitGuessBtn = $('submitGuessBtn');
const correctWordDisplay = $('correctWordDisplay');
const resultsBox = $('resultsBox');
const saveGameBtn = $('saveGameBtn');

// Dual Card / Active Puzzle Elements
const startPuzzleBtn = $('startPuzzleBtn') || $('loadGameBtn');
const loadRoomCodeInput = $('loadRoomCodeInput');
const loadNickInput = $('loadNickInput');

// Vault Authentication Elements
const loginUsernameInput = $('loginUsername');
const rejoinRoomCodeInput = $('rejoinRoomCode');
const loginSubmitBtn = $('loginSubmitBtn');
const loginStatus = $('loginStatus');

// Rejoin With Code Toggle Elements
const toggleRejoinBtn = $('toggleRejoinBtn');
const rejoinCodeContainer = $('rejoinCodeContainer');

// Global AudioContext & Buffer Cache
let audioCtx = null;
let cachedNoiseBuffer = null;

// ==========================================
// Auto-Run Configurations & Form Listeners
// ==========================================

// Auto-fill room code from shared URL query parameter
const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom && joinRoomCodeInput) {
    joinRoomCodeInput.value = urlRoom.toUpperCase();
}

// Toggle Rejoin Code Input Container
if (toggleRejoinBtn && rejoinCodeContainer) {
    toggleRejoinBtn.addEventListener('click', () => {
        rejoinCodeContainer.classList.toggle('hidden');
        const isHidden = rejoinCodeContainer.classList.contains('hidden');
        toggleRejoinBtn.textContent = isHidden ? 'REJOIN WITH CODE 🔑' : 'CANCEL CODE ENTRY ✖';
    });
}

// Vault Login / Enter Game Event Handler
loginSubmitBtn?.addEventListener('click', () => {
    const nickname = loginUsernameInput?.value.trim().toUpperCase() || '';
    const roomCode = rejoinRoomCodeInput?.value.trim().toUpperCase() || '';

    if (!nickname) {
        if (loginStatus) {
            loginStatus.textContent = "PLEASE ENTER YOUR NAME";
            loginStatus.style.color = "#f43f5e";
        }
        return;
    }

    sessionStorage.setItem("current_nickname", nickname);

    if (roomCode) {
        window.socket?.emit("load_game_with_code", { roomCode, nickname });
    } else {
        triggerVaultDoorOpen();
    }
});

// Single-Button Action: Create & Launch Room (Fixed Target & Fallbacks)
btnCreateRoom?.addEventListener('click', () => {
    const nickname = (
        sessionStorage.getItem("current_nickname") ||
        loginUsernameInput?.value.trim() ||
        'AGENT'
    ).toUpperCase();

    sessionStorage.setItem("current_nickname", nickname);
    window.socket?.emit('hostless-create-room', { nickname });
});

// Single-Button Action: Join / Re-enter Game Panel
btnJoinRoom?.addEventListener('click', () => {
    const roomCode = joinRoomCodeInput?.value.trim().toUpperCase() || '';
    const nickname = (
        joinNicknameInput?.value.trim() ||
        sessionStorage.getItem("current_nickname") ||
        'AGENT'
    ).toUpperCase();

    if (!roomCode) {
        alert("PLEASE ENTER A VALID ROOM CODE");
        joinRoomCodeInput?.focus();
        return;
    }

    sessionStorage.setItem("current_nickname", nickname);
    sessionStorage.setItem("current_room_code", roomCode);
    window.socket?.emit('join-room', { roomCode, nickname });
});

// Action: Start Puzzle from Card
startPuzzleBtn?.addEventListener('click', handleStartPuzzleFromCard);

function handleStartPuzzleFromCard() {
    const roomCode = loadRoomCodeInput?.value.trim().toUpperCase() || '';
    const nickname = (
        loadNickInput?.value.trim() ||
        sessionStorage.getItem("current_nickname") ||
        'AGENT'
    ).toUpperCase();

    if (!roomCode) {
        alert("PLEASE ENTER A VALID ROOM CODE TO START THE PUZZLE");
        loadRoomCodeInput?.focus();
        return;
    }

    sessionStorage.setItem("current_nickname", nickname);
    sessionStorage.setItem("current_room_code", roomCode);

    triggerVaultDoorOpen();
    window.socket?.emit("load_game_with_code", { roomCode, nickname });
}

// ==========================================
// Initialization & Socket Binding
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (typeof io === "undefined") {
        console.error("Socket.io library not loaded! Check HTML script tag.");
        return;
    }

    if (!window.socket) {
        window.socket = io();
    }

    window.socket.on("connect", () => {
        console.log("[SOCKET] Connected to server:", window.socket.id);

        const savedRoom = sessionStorage.getItem("current_room_code");
        const savedNick = sessionStorage.getItem("current_nickname");
        if (savedRoom && savedNick) {
            window.socket.emit('load_game_with_code', { roomCode: savedRoom, nickname: savedNick });
        }
    });

    setupGameplaySocketListeners();
});

// ==========================================
// Visual & Audio Effects
// ==========================================
function createVaultBlastEffect(container) {
    const particleCount = 28;
    const rect = container ? container.getBoundingClientRect() : document.body.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div");
        particle.className = "blast-particle";

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 250 + 100;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        const rotation = Math.random() * 720 - 360;

        particle.style.cssText = `
            left: ${centerX}px;
            top: ${centerY}px;
            --tx: ${tx}px;
            --ty: ${ty}px;
            --rot: ${rotation}deg;
        `;

        fragment.appendChild(particle);
        setTimeout(() => particle.remove(), 700);
    }
    document.body.appendChild(fragment);
}

function playVaultDoorSequence() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const now = audioCtx.currentTime;

        // 1. Laser Ping
        const blasterOsc = audioCtx.createOscillator();
        const blasterGain = audioCtx.createGain();
        blasterOsc.type = 'sawtooth';
        blasterOsc.frequency.setValueAtTime(3200, now);
        blasterOsc.frequency.exponentialRampToValueAtTime(150, now + 0.18);

        blasterGain.gain.setValueAtTime(0.8, now);
        blasterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        const pingFilter = audioCtx.createBiquadFilter();
        pingFilter.type = 'highpass';
        pingFilter.frequency.setValueAtTime(1000, now);

        blasterOsc.connect(pingFilter);
        pingFilter.connect(blasterGain);
        blasterGain.connect(audioCtx.destination);

        blasterOsc.start(now);
        blasterOsc.stop(now + 0.2);

        // 2. Sub Impact
        const impactTime = now + 0.12;
        const subImpact = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subImpact.type = 'sine';

        subImpact.frequency.setValueAtTime(220, impactTime);
        subImpact.frequency.exponentialRampToValueAtTime(25, impactTime + 0.4);

        subGain.gain.setValueAtTime(1.0, impactTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, impactTime + 0.45);

        subImpact.connect(subGain);
        subGain.connect(audioCtx.destination);

        subImpact.start(impactTime);
        subImpact.stop(impactTime + 0.45);

        // 3. Hydraulic Release
        const doorReleaseTime = now + 0.25;
        const doorDuration = 0.6;

        if (!cachedNoiseBuffer) {
            cachedNoiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * doorDuration, audioCtx.sampleRate);
            const noiseData = cachedNoiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = Math.random() * 2 - 1;
            }
        }

        const noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = cachedNoiseBuffer;

        const doorFilter = audioCtx.createBiquadFilter();
        doorFilter.type = 'lowpass';
        doorFilter.frequency.setValueAtTime(1800, doorReleaseTime);
        doorFilter.frequency.exponentialRampToValueAtTime(200, doorReleaseTime + doorDuration);
        doorFilter.Q.setValueAtTime(6.0, doorReleaseTime);

        const doorGain = audioCtx.createGain();
        doorGain.gain.setValueAtTime(0.01, doorReleaseTime);
        doorGain.gain.linearRampToValueAtTime(0.35, doorReleaseTime + 0.08);
        doorGain.gain.exponentialRampToValueAtTime(0.001, doorReleaseTime + doorDuration);

        noiseSrc.connect(doorFilter);
        doorFilter.connect(doorGain);
        doorGain.connect(audioCtx.destination);

        noiseSrc.start(doorReleaseTime);
        noiseSrc.stop(doorReleaseTime + doorDuration);

    } catch (err) {
        console.warn("Web Audio API warning:", err);
    }
}

function triggerVaultDoorOpen() {
    const vaultWrapper = $("vaultWrapper");

    playVaultDoorSequence();
    document.body.classList.add("shake-blast");
    createVaultBlastEffect(vaultWrapper || document.body);

    setTimeout(() => {
        if (vaultWrapper) {
            vaultWrapper.classList.add("open");
            setTimeout(() => { vaultWrapper.style.display = 'none'; }, 1000);
        }
    }, 150);

    setTimeout(() => {
        document.body.classList.remove("shake-blast");
    }, 650);
}

// ==========================================
// Room & UI Event Listeners
// ==========================================
saveGameBtn?.addEventListener('click', () => {
    window.socket?.emit("save_game_progress");
    saveGameBtn.disabled = true;
    saveGameBtn.innerText = "Saving... 💾";
});

$('copyCodeBtn')?.addEventListener('click', () => {
    if (!currentRoomCode) return;
    navigator.clipboard.writeText(currentRoomCode).then(() => {
        const btnSpan = $('copyCodeBtn')?.querySelector('span');
        if (btnSpan) {
            btnSpan.innerText = 'Copied Code! ✅';
            setTimeout(() => { btnSpan.innerText = 'Code 📋'; }, 2000);
        }
    });
});

leaveRoomBtn?.addEventListener('click', () => {
    if (confirm("Leave game session? Your scores will be lost.")) {
        sessionStorage.removeItem("current_room_code");
        sessionStorage.removeItem("current_nickname");
        window.location.href = window.location.pathname;
    }
});

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

// ==========================================
// Gameplay Mechanics & Socket Handlers
// ==========================================
const submitGuess = () => {
    if (!guessInput) return;
    const answer = guessInput.value.trim().toUpperCase();
    if (!answer || guessInput.disabled) return;

    window.socket?.emit('submit-guess', { guess: answer });
    guessInput.disabled = true;
    if (submitGuessBtn) {
        submitGuessBtn.disabled = true;
        submitGuessBtn.innerText = "Checking... ⏳";
        submitGuessBtn.className = "btn-locked font-orbitron";
    }
};

submitGuessBtn?.addEventListener('click', submitGuess);
guessInput?.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') submitGuess(); 
});

letterBank?.addEventListener('click', (e) => {
    if (e.target.classList.contains('letter-tile') && guessInput && !guessInput.disabled) {
        if (e.target.classList.contains('used-tile')) return;
        
        guessInput.value += e.target.innerText;
        e.target.classList.add('used-tile');
        e.target.style.opacity = '0.4';
        e.target.style.pointerEvents = 'none';
        guessInput.focus();
    }
});

function resetLetterBankTiles() {
    if (!letterBank) return;
    letterBank.querySelectorAll('.letter-tile').forEach(tile => {
        tile.classList.remove('used-tile');
        tile.style.opacity = '1';
        tile.style.pointerEvents = 'auto';
    });
}

function setupGameplaySocketListeners() {
    const socket = window.socket;
    if (!socket || socketListenersInitialized) return;
    socketListenersInitialized = true;

    socket.on("game_saved_success", ({ roomCode, score }) => {
        alert(`Game progress saved!\nRoom Code: [${roomCode}]\nCurrent Score: ${score} PTS`);
        if (saveGameBtn) {
            saveGameBtn.disabled = false;
            saveGameBtn.innerText = "Save Game 💾";
        }
    });

    socket.on("game_saved_error", (errMsg) => {
        alert(errMsg);
        if (saveGameBtn) {
            saveGameBtn.disabled = false;
            saveGameBtn.innerText = "Save Game 💾";
        }
    });

    socket.on('player-joined-success', ({ roomCode }) => {
        currentRoomCode = roomCode;
        sessionStorage.setItem("current_room_code", roomCode);

        triggerVaultDoorOpen();

        if (roomCodeBadge) roomCodeBadge.innerText = `[${roomCode}]`;
        
        // Hide Main Lobby Card
        const formPanel = document.querySelector('.form-panel');
        if (formPanel) formPanel.classList.add('hidden');
        
        resultsScreen?.classList.add('hidden');
        
        roomHeader?.classList.remove('hidden');
        waitingScreen?.classList.remove('hidden');
        topDashboard?.classList.remove('hidden');
        leaveRoomBtn?.classList.remove('hidden');
    });

    socket.on('player-start-puzzle', ({ scrambledLetters, avatarUrl, clue }) => {
        currentPuzzleClue = clue || '';

        waitingScreen?.classList.add('hidden');
        resultsScreen?.classList.add('hidden');
        playerPuzzleScreen?.classList.remove('hidden');
        
        if (guessInput) {
            guessInput.value = '';
            guessInput.disabled = false;
        }
        if (submitGuessBtn) {
            submitGuessBtn.disabled = false;
            submitGuessBtn.innerText = "Submit Guess 🎯";
            submitGuessBtn.className = "btn-primary font-orbitron";
        }

        if (puzzleImg && avatarUrl) puzzleImg.src = avatarUrl;
        if (clueText) clueText.innerText = `Clue: ${currentPuzzleClue}`;

        if (letterBank && scrambledLetters) {
            letterBank.innerHTML = scrambledLetters.split('').map(char => `
                <span class="letter-tile font-orbitron" style="cursor: pointer; user-select: none;">${char}</span>
            `).join('');
        }
    });

    socket.on('guess-result', ({ success, locked, feedback }) => {
        if (clueText) {
            clueText.innerText = `${feedback} | Clue: ${currentPuzzleClue}`;
        } 

        if (locked) {
            if (guessInput) guessInput.disabled = true;
            if (submitGuessBtn) {
                submitGuessBtn.disabled = true;
                submitGuessBtn.innerText = success ? "Correct! 🎉" : "Locked Out 🔒";
                submitGuessBtn.className = "btn-locked font-orbitron";
            }
        } else {
            if (guessInput) {
                guessInput.disabled = false;
                guessInput.value = '';
                guessInput.focus();
            }
            if (submitGuessBtn) {
                submitGuessBtn.disabled = false;
                submitGuessBtn.innerText = "Submit Guess 🎯";
                submitGuessBtn.className = "btn-primary font-orbitron";
            }
            resetLetterBankTiles();
        }
    });

    socket.on('update-player-scores', ({ standings }) => {
        if (standings && standings.length > 0) {
            if (championName) championName.innerText = standings[0].nickname;
            if (playerScoreboardList) playerScoreboardList.innerHTML = renderStandings(standings);
        }
    });

    socket.on('reveal-results', ({ scoreboard, correctWord }) => {
        playerPuzzleScreen?.classList.add('hidden');
        waitingScreen?.classList.add('hidden');
        resultsScreen?.classList.remove('hidden');
        
        if (correctWordDisplay) correctWordDisplay.innerText = correctWord;

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
}