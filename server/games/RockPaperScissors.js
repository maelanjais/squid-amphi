/**
 * Jeu Final — Pierre, Feuille, Ciseaux (Tournament)
 *
 * Full bracket tournament. Shows static tree between rounds.
 * State flow: bracket_full → countdown → resolution → bracket_full → ... → finished
 */
class RockPaperScissors {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.state = 'bracket_full'; // bracket_full, countdown, resolution
    this.timer = 12;

    this.bracketTree = []; // [ [Match1, Match2...], [Match1...] ]
    this.activeMatches = []; // Pointer to matches evaluated this round
    this.eliminatedThisRound = [];
    this.roundNumber = 1;
    this.finished = false;
    this.totalRoundsEstimate = 1;

    // Track players qualifying automatically (Byes)
    this.byesCurrentRound = []; 
  }

  setup(players) {
    const aliveIds = players.filter(p => p.alive).map(p => p.id);
    for (const p of players) p.moving = false;

    // Nearest power of 2
    let power = 1;
    while (power < aliveIds.length) power *= 2;
    this.totalRoundsEstimate = Math.max(1, Math.log2(power));
    
    // Create empty rounds
    for (let r = 0; r < this.totalRoundsEstimate; r++) {
      let matchesInRound = power / Math.pow(2, r + 1);
      let roundMatches = [];
      for (let i = 0; i < matchesInRound; i++) {
        roundMatches.push({
          p1: null, p2: null,
          choice1: null, choice2: null,
          winner: null, loser: null,
          finished: false
        });
      }
      this.bracketTree.push(roundMatches);
    }

    // Seed round 1 symmetrically
    let shuffled = [...aliveIds].sort(() => Math.random() - 0.5);
    let round1 = this.bracketTree[0];

    // Distribute players across matches evenly to maximize spacing
    let slotIdx = 0;
    while (shuffled.length > 0) {
       if (!round1[slotIdx].p1) round1[slotIdx].p1 = shuffled.pop();
       else if (!round1[slotIdx].p2) round1[slotIdx].p2 = shuffled.pop();
       slotIdx = (slotIdx + 1) % round1.length;
    }

    // Resolve byes immediately
    this.byesCurrentRound = [];
    for (let i = 0; i < round1.length; i++) {
       let m = round1[i];
       if (m.p1 && !m.p2) {
          m.winner = m.p1;
          m.finished = true;
          this.byesCurrentRound.push(m.p1);
          // Advance to round 2 immediately so the visual displays them ahead
          if (this.bracketTree[1]) {
             let nextMatchIdx = Math.floor(i / 2);
             if (i % 2 === 0) this.bracketTree[1][nextMatchIdx].p1 = m.winner;
             else this.bracketTree[1][nextMatchIdx].p2 = m.winner;
          }
       }
    }

    this.activeMatches = round1.filter(m => !m.finished && m.p1 && m.p2);
    this.state = 'bracket_full';
    this.timer = 12; // 12 seconds to show the bracket initially
    
    // Immediate end if 1 or 0 players
    if (aliveIds.length <= 1) {
       this.finished = true;
       this.timer = 0;
    }
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
          let m = this.activeMatches.find(m => m.p1 === p.id || m.p2 === p.id);
          if (m && !m.finished) {
            if (m.p1 === p.id) m.choice1 = p.input.choice;
            if (m.p2 === p.id) m.choice2 = p.input.choice;
          }
          p.input.choice = null; // consume
        }
      }

      // Fast-forward if all active matches have chosen
      let allChosen = this.activeMatches.every(m => m.choice1 && m.choice2);
      if (allChosen && this.timer > 1) {
        this.timer = 1;
      }
    }

    // Assign on-screen positions for active combat UI
    if (this.state === 'countdown' || this.state === 'resolution') {
      const numMatches = this.activeMatches.length;
      const isFinale = (numMatches === 1);
      const cols = Math.max(1, Math.ceil(numMatches / 5));
      
      for (let [i, m] of this.activeMatches.entries()) {
        let col = Math.floor(i / 5);
        let row = i % 5;

        let matchX = 960;
        let matchY = 320 + row * 160; // Start lower and add more space between cards
        let cardW = (cols >= 3 ? 550 : 800);
        let circleOffset = cardW / 2 - 60;
        let circleYOffset = 0; // Set to 0 to perfectly align with matchY

        if (isFinale) {
           matchY = 550; // Center screen lower
           cardW = 1200; // Much wider
           circleOffset = cardW / 2 - 100; // Push players further out
           circleYOffset = 0; // Set to 0 to perfectly align with matchY
        } else {
           if (cols === 2) {
             matchX = (col === 0) ? 500 : 1420;
           } else if (cols >= 3) {
             matchX = 300 + col * (1320 / (cols - 1));
           }
        }
        
        m.uiX = matchX;
        m.uiY = matchY;

        let p1 = players.find(p => p.id === m.p1);
        if (p1) { p1.x = matchX - circleOffset; p1.y = matchY + circleYOffset; }
        let p2 = players.find(p => p.id === m.p2);
        if (p2) { p2.x = matchX + circleOffset; p2.y = matchY + circleYOffset; }
      }

      // Keep byepass players at bottom visually
      for (let [i, byeId] of this.byesCurrentRound.entries()) {
        let b = players.find(p => p.id === byeId);
        if (b) { b.x = 960 + (i * 100); b.y = 950; }
      }
    }

    // === STATE MACHINE ===
    if (this.state === 'bracket_full' && this.timer <= 0) {
      if (this.activeMatches.length === 0) {
        // Skip current round if no active matches (only byes)
        this.advanceRound();
      } else {
        this.state = 'countdown';
        this.timer = 10;
      }
    }
    else if (this.state === 'countdown' && this.timer <= 0) {
      this.evaluateMatches();
      this.state = 'resolution';
      this.timer = 7;
    }
    else if (this.state === 'resolution' && this.timer <= 0) {
      toEliminate = [...this.eliminatedThisRound];
      this.eliminatedThisRound = [];

      let ties = this.activeMatches.filter(m => m.winner === 'tie');
      if (ties.length > 0) {
        // Redo tied matches
        for (let m of ties) {
          m.choice1 = null;
          m.choice2 = null;
          m.winner = null; // Important to reset so it doesn't stay 'tie'
        }
        this.state = 'countdown';
        this.timer = 10;
      } else {
         this.advanceRound();
      }
    }

    return { eliminated: toEliminate };
  }

  evaluateMatches() {
    for (let i = 0; i < this.activeMatches.length; i++) {
      let m = this.activeMatches[i];
      if (m.finished) continue;

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
        let p1Wins = (c1 === 'rock' && c2 === 'scissors') ||
                     (c1 === 'paper' && c2 === 'rock') ||
                     (c1 === 'scissors' && c2 === 'paper');
        if (p1Wins) { m.winner = m.p1; m.loser = m.p2; }
        else { m.winner = m.p2; m.loser = m.p1; }
      }

      if (m.loser) {
        this.eliminatedThisRound.push(m.loser);
        m.finished = true;
      } else if (m.winner && m.winner !== 'tie') {
        m.finished = true;
      }
      
      // Advance winner to the actual slot in the bracket!
      if (m.finished && m.winner !== 'tie' && this.roundNumber < this.totalRoundsEstimate) {
         let currentGlobalIndex = this.bracketTree[this.roundNumber - 1].indexOf(m);
         let nextMatchIdx = Math.floor(currentGlobalIndex / 2);
         if (currentGlobalIndex % 2 === 0) {
            this.bracketTree[this.roundNumber][nextMatchIdx].p1 = m.winner;
         } else {
            this.bracketTree[this.roundNumber][nextMatchIdx].p2 = m.winner;
         }
      }
    }
  }

  advanceRound() {
    this.roundNumber++;
    this.byesCurrentRound = [];
    
    if (this.roundNumber > this.totalRoundsEstimate) {
       this.finished = true;
       return;
    }
    
    // Evaluate if there are any immediate byes in the new round 
    // (e.g. someone from previous round won, but their new opponent slot is empty because someone got eliminated) 
    // Wait, in a balanced binary tree, if someone reaches here and has NO opponent, it means their opponent side had NO one surviving? 
    // If they have no opponent, they advance.
    let currentRoundSlots = this.bracketTree[this.roundNumber - 1];
    
    for (let i = 0; i < currentRoundSlots.length; i++) {
        let m = currentRoundSlots[i];
        // If a match is incomplete (one person but no opponent)
        // Note: it might just be waiting for a tied match to finish, but since we wait for ALL matches in the round to finish, 
        // anyone missing here permanently has no opponent.
        if (m.p1 && !m.p2 || !m.p1 && m.p2) {
           m.winner = m.p1 || m.p2;
           m.finished = true;
           this.byesCurrentRound.push(m.winner);
           
           if (this.roundNumber < this.totalRoundsEstimate) {
               let nextMatchIdx = Math.floor(i / 2);
               if (i % 2 === 0) this.bracketTree[this.roundNumber][nextMatchIdx].p1 = m.winner;
               else this.bracketTree[this.roundNumber][nextMatchIdx].p2 = m.winner;
           }
        }
    }
    
    this.activeMatches = currentRoundSlots.filter(m => !m.finished && m.p1 && m.p2);
    
    if (this.activeMatches.length === 0 && this.byesCurrentRound.length > 0) {
        // Fast-forward this empty round if everyone is a bye
        this.advanceRound();
    } else if (this.activeMatches.length === 0) {
        this.finished = true;
    } else {
        this.state = 'bracket_full';
        this.timer = 10;
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
      matches: this.activeMatches,
      bracketTree: this.bracketTree, // Send full tree representation
      totalRoundsEstimate: this.totalRoundsEstimate,
      byes: this.byesCurrentRound
    };
  }

  getControllerState(player) {
    let match = this.activeMatches.find(m => m.p1 === player.id || m.p2 === player.id);
    let isBye = this.byesCurrentRound.includes(player.id);
    let hasChosen = match ? (match.p1 === player.id ? match.choice1 !== null : match.choice2 !== null) : false;
    let showControls = (match && !match.finished && this.state === 'countdown' && !hasChosen);

    let matchResult = null;
    if (match && this.state === 'resolution') {
      if (match.winner === player.id) matchResult = 'win';
      else if (match.loser === player.id) matchResult = 'lose';
      else if (match.winner === 'tie') matchResult = 'tie';
    }

    return {
      controls: showControls ? 'rps' : 'none',
      state: this.state,
      isPlaying: !!match,
      isBye: isBye,
      hasChosen: hasChosen,
      timer: Math.max(0, Math.ceil(this.timer)),
      matchResult: matchResult,
      roundNumber: this.roundNumber
    };
  }
}

module.exports = RockPaperScissors;
