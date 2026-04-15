(function () {
  const socket = io();
  window.socket = socket;
  const canvas = document.getElementById('game-canvas');
  const renderer = new Renderer(canvas);

  
  const screens = {
    lobby: document.getElementById('lobby-screen'),
    betting: document.getElementById('betting-screen'),
    explanation: document.getElementById('explanation-screen'),
    countdown: document.getElementById('countdown-screen'),
    game: document.getElementById('game-screen'),
    transition_bank: document.getElementById('transition-bank-screen'),
    transition_dead: document.getElementById('transition-dead-screen'),
    transition_roulette: document.getElementById('transition-roulette-screen'),
    gameover: document.getElementById('gameover-screen')
  };

  let currentState = null;
  let previousAlivePlayers = new Set();
  let lastPhase = null;
  let rouletteAnimationFrame = null;
  
  
  let lastGreenLight = null;
  let lastWarning = null;
  let lastTimerValue = null;
  let lastCountdownValue = null;

  
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  
  document.addEventListener('click', () => { 
    window.soundManager.init(); 
    document.getElementById('audio-unlock')?.remove();
  }, { once: true });
  document.addEventListener('keydown', () => { window.soundManager.init(); }, { once: true });

  
  socket.emit('register-display');

  
  const protocol = window.location.protocol;
  const host = window.location.host;
  const joinUrl = `${protocol}//${host}/play`;
  document.getElementById('join-url-display').textContent = joinUrl;

  
  generateQR(joinUrl);

  
  const btnStart = document.getElementById('btn-start');
  btnStart.addEventListener('click', () => {
    socket.emit('admin-start');
  });

  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      socket.emit('admin-start');
    }
    if (e.key === 's' || e.key === 'S') {
      socket.emit('admin-skip');
    }
    if (e.key === 'r' || e.key === 'R') {
      socket.emit('admin-reset');
    }
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    socket.emit('admin-reset');
  });

  
  document.getElementById('btn-add-bots')?.addEventListener('click', () => {
    const count = parseInt(document.getElementById('bot-count').value) || 5;
    socket.emit('admin-add-bots', { count });
  });

  
  socket.on('phase', (data) => {
    showScreen(data.phase);

    
    if (data.phase !== lastPhase) {
      lastPhase = data.phase;
      
      window.soundManager.onPhaseChange(data.phase, data.currentGame);
    }
    if (data.phase === 'countdown' && data.currentGame) {
      document.getElementById('game-name').textContent = data.currentGame.name || '???';
      document.getElementById('hud-game-name').textContent = data.currentGame.name || '???';
      document.getElementById('hud-game-progress').textContent =
        `Épreuve ${data.currentGame.index !== undefined ? data.currentGame.index + 1 : '?'}/${data.currentGame.total || '?'}`;
    }
  });

  
  socket.on('player-list', (list) => {
    updatePlayerList(list);
    document.getElementById('player-count-num').textContent = list.length;
    btnStart.style.display = list.length >= 1 ? 'block' : 'none';
    window.soundManager.playSfxPlayerJoin();
  });

  
  socket.on('game-state', (state) => {
    currentState = state;

    
    if (state.players) {
      const currentAlive = new Set(
        state.players.filter(p => p.alive).map(p => p.id)
      );
      for (const id of previousAlivePlayers) {
        if (!currentAlive.has(id)) {
          const player = state.players.find(p => p.id === id);
          if (player) {
            renderer.addElimEffect(player.x, player.y);
            window.soundManager.playSfxElimination();
          }
        }
      }
      previousAlivePlayers = currentAlive;
    }

    
    if (state.phase === 'playing') {
      document.getElementById('hud-alive').textContent =
        `${state.alivePlayers} survivants`;

      
      const hc = document.getElementById('hud-center');
      if (state.currentGame && state.currentGame.state) {
        if (state.currentGame.name === 'Jeu Final') {
          hc.style.display = 'none';
        } else {
          hc.style.display = 'block';
        }

        const gs = state.currentGame.state;
        if (gs.greenLight !== undefined) {
          
          hc.innerHTML = '';
            
          
          if (gs.greenLight !== lastGreenLight) {
              if (gs.greenLight) {
                  window.soundManager.playDollSong(gs.phaseTimer);
                  window.soundManager.playSfxGreenLight();
              } else {
                  window.soundManager.stopDollSong();
                  window.soundManager.playSfxRedLight();
              }
              lastGreenLight = gs.greenLight;
          }
          if (gs.warning && !lastWarning) {
              window.soundManager.playSfxWarning();
          }
          lastWarning = gs.warning;
        } else if (gs.timer !== undefined) {
          
          hc.textContent = `${gs.timer}s`;
          
          
          if (gs.timer !== lastTimerValue && gs.timer <= 10) {
              window.soundManager.playTick(0.15);
              lastTimerValue = gs.timer;
          }
        } else {
          hc.textContent = '';
        }
      }
    }

    // explication
    if (state.phase === 'explanation') {
      if (state.currentGame) {
        document.getElementById('expl-game-name').textContent = state.currentGame.name || 'Jeu Inconnu';
        document.getElementById('expl-game-desc').textContent = state.currentGame.rules?.description || '...';
        document.getElementById('expl-game-controls').textContent = state.currentGame.rules?.controls || '...';
      }
      document.getElementById('expl-timer').textContent = state.explanation;
    }

    
    if (state.phase === 'countdown') {
      const countdownEl = document.getElementById('countdown-number');
      if (state.countdown !== lastCountdownValue) {
          countdownEl.textContent = state.countdown;
          
          countdownEl.style.animation = 'none';
          void countdownEl.offsetWidth;
          countdownEl.style.animation = 'countdown-pulse 1s ease-out forwards';
          
          if (state.countdown > 0) window.soundManager.playTick(0.2);
          lastCountdownValue = state.countdown;
      }
      document.getElementById('game-players').textContent =
        `${state.alivePlayers} joueurs en lice`;
    }

    
    if (state.phase === 'transition_bank') {
      const bankEl = document.getElementById('prize-pool');
      
      if (!bankEl.hasAttribute('data-animating')) {
        bankEl.setAttribute('data-animating', 'true');
        document.getElementById('bank-eliminated').textContent = `+ ${state.eliminatedThisRoundCount} joueurs éliminés`;
        
        let startVal = state.prizePoolOld || 0;
        let endVal = state.prizePool || 0;
        let duration = 3000; // 3 seconds
        let startTime = performance.now();
        
        function updateBank(time) {
          let progress = (time - startTime) / duration;
          if (progress > 1) progress = 1;
          
          let currentMoney = Math.floor(startVal + (endVal - startVal) * progress);
          bankEl.textContent = `${currentMoney.toLocaleString()} ₩`;
          
          if (progress < 1) {
            requestAnimationFrame(updateBank);
          }
        }
        requestAnimationFrame(updateBank);

        
        function spawnMoney() {
          if(!bankEl.hasAttribute('data-animating')) return;
          const rain = document.getElementById('money-rain-container');
          if(!rain) return;
          
          const bill = document.createElement('div');
          bill.className = 'falling-bill';
          bill.textContent = Math.random() > 0.5 ? '💵' : '💰';
          bill.style.left = (Math.random() * 100) + 'vw';
          const duration = 2 + Math.random() * 2;
          bill.style.animationDuration = duration + 's';
          rain.appendChild(bill);
          
          
          window.soundManager.playTick(0.1); 

          setTimeout(() => {
            if(bill.parentNode) bill.parentNode.removeChild(bill);
          }, duration * 1000 + 100);
          
          setTimeout(spawnMoney, 100 + Math.random() * 200);
        }
        spawnMoney();
      }
    } else {
      const bankEl = document.getElementById('prize-pool');
      if (bankEl) bankEl.removeAttribute('data-animating');
      const rain = document.getElementById('money-rain-container');
      if (rain) rain.innerHTML = '';
    }

    
    if (state.phase === 'transition_dead') {
      const grid = document.getElementById('memorial-grid');
      if (!grid.hasAttribute('data-rendered')) {
        grid.setAttribute('data-rendered', 'true');
        grid.innerHTML = '';
        
        
        const survivors = state.players ? state.players.filter(p => p.alive) : [];
        const deadThisRound = state.eliminatedDetails || [];
        
        const allParticipants = [];
        survivors.forEach(p => allParticipants.push({ ...p, justDied: false }));
        deadThisRound.forEach(p => allParticipants.push({ ...p, justDied: true }));
        
        
        allParticipants.sort((a, b) => a.number - b.number);

        const count = allParticipants.length;
        if (count > 0) {
            
            const cols = Math.ceil(Math.sqrt(count * (16/9)));
            const rows = Math.ceil(count / cols);
            grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
            
            allParticipants.forEach((p, i) => {
              const pDiv = document.createElement('div');
              pDiv.className = 'player-tile';
              pDiv.style.background = p.color;
              pDiv.innerHTML = `<span class="player-name">${p.name}</span>`;
              pDiv.style.animationDelay = `${(i % cols) * 0.08}s`;
              
              if (p.justDied) {
                
                setTimeout(() => {
                  pDiv.classList.add('eliminated-anim');
                  
                  window.soundManager.playTick(0.3); 
                  window.soundManager.playNote(60, 'sine', window.soundManager.ctx.currentTime, 0.5, 0.4); 
                }, 1500 + (i * 120)); // staggered rhythm
              }
              
              grid.appendChild(pDiv);
            });
        } else {
            grid.innerHTML = '<div style="color:white; font-size: 24px;">Aucun joueur ce tour-ci...</div>';
        }
      }
    } else {
      const grid = document.getElementById('memorial-grid');
      if (grid) grid.removeAttribute('data-rendered');
    }

    
    if (state.phase === 'transition_roulette') {
      const reel = document.getElementById('roulette-reel');
      if (!reel.hasAttribute('data-animating')) {
        reel.setAttribute('data-animating', 'true');
        reel.innerHTML = '';
        
        const fakeGames = ['Labyrinthe Mortel', 'Cache-cache Acide', 'Pluie de Flèches', 'Saut de la Foi', 'Les 7 Portes', 'Le Gouffre'];
        const pool = (state.allGameNames || []).concat(fakeGames);
        if (pool.length === 0) pool.push('Jeu Inconnu');
        const totalFiller = 50; 
        
        for (let i = 0; i < totalFiller; i++) {
          const item = document.createElement('div');
          item.className = 'roulette-item';
          item.textContent = pool[Math.floor(Math.random() * pool.length)];
          reel.appendChild(item);
        }
        
        const winner = document.createElement('div');
        winner.className = 'roulette-item target-winner';
        winner.textContent = state.nextGameName || 'Duel Final';
        winner.style.color = '#ffaa00';
        winner.style.fontWeight = '900';
        reel.appendChild(winner);
        
        for (let i = 0; i < 5; i++) {
          const item = document.createElement('div');
          item.className = 'roulette-item';
          item.textContent = pool[Math.floor(Math.random() * pool.length)];
          reel.appendChild(item);
        }

        // JS-driven animation for sound sync
        let start = null;
        const duration = 6500; 
        const targetScroll = totalFiller * 80 - 80;
        let lastTickIndex = -1;

        const animate = (timestamp) => {
          if (!start) start = timestamp;
          const progress = Math.min((timestamp - start) / duration, 1);
          const easedProgress = easeOut(progress);
          const currentY = easedProgress * targetScroll;
          
          reel.style.transform = `translateY(-${currentY}px)`;
          
          
          const currentTickIndex = Math.floor(currentY / 80);
          if (currentTickIndex !== lastTickIndex) {
            
            window.soundManager.playTick(0.2 * (1 - progress * 0.8)); 
            lastTickIndex = currentTickIndex;
          }

          if (progress < 1 && state.phase === 'transition_roulette') {
            rouletteAnimationFrame = requestAnimationFrame(animate);
          } else if (progress >= 1) {
             
             
          }
        };
        rouletteAnimationFrame = requestAnimationFrame(animate);
      }
    } else {
      
      const reel = document.getElementById('roulette-reel');
      if (reel) {
         reel.removeAttribute('data-animating');
         reel.style.transform = 'translateY(0)';
         if (rouletteAnimationFrame) {
           cancelAnimationFrame(rouletteAnimationFrame);
           rouletteAnimationFrame = null;
         }
      }
    }

    
    if (state.phase === 'gameover') {
      const alive = state.players.filter(p => p.alive);
      if (alive.length > 0) {
        document.getElementById('winner-name').textContent =
          `${alive[0].name} (#${alive[0].number})`;
      } else {
        document.getElementById('winner-name').textContent = 'Aucun survivant !';
      }

      const betEl = document.getElementById('best-bet-result');
      if (betEl) {
          if (state.bestBetResult) {
            const res = state.bestBetResult;
            if (res.isWinnerBet) {
               betEl.innerHTML = `🏆 Pronostic Parfait : <span style="color:#00d4aa">${res.bettorName}</span> a deviné la victoire de <span style="color:#ffd700">${res.targetName}</span> !`;
            } else {
               const rankSuffix = res.targetRank === 1 ? 'er' : 'ème';
               betEl.innerHTML = `🎯 Meilleur Pronostic : Personne n'a deviné le gagnant, mais <span style="color:#00d4aa">${res.bettorName}</span> était le plus proche grâce à son pari sur <span style="color:#ffd700">${res.targetName}</span> (qui a fini <span style="color:#ffd700">${res.targetRank}${rankSuffix}</span>) !`;
            }
            betEl.style.display = 'block';
          } else {
            betEl.style.display = 'none';
          }
      }
    }

    
    if (state.phase === 'betting') {
       const banner = document.getElementById('betting-status');
       if (banner) {
          banner.textContent = `${state.totalBets || 0} / ${state.alivePlayers || 0} votes`;
       }
    }

    
    if (state.phase !== 'lobby' && state.phase !== 'betting') {
      renderer.render(state);
    }
  });

  function showScreen(phase) {
    Object.values(screens).forEach(s => { if(s) s.classList.remove('active'); });
    switch (phase) {
      case 'lobby':
        screens.lobby.classList.add('active'); break;
      case 'betting':
        screens.betting.classList.add('active'); break;
      case 'explanation':
        screens.explanation.classList.add('active'); break;
      case 'countdown':
        screens.countdown.classList.add('active'); break;
      case 'playing':
        screens.game.classList.add('active'); break;
      case 'transition_bank':
        screens.transition_bank.classList.add('active'); break;
      case 'transition_dead':
        screens.transition_dead.classList.add('active'); break;
      case 'transition_roulette':
        screens.transition_roulette.classList.add('active'); break;
      case 'gameover':
        screens.gameover.classList.add('active'); break;
    }
  }

  function updatePlayerList(list) {
    const container = document.getElementById('player-list');
    container.innerHTML = '';
    for (const p of list) {
      const tag = document.createElement('div');
      tag.className = 'player-tag';
      tag.style.background = p.color;
      tag.innerHTML = `
        <span class="player-number">${p.number}</span>
        ${p.name}
      `;
      container.appendChild(tag);
    }
  }

  async function generateQR(url) {
    const qrContainer = document.getElementById('qr-code');
    try {
      const res = await fetch(`/api/qr?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.qr) {
        const img = document.createElement('img');
        img.src = data.qr;
        img.style.width = '160px';
        img.style.height = '160px';
        img.style.borderRadius = '8px';
        qrContainer.innerHTML = '';
        qrContainer.appendChild(img);
      }
    } catch (e) {
      qrContainer.innerHTML = `<p style="color:#1a1a2e;font-size:10px;word-break:break-all;padding:8px;">${url}</p>`;
    }
  }
})();
