/**
 * Pont de Verre (Glass Bridge) — Rewritten
 * 
 * Players cross one at a time in a random order.
 * Each step, they choose left or right — one is safe, one breaks.
 * Everyone watches. Revealed panels stay visible for following players.
 * Number of steps is adapted to player count for statistical fairness.
 */
class GlassBridge {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.steps = 5;
    this.panels = [];
    this.turnOrder = [];
    this.currentPlayerIndex = 0;
    this.currentPlayerId = null;
    this.playerStep = 0; // current step of the active player (0 = choosing step 0)
    this.choosing = false;
    this.choiceTimer = 10;
    this.revealedPanels = new Set(); // step indices where the safe side is known
    this.eliminatedOnStep = new Map(); // step -> 'left'|'right' (wrong side)
    this.finished = false;
    this.playerResults = new Map(); // playerId -> 'waiting'|'playing'|'crossed'|'eliminated'
    this.playerFinalStep = new Map(); // playerId -> step they reached
    this.waitingForNext = 0; // delay between players
  }

  setup(players) {
    const alive = players.filter(p => p.alive);
    const n = alive.length;

    // Adapt steps based on player count
    // With s steps, probability of crossing = (1/2)^(unrevealed steps)
    // We want ~50% of players to survive on average
    // Expected survivors = n * P(survive) where P depends on position in order
    // Use a simple heuristic: fewer players = fewer steps
    if (n <= 3) this.steps = 3;
    else if (n <= 6) this.steps = 4;
    else if (n <= 10) this.steps = 5;
    else if (n <= 15) this.steps = 6;
    else this.steps = 7;

    // Generate random safe panels
    this.panels = [];
    for (let i = 0; i < this.steps; i++) {
      this.panels.push({
        safe: Math.random() < 0.5 ? 'left' : 'right'
      });
    }

    // Randomize turn order
    this.turnOrder = alive.map(p => p.id).sort(() => Math.random() - 0.5);

    // Initialize all players
    for (const player of players) {
      player.moving = false;
      this.playerResults.set(player.id, 'waiting');
      this.playerFinalStep.set(player.id, -1);
    }

    // Visually position everyone off to the left
    this.positionPlayers(players);

    // Start first player
    this.startNextPlayer();
  }

  startNextPlayer() {
    if (this.currentPlayerIndex >= this.turnOrder.length) {
      this.finished = true;
      return;
    }

    this.currentPlayerId = this.turnOrder[this.currentPlayerIndex];
    this.playerStep = 0;
    this.choosing = true;
    this.choiceTimer = 10;
    this.playerResults.set(this.currentPlayerId, 'playing');

    // Skip revealed panels (already known safe)
    this.skipRevealedPanels();
  }

  skipRevealedPanels() {
    while (this.playerStep < this.steps && this.revealedPanels.has(this.playerStep)) {
      this.playerStep++;
    }
    if (this.playerStep >= this.steps) {
      // Player crossed safely (all panels were revealed!)
      this.playerResults.set(this.currentPlayerId, 'crossed');
      this.playerFinalStep.set(this.currentPlayerId, this.steps);
      this.choosing = false;
      this.waitingForNext = 1.5;
    } else {
      this.choiceTimer = 10;
    }
  }

  start(players) {
    // Already set up
  }

  update(dt, players) {
    const toEliminate = [];

    // Delay between players
    if (this.waitingForNext > 0) {
      this.waitingForNext -= dt;
      if (this.waitingForNext <= 0) {
        this.currentPlayerIndex++;
        this.startNextPlayer();
      }
      this.positionPlayers(players);
      return { eliminated: toEliminate };
    }

    if (this.choosing && this.currentPlayerId) {
      this.choiceTimer -= dt;

      // Find the active player
      const activePlayer = players.find(p => p.id === this.currentPlayerId);
      if (!activePlayer || !activePlayer.alive) {
        // Player disconnected, skip
        this.choosing = false;
        this.waitingForNext = 0.5;
        this.positionPlayers(players);
        return { eliminated: toEliminate };
      }

      // Check for choice input
      if (activePlayer.input.choice) {
        const choice = activePlayer.input.choice;
        activePlayer.input.choice = null;

        const panel = this.panels[this.playerStep];

        if (choice === panel.safe) {
          // Safe!
          this.revealedPanels.add(this.playerStep);
          this.playerStep++;

          // Skip any already-revealed panels ahead
          this.skipRevealedPanels();
        } else {
          // Wrong! Eliminated
          this.revealedPanels.add(this.playerStep);
          this.eliminatedOnStep.set(this.playerStep, choice);
          this.playerResults.set(this.currentPlayerId, 'eliminated');
          this.playerFinalStep.set(this.currentPlayerId, this.playerStep);
          toEliminate.push(this.currentPlayerId);
          this.choosing = false;
          this.waitingForNext = 2.0; // pause to show the fall
        }
      }

      // Timer expired = eliminated
      if (this.choiceTimer <= 0 && this.choosing) {
        this.playerResults.set(this.currentPlayerId, 'eliminated');
        this.playerFinalStep.set(this.currentPlayerId, this.playerStep);
        toEliminate.push(this.currentPlayerId);
        this.choosing = false;
        this.waitingForNext = 1.5;
      }
    }

    // Check if all done
    if (!this.choosing && this.waitingForNext <= 0 && this.currentPlayerIndex >= this.turnOrder.length) {
      this.finished = true;
    }

    this.positionPlayers(players);
    return { eliminated: toEliminate };
  }

  positionPlayers(players) {
    const bridgeStartX = this.arenaWidth * 0.15;
    const bridgeEndX = this.arenaWidth * 0.85;
    const bridgeY = this.arenaHeight * 0.5;
    const stepWidth = (bridgeEndX - bridgeStartX) / (this.steps + 1);

    for (const player of players) {
      const result = this.playerResults.get(player.id);

      if (player.id === this.currentPlayerId && this.choosing) {
        // Active player on the bridge
        const step = this.playerStep;
        player.x = bridgeStartX + (step + 0.5) * stepWidth;
        player.y = bridgeY;
      } else if (result === 'crossed') {
        // Reached the end
        player.x = this.arenaWidth * 0.92;
        player.y = bridgeY + 80 + (Math.abs(this.hashId(player.id)) % 150);
      } else if (result === 'waiting') {
        // Waiting on the left
        const idx = this.turnOrder.indexOf(player.id);
        player.x = this.arenaWidth * 0.06;
        player.y = 100 + (idx % 20) * 48;
      } else if (result === 'eliminated') {
        // Fallen
        player.x = bridgeStartX + ((this.playerFinalStep.get(player.id) || 0) + 0.5) * stepWidth;
        player.y = this.arenaHeight * 0.85;
      } else if (result === 'playing' && !this.choosing) {
        // Just crossed
        player.x = this.arenaWidth * 0.92;
        player.y = bridgeY + 80 + (Math.abs(this.hashId(player.id)) % 150);
      }
    }
  }

  hashId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    const results = {};
    for (const [id, val] of this.playerResults) results[id] = val;
    const finalSteps = {};
    for (const [id, val] of this.playerFinalStep) finalSteps[id] = val;

    return {
      totalSteps: this.steps,
      currentPlayerId: this.currentPlayerId,
      currentPlayerIndex: this.currentPlayerIndex,
      totalPlayers: this.turnOrder.length,
      playerStep: this.playerStep,
      choosing: this.choosing,
      choiceTimer: Math.max(0, Math.ceil(this.choiceTimer)),
      revealedPanels: Array.from(this.revealedPanels),
      panels: this.panels.map((p, i) => this.revealedPanels.has(i) ? p : null),
      turnOrder: this.turnOrder,
      playerResults: results,
      playerFinalSteps: finalSteps,
      waitingForNext: this.waitingForNext > 0
    };
  }

  getControllerState(player) {
    const isMyTurn = player.id === this.currentPlayerId && this.choosing;
    const result = this.playerResults.get(player.id) || 'waiting';
    const myIndex = this.turnOrder.indexOf(player.id);

    return {
      controls: isMyTurn ? 'choice' : 'none',
      isMyTurn: isMyTurn,
      result: result,
      step: isMyTurn ? this.playerStep : (this.playerFinalStep.get(player.id) || 0),
      totalSteps: this.steps,
      choosing: isMyTurn,
      timer: isMyTurn ? Math.max(0, Math.ceil(this.choiceTimer)) : 0,
      finished: result === 'crossed',
      myOrder: myIndex + 1,
      totalOrder: this.turnOrder.length,
      currentPlayerIndex: this.currentPlayerIndex + 1
    };
  }
}

module.exports = GlassBridge;
