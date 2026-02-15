const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameManager = require('./game/GameManager');

// ─── Configuration ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// ─── Fichiers statiques ──────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// Routes principales
app.get('/', (req, res) => {
    res.redirect('/controller/');
});

app.get('/controller', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'controller', 'index.html'));
});

app.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display', 'index.html'));
});

// ─── Game Manager ────────────────────────────────────────────
const gameManager = new GameManager(io);

// ─── Socket.io ───────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[Socket] Nouvelle connexion : ${socket.id}`);

    // ── Inscription d'un joueur ──
    socket.on('player:join', (data) => {
        const { username } = data;
        if (!username || username.trim() === '') {
            socket.emit('error', { message: 'Pseudo requis' });
            return;
        }

        const player = gameManager.addPlayer(socket.id, username.trim());
        if (player) {
            socket.emit('player:joined', { id: socket.id, player });
            console.log(`[Game] ${username} a rejoint (${gameManager.getPlayerCount()} joueurs)`);
        } else {
            socket.emit('error', { message: 'Impossible de rejoindre (partie en cours ou pseudo déjà pris)' });
        }
    });

    // ── Inscription de l'écran d'affichage ──
    socket.on('display:join', () => {
        socket.join('display');
        socket.emit('display:state', gameManager.getFullState());
        console.log('[Display] Écran d\'affichage connecté');
    });

    // ── Input joueur (générique) ──
    socket.on('player:input', (data) => {
        gameManager.handleInput(socket.id, data);
    });

    // ── Admin : lancer la partie ──
    socket.on('admin:start', () => {
        console.log(`[Admin] Bouton START pressé — ${gameManager.getPlayerCount()} joueurs, phase: ${gameManager.phase}`);
        gameManager.startGame();
    });

    // ── Admin : réinitialiser la partie ──
    socket.on('admin:reset', () => {
        console.log('[Admin] Reset de la partie');
        gameManager.resetGame();
        io.emit('game:reset');
    });

    // ── Déconnexion ──
    socket.on('disconnect', () => {
        const removed = gameManager.removePlayer(socket.id);
        if (removed) {
            console.log(`[Game] ${removed.username} s'est déconnecté (${gameManager.getPlayerCount()} joueurs)`);
        }
    });
});

// ─── Game Loop (20 ticks/sec) ────────────────────────────────
const TICK_RATE = 20;
setInterval(() => {
    gameManager.update();

    // Envoyer l'état du jeu à l'écran d'affichage
    const state = gameManager.getFullState();
    io.to('display').emit('game:state', state);

    // Envoyer le feedback individuel à chaque joueur
    const players = gameManager.getPlayers();
    for (const [socketId, player] of Object.entries(players)) {
        io.to(socketId).emit('player:state', {
            alive: player.alive,
            position: player.position,
            score: player.score,
            gamePhase: state.phase,
            currentGame: state.currentGame,
            light: state.gameData?.light // pour 1,2,3 Soleil
        });
    }
}, 1000 / TICK_RATE);

// ─── Démarrage ───────────────────────────────────────────────
server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║           🦑  SQUID AMPHI  🦑               ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Serveur lancé sur le port ${PORT}              ║`);
    console.log('║                                              ║');
    console.log(`║  📱 Manette :  http://localhost:${PORT}/controller ║`);
    console.log(`║  🖥️  Écran   :  http://localhost:${PORT}/display    ║`);
    console.log('║                                              ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
});
