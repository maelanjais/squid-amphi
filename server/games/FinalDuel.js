/**
 * Duel Final (Final Duel)
 * 
 * Last survivors are in a shrinking circle.
 * Swipe to push others out. Last one standing wins!
 */
class FinalDuel {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.centerX = arenaWidth / 2;
    this.centerY = arenaHeight / 2;
    this.maxRadius = 400;
    this.circleRadius = this.maxRadius;
    this.minRadius = 80;
    this.shrinkRate = 5; // pixels per second
    this.duration = 60;
    this.timer = this.duration;
    this.finished = false;
    this.pushForce = 300;
    this.friction = 3;
  }

  setup(players) {
    const alive = players.filter(p => p.alive);
    const count = alive.length;

    // Place players in a circle
    for (let i = 0; i < alive.length; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = this.circleRadius * 0.5;
      alive[i].x = this.centerX + Math.cos(angle) * r;
      alive[i].y = this.centerY + Math.sin(angle) * r;
      alive[i].speed = 160;
      alive[i].moving = false;
    }
  }

  start(players) {
    this.timer = this.duration;
  }

  update(dt, players) {
    this.timer -= dt;
    const toEliminate = [];

    // Shrink circle
    if (this.circleRadius > this.minRadius) {
      this.circleRadius -= this.shrinkRate * dt;
      this.circleRadius = Math.max(this.minRadius, this.circleRadius);
    }

    const alive = players.filter(p => p.alive);

    // Process swipe pushes
    for (const player of alive) {
      if (player.input.swipeX !== undefined && player.input.swipeY !== undefined) {
        const sx = player.input.swipeX;
        const sy = player.input.swipeY;
        const len = Math.sqrt(sx * sx + sy * sy);
        
        if (len > 0.1) {
          // Push nearby players in swipe direction
          for (const other of alive) {
            if (other.id === player.id) continue;
            const dx = other.x - player.x;
            const dy = other.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 80) {
              // Apply push force
              other.vx += (sx / len) * this.pushForce;
              other.vy += (sy / len) * this.pushForce;
            }
          }
          // Small recoil for pusher
          player.vx -= (sx / len) * this.pushForce * 0.3;
          player.vy -= (sy / len) * this.pushForce * 0.3;
        }

        player.input.swipeX = undefined;
        player.input.swipeY = undefined;
      }
    }

    // Apply physics — friction and position update
    for (const player of alive) {
      player.vx *= Math.max(0, 1 - this.friction * dt);
      player.vy *= Math.max(0, 1 - this.friction * dt);
      
      // Also allow movement via joystick
      if (player.moving) {
        player.vx += player.direction.x * player.speed * dt;
        player.vy += player.direction.y * player.speed * dt;
      }

      player.x += player.vx * dt;
      player.y += player.vy * dt;
    }

    // Handle collisions between players
    const PLAYER_RADIUS = 15;
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const p1 = alive[i];
        const p2 = alive[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = PLAYER_RADIUS * 2;

        if (distSq < minDist * minDist && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          p1.x -= nx * (overlap / 2);
          p1.y -= ny * (overlap / 2);
          p2.x += nx * (overlap / 2);
          p2.y += ny * (overlap / 2);

          p1.vx *= 0.8;
          p1.vy *= 0.8;
          p2.vx *= 0.8;
          p2.vy *= 0.8;
        }
      }
    }

    for (const player of alive) {
      // Check if outside circle
      const dx = player.x - this.centerX;
      const dy = player.y - this.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > this.circleRadius) {
        toEliminate.push(player.id);
      }
    }

    // End condition: 1 or 0 players left, or timer runs out
    const remainingAfterElim = alive.filter(p => !toEliminate.includes(p.id));
    if (remainingAfterElim.length <= 1 || this.timer <= 0) {
      this.finished = true;
    }

    return { eliminated: toEliminate };
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    return {
      centerX: this.centerX,
      centerY: this.centerY,
      circleRadius: this.circleRadius,
      timer: Math.ceil(this.timer)
    };
  }

  getControllerState(player) {
    return {
      controls: 'swipe-and-move',
      timer: Math.ceil(this.timer),
      circleRadius: Math.round(this.circleRadius)
    };
  }
}

module.exports = FinalDuel;
