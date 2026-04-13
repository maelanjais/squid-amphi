/**
 * Squid Amphi — Controller (Phone) Client
 * Handles all touch-based controls and Socket.IO communication
 */
(function () {
  const socket = io();

  // ---- Screens ----
  const screens = {
    join: document.getElementById('join-screen'),
    waiting: document.getElementById('waiting-screen'),
    controller: document.getElementById('controller-screen'),
    eliminated: document.getElementById('eliminated-screen')
  };
  const ctrlAreas = {
    move: document.getElementById('ctrl-move'),
    tap: document.getElementById('ctrl-tap'),
    'tap-and-move': document.getElementById('ctrl-tap-move'),
    choice: document.getElementById('ctrl-choice'),
    rps: document.getElementById('ctrl-rps'),
    'swipe-and-move': document.getElementById('ctrl-swipe')
  };

  let playerInfo = null;
  let currentControls = null;
  let tapCount = 0;

  // ---- POSITION INDICATOR ----
  const positionDot = document.getElementById('position-dot');
  const positionLabel = document.getElementById('position-label');
  function updatePositionDot(px, py) {
    if (!positionDot) return;
    const x = Math.max(0, Math.min(1, px)) * 100;
    const y = Math.max(0, Math.min(1, py)) * 100;
    positionDot.style.left = x + '%';
    positionDot.style.top = y + '%';
  }

  // ---- JOIN ----
  document.getElementById('btn-join').addEventListener('click', joinGame);
  document.getElementById('player-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinGame();
  });

  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock is active');
      }
    } catch (err) {
      console.warn(`Wake Lock error: ${err.message}`);
    }
  }

  document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });

  function joinGame() {
    const name = document.getElementById('player-name').value.trim() || 'Joueur';
    socket.emit('register-player', { name });
    requestWakeLock();
  }

  socket.on('registered', (data) => {
    playerInfo = data;
    document.getElementById('badge-number').textContent = data.number;
    document.getElementById('player-name-display').textContent = data.name;
    // Set badge color
    document.getElementById('player-badge').style.background =
      `linear-gradient(135deg, ${data.color}, ${data.color}dd)`;
    showScreen('waiting');
  });

  socket.on('error', (data) => {
    alert(data.message);
  });

  // ---- PHASE CHANGES ----
  socket.on('phase', (data) => {
    if (!playerInfo) return;
    if (data.phase === 'lobby') showScreen('waiting');
    if (data.phase === 'explanation' || data.phase === 'countdown') {
      showScreen('controller');
      currentControls = null; // Reset so controls will be re-applied
      if (data.currentGame) {
        document.getElementById('ctrl-game-name').textContent = data.currentGame.name;
      }
    }
    // Transition phases — show feedback on phone
    if (data.phase === 'transition_bank' || data.phase === 'transition_dead' || data.phase === 'transition_roulette') {
      showScreen('controller');
      switchControls(null);
      currentControls = null;
      document.getElementById('ctrl-game-name').textContent = '';
      document.getElementById('ctrl-status').textContent = 'Vous avez survécu ! Prochaine épreuve bientôt...';
    }
    if (data.phase === 'gameover') {
      showScreen('controller');
      switchControls(null);
      document.getElementById('ctrl-game-name').textContent = 'FIN DE PARTIE';
      document.getElementById('ctrl-status').textContent = 'Bravo, vous avez survécu à toutes les épreuves !';
    }
  });

  // ---- CONTROLLER STATE (from server, 30fps) ----
  const positionIndicator = document.getElementById('position-indicator');

  socket.on('controller-state', (state) => {
    if (!playerInfo) return;

    // Check elimination
    if (!state.alive) {
      showScreen('eliminated');
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
      return;
    }

    // Update position dot
    if (state.playerX !== undefined) {
      updatePositionDot(state.playerX, state.playerY);
    }

    // Transition phases — keep showing feedback
    if (state.phase === 'transition_bank' || state.phase === 'transition_dead' || state.phase === 'transition_roulette') {
      showScreen('controller');
      switchControls(null);
      document.getElementById('ctrl-status').textContent = 'Vous avez survécu ! Prochaine épreuve bientôt...';
      if (positionIndicator) positionIndicator.style.display = 'none';
      return;
    }

    if (state.phase === 'explanation') {
      showScreen('controller');
      document.getElementById('ctrl-game-name').textContent = state.currentGame || '';
      document.getElementById('ctrl-status').textContent =
        `Préparation... ${state.explanation || ''}s`;
      switchControls(null);
      currentControls = null;
      // Show position map large
      if (positionIndicator) positionIndicator.classList.add('large');
      if (positionIndicator) positionIndicator.style.display = 'flex';
    }

    if (state.phase === 'countdown') {
      showScreen('controller');
      document.getElementById('ctrl-status').textContent =
        state.countdown > 0 ? `Début dans ${state.countdown}...` : 'GO !';
      if (positionIndicator) positionIndicator.classList.add('large');
      if (positionIndicator) positionIndicator.style.display = 'flex';
    }

    if (state.phase === 'playing' && state.gameState) {
      showScreen('controller');
      const gs = state.gameState;
      const controls = gs.controls;

      // Always switch controls — don't guard with currentControls cache
      // This ensures controls always show up even on reconnect
      if (controls !== currentControls) {
        switchControls(controls);
        currentControls = controls;
      }

      // Status text
      if (controls === 'none') {
        // Game over for this game, or waiting (RPS bye, etc)
        if (gs.gameOver) {
          // TugOfWar over
          if (gs.winningTeam && gs.team) {
            if (gs.winningTeam === gs.team) {
              document.getElementById('ctrl-status').textContent = 'VICTOIRE ! Votre équipe a gagné !';
            } else {
              document.getElementById('ctrl-status').textContent = 'DÉFAITE... Votre équipe a perdu.';
            }
          }
        } else if (gs.isBye) {
          document.getElementById('ctrl-status').textContent = 'Vous êtes qualifié d\'office ce tour ! Observez les duels...';
        } else if (gs.state === 'bracket_reveal' || gs.state === 'bracket_full') {
          document.getElementById('ctrl-status').textContent = 'Regardez le tableau complet sur l\'écran géant !';
        } else if (gs.state === 'resolution') {
          if (gs.matchResult === 'win') document.getElementById('ctrl-status').textContent = 'VICTOIRE ! Vous passez au tour suivant.';
          else if (gs.matchResult === 'lose') document.getElementById('ctrl-status').textContent = 'DÉFAITE... Élimination imminente.';
          else if (gs.matchResult === 'tie') document.getElementById('ctrl-status').textContent = 'ÉGALITÉ ! Le combat continue...';
          else document.getElementById('ctrl-status').textContent = 'Résolution des combats en cours...';
        } else {
          document.getElementById('ctrl-status').textContent = 'En attente...';
        }
      } else {
        document.getElementById('ctrl-status').textContent =
          state.countdown > 0 ? `Début dans ${state.countdown}...` : '';
      }

      // Hide position map during gameplay
      if (positionIndicator) positionIndicator.style.display = 'none';
      if (positionIndicator) positionIndicator.classList.remove('large');

      updateControllerUI(gs);
    }
  });

  // ---- ELIMINATED ----
  socket.on('eliminated', (data) => {
    document.getElementById('elim-game').textContent = data.game;
    showScreen('eliminated');
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  });

  // ============================
  //    CONTROL IMPLEMENTATIONS
  // ============================

  // ---- MOVE CONTROL (1,2,3 Soleil + Group Game + Duel) ----
  const moveZone = document.getElementById('move-zone');
  let moveTouch = null;
  let joystickOrigin = null;

  if (moveZone) {
    moveZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      moveTouch = { id: t.identifier, startX: t.clientX, startY: t.clientY };
      joystickOrigin = { x: t.clientX, y: t.clientY };
      moveZone.classList.add('pressing');
      socket.emit('player-input', { type: 'move', pressing: true, dirX: 0, dirY: -1 });
    });

    moveZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!moveTouch) return;
      const t = Array.from(e.touches).find(t => t.identifier === moveTouch.id);
      if (!t || !joystickOrigin) return;

      const dx = t.clientX - joystickOrigin.x;
      const dy = t.clientY - joystickOrigin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 10) {
        socket.emit('player-input', { type: 'move', pressing: true, dirX: dx, dirY: dy });
        // Update joystick thumb visual
        const maxDist = 50;
        const clampedDist = Math.min(dist, maxDist);
        const normX = (dx / dist) * clampedDist;
        const normY = (dy / dist) * clampedDist;
        const thumb = document.getElementById('joystick-thumb');
        if (thumb) {
          thumb.style.transform = `translate(${normX}px, ${normY}px)`;
        }
      }
    });

    moveZone.addEventListener('touchend', (e) => {
      e.preventDefault();
      moveTouch = null;
      joystickOrigin = null;
      moveZone.classList.remove('pressing');
      socket.emit('player-input', { type: 'move', pressing: false });
      const thumb = document.getElementById('joystick-thumb');
      if (thumb) thumb.style.transform = '';
    });

    moveZone.addEventListener('touchcancel', () => {
      moveTouch = null;
      joystickOrigin = null;
      moveZone.classList.remove('pressing');
      socket.emit('player-input', { type: 'move', pressing: false });
    });
  }

  // ---- TAP CONTROL (Tug of War) ----
  const tapZone = document.getElementById('tap-zone');
  if (tapZone) {
    tapZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      tapCount++;
      document.getElementById('tap-counter').textContent = tapCount;
      tapZone.classList.add('tapping');
      socket.emit('player-input', { type: 'tap' });
      // Brief vibration feedback
      if (navigator.vibrate) navigator.vibrate(10);
    });
    tapZone.addEventListener('touchend', (e) => {
      e.preventDefault();
      tapZone.classList.remove('tapping');
    });
  }

  // ---- ATTACK ZONE (Night Fight) ----
  const attackZone = document.getElementById('attack-zone');
  if (attackZone) {
    attackZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      attackZone.classList.add('attacking');
      socket.emit('player-input', { type: 'tap' });
      if (navigator.vibrate) navigator.vibrate(20);
    });
    attackZone.addEventListener('touchend', (e) => {
      e.preventDefault();
      attackZone.classList.remove('attacking');
    });
  }

  // Mini joystick for Night Fight
  const miniJoystickArea = document.getElementById('mini-joystick-area');
  if (miniJoystickArea) {
    let miniTouch = null;
    let miniOrigin = null;

    miniJoystickArea.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      miniTouch = { id: t.identifier };
      miniOrigin = { x: t.clientX, y: t.clientY };
      socket.emit('player-input', { type: 'move', pressing: true, dirX: 0, dirY: 0 });
    });

    miniJoystickArea.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!miniTouch || !miniOrigin) return;
      const t = Array.from(e.touches).find(t => t.identifier === miniTouch.id);
      if (!t) return;

      const dx = t.clientX - miniOrigin.x;
      const dy = t.clientY - miniOrigin.y;
      socket.emit('player-input', { type: 'move', pressing: true, dirX: dx, dirY: dy });

      const maxDist = 40;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, maxDist);
      const normX = dist > 0 ? (dx / dist) * clampedDist : 0;
      const normY = dist > 0 ? (dy / dist) * clampedDist : 0;
      const thumb = document.getElementById('mini-joystick-thumb');
      if (thumb) thumb.style.transform = `translate(${normX}px, ${normY}px)`;
    });

    miniJoystickArea.addEventListener('touchend', (e) => {
      e.preventDefault();
      miniTouch = null;
      miniOrigin = null;
      socket.emit('player-input', { type: 'move', pressing: false });
      const thumb = document.getElementById('mini-joystick-thumb');
      if (thumb) thumb.style.transform = '';
    });
  }

  // ---- CHOICE (Glass Bridge) ----
  document.getElementById('btn-left')?.addEventListener('click', () => {
    socket.emit('player-input', { type: 'choice', choice: 'left' });
    if (navigator.vibrate) navigator.vibrate(30);
  });
  document.getElementById('btn-right')?.addEventListener('click', () => {
    socket.emit('player-input', { type: 'choice', choice: 'right' });
    if (navigator.vibrate) navigator.vibrate(30);
  });

  // ---- RPS (Tournament) ----
  ['rock', 'paper', 'scissors'].forEach(choice => {
    document.getElementById(`btn-${choice}`)?.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-rps').forEach(b => b.classList.remove('selected'));
      e.target.classList.add('selected');
      socket.emit('player-input', { type: 'choice', choice: choice });
      if (navigator.vibrate) navigator.vibrate(30);
    });
  });

  // ============================
  //    UI HELPERS
  // ============================

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
  }

  function switchControls(controls) {
    Object.values(ctrlAreas).forEach(a => { if (a) a.style.display = 'none'; });
    if (ctrlAreas[controls]) ctrlAreas[controls].style.display = 'block';

    // Reset tap counter when switching to tap controls
    if (controls === 'tap') {
      tapCount = 0;
      document.getElementById('tap-counter').textContent = '0';
    }
  }

  function updateControllerUI(gs) {
    // Tap controls (Tug Of War)
    if (gs.controls === 'tap') {
        let teamIndicator = tapZone.querySelector('.team-indicator');
        if (!teamIndicator) {
          teamIndicator = document.createElement('div');
          teamIndicator.className = 'team-indicator';
          teamIndicator.style.marginBottom = '20px';
          teamIndicator.style.fontSize = '24px';
          teamIndicator.style.fontWeight = 'bold';
          tapZone.prepend(teamIndicator);
        }
        
        let tapStatus = tapZone.querySelector('.tap-status');
        if (!tapStatus) {
          tapStatus = document.createElement('div');
          tapStatus.className = 'tap-status';
          tapStatus.style.marginTop = '20px';
          tapStatus.style.fontSize = '24px';
          tapStatus.style.fontWeight = 'bold';
          tapZone.appendChild(tapStatus);
        }
        
        teamIndicator.innerHTML = `VOUS ÊTES: ÉQUIPE ${gs.team}`;
        teamIndicator.style.color = gs.team === 1 ? '#ff6b6b' : '#4ecdc4';

        if (gs.winningTeam) {
            if (gs.winningTeam === gs.team) {
                tapStatus.innerHTML = '<span style="color:#39e75f">VICTOIRE !</span>';
            } else if (gs.winningTeam !== 0) {
                tapStatus.innerHTML = '<span style="color:#ff3b3b">DÉFAITE...</span>';
            } else {
                tapStatus.innerHTML = 'ÉGALITÉ';
            }
        } else {
            tapStatus.innerHTML = `Tirez ! Temps: ${gs.timer > 0 ? gs.timer : 0}s`;
        }
    }

    // Move controls — show light indicator for Red Light Green Light
    if (gs.controls === 'move' && gs.greenLight !== undefined) {
      let indicator = moveZone.querySelector('.light-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'light-indicator';
        moveZone.appendChild(indicator);
      }
      indicator.className = 'light-indicator';
      if (gs.greenLight) {
        indicator.classList.add(gs.warning ? 'warning' : 'green');
      } else {
        indicator.classList.add('red');
      }

      // Show crossed status or progress
      const inst = moveZone.querySelector('.move-instruction');
      if (gs.crossed) {
        inst.innerHTML = 'Ligne d\'arrivée franchie !';
      } else if (gs.progress !== undefined) {
        inst.innerHTML = `Avancement : ${gs.progress}%<br>TOUCHER pour courir<br>GLISSER pour diriger`;
      } else {
        inst.innerHTML = 'TOUCHER pour courir<br>GLISSER pour diriger';
      }
    }

    // Tap move controls (Night Fight) — update HP
    if (gs.controls === 'tap-and-move') {
      const hpBar = document.getElementById('hp-bar');
      const hpText = document.getElementById('hp-text');
      if (hpBar && gs.hp !== undefined) {
        hpBar.style.width = `${(gs.hp / gs.maxHP) * 100}%`;
        hpBar.style.background = gs.hp > 1 ? '#39e75f' : '#ff3b3b';
        hpText.textContent = `PV: ${gs.hp}/${gs.maxHP}`;
      }
    }

    // Choice controls (Glass Bridge)
    if (gs.controls === 'choice') {
      document.getElementById('choice-timer').textContent = gs.timer + 's';
      document.getElementById('choice-progress').textContent =
        `Étape ${gs.step + 1}/${gs.totalSteps}`;

      const leftBtn = document.getElementById('btn-left');
      const rightBtn = document.getElementById('btn-right');

      if (gs.finished) {
        document.getElementById('choice-info').textContent = 'Vous avez traversé !';
        leftBtn.disabled = true;
        rightBtn.disabled = true;
      } else if (gs.choosing) {
        document.getElementById('choice-info').textContent = 'Choisissez un côté !';
        leftBtn.disabled = false;
        rightBtn.disabled = false;
      } else {
        document.getElementById('choice-info').textContent = 'En attente de votre tour...';
        leftBtn.disabled = true;
        rightBtn.disabled = true;
      }
    }

    // RPS controls
    if (gs.controls === 'rps') {
      document.getElementById('rps-timer').textContent = gs.timer + 's';
      if (gs.hasChosen) {
        document.getElementById('rps-info').textContent = 'Choix envoyé ! En attente de votre adversaire...';
        // Let the button remain selected visually (class already toggled)
      } else {
        document.getElementById('rps-info').textContent = 'Duel : Choisissez votre arme !';
        // Reset selections if the server didn't register one
        document.querySelectorAll('.btn-rps').forEach(b => b.classList.remove('selected'));
      }
    }
  }
})();
