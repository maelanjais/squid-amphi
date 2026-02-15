/**
 * Mini-jeu : Jeu de la Corde (Tug of War)
 * 
 * Règles :
 * - Les joueurs sont divisés en 2 équipes aléatoires
 * - Chaque tap ajoute de la force à son équipe
 * - La corde glisse vers l'équipe qui tape le plus
 * - L'équipe perdante est éliminée
 */

const TICK_RATE = 20;

const CONFIG = {
    GAME_DURATION: 20,         // Durée max (secondes)
    TAP_FORCE: 1,              // Force par tap
    WIN_THRESHOLD: 100,        // Seuil pour gagner
    FRICTION: 0.2              // Réduction par tick
};

class TugOfWar {
    constructor(gameManager) {
        this.gm = gameManager;
        this.ropePosition = 0;     // Négatif = team A gagne, Positif = team B gagne
        this.teamA = [];           // socketIds
        this.teamB = [];           // socketIds
        this.gameTimer = 0;
        this.maxGameTicks = CONFIG.GAME_DURATION * TICK_RATE;
        this.finished = false;
    }

    start() {
        // Répartir les joueurs vivants en 2 équipes
        const alive = this.gm.getAlivePlayers();
        const shuffled = [...alive].sort(() => Math.random() - 0.5);
        const half = Math.ceil(shuffled.length / 2);

        this.teamA = shuffled.slice(0, half).map(p => p.id);
        this.teamB = shuffled.slice(half).map(p => p.id);

        // Placer les joueurs visuellement
        for (const p of Object.values(this.gm.getPlayers())) {
            if (this.teamA.includes(p.id)) {
                p.position = { x: 200 + Math.random() * 150, y: 250 + Math.random() * 300 };
            } else if (this.teamB.includes(p.id)) {
                p.position = { x: 650 + Math.random() * 150, y: 250 + Math.random() * 300 };
            }
        }

        this.ropePosition = 0;
        this.gameTimer = 0;
        this.finished = false;

        // Notifier les joueurs de leur équipe
        for (const id of this.teamA) {
            this.gm.io.to(id).emit('game:teamAssign', { team: 'A', side: 'left' });
        }
        for (const id of this.teamB) {
            this.gm.io.to(id).emit('game:teamAssign', { team: 'B', side: 'right' });
        }

        console.log(`[Corde] Équipe A: ${this.teamA.length} | Équipe B: ${this.teamB.length}`);
    }

    handleInput(socketId, player, data) {
        if (this.finished) return;
        if (data.type !== 'tap') return;

        if (this.teamA.includes(socketId)) {
            this.ropePosition -= CONFIG.TAP_FORCE;
        } else if (this.teamB.includes(socketId)) {
            this.ropePosition += CONFIG.TAP_FORCE;
        }
    }

    update() {
        if (this.finished) return;
        this.gameTimer++;

        // Friction — tirer la corde vers le centre
        if (Math.abs(this.ropePosition) > 0.5) {
            this.ropePosition *= (1 - CONFIG.FRICTION / TICK_RATE);
        }

        // Victoire par seuil
        if (Math.abs(this.ropePosition) >= CONFIG.WIN_THRESHOLD) {
            this._endByThreshold();
            return;
        }

        // Temps écoulé
        if (this.gameTimer >= this.maxGameTicks) {
            this._endByTime();
            return;
        }
    }

    _endByThreshold() {
        const losingTeam = this.ropePosition < 0 ? this.teamB : this.teamA;
        this._eliminateTeam(losingTeam);
    }

    _endByTime() {
        // L'équipe avec le moins de force perd
        const losingTeam = this.ropePosition <= 0 ? this.teamB : this.teamA;
        this._eliminateTeam(losingTeam);
    }

    _eliminateTeam(team) {
        for (const id of team) {
            this.gm.eliminatePlayer(id);
        }
        this.finished = true;
        console.log('[Corde] Mini-jeu terminé');
        this.gm.endCurrentMinigame();
    }

    getState() {
        return {
            type: 'tugofwar',
            ropePosition: this.ropePosition,
            threshold: CONFIG.WIN_THRESHOLD,
            teamA: this.teamA.length,
            teamB: this.teamB.length,
            timeRemaining: Math.max(0, Math.ceil((this.maxGameTicks - this.gameTimer) / TICK_RATE))
        };
    }
}

module.exports = TugOfWar;
