// ==========================================
// Global State & Utilities
// ==========================================
let currentRoomCode = "";
let currentPuzzleClue = "";
let currentPlayerData = null;

// Attach socket globally to window
window.socket = window.socket || (typeof io !== "undefined" ? io() : null);

const $ = (id) => document.getElementById(id);

// DOM Elements
const roomHeader = $('roomHeader');
const roomCodeBadge = $('roomCodeBadge');
const copyRoomBtn = $('copyRoomBtn');
const joinForm = $('joinForm');
const waitingScreen = $('waitingScreen');
const playerPuzzleScreen = $('playerPuzzleScreen');
const resultsScreen = $('resultsScreen');
const topDashboard = $('topDashboard');
const championName = $('championName');
const playerScoreboardList = $('playerScoreboardList');
const createRoomBtn = $('createRoomBtn');
const creatorNickInput = $('creatorNickInput');
const joinBtn = $('joinBtn');
const leaveRoomBtn = $('leaveRoomBtn');
const roomInput = $('roomInput');
const nickInput = $('nickInput');
const puzzleImg = $('puzzleImg');
const clueText = $('clueText');
const letterBank = $('letterBank');
const guessInput = $('guessInput');
const submitGuessBtn = $('submitGuessBtn');
const correctWordDisplay = $('correctWordDisplay');
const resultsBox = $('resultsBox');
const saveGameBtn = $('saveGameBtn');
const enterGameBtn = $('enterGameBtn');

// Auto-fill room code from shared URL query parameter
const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom && roomInput) {
    roomInput.value = urlRoom.toUpperCase();
}

// Global AudioContext cache
let audioCtx = null;

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

    // Vault Auth Listeners
    window.socket.on("vault_login_success", (playerProfile) => onAuthSuccess(playerProfile));
    window.socket.on("vault_login_error", (errorMessage) => onAuthError(errorMessage));

    // Socket Session Auto-Restore & Reconnect
    window.socket.on("connect", () => {
        console.log("[SOCKET] Connected to server:", window.socket.id);

        // 1. Auto-restore stored Vault session
        const savedPlayer = localStorage.getItem("word_bottts_player");
        if (savedPlayer) {
            try {
                const profile = JSON.parse(savedPlayer);
                onAuthSuccess(profile, false); // Populate UI without door animation

                if (profile.username && profile.password) {
                    window.socket.emit("player_vault_login", { 
                        username: profile.username, 
                        password: profile.password 
                    });
                }
            } catch (err) {
                console.error("Corrupted local profile session removed:", err);
                localStorage.removeItem("word_bottts_player");
            }
        }

        // 2. Auto-rejoin active room if disconnected mid-game
        const savedRoom = sessionStorage.getItem("current_room_code");
        const savedNick = sessionStorage.getItem("current_nickname");
        if (savedRoom && savedNick) {
            const username = currentPlayerData ? currentPlayerData.username : savedNick;
            window.socket.emit('join-room', { roomCode: savedRoom, nickname: savedNick, username });
        }
    });

    // Login Event Listeners
    const loginSubmitBtn = $('loginSubmitBtn');
    const loginPasswordInput = $('loginPassword');

    loginSubmitBtn?.addEventListener('click', handleVaultLogin);
    loginPasswordInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleVaultLogin();
    });

    enterGameBtn?.addEventListener('click', () => {
        enterGameBtn.disabled = true;
        triggerVaultDoorOpen();
    });

    setupGameplaySocketListeners();
});

// ==========================================
// 1. Vault Login & Auth Handlers
// ==========================================
function handleVaultLogin() {
    const usernameInput = $('loginUsername');
    const passwordInput = $('loginPassword');
    const username = usernameInput?.value.trim().toUpperCase() || '';
    const password = passwordInput?.value.trim() || '';
    const statusText = $('loginStatus');

    if (!username || !password) {
        if (statusText) {
            statusText.style.display = "block";
            statusText.style.color = "#EF4444";
            statusText.textContent = "ENTER BOTH CALLSIGN & PASSWORD";
        }
        return;
    }

    if (statusText) statusText.style.display = "none";
    window.socket?.emit("player_vault_login", { username, password });
}

function onAuthSuccess(profile, openDoor = true) {
    currentPlayerData = profile;
    localStorage.setItem("word_bottts_player", JSON.stringify(profile));

    const statusText = $('loginStatus');
    const loginSubmitBtn = $('loginSubmitBtn');

    if (statusText) {
        statusText.style.display = "block";
        statusText.style.color = "#10B981";
        statusText.textContent = `AUTHENTICATED AS ${profile.username}. OPENING VAULT...`;
    }

    if (creatorNickInput) creatorNickInput.value = profile.username;
    if (nickInput) nickInput.value = profile.username;

    loginSubmitBtn?.classList.add('hidden');
    enterGameBtn?.classList.remove('hidden');

    if (openDoor) {
        triggerVaultDoorOpen();
    }
}

function onAuthError(errMsg) {
    currentPlayerData = null;
    enterGameBtn?.classList.add('hidden');

    const statusText = $('loginStatus');
    if (statusText) {
        statusText.style.display = "block";
        statusText.style.color = "#EF4444";
        statusText.textContent = errMsg;
    }
}

// ==========================================
// 2. Blast Visual & Audio Effects
// ==========================================
function createVaultBlastEffect(container) {
    const particleCount = 28;
    const rect = container ? container.getBoundingClientRect() : document.body.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div");
        particle.className = "blast-particle";

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 250 + 100;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        const rotation = Math.random() * 720 - 360;

        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        particle.style.setProperty('--rot', `${rotation}deg`);

        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 700);
    }
}

function playVaultDoorSequence() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const now = audioCtx.currentTime;

        // 1. Blaster Laser / Wire-Ping
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

        // 2. Sub-Impact Blast
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

        // 3. Hydraulic Pneumatic Release
        const doorReleaseTime = now + 0.25;
        const doorDuration = 0.6;

        const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * doorDuration, audioCtx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        const noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;

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
            // Hide element from DOM layout once door animation finishes
            setTimeout(() => { vaultWrapper.style.display = 'none'; }, 1000);
        } else {
            $('loginScreen')?.classList.add('hidden');
            $('joinForm')?.classList.remove('hidden');
        }
    }, 150);

    setTimeout(() => {
        document.body.classList.remove("shake-blast");
    }, 650);
}

// ==========================================
// 3. Room & Standings UI Controls
// ==========================================
saveGameBtn?.addEventListener('click', () => {
    window.socket?.emit("save_game_progress");
    saveGameBtn.disabled = true;
    saveGameBtn.innerText = "Saving... 💾";
});

copyRoomBtn?.addEventListener('click', () => {
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

createRoomBtn?.addEventListener('click', () => {
    const nickname = (creatorNickInput?.value || '').trim().toUpperCase();
    const username = currentPlayerData ? currentPlayerData.username : nickname;
    
    if (nickname) {
        sessionStorage.setItem("current_nickname", nickname);
        window.socket?.emit('hostless-create-room', { nickname, username });
    } else {
        alert("Please type a nickname!");
    }
});

joinBtn?.addEventListener('click', () => {
    const roomCode = roomInput?.value.trim().toUpperCase() || '';
    const nickname = nickInput?.value.trim().toUpperCase() || '';
    const username = currentPlayerData ? currentPlayerData.username : nickname;

    if (roomCode && nickname) {
        sessionStorage.setItem("current_nickname", nickname);
        window.socket?.emit('join-room', { roomCode, nickname, username });
    }
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
// 4. Gameplay Logic & Socket Handlers
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
    if (!socket) return;

    socket.on("game_saved_success", ({ score }) => {
        alert(`Game saved! Current total score (${score} PTS) preserved in Vault.`);
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

        if (roomCodeBadge) roomCodeBadge.innerText = `[${roomCode}]`;
        
        joinForm?.classList.add('hidden');
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