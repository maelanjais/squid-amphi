/**
 * Mini-jeu : 1, 2, 3 Soleil (Red Light, Green Light)
 * 
 * Règles :
 * - Alternance entre feu VERT (avancer) et feu ROUGE (ne pas bouger)
 * - Pendant le feu vert, les joueurs tapotent pour avancer
 * - Pendant le feu rouge, tout input = élimination
 * - Objectif : atteindre la ligne d'arrivée (position.x >= FINISH_LINE)
 * - Les derniers à ne pas avoir atteint la ligne sont éliminés
 */

const TICK_RATE = 20;

// Configuration
const CONFIG = {
    FINISH_LINE: 950,           // Position X de la ligne d'arrivée
    START_LINE: 50,             // Position X de départ
    MOVE_SPEED: 8,              // Pixels par tap pendant le vert
    GREEN_MIN_DURATION: 3,      // Durée min du feu vert (secondes)
    GREEN_MAX_DURATION: 7,      // Durée max du feu vert (secondes)
    RED_MIN_DURATION: 2,        // Durée min du feu rouge (secondes)
    RED_MAX_DURATION: 5,        // Durée max du feu rouge (secondes)
    GRACE_PERIOD: 0.5,          // Délai de grâce après changement (secondes)
    GAME_DURATION: 60,          // Durée max du jeu (secondes)
    ELIMINATE_PERCENT: 0.5      // % de joueurs à éliminer si le temps expire
};

class RedLightGreenLight {
    constructor(gameManager) {
        this.gm = gameManager;
        this.light = 'GREEN';      // GREEN ou RED
        this.lightTimer = 0;       // Ticks restants avant changement
        this.graceTimer = 0;       // Ticks de grâce après changement
        this.gameTimer = 0;        // Ticks total du jeu
        this.maxGameTicks = CONFIG.GAME_DURATION * TICK_RATE;
        this.finished = false;
        this.finishedPlayers = [];  // Joueurs ayant franchi la ligne
    }

    start() {
        // Placer tous les joueurs vivants sur la ligne de départ
        const players = this.gm.getPlayers();
        for (const player of Object.values(players)) {
            if (player.alive) {
                player.position.x = CONFIG.START_LINE;
                player.position.y = 300 + Math.random() * 200; // Étaler verticalement
            }
        }

        // Commencer en vert
        this.light = 'GREEN';
        this.lightTimer = this._randomDuration(CONFIG.GREEN_MIN_DURATION, CONFIG.GREEN_MAX_DURATION);
        this.gameTimer = 0;
        this.finished = false;
        this.finishedPlayers = [];

        console.log('[1,2,3 Soleil] 🟢 FEU VERT — GO !');
    }

    handleInput(socketId, player, data) {
        if (this.finished) return;

        // Pendant la période de grâce, ignorer les inputs
        if (this.graceTimer > 0) return;

        if (this.light === 'RED') {
            // 💀 Mouvement pendant le rouge = ÉLIMINÉ
            this.gm.eliminatePlayer(socketId);
            console.log(`[1,2,3 Soleil] 💀 ${player.username} a bougé pendant le rouge !`);
        } else {
            // ✅ Avancer pendant le vert
            if (data.type === 'tap' || data.type === 'move') {
                player.position.x += CONFIG.MOVE_SPEED;

                // Vérifier si le joueur a franchi la ligne
                if (player.position.x >= CONFIG.FINISH_LINE) {
                    player.position.x = CONFIG.FINISH_LINE;
                    if (!this.finishedPlayers.includes(socketId)) {
                        this.finishedPlayers.push(socketId);
                        player.score += 100;
                        console.log(`[1,2,3 Soleil] 🏁 ${player.username} a franchi la ligne ! (+100 points)`);

                        this.gm.io.to(socketId).emit('player:finished', {
                            message: 'Ligne franchie ! Vous êtes en sécurité.'
                        });
                    }
                }
            }
        }
    }

    update() {
        if (this.finished) return;

        this.gameTimer++;

        // Période de grâce
        if (this.graceTimer > 0) {
            this.graceTimer--;
        }

        // Timer du feu
        this.lightTimer--;
        if (this.lightTimer <= 0) {
            this._toggleLight();
        }

        // Vérifier fin de jeu : tous les vivants ont franchi la ligne
        const alivePlayers = this.gm.getAlivePlayers();
        const allFinished = alivePlayers.every(p => this.finishedPlayers.includes(p.id));

        if (allFinished && alivePlayers.length > 0) {
            this._endGame();
            return;
        }

        // Vérifier fin de jeu : temps écoulé
        if (this.gameTimer >= this.maxGameTicks) {
            this._timeUp();
            return;
        }

        // Vérifier s'il ne reste plus qu'un joueur
        if (this.gm.getAliveCount() <= 1) {
            this._endGame();
        }
    }

    _toggleLight() {
        if (this.light === 'GREEN') {
            this.light = 'RED';
            this.lightTimer = this._randomDuration(CONFIG.RED_MIN_DURATION, CONFIG.RED_MAX_DURATION);
            this.graceTimer = Math.floor(CONFIG.GRACE_PERIOD * TICK_RATE);
            console.log('[1,2,3 Soleil] 🔴 FEU ROUGE — STOP !');
        } else {
            this.light = 'GREEN';
            this.lightTimer = this._randomDuration(CONFIG.GREEN_MIN_DURATION, CONFIG.GREEN_MAX_DURATION);
            this.graceTimer = Math.floor(CONFIG.GRACE_PERIOD * TICK_RATE);
            console.log('[1,2,3 Soleil] 🟢 FEU VERT — GO !');
        }

        // Notifier tous les clients
        this.gm.io.emit('game:lightChange', { light: this.light });
    }

    _timeUp() {
        console.log('[1,2,3 Soleil] ⏰ Temps écoulé !');

        // Éliminer ceux qui n'ont pas franchi la ligne
        const alivePlayers = this.gm.getAlivePlayers();
        for (const player of alivePlayers) {
            if (!this.finishedPlayers.includes(player.id)) {
                this.gm.eliminatePlayer(player.id);
            }
        }

        this._endGame();
    }

    _endGame() {
        this.finished = true;
        console.log('[1,2,3 Soleil] ✅ Mini-jeu terminé');
        this.gm.endCurrentMinigame();
    }

    _randomDuration(minSec, maxSec) {
        const seconds = minSec + Math.random() * (maxSec - minSec);
        return Math.floor(seconds * TICK_RATE);
    }

    getState() {
        return {
            light: this.light,
            timeRemaining: Math.max(0, Math.ceil((this.maxGameTicks - this.gameTimer) / TICK_RATE)),
            finishLine: CONFIG.FINISH_LINE,
            startLine: CONFIG.START_LINE,
            finishedCount: this.finishedPlayers.length
        };
    }
}

module.exports = RedLightGreenLight;
