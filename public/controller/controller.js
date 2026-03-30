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
    'swipe-and-move': document.getElementById('ctrl-swipe')
  };

  let playerInfo = null;
  let currentControls = null;
  let tapCount = 0;

  // ---- LOCATE BUTTON ----
  const btnLocate = document.getElementById('btn-locate');
  if (btnLocate) {
    btnLocate.addEventListener('click', () => {
      if (btnLocate.disabled) return;
      socket.emit('player-input', { type: 'locate' });
      // Cooldown
      btnLocate.disabled = true;
      btnLocate.style.opacity = '0.5';
      setTimeout(() => {
        btnLocate.disabled = false;
        btnLocate.style.opacity = '1';
      }, 3000);
      if (navigator.vibrate) navigator.vibrate(20);
    });
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
    if (data.phase === 'countdown') {
      showScreen('controller');
      if (data.currentGame) {
        document.getElementById('ctrl-game-name').textContent = data.currentGame.name;
      }
    }
    if (data.phase === 'transition') {
      document.getElementById('ctrl-status').textContent = 'Transition...';
    }
    if (data.phase === 'gameover') {
      document.getElementById('ctrl-status').textContent = 'Fin de la partie !';
    }
  });

  // ---- CONTROLLER STATE (from server, 30fps) ----
  socket.on('controller-state', (state) => {
    if (!playerInfo) return;

    // Check elimination
    if (!state.alive) {
      showScreen('eliminated');
      // Vibrate on elimination
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
      return;
    }

    if (state.phase === 'playing' && state.gameState) {
      const gs = state.gameState;
      const controls = gs.controls;

      // Show correct control area
      if (controls !== currentControls) {
        switchControls(controls);
        currentControls = controls;
      }

      // Update controller-specific UI
      document.getElementById('ctrl-status').textContent =
        state.countdown > 0 ? `Début dans ${state.countdown}...` : '';

      updateControllerUI(gs);
    }

    if (state.phase === 'countdown') {
      document.getElementById('ctrl-status').textContent =
        `Début dans ${state.countdown}...`;
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

  // ---- SWIPE (Final Duel) ----
  const swipeZone = document.getElementById('swipe-zone');
  if (swipeZone) {
    let swipeStart = null;

    swipeZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      swipeStart = { x: t.clientX, y: t.clientY };
      // Also movement via touch hold
      socket.emit('player-input', { type: 'move', pressing: true, dirX: 0, dirY: 0 });
    });

    swipeZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!swipeStart) return;

      const dx = t.clientX - swipeStart.x;
      const dy = t.clientY - swipeStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Movement direction
      socket.emit('player-input', { type: 'move', pressing: true, dirX: dx, dirY: dy });

      // Swipe detection
      if (dist > 50) {
        socket.emit('player-input', { type: 'swipe', swipeX: dx, swipeY: dy });
        swipeStart = { x: t.clientX, y: t.clientY };
        swipeZone.classList.add('swiping');
        if (navigator.vibrate) navigator.vibrate(15);
        setTimeout(() => swipeZone.classList.remove('swiping'), 150);
      }
    });

    swipeZone.addEventListener('touchend', (e) => {
      e.preventDefault();
      swipeStart = null;
      socket.emit('player-input', { type: 'move', pressing: false });
      swipeZone.classList.remove('swiping');
    });
  }

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
        inst.innerHTML = '✅ Ligne d\'arrivée franchie !';
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
        hpText.textContent = `❤️ ${gs.hp}/${gs.maxHP}`;
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
        document.getElementById('choice-info').textContent = '✅ Vous avez traversé !';
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
  }
})();
