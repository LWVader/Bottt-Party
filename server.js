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
} catch (e) {}

db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
        room_code TEXT PRIMARY KEY,
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

// Route to serve your game layout from the root URL
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/game.html');
});

const PUZZLE_BANK = [
    // === AVATAAARS STYLE ===
    { word: "SUNGLASSES", style: "avataaars", seed: "shade-tint-98", clue: "Two dark shields across the sight, I dim the glare of blinding light. A cool facade to wear by day, I steal the sun's bright beams away." },
    { word: "EYEPATCH", style: "avataaars", seed: "pirate-captain-14", clue: "A single guard of fabric dark, I cross the face and leave my mark. One window stays open, one is blind, a sailor's secret kept behind." },
    { word: "GLASSES", style: "avataaars", seed: "spark-glasses-99", clue: "Two clear windows held in place, sitting softly on the face. I do not see, yet give you sight, to make the blurry world look bright." },
    { word: "TURBAN", style: "avataaars", seed: "royal-wrap-04", clue: "Fabric wound with careful grace, a crowning fold in every space. A traditional wrap of ancient pride, where layers of woven cloth abide." },
    { word: "HIJAB", style: "avataaars", seed: "silk-scarf-71", clue: "An elegant frame of modest grace, I wrap the hair but show the face. A silken flow of quiet pride, where sacred layers safely hide." },
    { word: "DREADLOCKS", style: "avataaars", seed: "twist-locks-32", clue: "Strands entwined in patient time, woven deep with rhythm and rhyme. Textured ropes that fall and crown, heavy paths that tumble down." },
    { word: "HAT", style: "avataaars", seed: "winter-cap-01", clue: "A cozy dome of knitted thread, I sit softly on the head. When winter winds begin to bite, I hold the warmth inside the night." },
    { word: "CROWN", style: "avataaars", seed: "monarch-gold-88", clue: "A heavy circle made of gold, a grand dominion to uphold. With jewels bright and gleaming crest, I sit upon the royal best." },
    { word: "SIDESHAVED", style: "avataaars", seed: "wave-trim-55", clue: "Clear and clean along the side, where sharp and faded paths divide. While textured waves remain on top, the razor made the margins drop." },
    { word: "AFRO", style: "avataaars", seed: "retro-puff-12", clue: "A rounded cloud of natural pride, a textured sphere where patterns hide. I grow out wide into the air, a bold and glorious crown of hair." },
    { word: "BUN", style: "avataaars", seed: "top-knot-67", clue: "Gathered tight and twisted high, I reach up toward the open sky. Tied up neatly at the crown, keeping loose strands from falling down." },
    { word: "OVERALLS", style: "avataaars", seed: "denim-straps-23", clue: "Two heavy straps upon the shoulder, tough utility built to smolder. Blue denim armor built for trade, worn over where the work is made." },
    { word: "HOODIE", style: "avataaars", seed: "street-style-zip", clue: "Comfort stitched from sleeve to sleeve, a casual shield when cold winds grieve. A relaxed pullover, soft and deep, with an attached crown to safely keep." },
    { word: "BLAZER", style: "avataaars", seed: "suit-tie-41", clue: "A sharp lapel, a structured frame, I dress to win the corporate game. Over a collar neat and white, I bring the formal style to light." },
    { word: "SWEATER", style: "avataaars", seed: "knit-collar-09", clue: "A knit embrace of cozy thread, I frame the neck and greet the head. A preppy layer, soft and clean, revealing a neat collar underneath." },
    { word: "GRAPHIC-TEE", style: "avataaars", seed: "print-shirt-83", clue: "A simple shield of casual weave, with standard crewneck and short sleeve. Upon my chest, a message or art, I wear an emblem near the heart." },
   
    // === ADVENTURER STYLE ===
    { word: "MUSTACHE", style: "adventurer", seed: "stache-man-42", clue: "I sit like a wing on the upper lip, catching the crumbs and a coffee sip. A furry companion beneath the nose, a dashing addition that proudly grows." },
    { word: "BLUSH", style: "adventurer", seed: "rosy-cheek-11", clue: "A rush of pink when the heart beats fast, a fleeting warmth that cannot last. I paint the cheeks with a sudden glow, a flustered secret you're bound to know." },
    { word: "EARRINGS", style: "adventurer", seed: "gold-loops-06", clue: "We hug the edges of left and right, catching the flash of the evening light. Metallic loops or a shiny stud, we hang from the lobes of flesh and blood." },
    { word: "SMILE", style: "adventurer", seed: "happy-grin-76", clue: "A curving bridge from cheek to cheek, I speak aloud though I am meek. I lift the spirits and warm the cold, a priceless treasure that's freely told." },
    { word: "SAD", style: "adventurer", seed: "blue-mood-19", clue: "A heavy shadow upon the face, where all the laughter leaves no trace. A downward line where the corners fall, a quiet ache that demands it all." },

    // === PERSONAS STYLE ===
    { word: "GOATEE", style: "personas", seed: "chin-scruff-44", clue: "I hug the chin but leave the cheek, a rugged patch of which you speak. An isolated island strand, upon the jawline of the man." },
    { word: "MOHAWK", style: "personas", seed: "punk-ridge-27", clue: "A razor strips my left and right, leaving a center standing tight. A defiant ridge, a rebel spine, along the crown's dividing line." },
    { word: "BEANIE", style: "personas", seed: "warm-beanie-02", clue: "A knitted crown of cozy thread, I hug the contours of your head. I hide the strands and lock the heat, to make your winter garb complete." },
    { word: "BALD", style: "personas", seed: "smooth-dome-81", clue: "Sleek and smooth, a barren space, where not a single strand takes place. Reflecting light, a polished dome, where combs will never find a home." },
    { word: "PONYTAIL", style: "personas", seed: "back-tie-38", clue: "Long locks pulled tight and bound away, to keep them clear throughout the day. I clear the neck and trail behind, by a simple ribbon tightly twined." },
    { word: "CURLS", style: "personas", seed: "bouncy-coils-95", clue: "A sea of springs upon the crown, that bounce up high and tumble down. No straight or rigid lines are seen, just tightly coiled rings supreme." },
    { word: "WINK", style: "personas", seed: "playful-glance-13", clue: "One eye is wide, the other bound, a quiet sign when no one's round. A playful flash, a secret spark, that leaves a knowing, friendly mark." },
    { word: "SQUINT", style: "personas", seed: "bright-glare-52", clue: "Narrowed down to slender slits, where doubt or blinding sunlight sits. I peer with caution through the glare, a sharp, suspicious, tight-knit stare." },

    // === BOTTTS STYLE ===
    { word: "ANTENNA", style: "bottts", seed: "radar-bot-03", clue: "I reach to the sky from a metallic head, catching the signals that others have read. Sprouting from sides with a mechanical grace, I pull down the data from infinite space." },
    { word: "GOGGLES", style: "bottts", seed: "visor-eye-84", clue: "Large mechanical glass pinned over the sight, I shield optical sensors from blinding light. A protective visor of heavy-duty design, I frame the gaze of this droid outline." },
    { word: "SENSORS", style: "bottts", seed: "scanner-unit-15", clue: "A glowing slit where eyes should be, scanning the dark so the system can see. Electronic receptors that flicker and gleam, watching the world in a digital stream." },
    { word: "CABLES", style: "bottts", seed: "exposed-wire-72", clue: "Exposed machinery, twisted and loose, carrying power and digital juice. Emerging in bundles from side panel seams, we feed the machine its electrical dreams." },
    { word: "ROUND-HEAD", style: "bottts", seed: "sphere-chassis-61", clue: "No sharp edges or corners to trace, a perfect smooth dome frames my mechanical face. Look at the chassis geometry here, a metal mind built in the shape of a sphere." },
    { word: "SQUARE-HEAD", style: "bottts", seed: "block-chassis-49", clue: "Blocky engineering and heavy-set design, my features are bound by a rigid line. With sharp ninety degrees at every border, I am a machine built for geometric order." },

    // === PROCEDURAL/ABSTRACT STYLES ===
    { word: "STRIPES", style: "stripes", seed: "38qvufi8", clue: "We run in parallel, side by side, across a canvas long and wide. We never touch, we never bend, a repeating line without an end." },
    { word: "TRIANGLES", style: "triangles", seed: "inzvldb4", clue: "Three sharp corners, three straight sides, where mathematical harmony resides. A multi-pointed, rigid frame, tell me now my geometric name." },
    { word: "SHAPES", style: "shapes", seed: "la90ar6r", clue: "A chaotic mix of form and line, where overlapping grids entwine. An abstract, colorful, crowded space, where geometry lacks a single face." },

    // === CORE ICONS STYLE ===
    { word: "SNOWFLAKE", style: "icons", seed: "20gcyut8", clue: "Born of the clouds, a silent grace, No two alike in form or face. A frozen star of crystal lace, That melts away without a trace." },
    { word: "DICE", style: "icons", seed: "zg8c494u", clue: "Six square faces, dots for eyes,I hold your fate, your fall, your rise.Though I cannot see or speak a word, My rolling tumble is widely heard." },
    { word: "FLOWER", style: "icons", seed: "9j0wljev", clue: "I drink the sun and taste the rain, I bloom in joy and fade in pain. I wear a crown of petals bright, A fragrant beacon in the light." },
    { word: "HEART", style: "bottts-neutral", seed: "xhiqivn1", clue: "It has no voice, yet speaks aloud, It pumps unseen, without a shroud. Its beats define the days we've known, In every shape that love has grown. No hinges, keys, or doors appear, Yet it holds everything you hold dear." },
    { word: "CAMERA", style: "icons", seed: "0twv69ar", clue: "I have an eye but cannot see, I steal a flash of history. I freeze a second, hold it tight, To save a memory from the night." },
    { word: "BICYCLE", style: "icons", seed: "0twv69ar", clue: "Two round legs that spin and roll, A human engine is my soul. I never speak, I have no mind, Yet leave a tracks of tracks behind." },
    { word: "ALARM", style: "icons", seed: "f2dpgmeo", clue: "Two metal ears upon my head, I shatter dreams while in your bed. I scream aloud to break the night, And force your eyes to meet the light." },
    { word: "BUG", style: "icons", seed: "juw8dl3o", clue: "A tiny phantom in the code, Or crawling on a dusty road. A multi-legged, silent fright, That keeps developers up at night." },
    { word: "BINOCULARS", style: "icons", seed: "b381cfmg", clue: "Two heavy eyes that stretch the sight, To pull the distant into light. I bring the far-off mountains near, To make the hidden world appear." },
    { word: "BOOK", style: "icons", seed: "ibrvk7h7", clue: "I have a spine but cannot stand, I hold a world within your hand. Leaf after leaf, my secrets grow, With silent words you ought to know." },
    { word: "BRIEFCASE", style: "icons", seed: "u3q44cai", clue: "Rectangular and locked up tight, I guard your secrets day and night. I hold the papers, deals, and trade, Wherever corporate fortunes are made." },
    { word: "BELL", style: "icons", seed: "f2dpgmeo", clue: "A hollow tongue inside my shell, I toll a warning or a knell. Swing me hard to make me shout, To clear a room or call them out." },
    { word: "BANK", style: "icons", seed: "u1llz3e7", clue: "I stand on pillars, tall and grand, A vault of green within the land. I guard the wealth of poor and king, Yet of myself, I own no thing." }
];

function scrambleWord(word) {
    let scrambled = word;
    while (scrambled === word) {
        scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    }
    return scrambled;
}

function generateStrictDicebearURL(puzzleItem) {
    const dynamicSeed = `room-seed-${Math.floor(Math.random() * 1000000)}`;
    let url = `https://api.dicebear.com/10.x/${puzzleItem.style}/svg?`;
    
    // Custom handling matching your specific database template structures
    if (puzzleItem.style === "icons" || puzzleItem.style === "stripes" || puzzleItem.style === "triangles" || puzzleItem.style === "shapes") {
        url += `seed=${puzzleItem.seed}`;
    } else {
        url += `seed=${puzzleItem.seed || dynamicSeed}`;
    }
    
    url += `&backgroundType=solid&backgroundColor=1982c4,8ac926,ffca3a,ff595e,6a4c93`;
    return url;
}

function getNextUniquePuzzle(roomCode) {
    const room = db.prepare(`SELECT used_puzzles FROM rooms WHERE room_code = ?`).get(roomCode);
    let usedWords = room && room.used_puzzles ? room.used_puzzles.split(',') : [];

    let availablePuzzles = PUZZLE_BANK.filter(p => !usedWords.includes(p.word));

    if (availablePuzzles.length === 0) {
        usedWords = [];
        availablePuzzles = [...PUZZLE_BANK];
    }

    const styleHistory = [];
    for (const word of usedWords) {
        const found = PUZZLE_BANK.find(p => p.word === word);
        if (found) styleHistory.push(found.style);
    }

    const remainingStyles = [...new Set(availablePuzzles.map(p => p.style))];

    let targetStyle = remainingStyles[0];
    let oldestIndex = Infinity;

    for (const style of remainingStyles) {
        const lastSeen = styleHistory.lastIndexOf(style);
        if (lastSeen === -1) {
            targetStyle = style;
            break;
        }
        if (lastSeen < oldestIndex) {
            oldestIndex = lastSeen;
            targetStyle = style;
        }
    }

    const stylePool = availablePuzzles.filter(p => p.style === targetStyle);
    const chosenPuzzle = stylePool[Math.floor(Math.random() * stylePool.length)];

    usedWords.push(chosenPuzzle.word);
    db.prepare(`UPDATE rooms SET used_puzzles = ? WHERE room_code = ?`)
      .run(usedWords.join(','), roomCode);

    return chosenPuzzle;
}

function runNextRoundSetup(roomCode) {
    const targetPuzzle = getNextUniquePuzzle(roomCode);
    const avatarUrl = generateStrictDicebearURL(targetPuzzle);

    db.prepare(`UPDATE rooms SET game_state = 'PLAYING', current_word = ?, current_clue = ?, avatar_url = ? WHERE room_code = ?`)
      .run(targetPuzzle.word, targetPuzzle.clue, avatarUrl, roomCode);

    db.prepare(`UPDATE players SET has_guessed = 0, correct_this_round = 0 WHERE room_code = ?`).run(roomCode);

    io.to(roomCode).emit('player-start-puzzle', { 
        scrambledLetters: scrambleWord(targetPuzzle.word),
        avatarUrl: avatarUrl,
        clue: targetPuzzle.clue
    });
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Backend handler: Triggered exclusively by the person creating a new game room
    socket.on('hostless-create-room', ({ nickname }) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        db.prepare(`INSERT INTO rooms (room_code, game_state, used_puzzles) VALUES (?, 'LOBBY', '')`).run(roomCode);
        db.prepare(`INSERT INTO players (player_id, room_code, nickname) VALUES (?, ?, ?)`).run(socket.id, roomCode, nickname.toUpperCase());

        socket.join(roomCode);
        socket.emit('player-joined-success', { roomCode, nickname });

        const currentStandings = db.prepare(`SELECT nickname, total_score as score FROM players WHERE room_code = ? ORDER BY total_score DESC`).all(roomCode);
        io.to(roomCode).emit('update-player-scores', { standings: currentStandings });

        // Instantly kick off the puzzle phase for the hostless room loop
        runNextRoundSetup(roomCode);
    });

   socket.on('join-room', ({ roomCode, nickname }) => {
    if (!roomCode || !nickname) {
        return socket.emit('error-message', 'Missing room code or nickname!');
    }

    roomCode = roomCode.toUpperCase().trim();
    nickname = nickname.toUpperCase().trim();

    // 1. Fetch room details
    let room = db.prepare(`SELECT * FROM rooms WHERE room_code = ?`).get(roomCode);
    if (!room) {
        return socket.emit('error-message', 'Room not found! Check your code.');
    }

    // 2. Handle Player Persistent Session (Reconnect vs New Entry)
    let player = db.prepare(`SELECT * FROM players WHERE room_code = ? AND nickname = ?`).get(roomCode, nickname);

    if (player) {
        // Reconnection: update their socket ID and mark them online
        db.prepare(`UPDATE players SET player_id = ?, is_connected = 1 WHERE room_code = ? AND nickname = ?`)
          .run(socket.id, roomCode, nickname);
    } else {
        // New player: insert fresh profile
        db.prepare(`INSERT INTO players (player_id, room_code, nickname, total_score, is_connected) VALUES (?, ?, ?, 0, 1)`)
          .run(socket.id, roomCode, nickname);
    }

    // 3. Move Socket into room channel
    socket.join(roomCode);
    
    // Crucial: Pass the roomCode and nickname object back so frontend header maps it!
    socket.emit('player-joined-success', { roomCode, nickname });

    // 4. Broadcast updated scores to everyone in the lobby
    const currentStandings = db.prepare(`SELECT nickname, total_score as score FROM players WHERE room_code = ? ORDER BY total_score DESC`).all(roomCode);
    io.to(roomCode).emit('update-player-scores', { standings: currentStandings });

    // 5. Catch-up Mechanic: Send the current active puzzle instantly if a game is running
    if (room.game_state === 'PLAYING' && room.current_word) {
        // Double-check your database helper utility function names match (e.g., scrambleWord or scramble)
        const scrambled = typeof scrambleWord === 'function' ? scrambleWord(room.current_word) : room.current_word.split('').sort(() => 0.5 - Math.random()).join('');
        
        socket.emit('player-start-puzzle', { 
            scrambledLetters: scrambled,
            avatarUrl: room.avatar_url || room.current_avatar, // fallback depending on your schema setup
            clue: room.current_clue || room.clue
        });
    }
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
            io.to(player.room_code).emit('reveal-results', { scoreboard: updatedStandings, correctWord: room.current_word });

            // ⏱️ Auto-advance loop: setup 10-second timer to start the next round
            setTimeout(() => {
                runNextRoundSetup(player.room_code);
            }, 10000);
        }
    });

    socket.on('disconnect', () => {
        db.prepare(`UPDATE players SET is_connected = 0 WHERE player_id = ?`).run(socket.id);
        const player = db.prepare(`SELECT room_code FROM players WHERE player_id = ?`).get(socket.id);
        if (player) {
            const currentStandings = db.prepare(`SELECT nickname, total_score as score FROM players WHERE room_code = ? ORDER BY total_score DESC`).all(player.room_code);
            io.to(player.room_code).emit('update-player-scores', { standings: currentStandings });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Hostless Server running on port ${PORT}`));