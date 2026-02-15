/**
 * Mini-jeu : Billes (Marbles)
 * 
 * Règles :
 * - Les joueurs sont mis en paires aléatoires
 * - Chaque paire joue à pair/impair
 * - Le joueur choisit "pair" ou "impair"
 * - Un nombre aléatoire est tiré
 * - Le gagnant survit, le perdant est éliminé
 * - Si nombre impair de joueurs, le dernier passe automatiquement
 */

const TICK_RATE = 20;

const CONFIG = {
    CHOICE_TIME: 8,             // Secondes pour choisir
    REVEAL_TIME: 3,             // Secondes pour montrer le résultat
    PAUSE_BETWEEN: 2            // Pause entre les duels
};

class Marbles {
    constructor(gameManager) {
        this.gm = gameManager;
        this.pairs = [];            // { playerA, playerB, choiceA, choiceB }
        this.currentPairIndex = -1;
        this.choiceTimer = 0;
        this.revealTimer = 0;
        this.pauseTimer = 0;
        this.phase = 'idle';        // idle, choosing, reveal, pause
        this.finished = false;
        this.drawnNumber = 0;
    }

    start() {
        this.finished = false;
        this._setupPairs();
    }

    _setupPairs() {
        const alive = this.gm.getAlivePlayers();

        if (alive.length <= 1) {
            this._endGame();
            return;
        }

        const shuffled = [...alive].sort(() => Math.random() - 0.5);
        this.pairs = [];

        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                this.pairs.push({
                    playerA: shuffled[i].id,
                    playerB: shuffled[i + 1].id,
                    choiceA: null,
                    choiceB: null
                });
            }
        }

        this.currentPairIndex = -1;
        this._nextPair();
    }

    _nextPair() {
        this.currentPairIndex++;

        if (this.currentPairIndex >= this.pairs.length) {
            if (this.gm.getAliveCount() > 1) {
                this._setupPairs();
            } else {
                this._endGame();
            }
            return;
        }

        const pair = this.pairs[this.currentPairIndex];
        const pA = this.gm.getPlayers()[pair.playerA];
        const pB = this.gm.getPlayers()[pair.playerB];

        if (!pA?.alive || !pB?.alive) {
            this._nextPair();
            return;
        }

        pA.position = { x: 350, y: 400 };
        pB.position = { x: 650, y: 400 };

        pair.choiceA = null;
        pair.choiceB = null;
        this.choiceTimer = CONFIG.CHOICE_TIME * TICK_RATE;
        this.phase = 'choosing';

        // Notifier les joueurs
        this.gm.io.to(pair.playerA).emit('game:marblesChoose', {
            opponent: pB.username,
            timeLimit: CONFIG.CHOICE_TIME
        });
        this.gm.io.to(pair.playerB).emit('game:marblesChoose', {
            opponent: pA.username,
            timeLimit: CONFIG.CHOICE_TIME
        });

        this.gm.io.emit('game:marblesMatch', {
            playerA: { id: pair.playerA, name: pA.username },
            playerB: { id: pair.playerB, name: pB.username },
            matchNumber: this.currentPairIndex + 1,
            totalMatches: this.pairs.length
        });

        console.log(`[Billes] ${pA.username} vs ${pB.username}`);
    }

    handleInput(socketId, player, data) {
        if (this.finished || this.phase !== 'choosing') return;

        const pair = this.pairs[this.currentPairIndex];
        if (!pair) return;

        if (data.type === 'chooseParity' && (data.choice === 'pair' || data.choice === 'impair')) {
            if (socketId === pair.playerA) {
                pair.choiceA = data.choice;
            } else if (socketId === pair.playerB) {
                pair.choiceB = data.choice;
            }

            this.gm.io.to(socketId).emit('game:marblesChosen', { choice: data.choice });

            // Si les deux ont choisi, résoudre immédiatement
            if (pair.choiceA && pair.choiceB) {
                this._resolve();
            }
        }
    }

    update() {
        if (this.finished) return;

        if (this.phase === 'choosing') {
            this.choiceTimer--;
            if (this.choiceTimer <= 0) {
                // Choix par défaut si pas choisi
                const pair = this.pairs[this.currentPairIndex];
                if (!pair.choiceA) pair.choiceA = Math.random() < 0.5 ? 'pair' : 'impair';
                if (!pair.choiceB) pair.choiceB = Math.random() < 0.5 ? 'pair' : 'impair';
                this._resolve();
            }
        }

        if (this.phase === 'reveal') {
            this.revealTimer--;
            if (this.revealTimer <= 0) {
                this.phase = 'pause';
                this.pauseTimer = CONFIG.PAUSE_BETWEEN * TICK_RATE;
            }
        }

        if (this.phase === 'pause') {
            this.pauseTimer--;
            if (this.pauseTimer <= 0) {
                this._nextPair();
            }
        }
    }

    _resolve() {
        const pair = this.pairs[this.currentPairIndex];
        this.drawnNumber = 1 + Math.floor(Math.random() * 10); // 1-10
        const isPair = this.drawnNumber % 2 === 0;
        const correctAnswer = isPair ? 'pair' : 'impair';

        const aCorrect = pair.choiceA === correctAnswer;
        const bCorrect = pair.choiceB === correctAnswer;

        let loser = null;
        if (aCorrect && !bCorrect) {
            loser = pair.playerB;
        } else if (!aCorrect && bCorrect) {
            loser = pair.playerA;
        } else {
            // Tous les deux ont raison ou tort → éliminer au hasard
            loser = Math.random() < 0.5 ? pair.playerA : pair.playerB;
        }

        this.gm.io.emit('game:marblesResult', {
            drawnNumber: this.drawnNumber,
            correct: correctAnswer,
            choiceA: pair.choiceA,
            choiceB: pair.choiceB,
            loser: loser,
            loserName: this.gm.getPlayers()[loser]?.username
        });

        this.gm.eliminatePlayer(loser);

        this.phase = 'reveal';
        this.revealTimer = CONFIG.REVEAL_TIME * TICK_RATE;

        if (this.gm.getAliveCount() <= 1) {
            setTimeout(() => this._endGame(), CONFIG.REVEAL_TIME * 1000);
        }
    }

    _endGame() {
        this.finished = true;
        console.log('[Billes] Mini-jeu terminé');
        this.gm.endCurrentMinigame();
    }

    getState() {
        const pair = this.currentPairIndex >= 0 && this.currentPairIndex < this.pairs.length
            ? this.pairs[this.currentPairIndex] : null;
        return {
            type: 'marbles',
            phase: this.phase,
            currentMatch: pair ? {
                playerA: pair.playerA,
                playerB: pair.playerB,
                nameA: this.gm.getPlayers()[pair.playerA]?.username,
                nameB: this.gm.getPlayers()[pair.playerB]?.username
            } : null,
            matchNumber: this.currentPairIndex + 1,
            totalMatches: this.pairs.length,
            drawnNumber: this.phase === 'reveal' ? this.drawnNumber : null,
            timeRemaining: this.phase === 'choosing'
                ? Math.max(0, Math.ceil(this.choiceTimer / TICK_RATE))
                : 0
        };
    }
}

module.exports = Marbles;
