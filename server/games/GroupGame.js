/**
 * Jeu du Manège (Group Game)
 * 
 * A number is shown. Players must form groups of exactly that number.
 * Players who don't belong to a complete group are eliminated.
 */
class GroupGame {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.targetNumber = 3;
    this.movePhaseTime = 15; // seconds to form groups
    this.timer = 0;
    this.phase = 'announce'; // 'announce', 'move', 'check'
    this.announceTime = 3;
    this.announceTimer = 0;
    this.rounds = 0;
    this.maxRounds = 3;
    this.finished = false;
    this.groupRadius = 60; // proximity to be in a group
    this.groups = [];
  }

  setup(players) {
    // Scatter players
    for (const player of players) {
      player.x = 100 + Math.random() * (this.arenaWidth - 200);
      player.y = 100 + Math.random() * (this.arenaHeight - 200);
      player.speed = 220;
      player.moving = false;
    }
  }

  start(players) {
    this.startRound(players);
  }

  startRound(players) {
    this.rounds++;
    const alive = players.filter(p => p.alive);
    
    // Pick a target number that ensures some elimination
    const possibleNumbers = [2, 3, 4, 5];
    this.targetNumber = possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
    
    this.phase = 'announce';
    this.announceTimer = this.announceTime;
    this.groups = [];
  }

  update(dt, players) {
    const toEliminate = [];
    const alive = players.filter(p => p.alive);

    if (this.phase === 'announce') {
      this.announceTimer -= dt;
      if (this.announceTimer <= 0) {
        this.phase = 'move';
        this.timer = this.movePhaseTime;
      }
    }

    if (this.phase === 'move') {
      this.timer -= dt;
      
      // Calculate groups in real-time for display
      this.groups = this.calculateGroups(alive);

      if (this.timer <= 0) {
        this.phase = 'check';
        // Final group calculation
        this.groups = this.calculateGroups(alive);
        
        // Eliminate players not in a valid group
        const inValidGroup = new Set();
        for (const group of this.groups) {
          if (group.length === this.targetNumber) {
            for (const p of group) {
              inValidGroup.add(p.id);
            }
          }
        }

        for (const player of alive) {
          if (!inValidGroup.has(player.id)) {
            toEliminate.push(player.id);
          }
        }

        // Check if more rounds needed
        if (this.rounds >= this.maxRounds) {
          this.finished = true;
        } else {
          // Start next round after a short delay
          setTimeout(() => {
            if (!this.finished) {
              this.startRound(players);
            }
          }, 3000);
        }
      }
    }

    return { eliminated: toEliminate };
  }

  calculateGroups(players) {
    const alive = players.filter(p => p.alive);
    const visited = new Set();
    const groups = [];

    for (const player of alive) {
      if (visited.has(player.id)) continue;
      
      // BFS to find nearby players
      const group = [player];
      visited.add(player.id);
      const queue = [player];

      while (queue.length > 0) {
        const current = queue.shift();
        for (const other of alive) {
          if (visited.has(other.id)) continue;
          const dx = current.x - other.x;
          const dy = current.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.groupRadius) {
            group.push(other);
            visited.add(other.id);
            queue.push(other);
          }
        }
      }
      groups.push(group);
    }
    return groups;
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    return {
      targetNumber: this.targetNumber,
      phase: this.phase,
      timer: Math.ceil(this.timer),
      announceTimer: Math.ceil(this.announceTimer),
      round: this.rounds,
      maxRounds: this.maxRounds,
      groups: this.groups.map(g => ({
        members: g.map(p => p.id),
        valid: g.length === this.targetNumber,
        centerX: g.reduce((s, p) => s + p.x, 0) / g.length,
        centerY: g.reduce((s, p) => s + p.y, 0) / g.length
      }))
    };
  }

  getControllerState(player) {
    return {
      controls: 'move',
      targetNumber: this.targetNumber,
      phase: this.phase,
      timer: Math.ceil(this.timer)
    };
  }
}

module.exports = GroupGame;
