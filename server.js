const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 💾 Initialize SQLite persistent database file
const db = new Database('database.db');
try {
    db.exec(`ALTER TABLE rooms ADD COLUMN used_puzzles TEXT DEFAULT '';`);
} catch (e) {
}

db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
        room_code TEXT PRIMARY KEY,
        host_id TEXT,
        game_state TEXT DEFAULT 'LOBBY',
        current_word TEXT,
        current_clue TEXT,
        avatar_url TEXT,
        used_puzzles TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS players (
        player_id TEXT PRIMARY KEY,
        room_code TEXT,
        nickname TEXT,
        total_score INTEGER DEFAULT 0,
        has_guessed INTEGER DEFAULT 0,
        correct_this_round INTEGER DEFAULT 0,
        is_connected INTEGER DEFAULT 1,
        FOREIGN KEY(room_code) REFERENCES rooms(room_code)
    );
`);

app.use(express.static('public'));

const PUZZLE_BANK = [
    // === AVATAAARS STYLE ===
    { word: "SUNGLASSES", style: "avataaars", seed: "shade-tint-98", clue: "Look closely at the dark tinted fashion eyewear protection on this character." },
    { word: "EYEPATCH", style: "avataaars", seed: "pirate-captain-14", clue: "Ahoy! One eye is completely covered up by a classic dark pirate style patch." },
    { word: "GLASSES", style: "avataaars", seed: "spark-glasses-99", clue: "Check the eyes! The character is wearing round, clear, thick-rimmed reading frames." },
    { word: "TURBAN", style: "avataaars", seed: "royal-wrap-04", clue: "Traditional wrapped headwear fashion spotted on the crown profile." },
    { word: "HIJAB", style: "avataaars", seed: "silk-scarf-71", clue: "An elegant wrapped head scarf item covering the top hair layers entirely." },
    { word: "DREADLOCKS", style: "avataaars", seed: "twist-locks-32", clue: "Look at that hairstyle texture: distinct structural twists and long locks." },
    { word: "HAT", style: "avataaars", seed: "winter-cap-01", clue: "Classic winter wear. A soft, warm beanie-style cap sits on their head." },
    { word: "CROWN", style: "avataaars", seed: "monarch-gold-88", clue: "Absolute royalty! This character is sporting a golden headpiece fit for a monarch." },
    { word: "SIDESHAVED", style: "avataaars", seed: "wave-trim-55", clue: "A modern trim style featuring short, textured waves on top with clean margins." },
    { word: "AFRO", style: "avataaars", seed: "retro-puff-12", clue: "A beautifully large, rounded, highly textured hair silhouette." },
    { word: "BUN", style: "avataaars", seed: "top-knot-67", clue: "Updo fashion! The hair is gathered and tied neatly on the back of the crown." },
    { word: "OVERALLS", style: "avataaars", seed: "denim-straps-23", clue: "Workplace utility outfit. Classic strapped denim attire over a plain tee." },
    { word: "HOODIE", style: "avataaars", seed: "street-style-zip", clue: "Comfy casual street attire. Look for a relaxed pullover with an attached hood look." },
    { word: "BLAZER", style: "avataaars", seed: "suit-tie-41", clue: "Dressed to impress! A formal business jacket over a collared dress shirt." },
    { word: "SWEATER", style: "avataaars", seed: "knit-collar-09", clue: "Preppy layer look. A casual knit top revealing a neat shirt collar underneath." },
    { word: "GRAPHIC-TEE", style: "avataaars", seed: "print-shirt-83", clue: "Casual street fashion. A basic crewneck t-shirt featuring a prominent chest print design." },

    // === ADVENTURER STYLE ===
    { word: "MUSTACHE", style: "adventurer", seed: "stache-man-42", clue: "Facial hair addition! A prominent upper lip hair configuration." },
    { word: "BLUSH", style: "adventurer", seed: "rosy-cheek-11", clue: "A rosy, flustered skin texture overlay accenting both left and right cheeks." },
    { word: "EARRINGS", style: "adventurer", seed: "gold-loops-06", clue: "Look very closely at the earlobe margins for decorative metallic loops or studs." },
    { word: "SMILE", style: "adventurer", seed: "happy-grin-76", clue: "Pure happiness. Spot a wide, open-mouthed grinning expression on this face." },
    { word: "SAD", style: "adventurer", seed: "blue-mood-19", clue: "Melancholy vibes. The mouth line curves sharply downward in a clear frown." },

    // === PERSONAS STYLE ===
    { word: "GOATEE", style: "personas", seed: "chin-scruff-44", clue: "Facial hair configuration focusing an isolated beard element around the chin zone." },
    { word: "MOHAWK", style: "personas", seed: "punk-ridge-27", clue: "A distinctive strip of hair running down the center with shaved sides." },
    { word: "BEANIE", style: "personas", seed: "warm-beanie-02", clue: "A snug, knitted winter cap component covering up the hair layers completely." },
    { word: "BALD", style: "personas", seed: "smooth-dome-81", clue: "Sleek and aerodynamic. This character doesn't have a single strand of hair on top." },
    { word: "PONYTAIL", style: "personas", seed: "back-tie-38", clue: "Long locks pulled back tightly and secured, leaving the neck area clear." },
    { word: "CURLS", style: "personas", seed: "bouncy-coils-95", clue: "Highly bouncy, wavy, and tightly coiled lock textures across the main scalp." },
    { word: "WINK", style: "personas", seed: "playful-glance-13", clue: "A playful facial expression! One eye is wide open while the other is fully shut." },
    { word: "SQUINT", style: "personas", seed: "bright-glare-52", clue: "Suspicious thoughts or bright lights. The eyes are narrowed down to thin slits." },

    // === BOTTTS STYLE ===
    { word: "ANTENNA", style: "bottts", seed: "radar-bot-03", clue: "Signal receiver arrays sticking straight out from the sides of this droid head." },
    { word: "GOGGLES", style: "bottts", seed: "visor-eye-84", clue: "Protective visors or large mechanical viewing glass pinned over the optical sensors." },
    { word: "SENSORS", style: "bottts", seed: "scanner-unit-15", clue: "Electronic optical receptors. Look for glowing horizontal camera slits instead of eyes." },
    { word: "CABLES", style: "bottts", seed: "exposed-wire-72", clue: "Exposed machinery. Wire bundles or loose connection cords emerging from the side panels." },
    { word: "ROUND-HEAD", style: "bottts", seed: "sphere-chassis-61", clue: "Look at the chassis geometry. This droid has an entirely circular dome head frame." },
    { word: "SQUARE-HEAD", style: "bottts", seed: "block-chassis-49", clue: "Blocky engineering. The robot's face structure is framed by sharp 90-degree corners." },

    // === PROCEDURAL/ABSTRACT STYLES ===
    { word: "STRIPES", style: "stripes", seed: "38qvufi8", clue: "Count the parallel tracks. A repeating linear canvas pattern dominating the entire frame." },
    { word: "TRIANGLES", style: "triangles", seed: "inzvldb4", clue: "Three corners, three sides. Look for a sharp, multi-pointed mathematical arrangement layout." },
    { word: "SHAPES", style: "shapes", seed: "la90ar6r", clue: "A chaotic mix of overlapping geometric configurations forming a colorful abstract grid." },

    // === CORE ICONS STYLE (DIRECT INJECTION) ===
    { word: "SNOWFLAKE", style: "icons", seed: "20gcyut8", clue: "Think of winter! A beautiful, symmetrical frozen ice crystal design." },
    { word: "DICE", style: "icons", seed: "zg8c494u", clue: "Roll for initiative! A classic 3D block layout used in tabletop board games." },
    { word: "FLOWER", style: "icons", seed: "9j0wljev", clue: "A clean organic emblem symbol mimicking natural petals and plant growth patterns." },
    { word: "HEART", style: "bottts-neutral", seed: "xhiqivn1", clue: "The universal icon symbol for affection. A perfectly symmetrical two-lobed silhouette." },
    { word: "CAMERA", style: "icons", seed: "0twv69ar", clue: "Say cheese! A tech device frame used to capture photographs or record videos." },
    { word: "BICYCLE", style: "icons", seed: "0twv69ar", clue: "Eco-friendly travel. A classic human-powered transit frame featuring two wheels." },
    { word: "ALARM", style: "icons", seed: "f2dpgmeo", clue: "Time to wake up! A classic desk clock featuring ringing twin metal bells on top." },
    { word: "BUG", style: "icons", seed: "juw8dl3o", clue: "Developer nightmares or creepy crawlies. A tiny multi-legged insect vector outline." },
    { word: "BINOCULARS", style: "icons", seed: "b381cfmg", clue: "Spying from afar. A dual-lens optical viewing system used for long-distance scouting." },
    { word: "BOOK", style: "icons", seed: "ibrvk7h7", clue: "Knowledge base. A clear visual layout showing an open paper binder ready to read." },
    { word: "BRIEFCASE", style: "icons", seed: "u3q44cai", clue: "Corporate business style. A handheld hard-shelled rectangular storage unit for travel." },
    { word: "BELL", style: "icons", seed: "f2dpgmeo", clue: "Alert notifications! A classic metallic ringing chimer hanging by its crown handle." },
    { word: "BANK", style: "icons", seed: "u1llz3e7", clue: "Financial building profile. Features traditional concrete structural pillars and triangular roof margins." }
];

function scrambleWord(word) {
    let scrambled = word;
    while (scrambled === word) {
        scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    }
    return scrambled;
}

// ⚙️ Core Builder forcing unique character generation while locking target components
function generateStrictDicebearURL(puzzleItem) {
    // 1. Generate a completely random seed so other facial features randomize every round
    const dynamicSeed = `room-seed-${Math.floor(Math.random() * 1000000)}`;
    let url = `https://api.dicebear.com/10.x/${puzzleItem.style}/svg?`;
    
    if (puzzleItem.param === "seed") {
        // Handle abstract icons explicitly via structural seed injection
        url += `seed=${puzzleItem.variant}`;
    } else if (puzzleItem.param && puzzleItem.variant) {
        // Provide BOTH the randomized facial seed AND force the exact item configuration
        url += `seed=${dynamicSeed}&${puzzleItem.param}=${puzzleItem.variant}&${puzzleItem.param}Probability=100`;
    } else {
        // Fallback procedural rules for purely abstract systems (stripes, triangles, shapes)
        url += `seed=${dynamicSeed}`;
    }
    
    // Aesthetic additions
    url += `&backgroundType=solid&backgroundColor=1982c4,8ac926,ffca3a,ff595e,6a4c93`;
    return url;
}

// 📦 Smart Round Robin Selector: Evenly balances style distribution
function getNextUniquePuzzle(roomCode) {
    // 1. Fetch room details
    const room = db.prepare(`SELECT used_puzzles FROM rooms WHERE room_code = ?`).get(roomCode);
    let usedWords = room && room.used_puzzles ? room.used_puzzles.split(',') : [];

    // Filter down to what's left in the global deck
    let availablePuzzles = PUZZLE_BANK.filter(p => !usedWords.includes(p.word));

    // Reset loop index entirely if the total puzzle bank has been fully depleted
    if (availablePuzzles.length === 0) {
        usedWords = [];
        availablePuzzles = [...PUZZLE_BANK];
    }

    // 2. Identify style metrics to find out what has been played in this specific room
    const styleHistory = [];
    for (const word of usedWords) {
        const found = PUZZLE_BANK.find(p => p.word === word);
        if (found) styleHistory.push(found.style);
    }

    // Get a list of unique styles still containing unplayed puzzles
    const remainingStyles = [...new Set(availablePuzzles.map(p => p.style))];

    // 3. Determine the least-recently used (LRU) style
    let targetStyle = remainingStyles[0];
    let oldestIndex = Infinity;

    for (const style of remainingStyles) {
        // Find the last time this style appeared in the history queue
        const lastSeen = styleHistory.lastIndexOf(style);
        
        // If a style has NEVER been played yet this game, prioritize it instantly
        if (lastSeen === -1) {
            targetStyle = style;
            break;
        }
        
        // Find the style that was played furthest back in time
        if (lastSeen < oldestIndex) {
            oldestIndex = lastSeen;
            targetStyle = style;
        }
    }

    // 4. Narrow pool down to unplayed puzzles matching our target style
    const stylePool = availablePuzzles.filter(p => p.style === targetStyle);
    
    // Pick a random puzzle from within that balanced style pool
    const chosenPuzzle = stylePool[Math.floor(Math.random() * stylePool.length)];

    // 5. Update SQLite persistence string
    usedWords.push(chosenPuzzle.word);
    db.prepare(`UPDATE rooms SET used_puzzles = ? WHERE room_code = ?`)
      .run(usedWords.join(','), roomCode);

    return chosenPuzzle;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('create-room', () => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const insertRoom = db.prepare(`INSERT INTO rooms (room_code, host_id, game_state, used_puzzles) VALUES (?, ?, 'LOBBY', '')`);
        insertRoom.run(roomCode, socket.id);
        socket.join(roomCode);
        socket.emit('room-created', roomCode);
    });

    socket.on('join-room', ({ roomCode, nickname }) => {
        roomCode = roomCode.toUpperCase();
        const room = db.prepare(`SELECT * FROM rooms WHERE room_code = ?`).get(roomCode);
        if (!room) return socket.emit('error-message', 'Room not found!');

        let player = db.prepare(`SELECT * FROM players WHERE room_code = ? AND nickname = ?`).get(roomCode, nickname.toUpperCase());

        if (player) {
            db.prepare(`UPDATE players SET player_id = ?, is_connected = 1 WHERE room_code = ? AND nickname = ?`)
              .run(socket.id, roomCode, nickname.toUpperCase());
        } else {
            if (room.game_state !== 'LOBBY') return socket.emit('error-message', 'Game already started!');
            db.prepare(`INSERT INTO players (player_id, room_code, nickname) VALUES (?, ?, ?)`).run(socket.id, roomCode, nickname.toUpperCase());
        }

        socket.join(roomCode);
        socket.emit('player-joined-success', { roomCode, nickname });

        const currentStandings = db.prepare(`SELECT nickname, total_score as score FROM players WHERE room_code = ? ORDER BY total_score DESC`).all(roomCode);
        io.to(roomCode).emit('update-player-scores', { standings: currentStandings });

        const activePlayers = db.prepare(`SELECT nickname FROM players WHERE room_code = ? AND is_connected = 1`).all(roomCode);
        io.to(room.host_id).emit('update-player-list', activePlayers.map(p => p.nickname));

        if (room.game_state === 'PLAYING') {
            socket.emit('player-start-puzzle', { scrambledLetters: scrambleWord(room.current_word) });
        }
    });

    socket.on('start-game', ({ roomCode }) => {
        const room = db.prepare(`SELECT * FROM rooms WHERE room_code = ?`).get(roomCode);
        if (!room || room.host_id !== socket.id) return;

        // Guaranteed selection tracking engine call
        const targetPuzzle = getNextUniquePuzzle(roomCode);
        const avatarUrl = generateStrictDicebearURL(targetPuzzle);

        db.prepare(`UPDATE rooms SET game_state = 'PLAYING', current_word = ?, current_clue = ?, avatar_url = ? WHERE room_code = ?`)
          .run(targetPuzzle.word, targetPuzzle.clue, avatarUrl, roomCode);

        db.prepare(`UPDATE players SET has_guessed = 0, correct_this_round = 0 WHERE room_code = ?`).run(roomCode);

        io.to(room.host_id).emit('host-display-puzzle', { avatarUrl, clue: targetPuzzle.clue });
        io.to(roomCode).emit('player-start-puzzle', { scrambledLetters: scrambleWord(targetPuzzle.word) });
    });

    socket.on('submit-guess', ({ guess }) => {
        const player = db.prepare(`SELECT * FROM players WHERE player_id = ?`).get(socket.id);
        if (!player || player.has_guessed === 1) return;

        const room = db.prepare(`SELECT * FROM rooms WHERE room_code = ?`).get(player.room_code);
        const isCorrect = guess.trim().toUpperCase() === room.current_word;

        let pointsAwarded = 0;
        if (isCorrect) {
            const fastestSolver = db.prepare(`SELECT COUNT(*) as count FROM players WHERE room_code = ? AND correct_this_round = 1`).get(player.room_code);
            pointsAwarded = fastestSolver.count === 0 ? 100 : 50;
        }

        db.prepare(`UPDATE players SET has_guessed = 1, correct_this_round = ?, total_score = total_score + ? WHERE player_id = ?`)
          .run(isCorrect ? 1 : 0, pointsAwarded, socket.id);

        if (isCorrect) {
            socket.emit('guess-result', { success: true, feedback: `Correct! +${pointsAwarded} pts` });
        } else {
            socket.emit('guess-result', { success: false, feedback: `Wrong! Answer was ${room.current_word}` });
        }

        const totalActive = db.prepare(`SELECT COUNT(*) as count FROM players WHERE room_code = ? AND is_connected = 1`).get(player.room_code);
        const completedActive = db.prepare(`SELECT COUNT(*) as count FROM players WHERE room_code = ? AND is_connected = 1 AND has_guessed = 1`).get(player.room_code);

        const updatedStandings = db.prepare(`SELECT nickname, total_score as score FROM players WHERE room_code = ? ORDER BY total_score DESC`).all(player.room_code);
        io.to(player.room_code).emit('update-player-scores', { standings: updatedStandings });

        if (completedActive.count >= totalActive.count) {
            db.prepare(`UPDATE rooms SET game_state = 'RESULTS' WHERE room_code = ?`).run(player.room_code);
            io.to(room.host_id).emit('reveal-results', { scoreboard: updatedStandings, correctWord: room.current_word });
        }
    });

    socket.on('host-restart-round', ({ roomCode }) => {
        const room = db.prepare(`SELECT host_id FROM rooms WHERE room_code = ?`).get(roomCode);
        if (room && room.host_id === socket.id) {
            io.to(roomCode).emit('reset-player-controller');
            io.to(socket.id).emit('trigger-next-round', { roomCode });
        }
    });

    socket.on('force-end-round', ({ roomCode }) => {
        const room = db.prepare(`SELECT * FROM rooms WHERE room_code = ?`).get(roomCode);
        if (!room || room.host_id !== socket.id) return;

        db.prepare(`UPDATE rooms SET game_state = 'RESULTS' WHERE room_code = ?`).run(roomCode);
        const scoreboard = db.prepare(`SELECT nickname, total_score as score FROM players WHERE room_code = ? ORDER BY total_score DESC`).all(roomCode);
        
        io.to(room.host_id).emit('reveal-results', { scoreboard, correctWord: room.current_word });
        io.to(roomCode).emit('update-player-scores', { standings: scoreboard });
    });

    socket.on('player-leave-room', () => {
        const player = db.prepare(`SELECT * FROM players WHERE player_id = ?`).get(socket.id);
        if (player) {
            db.prepare(`DELETE FROM players WHERE player_id = ?`).run(socket.id);
            const activePlayers = db.prepare(`SELECT nickname FROM players WHERE room_code = ? AND is_connected = 1`).all(player.room_code);
            const room = db.prepare(`SELECT host_id FROM rooms WHERE room_code = ?`).get(player.room_code);
            if (room) io.to(room.host_id).emit('update-player-list', activePlayers.map(p => p.nickname));
            
            const currentStandings = db.prepare(`SELECT nickname, total_score as score FROM players WHERE room_code = ? ORDER BY total_score DESC`).all(player.room_code);
            io.to(player.room_code).emit('update-player-scores', { standings: currentStandings });
        }
    });

    socket.on('disconnect', () => {
        db.prepare(`UPDATE players SET is_connected = 0 WHERE player_id = ?`).run(socket.id);
        const player = db.prepare(`SELECT room_code FROM players WHERE player_id = ?`).get(socket.id);
        if (player) {
            const room = db.prepare(`SELECT host_id FROM rooms WHERE room_code = ?`).get(player.room_code);
            const activePlayers = db.prepare(`SELECT nickname FROM players WHERE room_code = ? AND is_connected = 1`).all(player.room_code);
            if (room) io.to(room.host_id).emit('update-player-list', activePlayers.map(p => p.nickname));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Persistent Server running on port ${PORT}`));