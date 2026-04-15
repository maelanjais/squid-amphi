 
class TugOfWar {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.ropePosition = 0; // -100 to 100, 0 = center
    this.team1Score = 0;
    this.team2Score = 0;
    this.duration = 20; // seconds
    this.timer = this.duration;
    this.finished = false;
    this.decay = 2; // retour lent au centre
    this.winThreshold = 100;
    this.endDelayTimer = 2;
    this.winnerDetermined = false;
    this.winningTeam = 0;
    this.toEliminate = [];
  }

  setup(players) {
    
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    
    // alignement sur la corde
    
    const teamSize = half;
    const maxCols = Math.ceil(teamSize / 3);
    const spacingX = Math.max(35, Math.min(65, 350 / maxCols));
    const spacingY = Math.max(35, Math.min(65, 350 / maxCols));
    for (let i = 0; i < shuffled.length; i++) {
      const player = shuffled[i];
      const isTeam1 = (i < half);
      const teamLocalIndex = isTeam1 ? i : (i - half);
      
      const col = Math.floor(teamLocalIndex / 3);  // 3 players per vertical slice
      const row = teamLocalIndex % 3;              // 0, 1, 2
      
      player.offsetX = isTeam1 ? (col * -spacingX + 150) : (col * spacingX - 150);
      player.offsetY = (row - 1) * spacingY;

      if (isTeam1) {
        player.team = 1;
        player.x = this.arenaWidth * 0.25 + player.offsetX;
        player.y = this.arenaHeight / 2 + player.offsetY;
      } else {
        player.team = 2;
        player.x = this.arenaWidth * 0.75 + player.offsetX;
        player.y = this.arenaHeight / 2 + player.offsetY;
      }
      player.moving = false;
      player.input.tap = false;
    }
  }

  start(players) {
    this.timer = this.duration;
  }

  update(dt, players) {
    this.timer -= dt;
    const toEliminate = [];

    
    let team1Taps = 0;
    let team2Taps = 0;

    for (const player of players) {
      if (player.alive && player.input.tap) {
        if (!this.winnerDetermined) {
          if (player.team === 1) team1Taps++;
          if (player.team === 2) team2Taps++;
        }
        player.input.tap = false; // consommer le tap
      }
    }

    
    if (!this.winnerDetermined) {
      const force = (team1Taps - team2Taps) * 3;
      this.ropePosition += force;

      
      this.ropePosition -= Math.sign(this.ropePosition) * this.decay * dt;
      this.ropePosition = Math.max(-this.winThreshold, Math.min(this.winThreshold, this.ropePosition));
    }

    // maj positions
    for (const player of players) {
      if (player.alive) {
        const offset = this.ropePosition * 0.5;
        if (player.team === 1) {
          player.x = this.arenaWidth * 0.25 + offset + (player.offsetX || 0);
        } else {
          player.x = this.arenaWidth * 0.75 + offset + (player.offsetX || 0);
        }
      }
    }

    
    if (Math.abs(this.ropePosition) >= this.winThreshold || this.timer <= 0) {
      if (!this.winnerDetermined) {
        this.winnerDetermined = true;
        this.timer = 0;

        if (this.ropePosition > 0) {
          this.winningTeam = 1;
        } else if (this.ropePosition < 0) {
          this.winningTeam = 2;
        } else {
          this.winningTeam = 0; 
        }
        
        let losingTeam = this.winningTeam === 1 ? 2 : (this.winningTeam === 2 ? 1 : 0);
        
        for (const player of players) {
          if (player.alive && player.team === losingTeam) {
            this.toEliminate.push(player.id);
          }
        }
      }
      
      this.endDelayTimer -= dt;
      if (this.endDelayTimer <= 0) {
        this.finished = true;
        return { eliminated: this.toEliminate };
      }
      return { eliminated: [] };
    }

    return { eliminated: toEliminate };
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    return {
      ropePosition: this.ropePosition,
      timer: Math.max(0, Math.ceil(this.timer)),
      winThreshold: this.winThreshold,
      winningTeam: this.winningTeam
    };
  }

  getControllerState(player) {
    return {
      controls: this.winnerDetermined ? 'none' : 'tap',
      team: player.team,
      ropePosition: this.ropePosition,
      timer: Math.max(0, Math.ceil(this.timer)),
      winningTeam: this.winningTeam,
      gameOver: this.winnerDetermined
    };
  }
}

module.exports = TugOfWar;
