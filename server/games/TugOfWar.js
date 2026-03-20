/**
 * Jeu de la Corde (Tug of War)
 * 
 * Players are split into two teams. Tap as fast as possible
 * to pull the rope. The losing team is eliminated.
 */
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
    this.decay = 2; // rope slowly returns to center
    this.winThreshold = 100;
  }

  setup(players) {
    // Split into two teams
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    
    for (let i = 0; i < shuffled.length; i++) {
      const player = shuffled[i];
      if (i < half) {
        player.team = 1;
        player.x = this.arenaWidth * 0.25 + (Math.random() - 0.5) * 150;
        player.y = this.arenaHeight / 2 + (Math.random() - 0.5) * 200;
      } else {
        player.team = 2;
        player.x = this.arenaWidth * 0.75 + (Math.random() - 0.5) * 150;
        player.y = this.arenaHeight / 2 + (Math.random() - 0.5) * 200;
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

    // Count taps from each team
    let team1Taps = 0;
    let team2Taps = 0;

    for (const player of players) {
      if (player.alive && player.input.tap) {
        if (player.team === 1) team1Taps++;
        if (player.team === 2) team2Taps++;
        player.input.tap = false; // consume the tap
      }
    }

    // Move rope based on difference
    const force = (team1Taps - team2Taps) * 3;
    this.ropePosition += force;

    // Apply decay toward center
    this.ropePosition -= Math.sign(this.ropePosition) * this.decay * dt;
    this.ropePosition = Math.max(-this.winThreshold, Math.min(this.winThreshold, this.ropePosition));

    // Update player positions based on rope
    for (const player of players) {
      if (player.alive) {
        const offset = this.ropePosition * 0.5;
        if (player.team === 1) {
          player.x = this.arenaWidth * 0.25 + offset;
        } else {
          player.x = this.arenaWidth * 0.75 + offset;
        }
      }
    }

    // Check win condition
    if (Math.abs(this.ropePosition) >= this.winThreshold || this.timer <= 0) {
      this.finished = true;
      // Determine losing team
      let losingTeam;
      if (this.ropePosition > 0) {
        losingTeam = 2; // Team 1 pulled harder
      } else if (this.ropePosition < 0) {
        losingTeam = 1; // Team 2 pulled harder
      } else {
        // Tie — no one eliminated
        return { eliminated: [] };
      }

      for (const player of players) {
        if (player.alive && player.team === losingTeam) {
          toEliminate.push(player.id);
        }
      }
    }

    return { eliminated: toEliminate };
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    return {
      ropePosition: this.ropePosition,
      timer: Math.ceil(this.timer),
      winThreshold: this.winThreshold
    };
  }

  getControllerState(player) {
    return {
      controls: 'tap',
      team: player.team,
      ropePosition: this.ropePosition,
      timer: Math.ceil(this.timer)
    };
  }
}

module.exports = TugOfWar;
