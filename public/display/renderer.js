/**
 * Canvas 2D Renderer for Squid Amphi Display
 * Handles rendering players, arenas, and game-specific visuals
 */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Colors
    this.bgColor = '#0f0f1e';
    this.gridColor = 'rgba(233, 30, 130, 0.05)';
    this.pink = '#e91e82';
    this.teal = '#00d4aa';
    this.red = '#ff3b3b';
    this.green = '#39e75f';
    this.gold = '#ffd700';

    // Animation
    this.time = 0;
    this.eliminationEffects = [];
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.scaleX = this.canvas.width / 1920;
    this.scaleY = this.canvas.height / 1080;
  }

  /**
   * Main render function — called each frame
   */
  render(state) {
    if (!state) return;
    this.time += 1 / 30;

    const ctx = this.ctx;
    ctx.save();

    // Clear
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Scale to arena
    ctx.scale(this.scaleX, this.scaleY);

    // Draw grid
    this.drawGrid(ctx);

    // Render based on current game
    if (state.currentGame && state.currentGame.state) {
      const gameName = state.currentGame.name;
      const gameState = state.currentGame.state;

      if (gameName.includes('Soleil')) {
        this.renderRedLightGreenLight(ctx, state, gameState);
      } else if (gameName.includes('Corde')) {
        this.renderTugOfWar(ctx, state, gameState);
      } else if (gameName.includes('Pont')) {
        this.renderGlassBridge(ctx, state, gameState);
      } else if (gameName.includes('Ciseaux') || gameName.includes('Final')) {
        this.renderRockPaperScissors(ctx, state, gameState);
      }
    }

    // Draw all players
    // Skip during bracket tree view (full-screen bracket replaces everything)
    const isBracketFullView = state.currentGame && state.currentGame.state && state.currentGame.state.state === 'bracket_full';
    if (!isBracketFullView) {
      // For RPS/Jeu Final, only draw alive players (dead are hidden behind opaque cards)
      if (state.currentGame && (state.currentGame.name.includes('Final') || state.currentGame.name.includes('Ciseaux'))) {
        const alivePlayers = state.players.filter(p => p.alive);
        this.drawPlayers(ctx, alivePlayers);
      } else {
        this.drawPlayers(ctx, state.players);
      }
    }

    // Draw elimination effects
    this.drawElimEffects(ctx);

    ctx.restore();
  }

  drawGrid(ctx) {
    ctx.strokeStyle = this.gridColor;
    ctx.lineWidth = 1;
    for (let x = 0; x < 1920; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1080);
      ctx.stroke();
    }
    for (let y = 0; y < 1080; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1920, y);
      ctx.stroke();
    }
  }

  drawPlayers(ctx, players) {
    if (!players) return;
    const aliveCount = players.filter(p => p.alive).length;
    // Adaptive radius: visible even at 50+ players
    // 50 → 18px, 30 → 22px, 10 → 38px, 2 → 50px
    const adaptiveR = Math.min(50, Math.max(18, 120 / Math.max(1, Math.sqrt(aliveCount))));

    // Dead players on bottom
    for (const p of players) {
      if (!p.alive) {
        this.drawPlayer(ctx, p, true, adaptiveR);
      }
    }
    // Then alive players on top
    for (const p of players) {
      if (p.alive) {
        this.drawPlayer(ctx, p, false, adaptiveR);
      }
    }
  }

  drawPlayer(ctx, p, dead, r) {
    const x = p.x;
    const y = p.y;

    ctx.save();
    ctx.translate(x, y);

    if (dead) {
      ctx.globalAlpha = 0.15;
    }

    // Body (circle)
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    // Outline glow
    if (!dead) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (p.locating) {
         ctx.beginPath();
         ctx.arc(0, 0, r + 15 + Math.sin(this.time * 15) * 5, 0, Math.PI * 2);
         ctx.strokeStyle = '#ffd700';
         ctx.lineWidth = 4;
         ctx.stroke();
      }

      // Moving indicator
      if (p.moving) {
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Player number
    ctx.fillStyle = dead ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)';
    ctx.font = `bold ${Math.max(9, r * 0.7)}px Outfit`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.number, 0, 0);

    // Name label above — always show, scaled with radius
    if (!dead) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `${Math.max(9, r * 0.55)}px Outfit`;
      ctx.fillText(p.name, 0, -r - 6);
    }

    // Direction indicator
    if (!dead && p.moving) {
      ctx.beginPath();
      const dx = p.direction.x * (r + 6);
      const dy = p.direction.y * (r + 6);
      ctx.moveTo(dx, dy);
      const angle = Math.atan2(p.direction.y, p.direction.x);
      ctx.lineTo(
        dx + Math.cos(angle + 2.5) * 6,
        dy + Math.sin(angle + 2.5) * 6
      );
      ctx.lineTo(
        dx + Math.cos(angle - 2.5) * 6,
        dy + Math.sin(angle - 2.5) * 6
      );
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }

    ctx.restore();
  }

  // =================== GAME-SPECIFIC RENDERERS ===================

  renderRedLightGreenLight(ctx, state, gs) {
    const finishLine = gs.finishLine;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    const pulse = Math.abs(Math.sin(this.time * 5));
    
    let mainColor = this.red;
    let label = 'MOUVEMENT INTERDIT';
    if (gs.greenLight) {
        mainColor = gs.warning ? '#ffaa00' : this.green;
        label = gs.warning ? 'ANALYSE IMMINENTE...' : 'MOUVEMENT AUTORISÉ';
    }

    ctx.fillStyle = gs.greenLight ? `rgba(57, 231, 95, 0.1)` : `rgba(255, 59, 59, ${0.1 + pulse*0.1})`;
    ctx.fillRect(0, 0, 1920, 100);
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = mainColor;
    ctx.fillStyle = mainColor;
    ctx.fillRect(0, 98, 1920, 4);
    
    ctx.font = '900 48px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 960, 50);
    
    // Draw sci-fi eye
    ctx.beginPath();
    ctx.ellipse(960, 160, 80, 40, 0, 0, Math.PI * 2); 
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (!gs.greenLight || gs.warning) {
      const irisRadius = gs.warning ? 15 : 25;
      ctx.beginPath();
      ctx.arc(960, 160, irisRadius, 0, Math.PI * 2);
      ctx.fillStyle = mainColor;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(900, 160);
      ctx.lineTo(1020, 160);
      ctx.lineWidth = 6;
      ctx.strokeStyle = this.green;
      ctx.stroke();
    }
    
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = this.gold;
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 10]);
    ctx.beginPath();
    ctx.moveTo(0, finishLine);
    ctx.lineTo(1920, finishLine);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 215, 0, 0.05)';
    ctx.fillRect(0, 100, 1920, finishLine - 100);
    ctx.restore();

    ctx.fillStyle = this.gold;
    ctx.font = 'bold 20px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 LIGNE D\'ARRIVÉE', 960, finishLine - 15);
    // Timer is shown via the HTML HUD, no canvas duplicate needed
  }

  renderTugOfWar(ctx, state, gs) {
    const centerY = 540;
    const ropeY = centerY;

    // Rope line
    const ropeOffset = gs.ropePosition * 3;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(300 + ropeOffset, ropeY);
    ctx.lineTo(1620 + ropeOffset, ropeY);
    ctx.stroke();

    // Center mark
    ctx.strokeStyle = this.red;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(960, ropeY - 100);
    ctx.lineTo(960, ropeY + 100);
    ctx.stroke();
    ctx.setLineDash([]);

    // Flag on rope
    const flagX = 960 + ropeOffset;
    ctx.fillStyle = this.gold;
    ctx.beginPath();
    ctx.moveTo(flagX, ropeY - 8);
    ctx.lineTo(flagX + 30, ropeY - 25);
    ctx.lineTo(flagX, ropeY - 42);
    ctx.closePath();
    ctx.fill();

    // Team labels
    ctx.font = 'bold 30px Outfit';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('ÉQUIPE 1', 480, 200);
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('ÉQUIPE 2', 1440, 200);

    // Timer is shown via the HTML HUD, no canvas duplicate needed

    // Rope position bar
    const barW = 400;
    const barH = 16;
    const barX = 960 - barW / 2;
    const barY = 250;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, barH);
    const posNorm = (gs.ropePosition + gs.winThreshold) / (2 * gs.winThreshold);
    ctx.fillStyle = posNorm < 0.5 ? '#4ecdc4' : '#ff6b6b';
    ctx.fillRect(barX, barY, barW * posNorm, barH);
  }

  renderGlassBridge(ctx, state, gs) {
    const bridgeStartX = 1920 * 0.15;
    const bridgeEndX = 1920 * 0.85;
    const bridgeY = 540;
    const stepWidth = (bridgeEndX - bridgeStartX) / (gs.totalSteps + 1);
    const panelW = Math.min(stepWidth * 0.8, 120);
    const panelH = 100;

    // Abyss background
    ctx.fillStyle = 'rgba(20, 0, 40, 0.6)';
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bridgeStartX - 100, bridgeY - panelH - 60,
                  bridgeEndX - bridgeStartX + 200, panelH * 2 + 120);

    // Draw panels
    for (let i = 0; i < gs.totalSteps; i++) {
      const x = bridgeStartX + (i + 0.5) * stepWidth;
      const panel = gs.panels[i]; // null if unrevealed, otherwise { safe: 'left'|'right' }

      // Left panel (top visually)
      ctx.fillStyle = panel ? (panel.safe === 'left' ? 'rgba(0, 212, 170, 0.6)' : 'rgba(255, 60, 60, 0.1)') :
                              'rgba(150, 200, 255, 0.2)';
      ctx.strokeStyle = panel && panel.safe !== 'left' ? 'rgba(255, 60, 60, 0.4)' : 'rgba(150, 200, 255, 0.5)';
      ctx.lineWidth = 3;
      // Draw left slightly higher
      ctx.fillRect(x - panelW / 2, bridgeY - panelH - 10, panelW, panelH);
      if (!panel || panel.safe === 'left') {
        ctx.strokeRect(x - panelW / 2, bridgeY - panelH - 10, panelW, panelH);
      } else {
        // broken glass effect
        ctx.beginPath();
        ctx.moveTo(x - panelW/2, bridgeY - panelH - 10);
        ctx.lineTo(x + panelW/2, bridgeY - 10);
        ctx.moveTo(x - panelW/2, bridgeY - 10);
        ctx.lineTo(x + panelW/2, bridgeY - panelH - 10);
        ctx.stroke();
      }

      // Right panel (bottom visually)
      ctx.fillStyle = panel ? (panel.safe === 'right' ? 'rgba(0, 212, 170, 0.6)' : 'rgba(255, 60, 60, 0.1)') :
                              'rgba(150, 200, 255, 0.2)';
      ctx.strokeStyle = panel && panel.safe !== 'right' ? 'rgba(255, 60, 60, 0.4)' : 'rgba(150, 200, 255, 0.5)';
      ctx.fillRect(x - panelW / 2, bridgeY + 10, panelW, panelH);
      if (!panel || panel.safe === 'right') {
        ctx.strokeRect(x - panelW / 2, bridgeY + 10, panelW, panelH);
      } else {
        // broken glass effect
        ctx.beginPath();
        ctx.moveTo(x - panelW/2, bridgeY + 10);
        ctx.lineTo(x + panelW/2, bridgeY + panelH + 10);
        ctx.moveTo(x - panelW/2, bridgeY + panelH + 10);
        ctx.lineTo(x + panelW/2, bridgeY + 10);
        ctx.stroke();
      }

      // Step number
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = 'bold 20px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x, bridgeY + 6);
    }

    // Platforms
    ctx.fillStyle = '#333';
    ctx.fillRect(bridgeStartX - stepWidth, bridgeY - 150, stepWidth, 300);
    ctx.fillRect(bridgeStartX + gs.totalSteps * stepWidth, bridgeY - 150, stepWidth, 300);

    // Labels
    ctx.font = 'bold 24px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('DÉPART', bridgeStartX - stepWidth / 2, bridgeY + 190);
    ctx.fillText('ARRIVÉE', bridgeStartX + (gs.totalSteps + 0.5) * stepWidth, bridgeY + 190);

    // Active Player HUD
    if (gs.currentPlayerId && gs.choosing) {
      const p = state.players.find(pl => pl.id === gs.currentPlayerId);
      if (p) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(1920 / 2 - 300, 80, 600, 120);
        ctx.strokeStyle = this.teal;
        ctx.lineWidth = 4;
        ctx.strokeRect(1920 / 2 - 300, 80, 600, 120);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px Outfit';
        ctx.fillText(`Tour de : ${p.name.toUpperCase()}`, 1920 / 2, 130);
        ctx.fillStyle = this.pink;
        ctx.fillText(`Choix de la dalle ${gs.playerStep + 1} !`, 1920 / 2, 175);

        // Timer
        ctx.fillStyle = this.gold;
        ctx.font = 'bold 48px Outfit';
        ctx.fillText(`${gs.choiceTimer}s`, 1920 / 2 + 200, 150);
      }
    } else if (gs.waitingForNext && !gs.finished) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(1920 / 2 - 200, 80, 400, 80);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 28px Outfit';
      ctx.fillText('Joueur suivant...', 1920 / 2, 130);
    }

    // Progress
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '20px Outfit';
    ctx.textAlign = 'left';
    ctx.fillText(`Joueur ${gs.currentPlayerIndex} sur ${gs.totalPlayers}`, 40, 60);
  }

  // ---- ROCK PAPER SCISSORS ----
  renderRockPaperScissors(ctx, state, gs) {
    if (gs.state === 'bracket_full') {
      this.drawTournamentBracket(ctx, state, gs);
      return;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(15, 15, 30, 0.9)';
    ctx.fillRect(0, 0, 1920, 1080);
    
    // Draw Round Info
    // Draw Round Info
    ctx.fillStyle = this.pink;
    ctx.font = 'bold 42px Outfit';
    ctx.textAlign = 'center';
    
    let mainTitle = `MANCHE ${gs.roundNumber}`;
    if (gs.state === 'resolution') {
        const remainingToFinal = gs.totalRoundsEstimate - gs.roundNumber;
        if (remainingToFinal === 0 && Array.from(state.players).filter(p=>p.alive).length <= 1) {
             mainTitle = `VAINQUEUR DÉCLARÉ !`;
        } else {
             mainTitle = `RÉSULTATS DE LA MANCHE ${gs.roundNumber}`;
        }
    }
    ctx.fillText(mainTitle, 960, 60);

    // Draw timer
    ctx.fillStyle = this.white;
    ctx.font = 'bold 64px Outfit';
    ctx.fillText(`${gs.timer}s`, 960, 125);

    // Draw Phase Text
    ctx.font = 'bold 24px Outfit';
    let phaseText = '';
    if (gs.state === 'bracket_reveal') phaseText = 'Nouveaux affrontements assignés !';
    if (gs.state === 'countdown') phaseText = 'Choix des armes en cours...';
    if (gs.state === 'resolution') phaseText = 'Sanglante Résolution';
    
    ctx.fillStyle = this.teal;
    ctx.fillText(phaseText, 960, 170);

    // Draw Combat Brackets
    const numMatches = gs.matches.length;
    const isFinale = (numMatches === 1);
    const cols = Math.max(1, Math.ceil(numMatches / 5));

    gs.matches.forEach((m) => {
      let matchX = m.uiX || 960;
      let matchY = m.uiY || 350;
      
      let cardW = (cols >= 3 ? 550 : 800);
      let cardH = 120;
      let nameFontSize = cols >= 3 ? 24 : 30;
      let choiceFontSize = cols >= 3 ? 20 : 26;
      let vsFontSize = cols >= 3 ? 28 : 36;
      
      if (isFinale) {
         cardW = 1200;
         cardH = 200;
         nameFontSize = 48; // Huge names!
         choiceFontSize = 36; // Huge choices
         vsFontSize = 64; 
      }

      const p1 = state.players.find(p => p.id === m.p1);
      const p2 = state.players.find(p => p.id === m.p2);
      
      const halfCard = cardW / 2;
      
      // Card Background
      ctx.fillStyle = 'rgba(20, 20, 35, 0.95)';
      ctx.beginPath();
      ctx.roundRect(matchX - halfCard, matchY - cardH/2, cardW, cardH, 16);
      ctx.fill();
      
      let strokeStyle = 'rgba(255,255,255,0.1)';
      let lineWidth = 2;

      // Add colored borders based on the outcome during the resolution phase
      if (gs.state === 'resolution' || m.finished) {
         if (m.winner) {
            // Someone won: Green/Teal border
            strokeStyle = 'rgba(0, 212, 170, 0.9)';
            lineWidth = 4;
         } else if (m.choice1 && m.choice2 && m.choice1 === m.choice2) {
            // Tie (Egalité): Orange border
            strokeStyle = 'rgba(255, 170, 0, 0.9)';
            lineWidth = 4;
         } else {
            // Both eliminated (AFK / time out): Red border
            strokeStyle = 'rgba(255, 0, 85, 0.9)';
            lineWidth = 4;
         }
      }

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();

      // VS Text (always centered)
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = `bold ${vsFontSize}px Outfit`;
      ctx.fillText('VS', matchX, matchY + (isFinale ? 15 : 10));

      if (p1 && p2) {
        // P1 Name
        ctx.textAlign = 'right';
        ctx.fillStyle = (m.loser === p1.id) ? 'rgba(255, 60, 60, 0.5)' : this.white;
        ctx.font = `bold ${nameFontSize}px Outfit`;
        ctx.fillText(p1.name, matchX - (isFinale ? 80 : 40), matchY + (isFinale ? 5 : 10));
        
        // P2 Name
        ctx.textAlign = 'left';
        ctx.fillStyle = (m.loser === p2.id) ? 'rgba(255, 60, 60, 0.5)' : this.white;
        ctx.fillText(p2.name, matchX + (isFinale ? 80 : 40), matchY + (isFinale ? 5 : 10));
        
        // Status or Choices
        ctx.font = `bold ${choiceFontSize}px Outfit`;
        if (gs.state === 'resolution' || m.finished) {
           const icons = { 'rock': 'PIERRE', 'paper': 'FEUILLE', 'scissors': 'CISEAUX' };
           ctx.fillStyle = this.teal;

           ctx.textAlign = 'right';
           if (m.choice1) {
             ctx.fillText(icons[m.choice1], matchX - (isFinale ? 80 : 40), matchY + (isFinale ? 65 : 45));
           }
           
           ctx.textAlign = 'left';
           if (m.choice2) {
             ctx.fillText(icons[m.choice2], matchX + (isFinale ? 80 : 40), matchY + (isFinale ? 65 : 45));
           }

           // Crown to the winner
           ctx.textAlign = 'center';
           ctx.font = `bold ${isFinale ? 50 : 30}px Outfit`;
           if (m.winner === m.p1) {
             ctx.fillText('👑', matchX - (isFinale ? 350 : 200), matchY);
           } else if (m.winner === m.p2) {
             ctx.fillText('👑', matchX + (isFinale ? 350 : 200), matchY);
           }
        } else {
           // SHOW 'PRÊT' during countdown if choice made
           ctx.fillStyle = this.teal;
           ctx.font = `bold ${choiceFontSize}px Outfit`;
           
           ctx.textAlign = 'right';
           if (m.choice1) ctx.fillText('PRÊT', matchX - (isFinale ? 80 : 40), matchY + (isFinale ? 65 : 45));
           
           ctx.textAlign = 'left';
           if (m.choice2) ctx.fillText('PRÊT', matchX + (isFinale ? 80 : 40), matchY + (isFinale ? 65 : 45));
        }
      }
    });

    ctx.restore();
  }
  drawTournamentBracket(ctx, state, gs) {
    if (!gs.bracketTree || gs.bracketTree.length === 0) return;
    
    ctx.save();
    // Darker, more dramatic background for the bracket screen
    ctx.fillStyle = 'rgba(10, 15, 30, 0.98)';
    ctx.fillRect(0, 0, 1920, 1080);
    
    // Title
    ctx.fillStyle = this.pink;
    ctx.font = 'bold 64px Outfit';
    ctx.textAlign = 'center';
    
    const remainingToFinal = gs.totalRoundsEstimate - gs.roundNumber;
    let roundLabel = `MANCHE ${gs.roundNumber}`;
    if (remainingToFinal === 0) roundLabel = "GRANDE FINALE";
    else if (remainingToFinal === 1) roundLabel = "DEMI-FINALES";
    else if (remainingToFinal === 2) roundLabel = "QUARTS DE FINALE";
    else if (remainingToFinal === 3) roundLabel = "HUITIÈMES DE FINALE";

    ctx.fillText(`TABLEAU FINAL`, 960, 80);
    
    ctx.fillStyle = this.teal;
    ctx.font = 'bold 36px Outfit';
    ctx.fillText(roundLabel, 960, 130);

    const totalRounds = gs.bracketTree.length;
    
    // Dynamic scale based on bracket size — ensures it always fits on screen
    let scale;
    if (totalRounds <= 2) scale = 1.4;
    else if (totalRounds <= 3) scale = 1.2;
    else if (totalRounds <= 4) scale = 0.9;
    else scale = 0.7;

    // Dynamic card width that shrinks with more rounds
    const cardW = Math.min(280, Math.max(150, 1600 / (totalRounds * 2 + 1))) * scale;
    // Horizontal spacing between round columns
    const marginX = 40;
    const usableWidth = 1920 - marginX * 2 - cardW; // space for arranging round columns
    const roundSpacing = totalRounds > 1 ? usableWidth / (totalRounds - 1) : 0;

    // Helper to draw a match slot
    const drawSlot = (m, x, y, slotW, isThisRound) => {
        const isPlaying = isThisRound && !m.finished;
        const isFinishedThisRound = isThisRound && m.finished;

        // Bright background if active round
        ctx.fillStyle = isThisRound ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(x - slotW/2, y - 30 * scale, slotW, 60 * scale, 10);
        ctx.fill();

        if (isPlaying) {
           ctx.lineWidth = 6;
           ctx.strokeStyle = 'rgba(0, 212, 170, 0.3)';
           ctx.stroke();
           ctx.lineWidth = 3;
           ctx.strokeStyle = this.teal;
           ctx.stroke();
        } else if (isFinishedThisRound) {
           ctx.lineWidth = 6;
           ctx.strokeStyle = 'rgba(255, 0, 85, 0.3)';
           ctx.stroke();
           ctx.lineWidth = 3;
           ctx.strokeStyle = '#FF0055';
           ctx.stroke();
        } else {
           ctx.strokeStyle = m.finished ? 'rgba(229, 46, 99, 0.3)' : 'rgba(255,255,255,0.15)';
           ctx.lineWidth = 2;
           ctx.stroke();
        }

        ctx.textAlign = 'center';
        const p1 = state.players.find(p => p.id === m.p1);
        const p2 = state.players.find(p => p.id === m.p2);
        const name1 = p1 ? p1.name : '???';
        const name2 = p2 ? p2.name : '???';
        
        const fontSize = Math.max(14, Math.floor(18 * scale));
        ctx.font = `bold ${fontSize}px Outfit`;
        
        // Show winner in gold if round is finished
        if (m.finished && m.winner && m.winner !== 'tie') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fillText(`${name1}  VS  ${name2}`, x, y + 6 * scale);
            
            ctx.fillStyle = this.gold;
            const wName = (m.winner === m.p1 && p1) ? p1.name : (p2 ? p2.name : '');
            ctx.fillText(`👑 ${wName}`, x, y - 28 * scale);
        } else {
            ctx.fillStyle = isPlaying ? '#FFFFFF' : 'rgba(255,255,255, 0.8)';
            ctx.fillText(`${name1}  VS  ${name2}`, x, y + 5 * scale);
        }
    };

    // Store coord for connecting lines: coords[round][globalMatchIdx] = {x, y}
    const coords = []; 

    for (let r = 0; r < totalRounds; r++) {
       const matches = gs.bracketTree[r];
       const isThisRound = (r === gs.roundNumber - 1);
       coords[r] = [];
       
       if (matches.length === 1) { // FINALE
          const x = 960;
          const y = 850; 
          drawSlot(matches[0], x, y, cardW * 1.3, isThisRound);
          coords[r][0] = {x, y, isLeft: null, cardW: cardW * 1.3};
          
          ctx.fillStyle = this.pink;
          ctx.font = `bold ${Math.floor(28 * scale)}px Outfit`;
          ctx.fillText('FINALE', 960, y - 60 * scale);
       } else {
          let half = matches.length / 2;
          for (let i = 0; i < matches.length; i++) {
             const isLeft = (i < half);
             const sideIdx = isLeft ? i : (i - half);
             
             const offsetX = isLeft 
               ? (marginX + cardW/2 + r * roundSpacing) 
               : (1920 - marginX - cardW/2 - r * roundSpacing);
             
             const availableHeight = 780; 
             const spacingY = availableHeight / Math.max(1, half);
             const startY = 180 + spacingY / 2;
             const y = startY + sideIdx * spacingY;
             
             drawSlot(matches[i], offsetX, y, cardW, isThisRound);
             coords[r][i] = { x: offsetX, y: y, isLeft, cardW: cardW };
          }
       }
    }

    // Draw connecting lines
    ctx.lineWidth = 3;
    
    for (let r = 0; r < totalRounds - 1; r++) {
       // Highlight lines extending FROM finished rounds
       const pastRound = (r < gs.roundNumber - 1); 
       ctx.strokeStyle = pastRound ? 'rgba(255, 204, 0, 0.4)' : 'rgba(255, 255, 255, 0.15)'; // Gold tint if progressed

       for (let i = 0; i < coords[r].length; i++) {
           const current = coords[r][i];
           const nextIdx = Math.floor(i / 2);
           const next = coords[r+1][nextIdx];
           
           if (!current || !next) continue;
           
           ctx.beginPath();
           if (current.isLeft !== null) {
               const dir = current.isLeft ? 1 : -1;
               const startX = current.x + (current.cardW/2 * dir);
               
               if (r + 1 === totalRounds - 1) {
                  ctx.moveTo(startX, current.y);
                  ctx.lineTo(startX + 50 * dir, current.y);
                  ctx.lineTo(startX + 50 * dir, next.y - 120);
                  ctx.lineTo(next.x, next.y - 120);
                  ctx.lineTo(next.x, next.y - 40 * scale);
               } else {
                  const endX = next.x - (next.cardW/2 * dir);
                  const midX = startX + (endX - startX) / 2;
                  
                  ctx.moveTo(startX, current.y);
                  ctx.lineTo(midX, current.y);
                  ctx.lineTo(midX, next.y);
                  ctx.lineTo(endX, next.y);
               }
           }
           ctx.stroke();
       }
    }

    ctx.restore();
  }

  // Inject a fade in for the actual countdown rendering as well!

  // =================== EFFECTS ===================

  addElimEffect(x, y) {
    this.eliminationEffects.push({
      x, y, timer: 1.0, maxTimer: 1.0
    });
  }

  drawElimEffects(ctx) {
    this.eliminationEffects = this.eliminationEffects.filter(e => e.timer > 0);
    for (const e of this.eliminationEffects) {
      e.timer -= 1 / 30;
      const progress = 1 - (e.timer / e.maxTimer);
      const alpha = 1 - progress;
      const radius = 20 + progress * 50;

      ctx.beginPath();
      ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 60, 60, ${alpha * 0.3})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 60, 60, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // X mark
      ctx.strokeStyle = `rgba(255, 60, 60, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(e.x - 12, e.y - 12);
      ctx.lineTo(e.x + 12, e.y + 12);
      ctx.moveTo(e.x + 12, e.y - 12);
      ctx.lineTo(e.x - 12, e.y + 12);
      ctx.stroke();
    }
  }
}
