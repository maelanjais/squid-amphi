const Player = require('./Player');

class BotPlayer extends Player {
  constructor(id, name) {
    super(id, name);
    this.isBot = true;
    this.botTargetX = 0;
    this.botTargetY = 0;
  }

  botThink(gameState, currentGameName, allPlayers) {
    if (!this.alive || !gameState) return;

    if (currentGameName === '1, 2, 3… Soleil !') this.actRLGL(gameState);
    else if (currentGameName === 'Le Jeu de la Corde') this.actTugOfWar();
    else if (currentGameName === 'Le Pont de Verre') this.actGlassBridge(gameState);
    else if (currentGameName === 'Le Duel Final') this.actFinalDuel(gameState, allPlayers);
    else if (currentGameName === 'Le Sablé Dalgona') this.actDalgona(gameState);
    else if (currentGameName === 'Pierre, Feuille, Ciseaux') this.actRockPaperScissors(gameState);
  }

  actRockPaperScissors(gs) {
    if (gs.state === 'countdown' && !this.choiceMade) {
      // Simulate human reaction time before choosing
      if (Math.random() < 0.03) {
        const choices = ['rock', 'paper', 'scissors'];
        this.input.choice = choices[Math.floor(Math.random() * choices.length)];
        this.choiceMade = true;
      }
    }
    if (gs.state !== 'countdown') {
      this.choiceMade = false; // Reset for next round
    }
  }

  actRLGL(gs) {
    let shouldMove = false;
    if (gs.greenLight && !gs.warning) {
      shouldMove = Math.random() < 0.7;
    } else if (gs.greenLight && gs.warning) {
      shouldMove = Math.random() > 0.6;
    } else {
      shouldMove = Math.random() < 0.003;
    }

    if (this.y <= gs.finishLine) shouldMove = false;

    this.moving = shouldMove;
    if (shouldMove) {
      this.direction.x = (Math.random() - 0.5) * 0.6;
      this.direction.y = -1;
      const len = Math.sqrt(this.direction.x ** 2 + this.direction.y ** 2);
      this.direction.x /= len;
      this.direction.y /= len;
    }
  }

  actTugOfWar() {
    if (Math.random() < 0.4) {
      this.input.tap = true;
    }
  }

  actGlassBridge(gs) {
    // Only act when it's my turn
    if (gs.currentPlayerId !== this.id || !gs.choosing) return;

    // Use revealed panels if available
    const currentStep = gs.playerStep;
    const panel = gs.panels[currentStep];

    if (panel) {
      // Panel is revealed — choose the safe side
      this.input.choice = panel.safe;
    } else {
      // Unknown panel — wait a bit then guess
      if (gs.choiceTimer < 6 || Math.random() < 0.08) {
        this.input.choice = Math.random() > 0.5 ? 'left' : 'right';
      }
    }
  }

  actFinalDuel(gs, allPlayers) {
    const enemies = allPlayers.filter(p => p.alive && p.id !== this.id);
    let closest = null, minDist = Infinity;
    for (const e of enemies) {
      const dist = Math.sqrt((e.x - this.x) ** 2 + (e.y - this.y) ** 2);
      if (dist < minDist) { minDist = dist; closest = e; }
    }

    const cx = gs.centerX, cy = gs.centerY;
    let targetX = cx, targetY = cy;

    if (closest && minDist < 200) {
      targetX = closest.x;
      targetY = closest.y;
    }

    const noiseX = (Math.random() - 0.5) * 150;
    const noiseY = (Math.random() - 0.5) * 150;
    const dx = (targetX + noiseX) - this.x;
    const dy = (targetY + noiseY) - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    this.moving = true;
    if (len > 5) {
      this.direction.x = dx / len;
      this.direction.y = dy / len;
    }

    if (closest && minDist < 60 && Math.random() < 0.3) {
      this.input.swipeX = dx;
      this.input.swipeY = dy;
    }
  }

  actDalgona(gs) {
    if (!gs.playerStates) return;
    const state = gs.playerStates[this.id];
    if (!state || state.done) return;

    if (state.tension < 80) {
      if (Math.random() < 0.6) {
        this.input.tap = true;
      }
    } else {
      if (Math.random() < 0.05) {
        this.input.tap = true;
      }
    }
  }
}

module.exports = BotPlayer;
