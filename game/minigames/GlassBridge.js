/**
 * Mini-jeu : Pont de Verre (Glass Bridge)
 * 
 * Règles :
 * - Les joueurs avancent sur un pont avec des dalles gauche/droite
 * - À chaque étape, il faut choisir gauche ou droite
 * - Une des deux dalles est en verre trempé (safe), l'autre se brise
 * - Mauvais choix = élimination
 * - Les joueurs avancent un par un dans un ordre aléatoire
 */

const TICK_RATE = 20;

const CONFIG = {
    STEPS: 5,                   // Nombre d'étapes du pont
    CHOICE_TIME: 8,             // Secondes pour choisir
    PAUSE_BETWEEN: 2            // Pause entre chaque joueur (secondes)
};

class GlassBridge {
    constructor(gameManager) {
        this.gm = gameManager;
        this.bridge = [];           // Array de { safe: 'left'|'right' }
        this.playerOrder = [];      // Ordre de passage
        this.currentPlayerIndex = 0;
        this.currentStep = 0;
        this.choiceTimer = 0;
        this.pauseTimer = 0;
        this.waitingForChoice = false;
        this.inPause = false;
        this.finished = false;
        this.playerChoices = {};    // socketId -> current choice
    }

    start() {
        // Générer le pont : chaque étape a un côté safe aléatoire
        this.bridge = [];
        for (let i = 0; i < CONFIG.STEPS; i++) {
            this.bridge.push({
                safe: Math.random() < 0.5 ? 'left' : 'right'
            });
        }

        // Ordre aléatoire des joueurs vivants
        const alive = this.gm.getAlivePlayers();
        this.playerOrder = [...alive].sort(() => Math.random() - 0.5).map(p => p.id);

        this.currentPlayerIndex = 0;
        this.currentStep = 0;
        this.finished = false;
        this.playerChoices = {};

        // Positionner les joueurs en file
        const players = this.gm.getPlayers();
        for (let i = 0; i < this.playerOrder.length; i++) {
            const p = players[this.playerOrder[i]];
            if (p) {
                p.position = { x: 100 + i * 30, y: 400 };
            }
        }

        console.log(`[Pont] ${this.playerOrder.length} joueurs, ${CONFIG.STEPS} étapes`);
        this._startNextTurn();
    }

    _startNextTurn() {
        // Trouver le prochain joueur vivant
        while (this.currentPlayerIndex < this.playerOrder.length) {
            const playerId = this.playerOrder[this.currentPlayerIndex];
            const player = this.gm.getPlayers()[playerId];
            if (player && player.alive) break;
            this.currentPlayerIndex++;
        }

        if (this.currentPlayerIndex >= this.playerOrder.length) {
            // Tous les joueurs sont passés à cette étape → passer à l'étape suivante
            this.currentStep++;
            this.currentPlayerIndex = 0;

            if (this.currentStep >= CONFIG.STEPS) {
                this._endGame();
                return;
            }

            // Recommencer l'ordre pour la prochaine étape
            while (this.currentPlayerIndex < this.playerOrder.length) {
                const pid = this.playerOrder[this.currentPlayerIndex];
                const pl = this.gm.getPlayers()[pid];
                if (pl && pl.alive) break;
                this.currentPlayerIndex++;
            }

            if (this.currentPlayerIndex >= this.playerOrder.length) {
                this._endGame();
                return;
            }
        }

        const currentId = this.playerOrder[this.currentPlayerIndex];
        this.choiceTimer = CONFIG.CHOICE_TIME * TICK_RATE;
        this.waitingForChoice = true;
        this.inPause = false;

        // Notifier le joueur actif de choisir
        this.gm.io.to(currentId).emit('game:choosePanel', {
            step: this.currentStep + 1,
            totalSteps: CONFIG.STEPS,
            timeLimit: CONFIG.CHOICE_TIME
        });

        // Notifier tous les clients
        this.gm.io.emit('game:bridgeTurn', {
            playerId: currentId,
            playerName: this.gm.getPlayers()[currentId]?.username,
            step: this.currentStep + 1,
            totalSteps: CONFIG.STEPS
        });
    }

    handleInput(socketId, player, data) {
        if (this.finished || !this.waitingForChoice) return;

        const currentId = this.playerOrder[this.currentPlayerIndex];
        if (socketId !== currentId) return; // Pas son tour

        if (data.type === 'choose' && (data.choice === 'left' || data.choice === 'right')) {
            this._processChoice(socketId, data.choice);
        }
    }

    _processChoice(socketId, choice) {
        this.waitingForChoice = false;
        const safeChoice = this.bridge[this.currentStep].safe;

        if (choice === safeChoice) {
            // Safe !
            const player = this.gm.getPlayers()[socketId];
            if (player) {
                player.position.x = 300 + this.currentStep * 120;
                player.score += 20;
            }
            this.gm.io.to(socketId).emit('game:bridgeResult', { result: 'safe' });
            this.gm.io.emit('game:bridgeStep', { playerId: socketId, result: 'safe', step: this.currentStep });
            console.log(`[Pont] ${player?.username} → safe !`);
        } else {
            // Éliminé !
            this.gm.io.emit('game:bridgeStep', { playerId: socketId, result: 'fall', step: this.currentStep });
            this.gm.eliminatePlayer(socketId);
        }

        // Pause puis joueur suivant
        this.inPause = true;
        this.pauseTimer = CONFIG.PAUSE_BETWEEN * TICK_RATE;
        this.currentPlayerIndex++;
    }

    update() {
        if (this.finished) return;

        if (this.inPause) {
            this.pauseTimer--;
            if (this.pauseTimer <= 0) {
                this.inPause = false;
                this._startNextTurn();
            }
            return;
        }

        if (this.waitingForChoice) {
            this.choiceTimer--;
            if (this.choiceTimer <= 0) {
                // Temps écoulé → choix aléatoire (probablement mauvais)
                const currentId = this.playerOrder[this.currentPlayerIndex];
                const randomChoice = Math.random() < 0.5 ? 'left' : 'right';
                this._processChoice(currentId, randomChoice);
            }
        }

        // Vérifier s'il reste des joueurs
        if (this.gm.getAliveCount() <= 1) {
            this._endGame();
        }
    }

    _endGame() {
        this.finished = true;
        console.log('[Pont] Mini-jeu terminé');
        this.gm.endCurrentMinigame();
    }

    getState() {
        const currentId = this.currentPlayerIndex < this.playerOrder.length
            ? this.playerOrder[this.currentPlayerIndex] : null;
        return {
            type: 'glassbridge',
            currentStep: this.currentStep,
            totalSteps: CONFIG.STEPS,
            currentPlayer: currentId,
            currentPlayerName: currentId ? this.gm.getPlayers()[currentId]?.username : null,
            waitingForChoice: this.waitingForChoice,
            timeRemaining: this.waitingForChoice
                ? Math.max(0, Math.ceil(this.choiceTimer / TICK_RATE))
                : 0
        };
    }
}

module.exports = GlassBridge;
