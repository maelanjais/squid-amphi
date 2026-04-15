class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name || `Joueur ${id.substring(0, 4)}`;
    this.number = 0; // attribué à la connexion
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.speed = 200; // px/s
    this.radius = 16;
    this.color = this.generateColor();
    this.shape = this.generateShape();
    this.alive = true;
    this.roundDied = null;
    this.moving = false;
    this.direction = { x: 0, y: 1 }; // direction
    this.team = 0; // jeux équipe
    this.input = {}; // dernier input
    this.score = 0;
    this.lastInputTime = Date.now();
  }

  generateColor() {
    Player.colorIndex = (Player.colorIndex || 0) + 1;
    const hue = (Player.colorIndex * 137.5) % 360;
    return `hsl(${Math.floor(hue)}, 80%, 60%)`;
  }

  generateShape() {
    const shapes = ['circle', 'triangle', 'square'];
    return shapes[(Player.colorIndex || 1) % 3];
  }

  update(dt, bounds) {
    if (!this.alive) return;

    if (this.moving) {
      this.vx = this.direction.x * this.speed;
      this.vy = this.direction.y * this.speed;
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // limites zone
    if (bounds) {
      this.x = Math.max(this.radius, Math.min(bounds.width - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(bounds.height - this.radius, this.y));
    }
  }

  processInput(data) {
    this.lastInputTime = Date.now();
    this.input = data;

    if (data.type === 'move') {
      this.moving = data.pressing;
      if (data.dirX !== undefined && data.dirY !== undefined) {
        const len = Math.sqrt(data.dirX * data.dirX + data.dirY * data.dirY);
        if (len > 0.1) {
          this.direction.x = data.dirX / len;
          this.direction.y = data.dirY / len;
        }
      }
    } else if (data.type === 'tap') {
      // corde
      this.input.tap = true;
    } else if (data.type === 'choice') {
      // pont de verre
      this.input.choice = data.choice; // 'left' or 'right'
    } else if (data.type === 'swipe') {
      // duel final
      this.input.swipeX = data.swipeX;
      this.input.swipeY = data.swipeY;
    }
  }

  eliminate() {
    this.alive = false;
    this.moving = false;
    this.vx = 0;
    this.vy = 0;
  }

  revive() {
    this.alive = true;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      number: this.number,
      x: Math.round(this.x),
      y: Math.round(this.y),
      alive: this.alive,
      moving: this.moving,
      direction: this.direction,
      color: this.color,
      shape: this.shape,
      team: this.team,
      score: this.score
    };
  }
}

module.exports = Player;
