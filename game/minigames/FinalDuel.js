/**
 * Mini-jeu : Duel Final
 * 
 * Règles :
 * - Les joueurs restants s'affrontent en 1v1
 * - Chaque duel : les deux joueurs spamment le tap
 * - Celui qui tape le plus en X secondes gagne
 * - Le perdant est éliminé
 * - Si nombre impair, le dernier passe automatiquement
 */

const TICK_RATE = 20;

const CONFIG = {
    DUEL_DURATION: 10,          // Durée d'un duel (secondes)
    PAUSE_BETWEEN: 3            // Pause entre duels
};

class FinalDuel {
    constructor(gameManager) {
        this.gm = gameManager;
        this.duels = [];            // { playerA, playerB, tapsA, tapsB }
        this.currentDuelIndex = -1;
        this.duelTimer = 0;
        this.pauseTimer = 0;
        this.inDuel = false;
        this.inPause = false;
        this.finished = false;
    }

    start() {
        this.finished = false;
        this._setupDuels();
    }

    _setupDuels() {
        const alive = this.gm.getAlivePlayers();

        if (alive.length <= 1) {
            this._endGame();
            return;
        }

        // Mélanger et former des paires
        const shuffled = [...alive].sort(() => Math.random() - 0.5);
        this.duels = [];

        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                this.duels.push({
                    playerA: shuffled[i].id,
                    playerB: shuffled[i + 1].id,
                    tapsA: 0,
                    tapsB: 0
                });
            }
            // Si impair, le dernier passe automatiquement
        }

        this.currentDuelIndex = -1;
        this._nextDuel();
    }

    _nextDuel() {
        this.currentDuelIndex++;

        if (this.currentDuelIndex >= this.duels.length) {
            // Vérifie s'il reste encore des joueurs pour continuer
            if (this.gm.getAliveCount() > 1) {
                this._setupDuels(); // Nouveau tour de duels
            } else {
                this._endGame();
            }
            return;
        }

        const duel = this.duels[this.currentDuelIndex];
        const pA = this.gm.getPlayers()[duel.playerA];
        const pB = this.gm.getPlayers()[duel.playerB];

        if (!pA?.alive || !pB?.alive) {
            this._nextDuel(); // Skip si un joueur n'est plus vivant
            return;
        }

        // Positionner les duellistes
        pA.position = { x: 300, y: 400 };
        pB.position = { x: 700, y: 400 };

        this.duelTimer = CONFIG.DUEL_DURATION * TICK_RATE;
        this.inDuel = true;
        this.inPause = false;
        duel.tapsA = 0;
        duel.tapsB = 0;

        // Notifier les joueurs
        this.gm.io.to(duel.playerA).emit('game:duelStart', {
            opponent: pB.username,
            duration: CONFIG.DUEL_DURATION
        });
        this.gm.io.to(duel.playerB).emit('game:duelStart', {
            opponent: pA.username,
            duration: CONFIG.DUEL_DURATION
        });

        // Notifier l'écran
        this.gm.io.emit('game:duelInfo', {
            playerA: { id: duel.playerA, name: pA.username },
            playerB: { id: duel.playerB, name: pB.username },
            duelNumber: this.currentDuelIndex + 1,
            totalDuels: this.duels.length,
            duration: CONFIG.DUEL_DURATION
        });

        console.log(`[Duel] ${pA.username} vs ${pB.username}`);
    }

    handleInput(socketId, player, data) {
        if (this.finished || !this.inDuel) return;
        if (data.type !== 'tap') return;

        const duel = this.duels[this.currentDuelIndex];
        if (!duel) return;

        if (socketId === duel.playerA) {
            duel.tapsA++;
        } else if (socketId === duel.playerB) {
            duel.tapsB++;
        }
    }

    update() {
        if (this.finished) return;

        if (this.inPause) {
            this.pauseTimer--;
            if (this.pauseTimer <= 0) {
                this.inPause = false;
                this._nextDuel();
            }
            return;
        }

        if (this.inDuel) {
            this.duelTimer--;

            // Broadcast le score en temps réel
            if (this.duelTimer % 5 === 0) { // toutes les 0.25s
                const duel = this.duels[this.currentDuelIndex];
                this.gm.io.emit('game:duelScore', {
                    tapsA: duel.tapsA,
                    tapsB: duel.tapsB,
                    timeRemaining: Math.ceil(this.duelTimer / TICK_RATE)
                });
            }

            if (this.duelTimer <= 0) {
                this._resolveDuel();
            }
        }
    }

    _resolveDuel() {
        this.inDuel = false;
        const duel = this.duels[this.currentDuelIndex];

        const loser = duel.tapsA >= duel.tapsB ? duel.playerB : duel.playerA;
        const winner = loser === duel.playerA ? duel.playerB : duel.playerA;

        const winnerPlayer = this.gm.getPlayers()[winner];
        if (winnerPlayer) winnerPlayer.score += 50;

        this.gm.eliminatePlayer(loser);

        const loseName = this.gm.getPlayers()[loser]?.username || '?';
        const winName = winnerPlayer?.username || '?';
        console.log(`[Duel] ${winName} (${Math.max(duel.tapsA, duel.tapsB)}) bat ${loseName} (${Math.min(duel.tapsA, duel.tapsB)})`);

        this.gm.io.emit('game:duelResult', {
            winner: winner,
            winnerName: winName,
            loser: loser,
            loserName: loseName,
            tapsA: duel.tapsA,
            tapsB: duel.tapsB
        });

        if (this.gm.getAliveCount() <= 1) {
            this._endGame();
            return;
        }

        // Pause avant le prochain duel
        this.inPause = true;
        this.pauseTimer = CONFIG.PAUSE_BETWEEN * TICK_RATE;
    }

    _endGame() {
        this.finished = true;
        console.log('[Duel] Mini-jeu terminé');
        this.gm.endCurrentMinigame();
    }

    getState() {
        const duel = this.currentDuelIndex >= 0 && this.currentDuelIndex < this.duels.length
            ? this.duels[this.currentDuelIndex] : null;
        return {
            type: 'finalduel',
            inDuel: this.inDuel,
            currentDuel: duel ? {
                playerA: duel.playerA,
                playerB: duel.playerB,
                tapsA: duel.tapsA,
                tapsB: duel.tapsB,
                nameA: this.gm.getPlayers()[duel.playerA]?.username,
                nameB: this.gm.getPlayers()[duel.playerB]?.username
            } : null,
            duelNumber: this.currentDuelIndex + 1,
            totalDuels: this.duels.length,
            timeRemaining: this.inDuel ? Math.max(0, Math.ceil(this.duelTimer / TICK_RATE)) : 0
        };
    }
}

module.exports = FinalDuel;
