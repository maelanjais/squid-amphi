/**
 * Bataille du Dortoir (Night Fight)
 * 
 * Everyone is in the dark. Tap to attack nearby players.
 * Last ones standing survive.
 */
class NightFight {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.duration = 30;
    this.timer = this.duration;
    this.finished = false;
    this.attackRange = 60;
    this.attackCooldown = 0.5; // seconds
    this.playerCooldowns = new Map();
    this.playerHP = new Map();
    this.maxHP = 3;
    this.targetSurvivors = 0; // calculated on start
    this.flashEffects = []; // brief light flashes on attacks
  }

  setup(players) {
    for (const player of players) {
      player.x = 100 + Math.random() * (this.arenaWidth - 200);
      player.y = 100 + Math.random() * (this.arenaHeight - 200);
      player.speed = 150;
      player.moving = false;
      this.playerCooldowns.set(player.id, 0);
      this.playerHP.set(player.id, this.maxHP);
    }
    // Target: keep about half the players
    this.targetSurvivors = Math.ceil(players.length * 0.5);
  }

  start(players) {
    this.timer = this.duration;
  }

  update(dt, players) {
    this.timer -= dt;
    const toEliminate = [];
    this.flashEffects = this.flashEffects.filter(f => f.timer > 0);
    this.flashEffects.forEach(f => f.timer -= dt);

    // Update cooldowns
    for (const player of players) {
      if (!player.alive) continue;
      const cd = this.playerCooldowns.get(player.id) || 0;
      if (cd > 0) {
        this.playerCooldowns.set(player.id, cd - dt);
      }
    }

    // Process attacks
    for (const player of players) {
      if (!player.alive) continue;
      if (player.input.tap && (this.playerCooldowns.get(player.id) || 0) <= 0) {
        player.input.tap = false;
        this.playerCooldowns.set(player.id, this.attackCooldown);

        // Flash effect
        this.flashEffects.push({
          x: player.x, y: player.y,
          radius: this.attackRange,
          timer: 0.3
        });

        // Check for nearby players to hit
        for (const target of players) {
          if (target.id === player.id || !target.alive) continue;
          const dx = player.x - target.x;
          const dy = player.y - target.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.attackRange) {
            const hp = (this.playerHP.get(target.id) || this.maxHP) - 1;
            this.playerHP.set(target.id, hp);
            if (hp <= 0) {
              toEliminate.push(target.id);
            }
          }
        }
      }
    }

    // End when timer runs out
    if (this.timer <= 0) {
      this.finished = true;
    }

    return { eliminated: toEliminate };
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    const hpMap = {};
    for (const [id, hp] of this.playerHP) {
      hpMap[id] = hp;
    }
    return {
      timer: Math.ceil(this.timer),
      dark: true,
      flashEffects: this.flashEffects,
      playerHP: hpMap,
      maxHP: this.maxHP
    };
  }

  getControllerState(player) {
    return {
      controls: 'tap-and-move',
      timer: Math.ceil(this.timer),
      hp: this.playerHP.get(player.id) || 0,
      maxHP: this.maxHP
    };
  }
}

module.exports = NightFight;
