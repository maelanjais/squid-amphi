class RockPaperScissors {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.state = 'bracket_reveal'; // bracket_reveal, countdown, resolution
    this.timer = 5;
    
    this.matches = []; // array of { p1, p2, choice1, choice2, winner, loser }
    this.byes = []; // array of IDs
    this.eliminatedThisRound = [];
    this.roundNumber = 1;
    this.finished = false;
  }

  setup(players) {
    const aliveIds = players.filter(p => p.alive).map(p => p.id);
    for (const p of players) p.moving = false;
    this.generateRound(aliveIds);
  }

  generateRound(survivorIds) {
    let shuffled = [...survivorIds].sort(() => Math.random() - 0.5);
    this.matches = [];
    this.byes = [];
    
    while (shuffled.length >= 2) {
      let p1 = shuffled.pop();
      let p2 = shuffled.pop();
      this.matches.push({ p1, p2, choice1: null, choice2: null, winner: null, loser: null });
    }
    
    if (shuffled.length === 1) {
      this.byes.push(shuffled.pop());
    }
    
    this.state = 'bracket_reveal';
    this.timer = 8; // 8 seconds to show the bracket diagram
  }

  start(players) {
    // Already setup
  }

  update(dt, players) {
    let toEliminate = [];
    this.timer -= dt;

    // Capture choices during countdown
    if (this.state === 'countdown') {
      for (const p of players) {
        if (p.input.choice) {
          let m = this.matches.find(m => m.p1 === p.id || m.p2 === p.id);
          if (m) {
            if (m.p1 === p.id) m.choice1 = p.input.choice;
            if (m.p2 === p.id) m.choice2 = p.input.choice;
          }
          p.input.choice = null; // consume
        }
      }
      
      // If everyone in matches has chosen, auto-advance
      let allChosen = this.matches.every(m => m.choice1 && m.choice2);
      if (allChosen && this.timer > 0.5) {
        this.timer = 0.5; // fast forward!
      }
    }

    // Force player positions to snap into the grid
    const cols = Math.max(1, Math.ceil(this.matches.length / 5));
    for (let [i, m] of this.matches.entries()) {
      let col = Math.floor(i / 5);
      let row = i % 5;
      
      let matchX = 960;
      if (cols === 2) {
          matchX = (col === 0) ? 500 : 1420;
      } else if (cols >= 3) {
          matchX = 300 + col * (1320 / (cols - 1));
      }
      let matchY = 300 + row * 150;
      m.uiX = matchX;
      m.uiY = matchY;

      // Update positions physically in the engine so the renderer draws them there
      let offsetDist = (cols >= 3 ? 190 : 320);
      let p1 = players.find(p => p.id === m.p1);
      if (p1) { p1.x = matchX - offsetDist; p1.y = matchY + 60; }
      let p2 = players.find(p => p.id === m.p2);
      if (p2) { p2.x = matchX + offsetDist; p2.y = matchY + 60; }
    }

    // Put Byes visually somewhere safely at the bottom
    for (let [i, byeId] of this.byes.entries()) {
      let b = players.find(p => p.id === byeId);
      if (b) { b.x = 960 + (i * 100); b.y = 950; }
    }

    // State Machine
    if (this.state === 'bracket_reveal' && this.timer <= 0) {
      this.state = 'countdown';
      this.timer = 10;
    } 
    else if (this.state === 'countdown' && this.timer <= 0) {
      this.evaluateMatches();
      this.state = 'resolution';
      this.timer = 7;
    }
    else if (this.state === 'resolution' && this.timer <= 0) {
      toEliminate = [...this.eliminatedThisRound];
      this.eliminatedThisRound = [];

      let ties = this.matches.filter(m => m.winner === 'tie');
      if (ties.length > 0) {
        // Redo matches for tied pairs
        this.matches = ties.map(m => ({
          p1: m.p1, p2: m.p2, choice1: null, choice2: null, winner: null, loser: null
        }));
        this.state = 'countdown';
        this.timer = 10;
      } else {
        // Round absolutely finished!
        let survivors = [...this.byes];
        for (let m of this.matches) {
          if (m.winner !== 'tie') survivors.push(m.winner);
        }

        if (survivors.length <= 1) {
          this.finished = true;
        } else {
          this.roundNumber++;
          this.generateRound(survivors);
        }
      }
    }

    return { eliminated: toEliminate };
  }

  evaluateMatches() {
    for (let m of this.matches) {
      let c1 = m.choice1;
      let c2 = m.choice2;
      
      if (!c1 && !c2) {
        m.winner = 'tie'; m.loser = null;
      } else if (!c1) {
        m.winner = m.p2; m.loser = m.p1;
      } else if (!c2) {
        m.winner = m.p1; m.loser = m.p2;
      } else if (c1 === c2) {
        m.winner = 'tie'; m.loser = null;
      } else {
        let p1Wins = (c1==='rock' && c2==='scissors') || 
                     (c1==='paper' && c2==='rock') || 
                     (c1==='scissors' && c2==='paper');
        if (p1Wins) { m.winner = m.p1; m.loser = m.p2; }
        else { m.winner = m.p2; m.loser = m.p1; }
      }

      if (m.loser) {
        this.eliminatedThisRound.push(m.loser);
      }
    }
  }

  isFinished() {
    return this.finished;
  }

  getState() {
    return {
      state: this.state,
      timer: Math.max(0, Math.ceil(this.timer)),
      roundNumber: this.roundNumber,
      matches: this.matches,
      byes: this.byes
    };
  }

  getControllerState(player) {
    let match = this.matches.find(m => m.p1 === player.id || m.p2 === player.id);
    let isBye = this.byes.includes(player.id);
    let hasChosen = match ? (match.p1 === player.id ? match.choice1 !== null : match.choice2 !== null) : false;

    // We only show controls during 'countdown'
    let showControls = (match && this.state === 'countdown' && !hasChosen);
    
    return {
      controls: showControls ? 'rps' : 'none',
      state: this.state,
      isPlaying: !!match,
      isBye: isBye,
      hasChosen: hasChosen,
      timer: Math.max(0, Math.ceil(this.timer))
    };
  }
}

module.exports = RockPaperScissors;
