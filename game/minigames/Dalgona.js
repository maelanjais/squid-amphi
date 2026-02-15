/**
 * Mini-jeu : Dalgona (Le biscuit)
 * 
 * Règles :
 * - Un rythme est imposé (bip régulier)
 * - Le joueur doit taper EN RYTHME (ni trop tôt, ni trop tard)
 * - Chaque bon tap = +1 progressionChaque mauvais tap = le biscuit se fissure
 * - 3 fissures = éliminé
 * - Il faut atteindre le score cible pour survivre
 */

const TICK_RATE = 20;

const CONFIG = {
    GAME_DURATION: 25,          // Durée max (secondes)
    BEAT_INTERVAL: 1.2,         // Intervalle entre les beats (secondes)
    TOLERANCE: 0.35,            // Tolérance autour du beat (secondes)
    TARGET_SCORE: 12,           // Score à atteindre pour survivre
    MAX_CRACKS: 3               // Nombre de fissures avant élimination
};

class Dalgona {
    constructor(gameManager) {
        this.gm = gameManager;
        this.gameTimer = 0;
        this.maxGameTicks = CONFIG.GAME_DURATION * TICK_RATE;
        this.finished = false;
        this.beatTimer = 0;
        this.beatInterval = Math.floor(CONFIG.BEAT_INTERVAL * TICK_RATE);
        this.playerState = {};  // socketId -> { score, cracks, lastBeatHit }
        this.currentBeat = 0;
        this.beatActive = false;
    }

    start() {
        const alive = this.gm.getAlivePlayers();
        this.playerState = {};

        for (const p of alive) {
            this.playerState[p.id] = {
                score: 0,
                cracks: 0,
                lastBeatHit: -1
            };
            p.position = {
                x: 100 + Math.random() * 800,
                y: 200 + Math.random() * 300
            };
        }

        this.gameTimer = 0;
        this.beatTimer = this.beatInterval;
        this.currentBeat = 0;
        this.finished = false;

        console.log(`[Dalgona] Début — ${alive.length} joueurs, objectif: ${CONFIG.TARGET_SCORE} taps rythmés`);
    }

    handleInput(socketId, player, data) {
        if (this.finished) return;
        if (data.type !== 'tap') return;

        const ps = this.playerState[socketId];
        if (!ps) return;

        // Vérifier si on est dans la fenêtre de tolérance du beat
        const toleranceTicks = Math.floor(CONFIG.TOLERANCE * TICK_RATE);
        const ticksSinceBeat = this.beatInterval - this.beatTimer;
        const ticksUntilBeat = this.beatTimer;

        const inWindow = ticksSinceBeat <= toleranceTicks || ticksUntilBeat <= toleranceTicks;

        if (inWindow && ps.lastBeatHit !== this.currentBeat) {
            // Bon rythme !
            ps.score++;
            ps.lastBeatHit = this.currentBeat;
            player.score++;

            // Feedback position (avancer)
            player.position.x = 100 + (ps.score / CONFIG.TARGET_SCORE) * 800;

            this.gm.io.to(socketId).emit('game:dalgonaFeedback', { result: 'good', score: ps.score, target: CONFIG.TARGET_SCORE });

            if (ps.score >= CONFIG.TARGET_SCORE) {
                this.gm.io.to(socketId).emit('player:finished', { message: 'Biscuit découpé !' });
            }
        } else {
            // Hors rythme — fissure !
            ps.cracks++;
            this.gm.io.to(socketId).emit('game:dalgonaFeedback', { result: 'crack', cracks: ps.cracks, maxCracks: CONFIG.MAX_CRACKS });

            if (ps.cracks >= CONFIG.MAX_CRACKS) {
                this.gm.eliminatePlayer(socketId);
            }
        }
    }

    update() {
        if (this.finished) return;
        this.gameTimer++;

        // Beat timer
        this.beatTimer--;
        if (this.beatTimer <= 0) {
            this.currentBeat++;
            this.beatTimer = this.beatInterval;

            // Notifier le beat à tous
            this.gm.io.emit('game:beat', { beat: this.currentBeat });
        }

        // Temps écoulé
        if (this.gameTimer >= this.maxGameTicks) {
            this._timeUp();
            return;
        }

        if (this.gm.getAliveCount() <= 1) {
            this._endGame();
        }
    }

    _timeUp() {
        // Éliminer ceux qui n'ont pas atteint le score cible
        for (const [id, ps] of Object.entries(this.playerState)) {
            const player = this.gm.getPlayers()[id];
            if (player && player.alive && ps.score < CONFIG.TARGET_SCORE) {
                this.gm.eliminatePlayer(id);
            }
        }
        this._endGame();
    }

    _endGame() {
        this.finished = true;
        console.log('[Dalgona] Mini-jeu terminé');
        this.gm.endCurrentMinigame();
    }

    getState() {
        return {
            type: 'dalgona',
            timeRemaining: Math.max(0, Math.ceil((this.maxGameTicks - this.gameTimer) / TICK_RATE)),
            targetScore: CONFIG.TARGET_SCORE,
            beatInterval: CONFIG.BEAT_INTERVAL
        };
    }
}

module.exports = Dalgona;
