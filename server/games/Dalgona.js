class Dalgona {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.duration = 40;
    this.timer = this.duration;
    this.finished = false;
    this.playerStates = new Map(); // id -> { progress, tension }
    this.maxTension = 100;
    this.maxProgress = 100;
    this.decayRate = 30; // tension decreases per second
  }

  setup(players) {
    for (const player of players) {
      player.x = 100 + Math.random() * (this.arenaWidth - 200);
      player.y = 100 + Math.random() * (this.arenaHeight - 200);
      player.moving = false;
      this.playerStates.set(player.id, { progress: 0, tension: 0, done: false });
    }
  }

  start(players) {
    this.timer = this.duration;
  }

  update(dt, players) {
    this.timer -= dt;
    const toEliminate = [];

    for (const player of players) {
      if (!player.alive) continue;
      const state = this.playerStates.get(player.id);
      if (!state || state.done) continue;

      // Decay tension
      state.tension -= this.decayRate * dt;
      if (state.tension < 0) state.tension = 0;

      // Process tap
      if (player.input.tap) {
        player.input.tap = false;
        state.progress += 2;
        state.tension += 15;
      }

      if (state.tension > this.maxTension) {
        toEliminate.push(player.id);
        state.done = true;
      } else if (state.progress >= this.maxProgress) {
        state.progress = this.maxProgress;
        state.done = true;
      }
    }

    if (this.timer <= 0) {
      this.finished = true;
      for (const player of players) {
        if (player.alive) {
          const state = this.playerStates.get(player.id);
          if (state && !state.done && state.progress < this.maxProgress) {
            toEliminate.push(player.id);
            state.done = true;
          }
        }
      }
    } else {
      const active = players.filter(p => p.alive && !this.playerStates.get(p.id).done);
      if (active.length === 0) {
        this.finished = true; // everyone either finished or died
      }
    }

    return { eliminated: toEliminate };
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    const states = {};
    for (const [id, state] of this.playerStates) states[id] = state;
    return {
      timer: Math.ceil(this.timer),
      playerStates: states
    };
  }

  getControllerState(player) {
    const s = this.playerStates.get(player.id);
    return {
      controls: 'tap',
      timer: Math.ceil(this.timer),
      hp: s ? Math.floor(this.maxTension - s.tension) : 0, // Abuse HP bar for tension visually
      maxHP: this.maxTension
    };
  }
}

module.exports = Dalgona;
