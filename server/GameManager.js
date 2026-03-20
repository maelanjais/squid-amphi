/**
 * GameManager — Controls the game flow, lobby, and mini-game transitions
 */
const Player = require('./Player');

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

// Mini-game order
const GAME_ORDER = [
  'RedLightGreenLight',
  'TugOfWar',
  'GroupGame',
  'NightFight',
  'GlassBridge',
  'FinalDuel'
];

const GAME_NAMES = {
  RedLightGreenLight: '1, 2, 3… Soleil !',
  TugOfWar: 'Le Jeu de la Corde',
  GroupGame: 'Le Jeu du Manège',
  NightFight: 'La Bataille du Dortoir',
  GlassBridge: 'Le Pont de Verre',
  FinalDuel: 'Le Duel Final'
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

    // Load all mini-games
    this.gameClasses = {};
    for (const name of GAME_ORDER) {
      this.gameClasses[name] = require(`./games/${name}`);
    }

    // Game loop at 30fps
    this.loopInterval = setInterval(() => this.gameLoop(), 1000 / 30);
  }

  /**
   * Handle a new socket connection
   */
  handleConnection(socket) {
    socket.on('register-display', () => {
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

    socket.on('admin-reset', () => {
      this.players.clear();
      this.playerCounter = 0;
      this.currentGameIndex = -1;
      this.currentGame = null;
      this.phase = PHASE.LOBBY;
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
    if (this.players.size >= 50) {
      socket.emit('error', { message: 'La partie est pleine (50 joueurs max) !' });
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
        this.currentGame.start(this.getAlivePlayers());
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
              game: GAME_NAMES[GAME_ORDER[this.currentGameIndex]]
            });
          }
        }
      }

      if (this.currentGame.isFinished()) {
        this.endCurrentGame();
      }
    }

    if (this.phase === PHASE.TRANSITION) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.startNextGame();
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

    // Check if all games done or only 1 player left
    const alive = this.getAlivePlayers();
    if (this.currentGameIndex >= GAME_ORDER.length || alive.length <= 1) {
      this.phase = PHASE.GAME_OVER;
      this.broadcastPhase();
      return;
    }

    const gameName = GAME_ORDER[this.currentGameIndex];
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
    const gameName = GAME_ORDER[this.currentGameIndex];
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
        name: GAME_NAMES[GAME_ORDER[this.currentGameIndex]],
        rules: GAME_RULES[GAME_ORDER[this.currentGameIndex]],
        index: this.currentGameIndex,
        total: GAME_ORDER.length,
        state: this.currentGame ? this.currentGame.getState() : null
      } : null,
      alivePlayers: this.getAlivePlayers().length,
      totalPlayers: this.players.size,
      eliminatedThisRound: this.eliminatedThisRound.length
    };

    // Send to display
    if (this.displaySocket) {
      this.displaySocket.emit('game-state', state);
    }

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
        name: GAME_NAMES[GAME_ORDER[this.currentGameIndex]],
        index: this.currentGameIndex,
        total: GAME_ORDER.length
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

  destroy() {
    clearInterval(this.loopInterval);
  }
}

module.exports = GameManager;
module.exports.PHASE = PHASE;
module.exports.GAME_ORDER = GAME_ORDER;
module.exports.GAME_NAMES = GAME_NAMES;
module.exports.GAME_RULES = GAME_RULES;
