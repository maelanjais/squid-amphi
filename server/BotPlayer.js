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
    else if (currentGameName === 'La Bataille du Dortoir') this.actNightFight(allPlayers);
    else if (currentGameName === 'Le Pont de Verre') this.actGlassBridge(gameState);
    else if (currentGameName === 'Le Duel Final') this.actFinalDuel(gameState, allPlayers);
    else if (currentGameName === 'Le Sablé Dalgona') this.actDalgona(gameState);
  }

  actRLGL(gs) {
    let shouldMove = false;
    if (gs.greenLight && !gs.warning) {
      shouldMove = Math.random() < 0.7; // 70% chance to move (hesitation)
    } else if (gs.greenLight && gs.warning) {
      shouldMove = Math.random() > 0.6;
    } else {
      shouldMove = Math.random() < 0.003;
    }

    if (this.y <= gs.finishLine) shouldMove = false;

    this.moving = shouldMove;
    if (shouldMove) {
      this.direction.x = (Math.random() - 0.5) * 0.6; // more lateral drift = slower
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

  actNightFight(allPlayers) {
    const enemies = allPlayers.filter(p => p.alive && p.id !== this.id);
    if (enemies.length === 0) return;

    let closest = null;
    let minDist = Infinity;
    for (const e of enemies) {
      const dist = Math.sqrt((e.x - this.x) ** 2 + (e.y - this.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = e;
      }
    }

    if (closest) {
      if (minDist < 60 && Math.random() < 0.05) {
        this.input.tap = true;
      } else if (Math.random() < 0.5) {
        const dx = closest.x - this.x;
        const dy = closest.y - this.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        this.moving = true;
        this.direction.x = dx / len;
        this.direction.y = dy / len;
      } else {
        this.moving = false;
      }
    }
  }

  actGlassBridge(gs) {
    if (!gs.playerChoosing || !gs.playerChoosing[this.id]) return;
    
    const timer = gs.playerTimers ? gs.playerTimers[this.id] : 8;
    if (timer < 3 || Math.random() < 0.05) {
      this.input.choice = Math.random() > 0.5 ? 'left' : 'right';
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

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    this.moving = true;
    if (len > 0.1) {
      this.direction.x = dx / len;
      this.direction.y = dy / len;
    }

    if (closest && minDist < 50 && Math.random() < 0.3) {
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
