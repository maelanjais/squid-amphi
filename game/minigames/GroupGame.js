/**
 * Mini-jeu : Jeu du Manège (Group Game / Marbles)
 * 
 * Règles :
 * - Un nombre cible est annoncé (ex: "Groupes de 3")
 * - Les joueurs doivent taper pour choisir un groupe
 * - Les groupes qui n'ont pas le bon nombre de membres sont éliminés
 * - Plusieurs manches avec des nombres différents
 */

const TICK_RATE = 20;

const CONFIG = {
    ROUNDS: 3,                  // Nombre de manches
    CHOICE_TIME: 10,            // Secondes pour choisir son groupe
    MAX_GROUPS: 6,              // Nombre max de groupes disponibles
    PAUSE_BETWEEN: 3            // Pause entre chaque manche
};

class GroupGame {
    constructor(gameManager) {
        this.gm = gameManager;
        this.round = 0;
        this.targetSize = 0;
        this.groups = {};           // groupId -> [socketIds]
        this.playerGroups = {};     // socketId -> groupId
        this.choiceTimer = 0;
        this.pauseTimer = 0;
        this.inPause = false;
        this.waitingForChoice = false;
        this.finished = false;
        this.numGroups = 0;
    }

    start() {
        this.round = 0;
        this.finished = false;
        this._startNewRound();
    }

    _startNewRound() {
        this.round++;

        if (this.round > CONFIG.ROUNDS || this.gm.getAliveCount() <= 1) {
            this._endGame();
            return;
        }

        const alive = this.gm.getAlivePlayers();
        const count = alive.length;

        // Choisir un nombre cible qui crée de l'élimination
        const possibleSizes = [];
        for (let s = 2; s <= Math.min(count - 1, 5); s++) {
            if (count % s !== 0) { // pas divisible = quelqu'un sera éliminé
                possibleSizes.push(s);
            }
        }

        if (possibleSizes.length === 0) {
            possibleSizes.push(2); // fallback
        }

        this.targetSize = possibleSizes[Math.floor(Math.random() * possibleSizes.length)];
        this.numGroups = Math.min(CONFIG.MAX_GROUPS, Math.ceil(count / this.targetSize) + 1);

        // Reset groups
        this.groups = {};
        this.playerGroups = {};
        for (let i = 1; i <= this.numGroups; i++) {
            this.groups[i] = [];
        }

        this.choiceTimer = CONFIG.CHOICE_TIME * TICK_RATE;
        this.waitingForChoice = true;
        this.inPause = false;

        // Notifier les joueurs
        this.gm.io.emit('game:groupTarget', {
            targetSize: this.targetSize,
            numGroups: this.numGroups,
            round: this.round,
            totalRounds: CONFIG.ROUNDS,
            timeLimit: CONFIG.CHOICE_TIME
        });

        console.log(`[Manège] Manche ${this.round} — Groupes de ${this.targetSize} (${this.numGroups} groupes)`);
    }

    handleInput(socketId, player, data) {
        if (this.finished || !this.waitingForChoice) return;

        if (data.type === 'chooseGroup' && data.groupId >= 1 && data.groupId <= this.numGroups) {
            // Retirer du groupe précédent
            if (this.playerGroups[socketId]) {
                const prevGroup = this.groups[this.playerGroups[socketId]];
                const idx = prevGroup.indexOf(socketId);
                if (idx !== -1) prevGroup.splice(idx, 1);
            }

            // Ajouter au nouveau groupe
            this.groups[data.groupId].push(socketId);
            this.playerGroups[socketId] = data.groupId;

            // Position visuelle
            const groupX = 100 + (data.groupId - 1) * (800 / this.numGroups);
            player.position = { x: groupX + Math.random() * 80, y: 300 + Math.random() * 200 };

            // Notifier le joueur
            this.gm.io.to(socketId).emit('game:groupJoined', { groupId: data.groupId });

            // Notifier tous — mise à jour des groupes
            this.gm.io.emit('game:groupsUpdate', this._getGroupsSummary());
        }
    }

    _getGroupsSummary() {
        const summary = {};
        for (const [gid, members] of Object.entries(this.groups)) {
            summary[gid] = {
                count: members.length,
                members: members.map(id => this.gm.getPlayers()[id]?.username || '?')
            };
        }
        return { groups: summary, targetSize: this.targetSize };
    }

    update() {
        if (this.finished) return;

        if (this.inPause) {
            this.pauseTimer--;
            if (this.pauseTimer <= 0) {
                this._startNewRound();
            }
            return;
        }

        if (this.waitingForChoice) {
            this.choiceTimer--;
            if (this.choiceTimer <= 0) {
                this._resolveRound();
            }
        }
    }

    _resolveRound() {
        this.waitingForChoice = false;

        // Joueurs vivants sans groupe → éliminés directement
        const alive = this.gm.getAlivePlayers();
        for (const p of alive) {
            if (!this.playerGroups[p.id]) {
                this.gm.eliminatePlayer(p.id);
            }
        }

        // Groupes : seuls ceux avec le bon nombre survivent
        for (const [gid, members] of Object.entries(this.groups)) {
            if (members.length !== this.targetSize) {
                for (const id of members) {
                    this.gm.eliminatePlayer(id);
                }
            }
        }

        console.log(`[Manège] Manche ${this.round} résolue — ${this.gm.getAliveCount()} survivants`);

        // Notifier le résultat
        this.gm.io.emit('game:groupResult', {
            targetSize: this.targetSize,
            groups: this._getGroupsSummary(),
            aliveCount: this.gm.getAliveCount()
        });

        if (this.gm.getAliveCount() <= 1) {
            this._endGame();
            return;
        }

        // Pause avant la prochaine manche
        this.inPause = true;
        this.pauseTimer = CONFIG.PAUSE_BETWEEN * TICK_RATE;
    }

    _endGame() {
        this.finished = true;
        console.log('[Manège] Mini-jeu terminé');
        this.gm.endCurrentMinigame();
    }

    getState() {
        return {
            type: 'groupgame',
            targetSize: this.targetSize,
            numGroups: this.numGroups,
            round: this.round,
            totalRounds: CONFIG.ROUNDS,
            groups: this._getGroupsSummary(),
            waitingForChoice: this.waitingForChoice,
            timeRemaining: this.waitingForChoice
                ? Math.max(0, Math.ceil(this.choiceTimer / TICK_RATE))
                : 0
        };
    }
}

module.exports = GroupGame;
