// ==========================================
// Global State & Audio Cache
// ==========================================
let currentRoomCode = "";
let currentPuzzleClue = "";
let socketListenersInitialized = false;

// Attach socket globally to window
window.socket = window.socket || (typeof io !== "undefined" ? io() : null);

// Helper for quick element fetching
const $ = (id) => document.getElementById(id);

// Dynamic DOM getter to safely access elements depending on current active page
const getDOMElements = () => ({
  // Vault / Index Elements
  vaultWrapper: $('vaultWrapper'),
  loginUsernameInput: $('loginUsername'),
  rejoinRoomCodeInput: $('rejoinRoomCode'),
  loginSubmitBtn: $('loginSubmitBtn'),
  loginStatus: $('loginStatus'),
  toggleRejoinBtn: $('toggleRejoinBtn'),
  rejoinCodeContainer: $('rejoinCodeContainer'),

  // Arena / Game Header Elements
  roomHeader: $('roomHeader'),
  roomCodeBadge: $('roomCodeBadge'),
  copyCodeBtn: $('copyCodeBtn'),
  saveGameBtn: $('saveGameBtn'),
  leaveRoomBtn: $('leaveRoomBtn'),

  // Dashboards & Panels
  topDashboard: $('topDashboard'),
  championName: $('championName'),
  playerScoreboardList: $('playerScoreboardList'),
  waitingScreen: $('waitingScreen'),
  playerPuzzleScreen: $('playerPuzzleScreen'),
  resultsScreen: $('resultsScreen'),
  formPanel: document.querySelector('.form-panel'),

  // Form Controls
  btnCreateRoom: $('btnCreateRoom'),
  btnJoinRoom: $('btnJoinRoom'),
  joinRoomCodeInput: $('joinRoomCode'),
  joinNicknameInput: $('joinNickname'),
  startPuzzleBtn: $('startPuzzleBtn') || $('loadGameBtn'),
  loadRoomCodeInput: $('loadRoomCodeInput'),
  loadNickInput: $('loadNickInput'),

  // Gameplay Controls
  puzzleImg: $('puzzleImg'),
  clueText: $('clueText'),
  letterBank: $('letterBank'),
  guessInput: $('guessInput'),
  submitGuessBtn: $('submitGuessBtn'),
  correctWordDisplay: $('correctWordDisplay'),
  resultsBox: $('resultsBox')
});

// Global Web Audio Context & Buffer Cache
let audioCtx = null;
let cachedNoiseBuffer = null;

// ==========================================
// Initialization Router
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.getAttribute('data-page');
  const els = getDOMElements();

  if (page === 'index') {
    setupIndexHandlers(els);
  } else if (page === 'game') {
    setupGameHandlers(els);
  } else {
    // Fallback for unified single page
    setupIndexHandlers(els);
    setupGameHandlers(els);
  }
});

// ==========================================
// Page 1: Vault / Index Handlers
// ==========================================
function setupIndexHandlers(els) {
  // Toggle Rejoin Code Container
  if (els.toggleRejoinBtn && els.rejoinCodeContainer) {
    els.toggleRejoinBtn.addEventListener('click', () => {
      els.rejoinCodeContainer.classList.toggle('hidden');
      const isHidden = els.rejoinCodeContainer.classList.contains('hidden');
      els.toggleRejoinBtn.textContent = isHidden ? 'REJOIN WITH CODE 🔑' : 'CANCEL CODE ENTRY ✖';
    });
  }

  // Vault Entry / Redirect Trigger
  els.loginSubmitBtn?.addEventListener('click', () => {
    const nickname = els.loginUsernameInput?.value.trim().toUpperCase() || '';
    const roomCode = els.rejoinRoomCodeInput?.value.trim().toUpperCase() || '';

    if (!nickname) {
      if (els.loginStatus) {
        els.loginStatus.textContent = "PLEASE ENTER YOUR NAME";
        els.loginStatus.style.color = "#f43f5e";
      }
      return;
    }

    sessionStorage.setItem("current_nickname", nickname);
    if (roomCode) {
      sessionStorage.setItem("current_room_code", roomCode);
    }

    // Animate door opening and navigate to game page
    triggerVaultDoorOpen(() => {
      window.location.href = "game.html";
    });
  });
}

// ==========================================
// Page 2: Game Arena Handlers
// ==========================================
function setupGameHandlers(els) {
  if (typeof io !== "undefined" && !window.socket) {
    window.socket = io();
  }

  setupGameplaySocketListeners(els);

  // Auto-fill from query parameters if present
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  if (urlRoom && els.joinRoomCodeInput) {
    els.joinRoomCodeInput.value = urlRoom.toUpperCase();
  }

  // Load persisted state
  const savedRoom = sessionStorage.getItem("current_room_code");
  const savedNick = sessionStorage.getItem("current_nickname");

  if (savedNick && els.joinNicknameInput) els.joinNicknameInput.value = savedNick;
  if (savedRoom && els.joinRoomCodeInput) els.joinRoomCodeInput.value = savedRoom;

  // Auto-Join game if redirected with stored room code
  if (savedRoom && savedNick && window.socket) {
    window.socket.emit('join-room', { roomCode: savedRoom, nickname: savedNick });
  }

  // Create & Launch New Room
  els.btnCreateRoom?.addEventListener('click', () => {
    const nickname = (
      els.joinNicknameInput?.value.trim() ||
      sessionStorage.getItem("current_nickname") ||
      'AGENT'
    ).toUpperCase();

    sessionStorage.setItem("current_nickname", nickname);
    window.socket?.emit('hostless-create-room', { nickname });
  });

  // Join Room Button Action
  els.btnJoinRoom?.addEventListener('click', () => {
    const roomCode = els.joinRoomCodeInput?.value.trim().toUpperCase() || '';
    const nickname = (
      els.joinNicknameInput?.value.trim() ||
      sessionStorage.getItem("current_nickname") ||
      'AGENT'
    ).toUpperCase();

    if (!roomCode) {
      alert("PLEASE ENTER A VALID ROOM CODE");
      els.joinRoomCodeInput?.focus();
      return;
    }

    sessionStorage.setItem("current_nickname", nickname);
    sessionStorage.setItem("current_room_code", roomCode);
    window.socket?.emit('join-room', { roomCode, nickname });
  });

  // Save Game Action
  els.saveGameBtn?.addEventListener('click', () => {
    window.socket?.emit("save_game_progress");
    els.saveGameBtn.disabled = true;
    els.saveGameBtn.innerText = "Saving... 💾";
  });

  // Copy Code Action
  els.copyCodeBtn?.addEventListener('click', () => {
    if (!currentRoomCode) return;
    navigator.clipboard.writeText(currentRoomCode).then(() => {
      const btnSpan = els.copyCodeBtn?.querySelector('span');
      if (btnSpan) {
        btnSpan.innerText = 'Copied Code! ✅';
        setTimeout(() => { btnSpan.innerText = 'Copy Code'; }, 2000);
      }
    });
  });

  // Leave Session Action
  els.leaveRoomBtn?.addEventListener('click', () => {
    if (confirm("Leave game session? Your scores will be lost.")) {
      sessionStorage.removeItem("current_room_code");
      sessionStorage.removeItem("current_nickname");
      window.location.href = "index.html";
    }
  });

  // Submit Guess Inputs
  els.submitGuessBtn?.addEventListener('click', () => submitGuess(els));
  els.guessInput?.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') submitGuess(els); 
  });

  // Tile Click Helper for Letter Bank
  els.letterBank?.addEventListener('click', (e) => {
    if (e.target.classList.contains('letter-tile') && els.guessInput && !els.guessInput.disabled) {
      if (e.target.classList.contains('used-tile')) return;
      
      els.guessInput.value += e.target.innerText;
      e.target.classList.add('used-tile');
      e.target.style.opacity = '0.4';
      e.target.style.pointerEvents = 'none';
      els.guessInput.focus();
    }
  });
}

// ==========================================
// Gameplay Mechanics & Actions
// ==========================================
function submitGuess(els) {
  if (!els.guessInput) return;
  const answer = els.guessInput.value.trim().toUpperCase();
  if (!answer || els.guessInput.disabled) return;

  window.socket?.emit('submit-guess', { guess: answer });
  els.guessInput.disabled = true;
  if (els.submitGuessBtn) {
    els.submitGuessBtn.disabled = true;
    els.submitGuessBtn.innerText = "Checking... ⏳";
    els.submitGuessBtn.className = "btn-locked font-orbitron";
  }
}

function resetLetterBankTiles(letterBank) {
  if (!letterBank) return;
  letterBank.querySelectorAll('.letter-tile').forEach(tile => {
    tile.classList.remove('used-tile');
    tile.style.opacity = '1';
    tile.style.pointerEvents = 'auto';
  });
}

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
// Gameplay Socket Listeners
// ==========================================
function setupGameplaySocketListeners(els) {
  const socket = window.socket;
  if (!socket || socketListenersInitialized) return;
  socketListenersInitialized = true;

  socket.on("game_saved_success", ({ roomCode, score }) => {
    alert(`Game progress saved!\nRoom Code: [${roomCode}]\nCurrent Score: ${score} PTS`);
    if (els.saveGameBtn) {
      els.saveGameBtn.disabled = false;
      els.saveGameBtn.innerText = "Save Game 💾";
    }
  });

  socket.on("game_saved_error", (errMsg) => {
    alert(errMsg);
    if (els.saveGameBtn) {
      els.saveGameBtn.disabled = false;
      els.saveGameBtn.innerText = "Save Game 💾";
    }
  });

  socket.on('player-joined-success', ({ roomCode }) => {
    currentRoomCode = roomCode;
    sessionStorage.setItem("current_room_code", roomCode);

    triggerVaultDoorOpen();

    if (els.roomCodeBadge) els.roomCodeBadge.innerText = `[${roomCode}]`;
    
    if (els.formPanel) els.formPanel.classList.add('hidden');
    
    els.resultsScreen?.classList.add('hidden');
    els.roomHeader?.classList.remove('hidden');
    els.waitingScreen?.classList.remove('hidden');
    els.topDashboard?.classList.remove('hidden');
    els.leaveRoomBtn?.classList.remove('hidden');
  });

  socket.on('player-start-puzzle', ({ scrambledLetters, avatarUrl, clue }) => {
    currentPuzzleClue = clue || '';

    els.waitingScreen?.classList.add('hidden');
    els.resultsScreen?.classList.add('hidden');
    els.playerPuzzleScreen?.classList.remove('hidden');
    
    if (els.guessInput) {
      els.guessInput.value = '';
      els.guessInput.disabled = false;
    }
    if (els.submitGuessBtn) {
      els.submitGuessBtn.disabled = false;
      els.submitGuessBtn.innerText = "Submit Guess 🎯";
      els.submitGuessBtn.className = "btn-primary font-orbitron";
    }

    if (els.puzzleImg && avatarUrl) els.puzzleImg.src = avatarUrl;
    if (els.clueText) els.clueText.innerText = `Clue: ${currentPuzzleClue}`;

    if (els.letterBank && scrambledLetters) {
      els.letterBank.innerHTML = scrambledLetters.split('').map(char => `
        <span class="letter-tile font-orbitron" style="cursor: pointer; user-select: none;">${char}</span>
      `).join('');
    }
  });

  socket.on('guess-result', ({ success, locked, feedback }) => {
    if (els.clueText) {
      els.clueText.innerText = `${feedback} | Clue: ${currentPuzzleClue}`;
    } 

    if (locked) {
      if (els.guessInput) els.guessInput.disabled = true;
      if (els.submitGuessBtn) {
        els.submitGuessBtn.disabled = true;
        els.submitGuessBtn.innerText = success ? "Correct! 🎉" : "Locked Out 🔒";
        els.submitGuessBtn.className = "btn-locked font-orbitron";
      }
    } else {
      if (els.guessInput) {
        els.guessInput.disabled = false;
        els.guessInput.value = '';
        els.guessInput.focus();
      }
      if (els.submitGuessBtn) {
        els.submitGuessBtn.disabled = false;
        els.submitGuessBtn.innerText = "Submit Guess 🎯";
        els.submitGuessBtn.className = "btn-primary font-orbitron";
      }
      resetLetterBankTiles(els.letterBank);
    }
  });

  socket.on('update-player-scores', ({ standings }) => {
    if (standings && standings.length > 0) {
      if (els.championName) els.championName.innerText = standings[0].nickname;
      if (els.playerScoreboardList) els.playerScoreboardList.innerHTML = renderStandings(standings);
    }
  });

  socket.on('reveal-results', ({ scoreboard, correctWord }) => {
    els.playerPuzzleScreen?.classList.add('hidden');
    els.waitingScreen?.classList.add('hidden');
    els.resultsScreen?.classList.remove('hidden');
    
    if (els.correctWordDisplay) els.correctWordDisplay.innerText = correctWord;

    if (els.resultsBox && scoreboard) {
      els.resultsBox.innerHTML = scoreboard.map((p, idx) => {
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

function triggerVaultDoorOpen(callback) {
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
    if (typeof callback === 'function') callback();
  }, 650);
}