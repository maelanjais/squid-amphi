/**
 * GameManager — Controls the game flow, lobby, and mini-game transitions
 */
const Player = require('./Player');
const BotPlayer = require('./BotPlayer');

// Game phases
const PHASE = {
  LOBBY: 'lobby',
  EXPLANATION: 'explanation',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ELIMINATION: 'elimination',
  TRANSITION: 'transition',
  GAME_OVER: 'gameover'
};

const GAME_NAMES = {
  RedLightGreenLight: '1, 2, 3… Soleil !',
  TugOfWar: 'Le Jeu de la Corde',
  GroupGame: 'Le Jeu du Manège',
  NightFight: 'La Bataille du Dortoir',
  GlassBridge: 'Le Pont de Verre',
  FinalDuel: 'Le Duel Final',
  Dalgona: 'Le Sablé Dalgona'
};

const GAME_RULES = {
  RedLightGreenLight: {
    description: "Avancez quand la poupée ne regarde pas. Arrêtez-vous au feu rouge.",
    controls: "Maintenez pour avancer, glissez pour diriger."
  },
  TugOfWar: {
    description: "Votre équipe est en danger. Tirez plus fort que les autres !",
    controls: "Tapotez le plus vite possible pour tirer la corde."
  },
  GroupGame: {
    description: "Formez des groupes complets du nombre annoncé avant la fin du temps.",
    controls: "Déplacez-vous avec le joystick."
  },
  NightFight: {
    description: "L'émeute éclate dans le noir. Défendez-vous pour survivre.",
    controls: "Joystick pour bouger. Appuyez sur le bouton pour attaquer."
  },
  GlassBridge: {
    description: "Traversez le pont. Attention : mémorisez les dalles solides, les fragiles cèdent.",
    controls: "Choisissez Gauche ou Droite."
  },
  FinalDuel: {
    description: "Il n'en restera qu'un. Poussez vos adversaires hors de l'arène.",
    controls: "Glissez rapidement (swipe) pour frapper / repousser."
  },
  Dalgona: {
    description: "Tapotez pour dévoiler la forme sans briser la structure sous la tension.",
    controls: "Tapez pour avancer, mais ne remplissez pas la jauge de tension !"
  }
};

class GameManager {
  constructor(io) {
    this.io = io;
    this.players = new Map(); // socket.id -> Player
    this.displaySocket = null;
    this.phase = PHASE.LOBBY;
    this.currentGameIndex = -1;
    this.currentGame = null;
    this.playerCounter = 0;
    this.lastUpdate = Date.now();
    this.arenaWidth = 1920;
    this.arenaHeight = 1080;
    this.explanationTimer = 0;
    this.countdownTimer = 0;
    this.transitionTimer = 0;
    this.eliminatedThisRound = [];
    this.gameQueue = null;
    this.upcomingPool = null;
    this.botCounter = 0;

    // Load all mini-games
    this.gameClasses = {
      RedLightGreenLight: require('./games/RedLightGreenLight'),
      TugOfWar: require('./games/TugOfWar'),
      GroupGame: require('./games/GroupGame'),
      NightFight: require('./games/NightFight'),
      GlassBridge: require('./games/GlassBridge'),
      FinalDuel: require('./games/FinalDuel'),
      Dalgona: require('./games/Dalgona')
    };

    // Game loop at 30fps
    this.loopInterval = setInterval(() => this.gameLoop(), 1000 / 30);
  }

  /**
   * Handle a new socket connection
   */
  handleConnection(socket) {
    socket.on('register-display', () => {
      socket.join('displays');
      this.displaySocket = socket;
      socket.emit('phase', { phase: this.phase });
      this.broadcastState();
      console.log('📺 Display connected');
    });

    socket.on('register-player', (data) => {
      this.addPlayer(socket, data.name);
    });

    socket.on('player-input', (data) => {
      const player = this.players.get(socket.id);
      if (player && player.alive) {
        player.processInput(data);
      }
    });

    socket.on('admin-start', () => {
      if (this.phase === PHASE.LOBBY && this.players.size >= 1) {
        this.startNextGame();
      }
    });

    socket.on('admin-skip', () => {
      if (this.currentGame) {
        this.endCurrentGame();
      }
    });

    socket.on('admin-add-bots', (data) => {
      const count = Math.min(Math.max(parseInt(data.count) || 0, 0), 100 - this.players.size);
      if (count > 0 && this.phase === PHASE.LOBBY) {
        this.addBots(count);
      }
    });

    socket.on('admin-reset', () => {
      this.botCounter = 0;
      this.players.clear();
      this.playerCounter = 0;
      this.currentGameIndex = -1;
      this.currentGame = null;
      this.phase = PHASE.LOBBY;
      this.gameQueue = null;
      this.upcomingPool = null;
      this.broadcastState();
      this.broadcastPhase();
      this.broadcastPlayerList();
      console.log('🔄 Game reset by admin');
    });

    socket.on('disconnect', () => {
      if (socket === this.displaySocket) {
        this.displaySocket = null;
        console.log('📺 Display disconnected');
      }
      const player = this.players.get(socket.id);
      if (player) {
        this.players.delete(socket.id);
        console.log(`👋 ${player.name} (#${player.number}) left`);
        this.broadcastPlayerList();
      }
    });
  }

  addPlayer(socket, name) {
    if (this.phase !== PHASE.LOBBY) {
      socket.emit('error', { message: 'La partie a déjà commencé !' });
      return;
    }
    if (this.players.size >= 100) {
      socket.emit('error', { message: 'La partie est pleine (100 joueurs max) !' });
      return;
    }

    this.playerCounter++;
    const player = new Player(socket.id, name);
    player.number = this.playerCounter;
    // Spawn in lobby area
    player.x = 200 + Math.random() * (this.arenaWidth - 400);
    player.y = 200 + Math.random() * (this.arenaHeight - 400);
    this.players.set(socket.id, player);

    socket.emit('registered', {
      id: player.id,
      number: player.number,
      name: player.name,
      color: player.color
    });

    console.log(`🎮 ${player.name} (#${player.number}) joined! [${this.players.size} players]`);
    this.broadcastPlayerList();
  }

  /**
   * Main game loop — called 30 times per second
   */
  gameLoop() {
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    if (this.phase === PHASE.EXPLANATION) {
      this.explanationTimer -= dt;
      if (this.explanationTimer <= 0) {
        this.phase = PHASE.COUNTDOWN;
        this.countdownTimer = 4;
        this.broadcastPhase();
      }
    }

    if (this.phase === PHASE.COUNTDOWN) {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.phase = PHASE.PLAYING;
        
        const alive = this.getAlivePlayers();
        this.playersAtGameStart = alive.length;
        
        this.currentGame.start(alive);
        this.broadcastPhase();
      }
    }

    if (this.phase === PHASE.PLAYING && this.currentGame) {
      const result = this.currentGame.update(dt, this.getAlivePlayers());

      if (result && result.eliminated) {
        for (const playerId of result.eliminated) {
          const player = this.players.get(playerId);
          if (player) {
            player.eliminate();
            this.eliminatedThisRound.push(playerId);
            // Notify the eliminated player's controller
            this.io.to(playerId).emit('eliminated', {
              game: GAME_NAMES[this.gameQueue[this.currentGameIndex]]
            });
          }
        }
      }

      const aliveCount = this.getAlivePlayers().length;
      let prematureEnd = false;
      const gameName = this.gameQueue[this.currentGameIndex];

      if (gameName !== 'FinalDuel') {
        // Only end prematurely if everyone died
        if (aliveCount <= 0) {
          prematureEnd = true;
          console.log(`⚠️ Premature end: everyone died.`);
        }
      } else {
        if (aliveCount <= 1) prematureEnd = true;
      }

      if (this.currentGame.isFinished() || prematureEnd) {
        this.endCurrentGame();
      }
    }

    if (this.phase === PHASE.TRANSITION) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.startNextGame();
      }
    }

    // Run bot AI during gameplay
    if (this.phase === PHASE.PLAYING && this.currentGame) {
      const gameName = GAME_NAMES[this.gameQueue[this.currentGameIndex]];
      const gameState = this.currentGame.getState();
      const allPlayers = Array.from(this.players.values());
      for (const player of allPlayers) {
        if (player.isBot && player.alive) {
          player.botThink(gameState, gameName, allPlayers);
        }
      }
    }

    // Update player positions if in a movement-based game
    if (this.phase === PHASE.PLAYING || this.phase === PHASE.LOBBY) {
      for (const player of this.players.values()) {
        if (player.alive) {
          player.update(dt, { width: this.arenaWidth, height: this.arenaHeight });
        }
      }
    }

    this.broadcastState();
  }

  startNextGame() {
    this.currentGameIndex++;
    this.eliminatedThisRound = [];

    const alive = this.getAlivePlayers();

    // Check game over
    if (alive.length <= 1) {
      this.phase = PHASE.GAME_OVER;
      this.broadcastPhase();
      return;
    }

    if (!this.gameQueue) {
      this.gameQueue = ['RedLightGreenLight'];
      this.upcomingPool = ['Dalgona', 'TugOfWar', 'GroupGame', 'NightFight', 'GlassBridge'];
    }

    let gameName = 'FinalDuel'; // Default fallback

    if (this.currentGameIndex === 0) {
      gameName = this.gameQueue[0];
    } else if (this.currentGameIndex === 1) {
      gameName = 'GroupGame';
      const idx = this.upcomingPool.indexOf('GroupGame');
      if (idx !== -1) {
        this.upcomingPool.splice(idx, 1);
      }
      this.gameQueue.push(gameName);
    } else {
      if (alive.length <= 2) {
        gameName = 'FinalDuel';
      } else if (this.upcomingPool.length === 0) {
        gameName = 'FinalDuel';
      } else {
        // Randomize securely (Fisher-Yates)
        for (let i = this.upcomingPool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.upcomingPool[i], this.upcomingPool[j]] = [this.upcomingPool[j], this.upcomingPool[i]];
        }
        let pickedIndex = -1;
        for (let i = 0; i < this.upcomingPool.length; i++) {
          const g = this.upcomingPool[i];
          if (g === 'TugOfWar' && alive.length < 4) continue;
          if (g === 'GroupGame' && alive.length < 6) continue;
          if (g === 'GlassBridge' && alive.length > 20) continue;
          pickedIndex = i; break;
        }

        if (pickedIndex !== -1) {
          gameName = this.upcomingPool[pickedIndex];
          this.upcomingPool.splice(pickedIndex, 1);
        } else {
          gameName = 'FinalDuel';
        }
      }
      this.gameQueue.push(gameName);
    }

    if (gameName === 'FinalDuel') {
      this.upcomingPool = []; // Forcibly exhaust
    }

    const GameClass = this.gameClasses[gameName];
    this.currentGame = new GameClass(this.arenaWidth, this.arenaHeight);

    // Setup players for this game
    this.currentGame.setup(alive);

    // Initial phase before game start
    this.phase = PHASE.EXPLANATION;
    this.explanationTimer = 10; // 10 seconds explanation
    this.broadcastPhase();

    console.log(`🎲 Explaining: ${GAME_NAMES[gameName]} (${alive.length} players alive)`);
  }

  endCurrentGame() {
    const gameName = this.gameQueue[this.currentGameIndex];
    const alive = this.getAlivePlayers();
    console.log(`✅ ${GAME_NAMES[gameName]} finished. ${alive.length} players remain.`);
    console.log(`💀 ${this.eliminatedThisRound.length} eliminated this round.`);

    this.phase = PHASE.TRANSITION;
    this.transitionTimer = 5; // 5 seconds transition screen
    this.currentGame = null;
    this.broadcastPhase();
  }

  getAlivePlayers() {
    return Array.from(this.players.values()).filter(p => p.alive);
  }

  broadcastState() {
    const state = {
      phase: this.phase,
      players: Array.from(this.players.values()).map(p => p.toJSON()),
      explanation: Math.ceil(this.explanationTimer),
      countdown: Math.ceil(this.countdownTimer),
      transition: Math.ceil(this.transitionTimer),
      currentGame: this.currentGameIndex >= 0 ? {
        name: GAME_NAMES[this.gameQueue[this.currentGameIndex]],
        rules: GAME_RULES[this.gameQueue[this.currentGameIndex]],
        index: this.currentGameIndex,
        total: this.gameQueue.length + this.upcomingPool.length + (this.upcomingPool.length > 0 ? 1 : 0),
        state: this.currentGame ? this.currentGame.getState() : null
      } : null,
      alivePlayers: this.getAlivePlayers().length,
      totalPlayers: this.players.size,
      eliminatedThisRound: this.eliminatedThisRound.length
    };

    // Send to display
    this.io.to('displays').emit('game-state', state);

    // Send minimal state to each controller
    for (const [socketId, player] of this.players) {
      const controllerState = {
        phase: this.phase,
        alive: player.alive,
        number: player.number,
        currentGame: state.currentGame ? state.currentGame.name : null,
        countdown: state.countdown,
        gameState: this.currentGame ? this.currentGame.getControllerState(player) : null
      };
      this.io.to(socketId).emit('controller-state', controllerState);
    }
  }

  broadcastPhase() {
    const phaseData = {
      phase: this.phase,
      currentGame: this.currentGameIndex >= 0 ? {
        name: GAME_NAMES[this.gameQueue[this.currentGameIndex]],
        index: this.currentGameIndex,
        total: this.gameQueue.length + this.upcomingPool.length + (this.upcomingPool.length > 0 ? 1 : 0)
      } : null
    };
    this.io.emit('phase', phaseData);
  }

  broadcastPlayerList() {
    const list = Array.from(this.players.values()).map(p => ({
      name: p.name,
      number: p.number,
      color: p.color,
      alive: p.alive
    }));
    this.io.emit('player-list', list);
  }

  addBots(count) {
    for (let i = 0; i < count; i++) {
      this.botCounter++;
      this.playerCounter++;
      const botId = `bot-${this.botCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const bot = new BotPlayer(botId, `Bot ${this.botCounter}`);
      bot.number = this.playerCounter;
      bot.x = 200 + Math.random() * (this.arenaWidth - 400);
      bot.y = 200 + Math.random() * (this.arenaHeight - 400);
      this.players.set(botId, bot);
    }
    console.log(`🤖 ${count} bots added! [${this.players.size} players total]`);
    this.broadcastPlayerList();
  }

  destroy() {
    clearInterval(this.loopInterval);
  }
}

module.exports = GameManager;
module.exports.PHASE = PHASE;
module.exports.GAME_NAMES = GAME_NAMES;
module.exports.GAME_RULES = GAME_RULES;
