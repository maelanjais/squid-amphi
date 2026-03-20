/**
 * Pont de Verre (Glass Bridge)
 * 
 * Players advance across a bridge of glass panels.
 * Each step, they must choose left or right — one is safe, one breaks.
 */
class GlassBridge {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.steps = 8; // number of panel pairs
    this.panels = []; // Array of { safe: 'left' | 'right' }
    this.playerSteps = new Map(); // player.id -> current step (0 = start)
    this.playerChoosing = new Map(); // player.id -> true if waiting for choice
    this.choiceTimer = 8; // seconds per choice
    this.playerTimers = new Map();
    this.finished = false;
    this.turnOrder = []; // Order in which players go
    this.currentTurnIndex = 0;
    this.batchSize = 3; // players per batch
    this.revealedPanels = new Set(); // indices of revealed panels
  }

  setup(players) {
    // Generate random safe panels
    this.panels = [];
    for (let i = 0; i < this.steps; i++) {
      this.panels.push({
        safe: Math.random() < 0.5 ? 'left' : 'right'
      });
    }

    // Randomize turn order
    this.turnOrder = players.filter(p => p.alive).map(p => p.id).sort(() => Math.random() - 0.5);
    
    // Position players at start
    for (const player of players) {
      player.moving = false;
      this.playerSteps.set(player.id, -1); // not on bridge yet
      this.playerChoosing.set(player.id, false);
      this.playerTimers.set(player.id, this.choiceTimer);
    }

    // Start first batch
    this.activateNextBatch();

    // Position players visually
    this.positionPlayers(players);
  }

  activateNextBatch() {
    for (let i = 0; i < this.batchSize && this.currentTurnIndex < this.turnOrder.length; i++) {
      const playerId = this.turnOrder[this.currentTurnIndex];
      this.playerSteps.set(playerId, 0);
      this.playerChoosing.set(playerId, true);
      this.playerTimers.set(playerId, this.choiceTimer);
      this.currentTurnIndex++;
    }
  }

  start(players) {
    // Already set up
  }

  update(dt, players) {
    const toEliminate = [];
    let anyChoosing = false;

    for (const player of players) {
      if (!player.alive) continue;
      const step = this.playerSteps.get(player.id);
      
      if (step === -1) continue; // Not their turn yet

      if (this.playerChoosing.get(player.id)) {
        anyChoosing = true;
        
        // Countdown timer
        const timer = (this.playerTimers.get(player.id) || this.choiceTimer) - dt;
        this.playerTimers.set(player.id, timer);

        // Check for choice
        if (player.input.choice) {
          const choice = player.input.choice;
          player.input.choice = null;
          const currentStep = this.playerSteps.get(player.id);
          
          if (currentStep >= this.steps) continue;

          const panel = this.panels[currentStep];
          
          if (choice === panel.safe) {
            // Safe! Move forward
            this.playerSteps.set(player.id, currentStep + 1);
            this.revealedPanels.add(currentStep);
            
            if (currentStep + 1 >= this.steps) {
              // Reached the end!
              this.playerChoosing.set(player.id, false);
            } else {
              this.playerTimers.set(player.id, this.choiceTimer);
            }
          } else {
            // Wrong panel — eliminated!
            this.revealedPanels.add(currentStep);
            toEliminate.push(player.id);
            this.playerChoosing.set(player.id, false);
          }
        }

        // Timer expired — random choice (mostly wrong)
        if (timer <= 0) {
          const currentStep = this.playerSteps.get(player.id);
          if (currentStep < this.steps) {
            toEliminate.push(player.id);
            this.playerChoosing.set(player.id, false);
          }
        }
      }
    }

    // Check if current batch is done, activate next
    const activePlayers = players.filter(p => p.alive && this.playerChoosing.get(p.id));
    if (activePlayers.length === 0 && this.currentTurnIndex < this.turnOrder.length) {
      this.activateNextBatch();
    }

    // Finished when everyone has gone
    if (activePlayers.length === 0 && this.currentTurnIndex >= this.turnOrder.length) {
      this.finished = true;
    }

    // Update visual positions
    this.positionPlayers(players);

    return { eliminated: toEliminate };
  }

  positionPlayers(players) {
    const bridgeStartX = this.arenaWidth * 0.3;
    const bridgeEndX = this.arenaWidth * 0.7;
    const bridgeY = this.arenaHeight / 2;
    const stepWidth = (bridgeEndX - bridgeStartX) / this.steps;

    for (const player of players) {
      const step = this.playerSteps.get(player.id);
      if (step === -1) {
        player.x = this.arenaWidth * 0.15;
        player.y = bridgeY + (Math.random() - 0.5) * 100;
      } else if (step >= this.steps) {
        player.x = this.arenaWidth * 0.85;
        player.y = bridgeY + (Math.random() - 0.5) * 100;
      } else {
        player.x = bridgeStartX + step * stepWidth;
        player.y = bridgeY;
      }
    }
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    const steps = {};
    for (const [id, step] of this.playerSteps) {
      steps[id] = step;
    }
    const choosing = {};
    for (const [id, val] of this.playerChoosing) {
      choosing[id] = val;
    }
    const timers = {};
    for (const [id, val] of this.playerTimers) {
      timers[id] = Math.ceil(val);
    }
    return {
      totalSteps: this.steps,
      playerSteps: steps,
      playerChoosing: choosing,
      playerTimers: timers,
      revealedPanels: Array.from(this.revealedPanels),
      panels: this.panels.map((p, i) => this.revealedPanels.has(i) ? p : null)
    };
  }

  getControllerState(player) {
    const step = this.playerSteps.get(player.id);
    const choosing = this.playerChoosing.get(player.id);
    const timer = this.playerTimers.get(player.id);
    return {
      controls: 'choice',
      step: step,
      totalSteps: this.steps,
      choosing: choosing,
      timer: Math.ceil(timer || 0),
      finished: step >= this.steps
    };
  }
}

module.exports = GlassBridge;
