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
      } else if (gameName.includes('Manège')) {
        this.renderGroupGame(ctx, state, gameState);
      } else if (gameName.includes('Dortoir')) {
        this.renderNightFight(ctx, state, gameState);
      } else if (gameName.includes('Pont')) {
        this.renderGlassBridge(ctx, state, gameState);
      } else if (gameName.includes('Duel')) {
        this.renderFinalDuel(ctx, state, gameState);
      }
    }

    // Draw all players
    this.drawPlayers(ctx, state.players);

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

    // Draw dead players first (ghostly)
    for (const p of players) {
      if (!p.alive) {
        this.drawPlayer(ctx, p, true);
      }
    }
    // Then alive players on top
    for (const p of players) {
      if (p.alive) {
        this.drawPlayer(ctx, p, false);
      }
    }
  }

  drawPlayer(ctx, p, dead) {
    const x = p.x;
    const y = p.y;
    const r = 16;

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
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.number, 0, 0);

    // Name label above
    if (!dead) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '10px Outfit';
      ctx.fillText(p.name, 0, -r - 8);
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

    // Finish line
    ctx.save();
    ctx.strokeStyle = this.gold;
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 10]);
    ctx.beginPath();
    ctx.moveTo(0, finishLine);
    ctx.lineTo(1920, finishLine);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.fillRect(0, 0, 1920, finishLine);
    ctx.restore();

    // Finish label
    ctx.fillStyle = this.gold;
    ctx.font = 'bold 16px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 LIGNE D\'ARRIVÉE', 960, finishLine - 10);

    // Big traffic light in center
    const lightX = 960;
    const lightY = 80;
    const lightR = 40;
    
    // Light background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(lightX - 55, lightY - 55, 110, 110, 20);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lightX, lightY, lightR, 0, Math.PI * 2);
    if (gs.greenLight) {
      ctx.fillStyle = gs.warning ? '#ffaa00' : this.green;
      ctx.shadowColor = gs.warning ? '#ffaa00' : this.green;
    } else {
      ctx.fillStyle = this.red;
      ctx.shadowColor = this.red;
    }
    ctx.shadowBlur = 30;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Timer
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${gs.roundTimer}s`, 960, 160);
  }

  renderTugOfWar(ctx, state, gs) {
    const centerY = 540;
    const ropeY = centerY;

    // Rope line
    const ropeOffset = gs.ropePosition * 3;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 12;
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

    // Timer
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Outfit';
    ctx.fillText(`⏱ ${gs.timer}s`, 960, 200);

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

  renderGroupGame(ctx, state, gs) {
    // Show target number
    if (gs.phase === 'announce' || gs.phase === 'move') {
      ctx.fillStyle = this.pink;
      ctx.font = 'bold 160px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = gs.phase === 'announce' ? 1 : 0.3;
      ctx.fillText(gs.targetNumber, 960, 450);
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Outfit';
      ctx.fillText(`Formez des groupes de ${gs.targetNumber} !`, 960, 580);

      if (gs.phase === 'move') {
        ctx.fillText(`⏱ ${gs.timer}s`, 960, 630);
      }

      ctx.fillStyle = '#8892a4';
      ctx.font = '16px Outfit';
      ctx.fillText(`Manche ${gs.round}/${gs.maxRounds}`, 960, 670);
    }

    // Draw group circles
    if (gs.groups) {
      for (const group of gs.groups) {
        const r = 50 + group.members.length * 10;
        ctx.beginPath();
        ctx.arc(group.centerX, group.centerY, r, 0, Math.PI * 2);
        ctx.strokeStyle = group.valid ? 'rgba(0, 255, 150, 0.4)' : 'rgba(255, 60, 60, 0.3)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Group count
        ctx.fillStyle = group.valid ? this.green : this.red;
        ctx.font = 'bold 14px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(group.members.length, group.centerX, group.centerY - r - 8);
      }
    }
  }

  renderNightFight(ctx, state, gs) {
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, 1920, 1080);

    // Flash effects (brief moments of light)
    if (gs.flashEffects) {
      for (const flash of gs.flashEffects) {
        const alpha = flash.timer / 0.3;
        const gradient = ctx.createRadialGradient(
          flash.x, flash.y, 0,
          flash.x, flash.y, flash.radius * 1.5
        );
        gradient.addColorStop(0, `rgba(255, 200, 50, ${alpha * 0.6})`);
        gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(flash.x - flash.radius * 2, flash.y - flash.radius * 2,
                      flash.radius * 4, flash.radius * 4);
      }
    }

    // Show HP bars over visible players (near flashes)
    if (gs.playerHP && state.players) {
      for (const p of state.players) {
        if (!p.alive) continue;
        const hp = gs.playerHP[p.id] || 0;
        
        // HP bar
        const barW = 30;
        const barH = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(p.x - barW / 2, p.y - 28, barW, barH);
        ctx.fillStyle = hp > 1 ? this.green : this.red;
        ctx.fillRect(p.x - barW / 2, p.y - 28, barW * (hp / gs.maxHP), barH);
      }
    }

    // Timer
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 30px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${gs.timer}s`, 960, 60);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '20px Outfit';
    ctx.fillText('🌙 BATAILLE DANS LE NOIR', 960, 100);
  }

  renderGlassBridge(ctx, state, gs) {
    const bridgeStartX = 1920 * 0.3;
    const bridgeEndX = 1920 * 0.7;
    const bridgeY = 540;
    const stepWidth = (bridgeEndX - bridgeStartX) / gs.totalSteps;
    const panelH = 80;

    // Abyss background
    ctx.fillStyle = 'rgba(20, 0, 40, 0.5)';
    ctx.fillRect(bridgeStartX - 40, bridgeY - panelH - 20,
                  bridgeEndX - bridgeStartX + 80, panelH * 2 + 40);

    // Draw panels
    for (let i = 0; i < gs.totalSteps; i++) {
      const x = bridgeStartX + i * stepWidth;
      const panel = gs.panels[i];

      // Left panel
      ctx.fillStyle = panel ? (panel.safe === 'left' ? 'rgba(0, 212, 170, 0.4)' : 'rgba(255, 60, 60, 0.3)') :
                              'rgba(150, 200, 255, 0.15)';
      ctx.strokeStyle = 'rgba(150, 200, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.fillRect(x + 4, bridgeY - panelH / 2 - 25, stepWidth / 2 - 8, panelH);
      ctx.strokeRect(x + 4, bridgeY - panelH / 2 - 25, stepWidth / 2 - 8, panelH);

      // Right panel
      ctx.fillStyle = panel ? (panel.safe === 'right' ? 'rgba(0, 212, 170, 0.4)' : 'rgba(255, 60, 60, 0.3)') :
                              'rgba(150, 200, 255, 0.15)';
      ctx.fillRect(x + stepWidth / 2 + 4, bridgeY - panelH / 2 - 25, stepWidth / 2 - 8, panelH);
      ctx.strokeRect(x + stepWidth / 2 + 4, bridgeY - panelH / 2 - 25, stepWidth / 2 - 8, panelH);

      // Step number
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '12px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + stepWidth / 2, bridgeY + panelH / 2 + 10);
    }

    // Labels
    ctx.font = 'bold 18px Outfit';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('DÉPART', 1920 * 0.15, bridgeY);
    ctx.fillText('ARRIVÉE', 1920 * 0.85, bridgeY);

    // Title
    ctx.fillStyle = this.teal;
    ctx.font = 'bold 24px Outfit';
    ctx.fillText('🌉 LE PONT DE VERRE', 960, bridgeY - panelH - 60);
  }

  renderFinalDuel(ctx, state, gs) {
    // Draw circle arena
    ctx.beginPath();
    ctx.arc(gs.centerX, gs.centerY, gs.circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(233, 30, 130, 0.08)';
    ctx.fill();
    ctx.strokeStyle = this.pink;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Danger zone (pulsing)
    const pulseAlpha = 0.1 + Math.sin(this.time * 4) * 0.05;
    ctx.beginPath();
    ctx.arc(gs.centerX, gs.centerY, gs.circleRadius + 20, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 60, 60, ${pulseAlpha})`;
    ctx.lineWidth = 40;
    ctx.stroke();

    // Circle shrinking warning
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 20px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${gs.timer}s`, gs.centerX, gs.centerY - gs.circleRadius - 40);

    ctx.fillStyle = this.pink;
    ctx.font = 'bold 28px Outfit';
    ctx.fillText('⚔️ DUEL FINAL', gs.centerX, 60);
  }

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
