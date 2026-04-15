
class GlassBridge {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.steps = 5;
    this.panels = [];
    this.queue = [];
    this.currentPlayerId = null;
    this.currentStep = 0;
    this.choosing = false;
    this.choiceTimer = 10;
    this.revealedPanels = new Set();
    this.eliminatedOnStep = new Map();
    this.finished = false;
    this.playerResults = new Map();
    this.playerFinalStep = new Map();
    this.waitingForNext = 0;
    this.turnNumber = 0;
  }

  // mélange
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  setup(players) {
    const alive = players.filter(p => p.alive);
    const n = alive.length;

    // ajuster étapes
    this.steps = Math.max(6, Math.floor(n * 0.9));

    // générer dalles sûres
    this.panels = [];
    for (let i = 0; i < this.steps; i++) {
      this.panels.push({
        safe: Math.random() < 0.5 ? 'left' : 'right'
      });
    }

    // ordre passage aléatoire
    this.queue = this.shuffle(alive.map(p => p.id));

    // initialiser joueurs
    for (const player of players) {
      player.moving = false;
      this.playerResults.set(player.id, 'waiting');
      this.playerFinalStep.set(player.id, -1);
    }

    this.currentStep = 0;
    this.positionPlayers(players);
    this.startNextTurn();
  }

  startNextTurn() {
    // prochaine étape non révélée
    while (this.currentStep < this.steps && this.revealedPanels.has(this.currentStep)) {
      this.currentStep++;
    }

    // toutes dalles révélées = survie
    if (this.currentStep >= this.steps) {
      for (const id of this.queue) {
        this.playerResults.set(id, 'crossed');
        this.playerFinalStep.set(id, this.steps);
      }
      this.finished = true;
      return;
    }

    // file vide
    if (this.queue.length === 0) {
      this.finished = true;
      return;
    }

    // premier de la file
    this.currentPlayerId = this.queue[0];
    this.choosing = true;
    this.choiceTimer = 10;
    this.playerResults.set(this.currentPlayerId, 'playing');
    this.turnNumber++;
  }

  start(players) {
    // déjà préparé
  }

  update(dt, players) {
    const toEliminate = [];

    // délai tours
    if (this.waitingForNext > 0) {
      this.waitingForNext -= dt;
      if (this.waitingForNext <= 0) {
        this.startNextTurn();
      }
      this.positionPlayers(players);
      return { eliminated: toEliminate };
    }

    if (this.choosing && this.currentPlayerId) {
      this.choiceTimer -= dt;

      const activePlayer = players.find(p => p.id === this.currentPlayerId);
      if (!activePlayer || !activePlayer.alive) {
        this.queue = this.queue.filter(id => id !== this.currentPlayerId);
        this.choosing = false;
        this.waitingForNext = 0.5;
        this.positionPlayers(players);
        return { eliminated: toEliminate };
      }

      // recup choix
      if (activePlayer.input.choice) {
        const choice = activePlayer.input.choice;
        activePlayer.input.choice = null;

        const panel = this.panels[this.currentStep];

        if (choice === panel.safe) {
          // bon choix
          this.revealedPanels.add(this.currentStep);
          this.playerResults.set(this.currentPlayerId, 'waiting');
          this.playerFinalStep.set(this.currentPlayerId, this.currentStep);

          // remettre en fin de file
          this.queue.push(this.queue.shift());

          this.choosing = false;
          this.currentStep++;
          this.waitingForNext = 1.5;
        } else {
          // mauvais choix = mort
          this.revealedPanels.add(this.currentStep);
          this.eliminatedOnStep.set(this.currentStep, choice);
          this.playerResults.set(this.currentPlayerId, 'eliminated');
          this.playerFinalStep.set(this.currentPlayerId, this.currentStep);
          toEliminate.push(this.currentPlayerId);

          // retirer file
          this.queue.shift();

          this.choosing = false;
          this.currentStep++;
          this.waitingForNext = 2.0;
        }
      }

      
      if (this.choiceTimer <= 0 && this.choosing) {
        this.playerResults.set(this.currentPlayerId, 'eliminated');
        this.playerFinalStep.set(this.currentPlayerId, this.currentStep);
        toEliminate.push(this.currentPlayerId);
        this.queue.shift();
        this.choosing = false;
        this.waitingForNext = 1.5;
      }
    }

    
    if (!this.choosing && this.waitingForNext <= 0) {
      const allRevealed = this.currentStep >= this.steps || 
        (this.revealedPanels.size >= this.steps);
      if (allRevealed || this.queue.length === 0) {
        for (const id of this.queue) {
          this.playerResults.set(id, 'crossed');
          this.playerFinalStep.set(id, this.steps);
        }
        this.finished = true;
      }
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
        // joueur actif sur le pont
        player.x = bridgeStartX + (this.currentStep + 0.5) * stepWidth;
        player.y = bridgeY;
      } else if (result === 'crossed') {
        player.x = this.arenaWidth * 0.92 + (((this.hashId(player.id+'x') % 1000) / 1000) - 0.5) * 100;
        player.y = bridgeY + (((this.hashId(player.id+'y') % 1000) / 1000) - 0.5) * 600;
      } else if (result === 'waiting') {
        const idx = this.queue.indexOf(player.id);
        if (idx >= 0) {
          player.x = this.arenaWidth * 0.08 + (((this.hashId(player.id+'x') % 1000) / 1000) - 0.5) * 150;
          player.y = this.arenaHeight / 2 + (((this.hashId(player.id+'y') % 1000) / 1000) - 0.5) * 600;
        }
      } else if (result === 'eliminated') {
        player.x = bridgeStartX + ((this.playerFinalStep.get(player.id) || 0) + 0.5) * stepWidth;
        player.y = this.arenaHeight * 0.85;
      } else if (result === 'playing' && !this.choosing) {
        player.x = this.arenaWidth * 0.92 + (((this.hashId(player.id+'x') % 1000) / 1000) - 0.5) * 100;
        player.y = bridgeY + (((this.hashId(player.id+'y') % 1000) / 1000) - 0.5) * 600;
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
      turnNumber: this.turnNumber,
      queueSize: this.queue.length,
      totalPlayers: this.queue.length + Array.from(this.playerResults.values()).filter(v => v === 'eliminated' || v === 'crossed').length,
      playerStep: this.currentStep,
      choosing: this.choosing,
      choiceTimer: Math.max(0, Math.ceil(this.choiceTimer)),
      revealedPanels: Array.from(this.revealedPanels),
      panels: this.panels.map((p, i) => this.revealedPanels.has(i) ? p : null),
      queue: this.queue,
      playerResults: results,
      playerFinalSteps: finalSteps,
      waitingForNext: this.waitingForNext > 0
    };
  }

  getControllerState(player) {
    const isMyTurn = player.id === this.currentPlayerId && this.choosing;
    const result = this.playerResults.get(player.id) || 'waiting';
    const myQueuePos = this.queue.indexOf(player.id);

    return {
      controls: isMyTurn ? 'choice' : 'none',
      isMyTurn: isMyTurn,
      result: result,
      step: isMyTurn ? this.currentStep : (this.playerFinalStep.get(player.id) || 0),
      totalSteps: this.steps,
      choosing: isMyTurn,
      timer: isMyTurn ? Math.max(0, Math.ceil(this.choiceTimer)) : 0,
      finished: result === 'crossed',
      myQueuePosition: myQueuePos + 1,
      queueSize: this.queue.length,
      turnNumber: this.turnNumber
    };
  }
}

module.exports = GlassBridge;
