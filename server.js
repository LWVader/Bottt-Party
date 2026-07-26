const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const roomTimers = new Map();

// 💾 Initialize SQLite persistent database file
const db = new Database('database.db');

// Migration checks for existing databases
try {
    db.exec(`ALTER TABLE rooms ADD COLUMN used_puzzles TEXT DEFAULT '';`);
} catch (e) {}

try {
    db.exec(`ALTER TABLE players ADD COLUMN attempts INTEGER DEFAULT 0;`);
} catch (e) {}

// Table Initialization
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
        attempts INTEGER DEFAULT 0,
        correct_this_round INTEGER DEFAULT 0,
        is_connected INTEGER DEFAULT 1,
        FOREIGN KEY(room_code) REFERENCES rooms(room_code)
    );
`);

const stmts = {
    // Room Statements
    getRoom: db.prepare(`SELECT * FROM rooms WHERE room_code = ?`),
    createRoom: db.prepare(`INSERT INTO rooms (room_code, game_state) VALUES (?, 'PLAYING')`),
    getRoomUsedPuzzles: db.prepare(`SELECT used_puzzles FROM rooms WHERE room_code = ?`),
    updateRoomUsedPuzzles: db.prepare(`UPDATE rooms SET used_puzzles = ? WHERE room_code = ?`),
    updateRoomState: db.prepare(`
        UPDATE rooms 
        SET current_word = ?, current_clue = ?, avatar_url = ?, game_state = 'PLAYING' 
        WHERE room_code = ?
    `),
    updateRoomResultsState: db.prepare(`UPDATE rooms SET game_state = 'RESULTS' WHERE room_code = ?`),

    // Player Statements
    getPlayerBySocket: db.prepare(`SELECT * FROM players WHERE player_id = ?`),
    getPlayerByNickname: db.prepare(`SELECT * FROM players WHERE room_code = ? AND nickname = ?`),
    
    insertPlayer: db.prepare(`
        INSERT INTO players (player_id, room_code, nickname, total_score, has_guessed, attempts, correct_this_round, is_connected) 
        VALUES (?, ?, ?, 0, 0, 0, 0, 1)
    `),
    
    updatePlayerReconnect: db.prepare(`
        UPDATE players 
        SET player_id = ?, is_connected = 1 
        WHERE room_code = ? AND nickname = ?
    `),
    updatePlayerDisconnect: db.prepare(`UPDATE players SET is_connected = 0 WHERE player_id = ?`),
    
    // Guess & Attempt Tracking 
    incrementAttempts: db.prepare(`UPDATE players SET attempts = attempts + 1 WHERE player_id = ?`),
    
    updatePlayerCorrectGuess: db.prepare(`
        UPDATE players 
        SET total_score = COALESCE(total_score, 0) + ?, has_guessed = 1, correct_this_round = 1 
        WHERE player_id = ?
    `),
    
    resetPlayersForNewRound: db.prepare(`
        UPDATE players 
        SET has_guessed = 0, attempts = 0, correct_this_round = 0 
        WHERE room_code = ?
    `),

    // Round Progression & Active Player Checks
    getCorrectCountThisRound: db.prepare(`
        SELECT COUNT(*) AS count FROM players 
        WHERE room_code = ? AND correct_this_round = 1
    `),
    getTotalActivePlayers: db.prepare(`
        SELECT COUNT(*) AS count FROM players 
        WHERE room_code = ? AND is_connected = 1
    `),
    getFinishedActivePlayers: db.prepare(`
        SELECT COUNT(*) AS count FROM players 
        WHERE room_code = ? AND is_connected = 1 AND (has_guessed = 1 OR attempts >= 3)
    `),

    // Standings / Scoreboard 
    getStandings: db.prepare(`
        SELECT 
            nickname, 
            COALESCE(total_score, 0) AS total_score, 
            has_guessed, 
            attempts, 
            is_connected 
        FROM players 
        WHERE room_code = ? 
        ORDER BY total_score DESC
    `)
};

module.exports = { db, stmts };

app.use(express.static('public'));

// Route to serve the game layout from the root URL
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/game.html');
});

const PUZZLE_BANK = [
    // === AVATAAARS STYLE ===
    { 
        word: "SUNGLASSES", 
        style: "Open Peeps", 
        seed: "Felix", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?headVariant=shaved3&facialHairVariant=full3&facialHairProbability=100&expressionVariant=contempt&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7&backgroundColorFill=linear&accessoriesVariant=sunglasses2&clothingColorFill=linear&clothingColor=134ec3,931a44&backgroundColorAngle=-95&accessoriesProbability=99&seed=Felix", 
        clue: "Two dark shields across the sight, I dim the glare of blinding light. A cool facade to wear by day, I steal the sun's bright beams away." 
    },
    { 
        word: "EYEPATCH", 
        style: "Open Peeps", 
        seed: "6zi25hkm", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?headVariant=hatHip&facialHairVariant=goatee1&facialHairProbability=100&expressionVariant=contempt&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7,0cdf0f&backgroundColorFill=linear&accessoriesVariant=eyepatch&clothingColorFill=linear&clothingColor=080808,e708ca,0817e7&backgroundColorAngle=-95&accessoriesProbability=99&clothingColorAngle=-160&seed=6zi25hkm", 
        clue: "A single guard of fabric dark, I cross the face and leave my mark. One window stays open, one is blind, a sailor's secret kept behind." 
    },
    { 
        word: "GLASSES", 
        style: "Open Peeps", 
        seed: "rvmuswv2", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?facialHairProbability=100&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7,0cdf0f&backgroundColorFill=linear&accessoriesVariant=glasses4&clothingColorFill=linear&clothingColor=080808,e708ca,0817e7&backgroundColorAngle=-95&accessoriesProbability=99&clothingColorAngle=-160&seed=rvmuswv2", 
        clue: "Two clear windows held in place, sitting softly on the face. I do not see, yet give you sight, to make the blurry world look bright." 
    },
    { 
        word: "TURBAN", 
        style: "Open Peeps", 
        seed: "zwce1yv2", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?facialHairProbability=100&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7,0cdf0f&backgroundColorFill=linear&accessoriesVariant=&clothingColorFill=linear&clothingColor=080808,e708ca,0817e7&backgroundColorAngle=-95&accessoriesProbability=99&clothingColorAngle=-160&headVariant=turban&seed=zwce1yv2", 
        clue: "Fabric wound with careful grace, a crowning fold in every space. A traditional wrap of ancient pride, where layers of woven cloth abide." 
    },
    { 
        word: "HIJAB", 
        style: "Open Peeps", 
        seed: "kyecwnmz", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?facialHairProbability=100&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7,0cdf0f&backgroundColorFill=linear&accessoriesVariant=&clothingColorFill=linear&clothingColor=080808,e708ca,0817e7&backgroundColorAngle=-95&accessoriesProbability=99&clothingColorAngle=-160&headVariant=hijab&facialHairVariant=&seed=kyecwnmz", 
        clue: "An elegant frame of modest grace, I wrap the hair but show the face. A silken flow of quiet pride, where sacred layers safely hide." 
    },
    { 
        word: "DREADLOCKS", 
        style: "Open Peeps", 
        seed: "8d0b1xvz", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?facialHairProbability=100&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7,0cdf0f&backgroundColorFill=linear&accessoriesVariant=&clothingColorFill=linear&clothingColor=080808,e708ca,0817e7&backgroundColorAngle=-95&accessoriesProbability=99&clothingColorAngle=-160&headVariant=twists&facialHairVariant=&seed=8d0b1xvz", 
        clue: "Strands entwined in patient time, woven deep with rhythm and rhyme. Textured ropes that fall and crown, heavy paths that tumble down." 
    },
    { 
        word: "WinterHat", 
        style: "Open Peeps", 
        seed: "s0kqog0c", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?facialHairProbability=100&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7,0cdf0f&backgroundColorFill=linear&accessoriesVariant=&clothingColorFill=linear&clothingColor=080808,e708ca,0817e7&backgroundColorAngle=-95&accessoriesProbability=99&clothingColorAngle=-160&headVariant=hatBeanie&seed=s0kqog0c", 
        clue: "A cozy dome of knitted thread, I sit softly on the head. When winter winds begin to bite, I hold the warmth inside the night." 
    },
    { 
        word: "CROWN", 
        style: "Adventurer", 
        seed: "3im0ctk7", 
        imageSrc: "https://api.dicebear.com/10.x/adventurer/svg?hairVariant=long08&backgroundColor=1a1a4d,a25bc2&backgroundColorFill=linear&backgroundColorAngle=-248&seed=3im0ctk7", 
        clue: "A heavy circle made of gold, a grand dominion to uphold. With jewels bright and gleaming crest, I sit upon the royal best." 
    },
    { 
        word: "SIDESHAVED", 
        style: "Open Peeps", 
        seed: "qbyxo51f", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?facialHairProbability=100&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7,0cdf0f&backgroundColorFill=linear&accessoriesVariant=&clothingColorFill=linear&clothingColor=080808,e708ca,0817e7&backgroundColorAngle=-95&accessoriesProbability=99&clothingColorAngle=-160&headVariant=flatTopLong&seed=qbyxo51f", 
        clue: "Clear and clean along the side, where sharp and faded paths divide. While textured waves remain on top, the razor made the margins drop." 
    },
    { 
        word: "AFRO", 
        style: "Open Peeps", 
        seed: "obnvlpg8", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?facialHairProbability=100&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7,0cdf0f&backgroundColorFill=linear&accessoriesVariant=&clothingColorFill=linear&clothingColor=080808,e708ca,0817e7&backgroundColorAngle=-95&accessoriesProbability=99&clothingColorAngle=-160&headVariant=longAfro&seed=obnvlpg8", 
        clue: "A rounded cloud of natural pride, a textured sphere where patterns hide. I grow out wide into the air, a bold and glorious crown of hair." 
    },
    { 
        word: "BUN", 
        style: "Open Peeps", 
        seed: "Felix", 
        imageSrc: "https://api.dicebear.com/10.x/open-peeps/svg?headVariant=bun2,turban&facialHairVariant=full3&facialHairProbability=100&expressionVariant=contempt&maskVariant=&backgroundColor=0cdf24,df910c,df0ca7&backgroundColorFill=linear&accessoriesVariant=&clothingColorFill=linear&clothingColor=134ec3,931a44&backgroundColorAngle=-95&seed=Felix", 
        clue: "Gathered tight and twisted high, I reach up toward the open sky. Tied up neatly at the crown, keeping loose strands from falling down." 
    },
    { 
        word: "OVERALLS", 
        style: "avataaars", 
        seed: "qrh2aii3", 
        imageSrc: "https://api.dicebear.com/10.x/avataaars/svg?clothesVariant=overall&facialHairProbability=100&topVariant=hat&backgroundColor=cedb0f,0fdb7c&backgroundColorFill=linear&hatColor=493304&seed=qrh2aii3", 
        clue: "Two heavy straps upon the shoulder, tough utility built to smolder. Blue denim armor built for trade, worn over where the work is made." 
    },
    { 
        word: "HOODIE", 
        style: "Notionists", 
        seed: "nxkyc57p", 
        imageSrc: "https://api.dicebear.com/10.x/notionists/svg?backgroundColor=5f1c8d,12bdd3&backgroundColorFill=linear&backgroundColorAngle=48&clothesGraphicProbability=100&clothesGraphicVariant=&clothesVariant=variant24&mouthVariant=variant23&gestureVariant=&seed=nxkyc57p", 
        clue: "Comfort stitched from sleeve to sleeve, a casual shield when cold winds grieve. A relaxed pullover, soft and deep, with an attached crown to safely keep." 
    },
    { 
        word: "BLAZER", 
        style: "avataaars", 
        seed: "xo70rzrf", 
        imageSrc: "https://api.dicebear.com/10.x/avataaars/svg?clothesVariant=blazerAndShirt&accessoriesVariant=&clothesGraphicVariant=&facialHairVariant=beardMedium&facialHairProbability=100&mouthVariant=smile&backgroundColor=19f578,7c19f5&backgroundColorFill=linear&seed=xo70rzrf", 
        clue: "A sharp lapel, a structured frame, I dress to win the corporate game. Over a collar neat and white, I bring the formal style to light." 
    },
    { 
        word: "SWEATER", 
        style: "avataaars", 
        seed: "mqbgf7kk", 
        imageSrc: "https://api.dicebear.com/10.x/avataaars/svg?clothesVariant=collarAndSweater&accessoriesVariant=&clothesGraphicVariant=&facialHairVariant=beardMedium&facialHairProbability=100&mouthVariant=smile&backgroundColor=19f578,7c19f5&backgroundColorFill=linear&seed=mqbgf7kk", 
        clue: "A knit embrace of cozy thread, I frame the neck and greet the head. A preppy layer, soft and clean, revealing a neat collar underneath." 
    },
    { 
        word: "GRAPHIC-TEE", 
        style: "Notionists", 
        seed: "jbdoemp2", 
        imageSrc: "https://api.dicebear.com/10.x/notionists/svg?backgroundColor=5f1c8d,12bdd3&backgroundColorFill=linear&backgroundColorAngle=48&clothesGraphicProbability=100&clothesGraphicVariant=galaxy&clothesVariant=variant02&mouthVariant=variant23&hairVariant=hat&gestureVariant=&seed=jbdoemp2", 
        clue: "A simple shield of casual weave, with standard crew neck and short sleeve. Upon my chest, a message or art, I wear an emblem near the heart." 
    },
   
    // === ADVENTURER STYLE ===
    { 
        word: "MUSTACHE", 
        style: "Toon Head", 
        seed: "826pt4x4", 
        imageSrc: "https://api.dicebear.com/10.x/toon-head/svg?beardVariant=moustacheTwirl&clothesVariant=tShirt&hairVariant=undercut&rearHairVariant=&beardProbability=100&backgroundColor=6c9d43,9d436a&backgroundColorFill=linear&seed=826pt4x4", 
        clue: "I sit like a wing on the upper lip, catching the crumbs and a coffee sip. A furry companion beneath the nose, a dashing addition that proudly grows." 
    },
    { 
        word: "BLUSH", 
        style: "avataaars", 
        seed: "lqfy9svz", 
        imageSrc: "https://api.dicebear.com/10.x/avataaars/svg?mouthVariant=eating&eyesVariant=squint&backgroundColor=114b17,ad76db&backgroundColorFill=linear&backgroundColorAngle=-80&seed=lqfy9svz", 
        clue: "A rush of pink when the heart beats fast, a fleeting warmth that cannot last. I paint the cheeks with a sudden glow, a flustered secret you're bound to know." 
    },
    { 
        word: "EARRINGS", 
        style: "Lorelei", 
        seed: "0joopc5n", 
        imageSrc: "https://api.dicebear.com/10.x/lorelei/svg?beardVariant=&earringsProbability=100&eyesVariant=variant02&hairVariant=variant13&backgroundColor=d94636,542262&backgroundColorFill=linear&backgroundColorAngle=-133&earringsColor=e2e60a&seed=0joopc5n", 
        clue: "We hug the edges of left and right, catching the flash of the evening light. Metallic loops or a shiny stud, we hang from the lobes of flesh and blood." 
    },
    { 
        word: "SMILE", 
        style: "avataaars", 
        seed: "mjebn6hx", 
        imageSrc: "https://api.dicebear.com/10.x/avataaars/svg?topVariant=bob,frizzle,shaggy,shaggyMullet,shortCurly,shortFlat,shortRound,shortWaved,sides,theCaesar,theCaesarAndSidePart&backgroundColor=1ca3d4,87d90d&backgroundColorFill=linear&accessoriesProbability=54&eyesVariant=closed,cry,default,eyeRoll,happy,hearts,side,squint,wink,winkWacky,xDizzy&mouthVariant=smile&seed=mjebn6hx", 
        clue: "A curving bridge from cheek to cheek, I speak aloud though I am meek. I lift the spirits and warm the cold, a priceless treasure that's freely told." 
    },
    { 
        word: "SAD", 
        style: "avataaars", 
        seed: "jxeo67j2", 
        imageSrc: "https://api.dicebear.com/10.x/avataaars/svg?eyesVariant=cry&topVariant=bob&backgroundColor=1ca3d4,0d1ad9&backgroundColorFill=linear&accessoriesProbability=54&mouthVariant=screamOpen&seed=jxeo67j2", 
        clue: "A heavy shadow upon the face, where all the laughter leaves no trace. A downward line where the corners fall, a quiet ache that demands it all." 
    },

    // === PERSONAS STYLE ===
    { 
        word: "GOATEE", 
        style: "Croodles", 
        seed: "e3r6ll3v", 
        imageSrc: "https://api.dicebear.com/10.x/croodles/svg?noseVariant=variant04&mouthVariant=variant12&mustacheProbability=100&mustacheVariant=&backgroundColor=74479a&beardVariant=variant05&beardProbability=100&seed=e3r6ll3v", 
        clue: "I hug the chin but leave the cheek, a rugged patch of which you speak. An isolated island strand, upon the jawline of the man." 
    },
    { 
        word: "MOHAWK", 
        style: "Big Smile", 
        seed: "ocgcrs22", 
        imageSrc: "https://api.dicebear.com/10.x/big-smile/svg?hairVariant=mohawk&backgroundColor=d55601,ea57de,2f8ab1,16ac34&backgroundColorFill=linear&backgroundColorAngle=-95&seed=ocgcrs22", 
        clue: "A razor strips my left and right, leaving a center standing tight. A defiant ridge, a rebel spine, along the crown's dividing line." 
    },
    { 
        word: "BEANIE", 
        style: "Croodles", 
        seed: "Felix", 
        imageSrc: "https://api.dicebear.com/10.x/croodles/svg?topVariant=variant24&headVariant=variant01&noseVariant=variant04&mouthVariant=variant12&mustacheProbability=100&mustacheVariant=&backgroundColor=74479a&eyesVariant=variant13&beardVariant=&beardProbability=100&seed=Felix", 
        clue: "A knitted crown of cozy thread, I hug the contours of your head. I hide the strands and lock the heat, to make your winter garb complete." 
    },
    { 
        word: "BALD", 
        style: "Big Smile", 
        seed: "lqalqsd1", 
        imageSrc: "https://api.dicebear.com/10.x/big-smile/svg?hairVariant=&backgroundColor=d55601,2f8ab1,16ac34,0d1cf2&backgroundColorFill=linear&backgroundColorAngle=-95&seed=lqalqsd1", 
        clue: "Sleek and smooth, a barren space, where not a single strand takes place. Reflecting light, a polished dome, where combs will never find a home." 
    },
    { 
        word: "PONYTAIL", 
        style: "Croodles", 
        seed: "rgzzt7em", 
        imageSrc: "https://api.dicebear.com/10.x/croodles/svg?topVariant=variant15&backgroundColor=aa40bf,19d2b3,63d219,d2193e&backgroundColorFill=linear&seed=rgzzt7em", 
        clue: "Long locks pulled tight and bound away, to keep them clear throughout the day. I clear the neck and trail behind, by a simple ribbon tightly twined." 
    },
    { 
        word: "CURLS", 
        style: "Croodles", 
        seed: "c0n31i9y", 
        imageSrc: "https://api.dicebear.com/10.x/croodles/svg?topVariant=variant18&backgroundColor=aa40bf,19d2b3,63d219,d2193e&backgroundColorFill=linear&topColor=000000,9747ff,f24e1e,4d3000,699bf7&seed=c0n31i9y", 
        clue: "A sea of springs upon the crown, that bounce up high and tumble down. No straight or rigid lines are seen, just tightly coiled rings supreme." 
    },
    { 
        word: "WINK", 
        style: "Big Smile", 
        seed: "k2c2qcwv", 
        imageSrc: "https://api.dicebear.com/10.x/big-smile/svg?eyesVariant=winking&backgroundColor=b6e3f4,801414,14806e,b1bb1b&backgroundColorFill=linear&hairColor=220f00,3a1a00,71472d,e2ba87,605de4,238d80,d56c0c&seed=k2c2qcwv", 
        clue: "One eye is wide, the other bound, a quiet sign when no one's round. A playful flash, a secret spark, that leaves a knowing, friendly mark." 
    },
    { 
        word: "SQUINT", 
        style: "Lorelei Neutral", 
        seed: "2ntolur1", 
        imageSrc: "https://api.dicebear.com/10.x/lorelei-neutral/svg?eyesVariant=variant12&eyebrowsVariant=variant05&glassesVariant=variant01&glassesProbability=100&mouthVariant=happy03&noseVariant=variant01&backgroundColor=d6b8f4,1090e0,7a0fd2&backgroundColorFill=linear&mouthColor=e10909&eyebrowsColor=4f2803&glassesColor=44df0c&seed=2ntolur1", 
        clue: "Narrowed down to slender slits, where doubt or blinding sunlight sits. I peer with caution through the glare, a sharp, suspicious, tight-knit stare." 
    },

    // === BOTTTS STYLE ===
    { 
        word: "ANTENNA", 
        style: "bottts", 
        seed: "8jafjlai", 
        imageSrc: "https://api.dicebear.com/10.x/bottts/svg?topVariant=antenna,antennaCrooked&backgroundColor=e72e0d,f2df07,7f2974,0e6fd8&backgroundColorFill=linear&seed=8jafjlai", 
        clue: "I reach to the sky from a metallic head, catching the signals that others have read. Sprouting from sides with a mechanical grace, I pull down the data from infinite space." 
    },
    { 
        word: "GOGGLES", 
        style: "bottts", 
        seed: "8pqq4rk8", 
        imageSrc: "https://api.dicebear.com/10.x/bottts/svg?backgroundColor=e72e0d,f2df07,7f2974,0e6fd8&backgroundColorFill=linear&eyesVariant=roundFrame02&seed=8pqq4rk8", 
        clue: "Large mechanical glass pinned over the sight, I shield optical sensors from blinding light. A protective visor of heavy-duty design, I frame the gaze of this droid outline." 
    },
    { 
        word: "SENSORS", 
        style: "bottts", 
        seed: "nl6j8oom", 
        imageSrc: "https://api.dicebear.com/10.x/bottts/svg?backgroundColor=e72e0d,f2df07,7f2974,0e6fd8&backgroundColorFill=linear&textureProbability=100&eyesVariant=sensor&seed=nl6j8oom", 
        clue: "A glowing slit where eyes should be, scanning the dark so the system can see. Electronic receptors that flicker and gleam, watching the world in a digital stream." 
    },
    { 
        word: "CABLES", 
        style: "bottts", 
        seed: "lcnqa9sa", 
        imageSrc: "https://api.dicebear.com/10.x/bottts/svg?backgroundColor=e72e0d,f2df07,7f2974,0e6fd8&backgroundColorFill=linear&textureProbability=100&sidesVariant=cables01,cables02&seed=lcnqa9sa", 
        clue: "Exposed machinery, twisted and loose, carrying power and digital juice. Emerging in bundles from side panel seams, we feed the machine its electrical dreams." 
    },
    { 
        word: "ROUND-HEAD", 
        style: "bottts", 
        seed: "spksjjpj9", 
        imageSrc: "https://api.dicebear.com/10.x/bottts/svg?backgroundColor=e72e0d,7f2974,0e6fd8&backgroundColorFill=linear&textureProbability=100&headVariant=round01,round02&seed=pksjjpj9", 
        clue: "No sharp edges or corners to trace, a perfect smooth dome frames my mechanical face. Look at the chassis geometry here, a metal mind built in the shape of a sphere." 
    },
    { 
        word: "SQUARE-HEAD", 
        style: "bottts", 
        seed: "osa8m8tm", 
        imageSrc: "https://api.dicebear.com/10.x/bottts/svg?backgroundColor=e72e0d,7f2974,0e6fd8&backgroundColorFill=linear&textureProbability=100&headVariant=square01,square02,square03,square04&seed=osa8m8tm", 
        clue: "Blocky engineering and heavy-set design, my features are bound by a rigid line. With sharp ninety degrees at every border, I am a machine built for geometric order." 
    },

    // === PROCEDURAL/ABSTRACT STYLES ===
    { 
        word: "STRIPES", 
        imageUrl: "https://i.postimg.cc/zGVMZP56/STRIPES.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "We run in parallel, side by side, across a canvas long and wide. We never touch, we never bend, a repeating line without an end." 
    },
    { 
        word: "TRIANGLES", 
        imageUrl: "https://i.postimg.cc/2SVJRXrf/TRIANGLES.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "Three sharp corners, three straight sides, where mathematical harmony resides. A multi-pointed, rigid frame, tell me now my geometric name." 
    },
    { 
        word: "SHAPES", 
        imageUrl: "https://i.postimg.cc/vZkKQLHS/SHAPES.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "A chaotic mix of form and line, where overlapping grids entwine. An abstract, colorful, crowded space, where geometry lacks a single face." 
    },

    // === CORE ICONS STYLE ===
    { 
        word: "SNOWFLAKE",  
        imageUrl: "https://i.postimg.cc/P597tzrR/SNOWFLAKE.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "Born of the clouds, a silent grace, No two alike in form or face. A frozen star of crystal lace, That melts away without a trace." 
    },
    { 
        word: "DICE", 
        imageUrl: "https://i.postimg.cc/K8wWZrvw/DICE.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "Six square faces, dots for eyes,I hold your fate, your fall, your rise.Though I cannot see or speak a word, My rolling tumble is widely heard." 
    },
    { 
        word: "FLOWER", 
        imageUrl: "https://i.postimg.cc/mgJnbN2q/FLOWER.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "I drink the sun and taste the rain, I bloom in joy and fade in pain. I wear a crown of petals bright, A fragrant beacon in the light." 
    },
    { 
        word: "HEART",  
        imageUrl: "https://i.postimg.cc/sgv8d0sr/HEART.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "It has no voice, yet speaks aloud, It pumps unseen, without a shroud. Its beats define the days we've known, In every shape that love has grown. No hinges, keys, or doors appear, Yet it holds everything you hold dear." 
    },
    { 
        word: "CAMERA", 
        imageUrl: "https://i.postimg.cc/9MJKj3RW/CAMERA.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "I have an eye but cannot see, I steal a flash of history. I freeze a second, hold it tight, To save a memory from the night." 
    },
    { 
        word: "BICYCLE",  
        imageUrl: "https://i.postimg.cc/y6njnXcC/BICYCLE.png?auto=format&fit=crop&w=800&q=80", 
        clue: "Two round legs that spin and roll, A human engine is my soul. I never speak, I have no mind, Yet leave a tracks of tracks behind." 
    },
    { 
        word: "ALARM", 
        imageUrl: "https://i.postimg.cc/FFGpGgcD/ALARM.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "Two metal ears upon my head, I shatter dreams while in your bed. I scream aloud to break the night, And force your eyes to meet the light." 
    },
    { 
        word: "BUG", 
        imageUrl: "https://i.postimg.cc/5ywSBLw7/Bug.png?auto=format&fit=crop&w=800&q=80", 
        clue: "A tiny phantom in the code, Or crawling on a dusty road. A multi-legged, silent fright, That keeps developers up at night." 
    },
    { 
        word: "BINOCULARS", 
        imageUrl: "https://i.postimg.cc/bYLgLHb7/BINOCULARS.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "Two heavy eyes that stretch the sight, To pull the distant into light. I bring the far-off mountains near, To make the hidden world appear." 
    },
    { 
        word: "BOOK", 
        imageUrl: "https://i.postimg.cc/kgzHnFXk/BOOK.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "I have a spine but cannot stand, I hold a world within your hand. Leaf after leaf, my secrets grow, With silent words you ought to know." 
    },
    { 
        word: "BRIEFCASE", 
        imageUrl: "https://i.postimg.cc/3xVqKCJz/BRIEFCASE.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "Rectangular and locked up tight, I guard your secrets day and night. I hold the papers, deals, and trade, Wherever corporate fortunes are made." 
    },
    { 
        word: "BELL", 
        imageUrl: "https://i.postimg.cc/44wPwbtr/BELL.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "A hollow tongue inside my shell, I toll a warning or a knell. Swing me hard to make me shout, To clear a room or call them out." 
    },
    { 
        word: "BANK", 
        imageUrl: "https://i.postimg.cc/gc4s4qR7/BANK.jpg?auto=format&fit=crop&w=800&q=80", 
        clue: "I stand on pillars, tall and grand, A vault of green within the land. I guard the wealth of poor and king, Yet of myself, I own no thing." 
    }
];

function scrambleWord(word) {
    if (!word) return '';

    // 1. Generates 5 random uppercase extra letters
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let extraLetters = '';
    for (let i = 0; i < 5; i++) {
        extraLetters += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    // 2. Combines into a single array of letters
    const letters = (word.toUpperCase() + extraLetters).split('');

    // 3. Performs Fisher-Yates shuffle algorithm
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }

    return letters.join('');
}

// This determines which image type to use based on whether an image URL (like Unsplash) is defined!
function getPuzzleImage(puzzleItem) {
    if (puzzleItem.imageSrc) {
        return puzzleItem.imageSrc;
    }
    if (puzzleItem.imageUrl) {
        return puzzleItem.imageUrl;
    }

    // Otherwise, this uses DiceBear to construct from the standard DiceBear URL
    const style = puzzleItem.style || 'bottts';
    const seed = encodeURIComponent(puzzleItem.seed || puzzleItem.word);
    
    return `https://api.dicebear.com/10.x/${style}/svg?seed=${seed}&backgroundColor=1982c4`;
}

function getNextUniquePuzzle(roomCode) {
    const room = stmts.getRoomUsedPuzzles.get(roomCode);
    let usedWords = room && room.used_puzzles ? room.used_puzzles.split(',').filter(Boolean) : [];

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
    stmts.updateRoomUsedPuzzles.run(usedWords.join(','), roomCode);

    return chosenPuzzle;
}

function runNextRoundSetup(roomCode) {
    if (roomTimers.has(roomCode)) {
        clearTimeout(roomTimers.get(roomCode));
        roomTimers.delete(roomCode);
    }

    const targetPuzzle = getNextUniquePuzzle(roomCode);
    const avatarUrl = getPuzzleImage(targetPuzzle); 

    stmts.updateRoomState.run(targetPuzzle.word, targetPuzzle.clue, avatarUrl, roomCode);
    
    stmts.resetPlayersForNewRound.run(roomCode);

    io.to(roomCode).emit('player-start-puzzle', { 
        scrambledLetters: scrambleWord(targetPuzzle.word),
        avatarUrl: avatarUrl,
        clue: targetPuzzle.clue
    });
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Create room handler
    socket.on('hostless-create-room', ({ nickname }) => {
        let roomCode;
        let exists = true;
        
        while (exists) {
            roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
            exists = stmts.getRoom.get(roomCode);
        }
        
        stmts.createRoom.run(roomCode);
        stmts.insertPlayer.run(socket.id, roomCode, nickname.toUpperCase().trim());

        socket.join(roomCode);
        socket.emit('player-joined-success', { roomCode, nickname });

        const currentStandings = stmts.getStandings.all(roomCode);
        io.to(roomCode).emit('update-player-scores', { standings: currentStandings });

        runNextRoundSetup(roomCode);
    });

    // Join room handler
    socket.on('join-room', ({ roomCode, nickname }) => {
        if (!roomCode || !nickname) {
            return socket.emit('error-message', 'Missing room code or nickname!');
        }

        roomCode = roomCode.toUpperCase().trim();
        nickname = nickname.toUpperCase().trim();

        const room = stmts.getRoom.get(roomCode);
        if (!room) {
            return socket.emit('error-message', 'Room not found! Check your code.');
        }

        const player = stmts.getPlayerByNickname.get(roomCode, nickname);

        if (player) {
            // Reconnection path
            stmts.updatePlayerReconnect.run(socket.id, roomCode, nickname);
        } else {
            // New entry path
            stmts.insertPlayer.run(socket.id, roomCode, nickname);
        }

        socket.join(roomCode);
        socket.emit('player-joined-success', { roomCode, nickname });

        const currentStandings = stmts.getStandings.all(roomCode);
        io.to(roomCode).emit('update-player-scores', { standings: currentStandings });

        // Catch-up mechanic for active games
        if (room.game_state === 'PLAYING' && room.current_word) {
            socket.emit('player-start-puzzle', { 
                scrambledLetters: scrambleWord(room.current_word),
                avatarUrl: room.avatar_url,
                clue: room.current_clue
            });
        }
    });

    // Submit guess handler
    socket.on('submit-guess', ({ guess }) => {
    const player = stmts.getPlayerBySocket.get(socket.id);
    
    // Block if player doesn't exist, already guessed correctly, or used all 3 attempts
    if (!player || player.has_guessed === 1 || player.attempts >= 3) return;

    const room = stmts.getRoom.get(player.room_code);
    if (!room || room.game_state !== 'PLAYING') return;

    // Increment player's attempt counter in the DB
    stmts.incrementAttempts.run(socket.id);
    const updatedAttempts = player.attempts + 1;
    const isCorrect = guess.trim().toUpperCase() === room.current_word;

    if (isCorrect) {
        const fastestSolver = stmts.getCorrectCountThisRound.get(player.room_code);
        const pointsAwarded = (!fastestSolver || fastestSolver.count === 0) ? 100 : 50;

        // 1. Add points to player score
        stmts.updatePlayerCorrectGuess.run(pointsAwarded, socket.id);
        
        socket.emit('guess-result', { 
            success: true, 
            locked: true,
            feedback: `Correct! +${pointsAwarded} pts` 
        });
    } else {
        const attemptsLeft = 3 - updatedAttempts;

        if (attemptsLeft > 0) {
            socket.emit('guess-result', { 
                success: false, 
                locked: false,
                attemptsLeft: attemptsLeft,
                feedback: `Wrong! ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.` 
            });
        } else {
            socket.emit('guess-result', { 
                success: false, 
                locked: true,
                attemptsLeft: 0,
                feedback: 'No attempts remaining! Locked out for this round 🔒' 
            });
        }
    }

        // Live score & scoreboard update
        const updatedStandings = stmts.getStandings.all(player.room_code);
    io.to(player.room_code).emit('update-player-scores', { standings: updatedStandings });

    // 3. Check active players to see if everyone has completed their turns
    const totalActive = stmts.getTotalActivePlayers.get(player.room_code);
    const finishedActive = stmts.getFinishedActivePlayers.get(player.room_code);

    // 4. Reveal results & start next round timer if all active players are done
    if (finishedActive.count >= totalActive.count) {
        stmts.updateRoomResultsState.run(player.room_code);
        io.to(player.room_code).emit('reveal-results', { 
            scoreboard: updatedStandings, 
            correctWord: room.current_word 
        });

        const timer = setTimeout(() => {
            runNextRoundSetup(player.room_code);
        }, 10000);

        roomTimers.set(player.room_code, timer);
        }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        const player = stmts.getPlayerBySocket.get(socket.id);
        
        stmts.updatePlayerDisconnect.run(socket.id);

        if (player) {
            const currentStandings = stmts.getStandings.all(player.room_code);
            io.to(player.room_code).emit('update-player-scores', { standings: currentStandings });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Hostless Server running on port ${PORT}`));