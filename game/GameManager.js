/**
 * GameManager — Machine à états du jeu Squid Amphi
 * 
 * Phases : LOBBY → COUNTDOWN → PLAYING → ELIMINATION → RESULTS → VICTORY
 */

const RedLightGreenLight = require('./minigames/RedLightGreenLight');
const Dalgona = require('./minigames/Dalgona');
const TugOfWar = require('./minigames/TugOfWar');
const Marbles = require('./minigames/Marbles');
const GlassBridge = require('./minigames/GlassBridge');
const GroupGame = require('./minigames/GroupGame');
const FinalDuel = require('./minigames/FinalDuel');

// Phases du jeu
const PHASE = {
    LOBBY: 'LOBBY',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    ELIMINATION: 'ELIMINATION',
    RESULTS: 'RESULTS',
    VICTORY: 'VICTORY'
};

// Liste ordonnée des mini-jeux
const MINIGAME_LIST = [
    { name: '1, 2, 3 Soleil', factory: (gm) => new RedLightGreenLight(gm) },
    { name: 'Dalgona', factory: (gm) => new Dalgona(gm) },
    { name: 'Jeu de la Corde', factory: (gm) => new TugOfWar(gm) },
    { name: 'Billes', factory: (gm) => new Marbles(gm) },
    { name: 'Pont de Verre', factory: (gm) => new GlassBridge(gm) },
    { name: 'Jeu du Manège', factory: (gm) => new GroupGame(gm) },
    { name: 'Duel Final', factory: (gm) => new FinalDuel(gm) }
];

class GameManager {
    constructor(io) {
        this.io = io;
        this.players = {};        // { socketId: PlayerData }
        this.phase = PHASE.LOBBY;
        this.currentGameIndex = -1;
        this.currentMinigame = null;
        this.countdownTimer = 0;
        this.eliminationTimer = 0;
        this.roundNumber = 0;
    }

    // ── Gestion des joueurs ─────────────────────────────────

    addPlayer(socketId, username) {
        // Empêcher de rejoindre en cours de partie
        if (this.phase !== PHASE.LOBBY) {
            return null;
        }

        // Vérifier que le pseudo n'est pas déjà pris
        const taken = Object.values(this.players).some(
            p => p.username.toLowerCase() === username.toLowerCase()
        );
        if (taken) return null;

        // Attribuer une couleur aléatoire parmi les teintes néon
        const hue = Math.floor(Math.random() * 360);

        const player = {
            id: socketId,
            username: username,
            alive: true,
            position: { x: Math.random() * 800 + 100, y: 500 },
            score: 0,
            color: `hsl(${hue}, 100%, 60%)`,
            inputBuffer: []
        };

        this.players[socketId] = player;

        // Notifier l'écran d'affichage
        this.io.to('display').emit('player:add', player);

        // Notifier tous les joueurs de la liste mise à jour
        this._broadcastPlayerList();

        return player;
    }

    removePlayer(socketId) {
        const player = this.players[socketId];
        if (player) {
            delete this.players[socketId];
            this.io.to('display').emit('player:remove', { id: socketId });
            this._broadcastPlayerList();
        }
        return player;
    }

    _broadcastPlayerList() {
        const list = Object.values(this.players).map(p => ({
            username: p.username,
            color: p.color
        }));
        this.io.emit('lobby:players', { players: list, count: list.length });
    }

    getPlayers() {
        return this.players;
    }

    getPlayerCount() {
        return Object.keys(this.players).length;
    }

    getAlivePlayers() {
        return Object.values(this.players).filter(p => p.alive);
    }

    getAliveCount() {
        return this.getAlivePlayers().length;
    }

    // ── Élimination ─────────────────────────────────────────

    eliminatePlayer(socketId) {
        const player = this.players[socketId];
        if (player && player.alive) {
            player.alive = false;

            // Notifier le joueur éliminé
            this.io.to(socketId).emit('player:eliminated', {
                message: 'Vous avez été éliminé !'
            });

            // Notifier l'écran d'affichage
            this.io.to('display').emit('player:eliminated', {
                id: socketId,
                username: player.username
            });

            console.log(`[Game] 💀 ${player.username} éliminé ! (${this.getAliveCount()} restants)`);
        }
    }

    // ── Contrôle du jeu ─────────────────────────────────────

    resetGame() {
        this.phase = PHASE.LOBBY;
        this.currentGameIndex = -1;
        this.currentMinigame = null;
        this.roundNumber = 0;
        this.countdownTimer = 0;

        // Réinitialiser tous les joueurs
        for (const player of Object.values(this.players)) {
            player.alive = true;
            player.score = 0;
            player.position = {
                x: 100 + Math.random() * 400,
                y: 200 + Math.random() * 300
            };
        }

        this._broadcastPlayerList();
        console.log(`[Game] 🔄 Partie réinitialisée — ${this.getPlayerCount()} joueurs`);
    }

    startGame() {
        if (this.phase !== PHASE.LOBBY) return;
        if (this.getPlayerCount() < 2) {
            console.log('[Game] Il faut au moins 2 joueurs pour démarrer');
            return;
        }

        console.log(`[Game] 🎮 Partie lancée avec ${this.getPlayerCount()} joueurs !`);
        this.roundNumber = 0;
        this.nextRound();
    }

    nextRound() {
        this.currentGameIndex++;
        this.roundNumber++;

        // Vérifier victoire
        if (this.getAliveCount() <= 1 || this.currentGameIndex >= MINIGAME_LIST.length) {
            this.phase = PHASE.VICTORY;
            const winner = this.getAlivePlayers()[0];
            console.log(`[Game] 🏆 ${winner ? winner.username : 'Personne'} a gagné !`);
            this.io.emit('game:victory', {
                winner: winner || null
            });
            return;
        }

        // Lancer le countdown avant le prochain mini-jeu
        this.phase = PHASE.COUNTDOWN;
        this.countdownTimer = 5 * 20; // 5 secondes à 20 ticks/s

        const nextGame = MINIGAME_LIST[this.currentGameIndex];
        this.currentMinigame = nextGame.factory(this);

        console.log(`[Game] ⏳ Prochain jeu : ${nextGame.name} (Manche ${this.roundNumber})`);

        this.io.emit('game:countdown', {
            gameName: nextGame.name,
            roundNumber: this.roundNumber,
            duration: 5
        });
    }

    startCurrentMinigame() {
        this.phase = PHASE.PLAYING;
        this.currentMinigame.start();

        console.log(`[Game] 🎯 Manche ${this.roundNumber} lancée !`);
    }

    endCurrentMinigame() {
        this.phase = PHASE.ELIMINATION;
        this.eliminationTimer = 3 * 20; // 3 secondes de pause

        const alive = this.getAliveCount();
        console.log(`[Game] Fin de manche — ${alive} survivants`);

        this.io.to('display').emit('game:roundEnd', {
            aliveCount: alive,
            roundNumber: this.roundNumber
        });
    }

    // ── Gestion des inputs ──────────────────────────────────

    handleInput(socketId, data) {
        const player = this.players[socketId];
        if (!player || !player.alive) return;

        if (this.phase === PHASE.PLAYING && this.currentMinigame) {
            this.currentMinigame.handleInput(socketId, player, data);
        }
    }

    // ── Game Loop (appelé par le serveur à chaque tick) ─────

    update() {
        switch (this.phase) {
            case PHASE.LOBBY:
                // Rien, on attend
                break;

            case PHASE.COUNTDOWN:
                this.countdownTimer--;
                if (this.countdownTimer <= 0) {
                    this.startCurrentMinigame();
                }
                break;

            case PHASE.PLAYING:
                if (this.currentMinigame) {
                    this.currentMinigame.update();
                }
                break;

            case PHASE.ELIMINATION:
                this.eliminationTimer--;
                if (this.eliminationTimer <= 0) {
                    this.nextRound();
                }
                break;

            case PHASE.RESULTS:
                break;

            case PHASE.VICTORY:
                break;
        }
    }

    // ── État complet pour l'affichage ───────────────────────

    getFullState() {
        return {
            phase: this.phase,
            roundNumber: this.roundNumber,
            currentGame: this.currentMinigame ? MINIGAME_LIST[this.currentGameIndex]?.name : null,
            playerCount: this.getPlayerCount(),
            aliveCount: this.getAliveCount(),
            players: Object.values(this.players).map(p => ({
                id: p.id,
                username: p.username,
                alive: p.alive,
                position: p.position,
                score: p.score,
                color: p.color
            })),
            gameData: this.currentMinigame ? this.currentMinigame.getState() : null
        };
    }
}

module.exports = GameManager;
