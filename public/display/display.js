/**
 * Squid Amphi — Display Client
 * Connects to server and drives the renderer
 */
(function () {
  const socket = io();
  const canvas = document.getElementById('game-canvas');
  const renderer = new Renderer(canvas);

  // Screen elements
  const screens = {
    lobby: document.getElementById('lobby-screen'),
    explanation: document.getElementById('explanation-screen'),
    countdown: document.getElementById('countdown-screen'),
    game: document.getElementById('game-screen'),
    transition: document.getElementById('transition-screen'),
    gameover: document.getElementById('gameover-screen')
  };

  let currentState = null;
  let previousAlivePlayers = new Set();

  // Register as display
  socket.emit('register-display');

  // Generate join URL
  const protocol = window.location.protocol;
  const host = window.location.host;
  const joinUrl = `${protocol}//${host}/play`;
  document.getElementById('join-url-display').textContent = joinUrl;

  // Generate QR code
  generateQR(joinUrl);

  // Start button (admin control)
  const btnStart = document.getElementById('btn-start');
  btnStart.addEventListener('click', () => {
    socket.emit('admin-start');
  });

  // Also allow keyboard shortcuts for admin
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

  // Handle phase changes
  socket.on('phase', (data) => {
    showScreen(data.phase);

    if (data.phase === 'countdown' && data.currentGame) {
      document.getElementById('game-name').textContent = data.currentGame.name || '???';
      document.getElementById('hud-game-name').textContent = data.currentGame.name || '???';
      document.getElementById('hud-game-progress').textContent =
        `Épreuve ${data.currentGame.index !== undefined ? data.currentGame.index + 1 : '?'}/${data.currentGame.total || '?'}`;
    }
  });

  // Handle player list updates
  socket.on('player-list', (list) => {
    updatePlayerList(list);
    document.getElementById('player-count-num').textContent = list.length;
    btnStart.style.display = list.length >= 1 ? 'block' : 'none';
  });

  // Main game state — 30fps
  socket.on('game-state', (state) => {
    currentState = state;

    // Check for newly eliminated players
    if (state.players) {
      const currentAlive = new Set(
        state.players.filter(p => p.alive).map(p => p.id)
      );
      for (const id of previousAlivePlayers) {
        if (!currentAlive.has(id)) {
          const player = state.players.find(p => p.id === id);
          if (player) {
            renderer.addElimEffect(player.x, player.y);
          }
        }
      }
      previousAlivePlayers = currentAlive;
    }

    // Update HUD
    if (state.phase === 'playing') {
      document.getElementById('hud-alive').textContent =
        `👥 ${state.alivePlayers} survivants`;

      // Game-specific HUD center
      const hc = document.getElementById('hud-center');
      if (state.currentGame && state.currentGame.state) {
        const gs = state.currentGame.state;
        if (gs.greenLight !== undefined) {
          // Red Light Green Light
          hc.innerHTML = gs.greenLight
            ? (gs.warning ? '<span style="color:#ffaa00">⚠️</span>' : '<span style="color:#39e75f">🟢</span>')
            : '<span style="color:#ff3b3b">🔴</span>';
        } else if (gs.ropePosition !== undefined) {
          // Tug of War
          hc.textContent = `⏱ ${gs.timer}s`;
        } else if (gs.timer !== undefined) {
          hc.textContent = `⏱ ${gs.timer}s`;
        } else {
          hc.textContent = '';
        }
      }
    }

    // Update explanation
    if (state.phase === 'explanation') {
      if (state.currentGame) {
        document.getElementById('expl-game-name').textContent = state.currentGame.name || 'Jeu Inconnu';
        document.getElementById('expl-game-desc').textContent = state.currentGame.rules?.description || '...';
        document.getElementById('expl-game-controls').textContent = state.currentGame.rules?.controls || '...';
      }
      document.getElementById('expl-timer').textContent = state.explanation;
    }

    // Update countdown
    if (state.phase === 'countdown') {
      document.getElementById('countdown-number').textContent = state.countdown;
      document.getElementById('game-players').textContent =
        `${state.alivePlayers} joueurs en lice`;
    }

    // Update transition
    if (state.phase === 'transition') {
      document.getElementById('eliminated-count').textContent =
        `${state.eliminatedThisRound} joueurs éliminés`;
      document.getElementById('remaining-count').textContent =
        `${state.alivePlayers} survivants`;
      const nextIdx = state.currentGame ? state.currentGame.index + 1 : 0;
      if (nextIdx < state.currentGame.total) {
        document.getElementById('next-game').textContent =
          `Prochaine épreuve dans ${state.transition}s...`;
      } else {
        document.getElementById('next-game').textContent = 'Résultats finaux...';
      }
    }

    // Game over
    if (state.phase === 'gameover') {
      const alive = state.players.filter(p => p.alive);
      if (alive.length > 0) {
        document.getElementById('winner-name').textContent =
          `${alive[0].name} (#${alive[0].number})`;
      } else {
        document.getElementById('winner-name').textContent = 'Aucun survivant !';
      }
    }

    // Render
    if (state.phase === 'playing') {
      renderer.render(state);
    }
  });

  function showScreen(phase) {
    Object.values(screens).forEach(s => { if(s) s.classList.remove('active'); });
    switch (phase) {
      case 'lobby':
        screens.lobby.classList.add('active'); break;
      case 'explanation':
        screens.explanation.classList.add('active'); break;
      case 'countdown':
        screens.countdown.classList.add('active'); break;
      case 'playing':
        screens.game.classList.add('active'); break;
      case 'transition':
        screens.transition.classList.add('active'); break;
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
