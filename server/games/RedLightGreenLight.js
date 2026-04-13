/**
 * 1, 2, 3… Soleil ! (Red Light Green Light)
 * 
 * Players must run to the finish line. When the light turns red,
 * any player still moving is eliminated.
 */
class RedLightGreenLight {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.finishLine = 100; // y position of finish line
    this.greenLight = true;
    this.timer = 0;
    this.phaseTimer = 0;
    this.greenDuration = 0;
    this.redDuration = 3;
    this.roundDuration = 90; // total game time
    this.roundTimer = this.roundDuration;
    this.finished = false;
    this.toEliminate = [];
    this.warningTime = 1.5; // warning before red
    this.warning = false;
    this.cycleCount = 0;
  }

  setup(players) {
    // Place players at the bottom of the arena
    for (const player of players) {
      player.x = 100 + Math.random() * (this.arenaWidth - 200);
      player.y = this.arenaHeight - 80;
      player.moving = false;
      player.speed = 180;
    }
  }

  start(players) {
    this.startNewCycle();
  }

  startNewCycle() {
    this.greenLight = true;
    this.warning = false;
    this.greenDuration = 2 + Math.random() * 3; // 2-5 seconds of green
    this.phaseTimer = this.greenDuration;
    this.cycleCount++;
  }

  update(dt, players) {
    this.roundTimer -= dt;
    this.toEliminate = [];

    if (this.roundTimer <= 0) {
      // Time's up — eliminate everyone who hasn't crossed
      for (const player of players) {
        if (player.alive && player.y > this.finishLine) {
          this.toEliminate.push(player.id);
        }
      }
      this.finished = true;
      return { eliminated: this.toEliminate };
    }

    this.phaseTimer -= dt;

    if (this.greenLight) {
      // Check for warning phase
      if (this.phaseTimer <= this.warningTime && !this.warning) {
        this.warning = true;
      }
      // Transition to red
      if (this.phaseTimer <= 0) {
        this.greenLight = false;
        this.phaseTimer = this.redDuration;
        this.warning = false;
      }
    } else {
      // Red light — check who is still moving (skip players who already crossed)
      for (const player of players) {
        if (player.alive && player.moving && player.y > this.finishLine) {
          this.toEliminate.push(player.id);
        }
      }
      // Transition back to green
      if (this.phaseTimer <= 0) {
        this.startNewCycle();
      }
    }


    // Check for players crossing the finish line
    for (const player of players) {
      if (player.alive && player.y <= this.finishLine) {
        player.moving = false;
        player.y = this.finishLine;
      }
    }

    // End game if all alive players have crossed
    const alive = players.filter(p => p.alive);
    const crossed = alive.filter(p => p.y <= this.finishLine);
    if (crossed.length === alive.length && alive.length > 0) {
      this.finished = true;
    }

    return { eliminated: this.toEliminate };
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    return {
      greenLight: this.greenLight,
      warning: this.warning,
      finishLine: this.finishLine,
      roundTimer: Math.max(0, Math.ceil(this.roundTimer)),
      phaseTimer: Math.max(0, this.phaseTimer)
    };
  }

  getControllerState(player) {
    const startY = this.arenaHeight - 80;
    const totalDist = startY - this.finishLine;
    const currentDist = startY - player.y;
    let progress = Math.round((currentDist / totalDist) * 100);
    if (progress < 0) progress = 0;
    if (progress > 100) progress = 100;

    return {
      controls: 'move',
      greenLight: this.greenLight,
      warning: this.warning,
      roundTimer: Math.max(0, Math.ceil(this.roundTimer)),
      crossed: player.y <= this.finishLine,
      progress: progress
    };
  }
}

module.exports = RedLightGreenLight;
