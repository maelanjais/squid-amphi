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
    this.minRadius = 100;
    this.shrinkRate = 3; // pixels per second (slower, more suspense)
    this.duration = 90;
    this.timer = this.duration;
    this.finished = false;
    this.pushForce = 700; // very strong pushes
    this.friction = 5; // higher friction = less sliding, more control
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
            
            if (dist < 120) {
              // Apply push force — stronger when closer
              const proximity = 1 - (dist / 120);
              const force = this.pushForce * (0.5 + proximity * 0.5);
              other.vx += (sx / len) * force;
              other.vy += (sy / len) * force;
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

    // Handle collisions between players — heavy elastic bounce
    const PLAYER_RADIUS = 25;
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

          // Separate players so they never overlap
          p1.x -= nx * (overlap / 2 + 2);
          p1.y -= ny * (overlap / 2 + 2);
          p2.x += nx * (overlap / 2 + 2);
          p2.y += ny * (overlap / 2 + 2);

          // Elastic velocity exchange along collision normal
          const relVx = p1.vx - p2.vx;
          const relVy = p1.vy - p2.vy;
          const relDot = relVx * nx + relVy * ny;

          // Always bounce when overlapping, with minimum impulse
          const bounceFactor = 1.6;
          const impulse = Math.max(relDot > 0 ? relDot : 0, 150); // minimum bump of 150
          p1.vx -= bounceFactor * impulse * nx;
          p1.vy -= bounceFactor * impulse * ny;
          p2.vx += bounceFactor * impulse * nx;
          p2.vy += bounceFactor * impulse * ny;
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
