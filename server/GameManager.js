const Player = require('./Player');
const BotPlayer = require('./BotPlayer');


const PHASE = {
  LOBBY: 'lobby',
  BETTING: 'betting',
  EXPLANATION: 'explanation',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ELIMINATION: 'elimination',
  TRANSITION_BANK: 'transition_bank',
  TRANSITION_DEAD: 'transition_dead',
  TRANSITION_ROULETTE: 'transition_roulette',
  GAME_OVER: 'gameover'
};

const GAME_NAMES = {
  RedLightGreenLight: '1, 2, 3… Soleil !',
  TugOfWar: 'Le Jeu de la Corde',
  GlassBridge: 'Le Pont de Verre',
  RockPaperScissors: 'Jeu Final'
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
  GlassBridge: {
    description: "Un par un, traversez le pont. Choisissez la bonne dalle à chaque étape. Les dalles découvertes par les premiers sont visibles pour les suivants !",
    controls: "Choisissez Gauche ou Droite quand c'est votre tour."
  },
  RockPaperScissors: {
    description: "Il n'en restera qu'un. Duels en Pierre-Feuille-Ciseaux. Le perdant de chaque duel est éliminé.",
    controls: "Sélectionnez Pierre, Feuille ou Ciseaux sur votre écran avant la fin du décompte."
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
    
    // systèmes de suivi
    this.prizePool = 0;
    this.prizePoolOld = 0;
    this.eliminatedDetails = [];
    this.bets = new Map(); // socket.id -> targetId
    this.bestBetResult = null;
    this.nextGameName = null;

    // compteur de frames
    this.frameCount = 0;
    this._cachedAlivePlayers = null;
    this._cachedAlivePlayersDirty = true;

    // délai 500ms
    setTimeout(() => this.gameLoop(), 500);
    this.explanationTimer = 0;
    this.countdownTimer = 0;
    this.transitionTimer = 0;
    this.eliminatedThisRound = [];
    this.gameQueue = null;
    this.upcomingPool = null;
    this.botCounter = 0;

    // charger jeux
    this.gameClasses = {
      RedLightGreenLight: require('./games/RedLightGreenLight'),
      TugOfWar: require('./games/TugOfWar'),
      GlassBridge: require('./games/GlassBridge'),
      RockPaperScissors: require('./games/RockPaperScissors')
    };

    // boucle 30fps
    this.loopInterval = setInterval(() => this.gameLoop(), 1000 / 30);
  }

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

    socket.on('player-bet', (data) => {
      if (this.phase === PHASE.BETTING) {
          const player = this.players.get(socket.id);
          if (player && player.alive) {
              this.bets.set(player.id, data.targetId);
              this.broadcastState(); // maj affichage
              this.checkBettingComplete();
          }
      }
    });

    socket.on('admin-start', () => {
      // phase paris (min 2 joueurs)
      if (this.phase === PHASE.LOBBY && this.players.size > 1) {
        this.startBettingPhase();
      } else if (this.phase === PHASE.LOBBY && this.players.size === 1) {
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

    socket.on('admin-debug-start', (data) => {
      console.log(`[DEBUG] Démarrage forcé: ${data.game} avec ${data.bots} bots`);
      if (this.phase !== PHASE.LOBBY) return;
      
      const botsNeeded = parseInt(data.bots) || 0;
      if (botsNeeded > 0) {
        this.addBots(botsNeeded);
      }
      
      // forcer file
      this.gameQueue = [data.game];
      this.upcomingPool = []; // éviter erreur longueur
      this.currentGameIndex = -1; // prochain jeu
      
      if (this.players.size > 1) {
          this.startBettingPhase();
      } else {
          this.startNextGame();
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
    // placement
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

  
  startBettingPhase() {
    this.phase = PHASE.BETTING;
    this.bets.clear();
    this.bestBetResult = null;
    
    // paris bots instantanés
    const allPlayers = Array.from(this.players.values());
    for (const p of allPlayers) {
        if (p.isBot && p.alive) {
            const others = allPlayers.filter(o => o.id !== p.id && o.alive);
            if (others.length > 0) {
                const target = others[Math.floor(Math.random() * others.length)];
                this.bets.set(p.id, target.id);
            } else {
                this.bets.set(p.id, p.id); // défaut: soi-même
            }
        }
    }
    
    // envoi liste joueurs
    const aliveSummary = allPlayers.filter(p => p.alive).map(p => ({ 
      id: p.id, 
      name: p.name, 
      number: p.number, 
      color: p.color,
      isBot: p.isBot
    }));
    this.io.emit('start-betting', aliveSummary);
    this.broadcastPhase();
    
    this.checkBettingComplete();
  }

  checkBettingComplete() {
    if (this.phase !== PHASE.BETTING) return;
    const aliveCount = this.getAlivePlayers().length;
    if (this.bets.size >= aliveCount) {
        // léger délai avant lancement
        setTimeout(() => {
           if (this.phase === PHASE.BETTING) this.startNextGame();
        }, 1500);
    }
  }

  calculateBestBets() {
    const alive = this.getAlivePlayers();
    let winnerId = alive.length === 1 ? alive[0].id : null;
    
    let bestBettor = null;
    let bestTarget = null;
    let bestType = "";
    let maxRoundsSurvived = -1;

    // compteur survie
    // survivant final
    const survivalMap = new Map();
    Array.from(this.players.values()).forEach(p => {
        survivalMap.set(p.id, p.alive ? 999999 : 0); 
    });

    // durée survie éliminés
    for (const p of this.players.values()) {
        if (!p.alive && p.roundDied !== undefined) {
             survivalMap.set(p.id, p.roundDied);
        }
    }

    // analyser paris
    for (const [bettorId, targetId] of this.bets.entries()) {
        const bettor = this.players.get(bettorId);
        const target = this.players.get(targetId);
        if (!bettor || !target) continue;

        const survivedRounds = survivalMap.get(targetId);
        
        if (targetId === winnerId) {
            // priorité
            bestBettor = bettor;
            bestTarget = target;
            bestType = "exact";
            maxRoundsSurvived = 999999;
            break; 
        } else if (survivedRounds > maxRoundsSurvived && bestType !== "exact") {
            bestBettor = bettor;
            bestTarget = target;
            bestType = "closest";
            maxRoundsSurvived = survivedRounds;
        }
    }

    if (bestBettor && bestTarget) {
        // rang final
        const allPlayersSorted = Array.from(this.players.values()).sort((a, b) => {
            if (a.alive !== b.alive) return a.alive ? -1 : 1;
            if (a.roundDied !== b.roundDied) return b.roundDied - a.roundDied;
            return (b.score || 0) - (a.score || 0); // départage
        });
        
        const targetRank = allPlayersSorted.findIndex(p => p.id === bestTarget.id) + 1;

        this.bestBetResult = {
            bettor: bestBettor,
            target: bestTarget,
            type: bestType,
            roundsSurvived: maxRoundsSurvived,
            targetRank: targetRank,
            isWinnerBet: bestTarget.id === winnerId
        };
    }
  }

  gameLoop() {
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    this.frameCount++;
    this._cachedAlivePlayersDirty = true; // invalider cache

    if (this.phase === PHASE.EXPLANATION) {
      this.explanationTimer -= dt;
      if (this.explanationTimer <= 0) {
        this.phase = PHASE.COUNTDOWN;
        this.countdownTimer = 3.0;
        this.broadcastPhase();
      }
    }

    if (this.phase === PHASE.COUNTDOWN) {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0.99) {
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
            player.roundDied = this.currentGameIndex;
            this._cachedAlivePlayersDirty = true; // invalider cache
            this.eliminatedThisRound.push(playerId);
            // notifier éliminé
            this.io.to(playerId).emit('eliminated', {
              game: GAME_NAMES[this.gameQueue[this.currentGameIndex]]
            });
          }
        }
      }

      const aliveCount = this.getAlivePlayers().length;
      let prematureEnd = false;
      const gameName = this.gameQueue[this.currentGameIndex];

      if (gameName !== 'RockPaperScissors') {
        // fin si tous morts
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

    if (this.phase === PHASE.TRANSITION_BANK) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        if (this.eliminatedDetails.length > 0) {
          this.phase = PHASE.TRANSITION_DEAD;
          this.transitionTimer = 10;
        } else if (this.nextGameName !== null) {
          this.phase = PHASE.TRANSITION_ROULETTE;
          this.transitionTimer = 10;
        } else {
          this.startNextGame();
        }
        this.broadcastPhase();
      }
    }

    if (this.phase === PHASE.TRANSITION_DEAD) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        if (this.nextGameName !== null) {
          this.phase = PHASE.TRANSITION_ROULETTE;
          this.transitionTimer = 10;
          this.broadcastPhase();
        } else {
          this.startNextGame();
        }
      }
    }

    if (this.phase === PHASE.TRANSITION_ROULETTE) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.startNextGame();
      }
    }

    // IA bots en jeu
    if (this.phase === PHASE.PLAYING && this.currentGame && this.frameCount % 6 === 0) {
      const gameName = GAME_NAMES[this.gameQueue[this.currentGameIndex]];
      const gameState = this.currentGame.getState();
      const allPlayers = Array.from(this.players.values());
      for (const player of allPlayers) {
        if (player.isBot && player.alive) {
          player.botThink(gameState, gameName, allPlayers);
        }
      }
    }

    // maj positions
    if (this.phase === PHASE.PLAYING || this.phase === PHASE.LOBBY) {
      for (const player of this.players.values()) {
        if (player.alive) {
          player.update(dt, { width: this.arenaWidth, height: this.arenaHeight });
        }
      }
    }

    this.broadcastState(this.frameCount);
  }

  startNextGame() {
    this.currentGameIndex++;
    this.eliminatedThisRound = [];

    const alive = this.getAlivePlayers();

    // vérif fin de partie
    // si <= 1 joueur
    if (alive.length <= 1) {
      this.calculateBestBets();
      this.phase = PHASE.GAME_OVER;
      this.currentGame = null;
      this.nextGameName = null;
      this.broadcastPhase();
      return;
    }

    if (!this.gameQueue) {
      this.gameQueue = ['RedLightGreenLight', 'TugOfWar', 'GlassBridge', 'RockPaperScissors'];
      this.upcomingPool = []; // plus de pool aléatoire
    }

    let gameName = this.gameQueue[this.currentGameIndex];

    if (!gameName) {
      gameName = 'RockPaperScissors'; // fallback
    }

    if (gameName === 'RockPaperScissors') {
      this.upcomingPool = []; // vider pool
    }

    const GameClass = this.gameClasses[gameName];
    this.currentGame = new GameClass(this.arenaWidth, this.arenaHeight);

    // initialiser joueurs
    this.currentGame.setup(alive);

    // phase initiale
    this.phase = PHASE.EXPLANATION;
    this.explanationTimer = 15; // explication
    this.broadcastPhase();

    console.log(`🎲 Explaining: ${GAME_NAMES[gameName]} (${alive.length} players alive)`);
  }

  endCurrentGame() {
    const gameName = this.gameQueue[this.currentGameIndex];
    let alive = this.getAlivePlayers();

    console.log(`✅ ${GAME_NAMES[gameName]} finished. ${alive.length} players remain.`);

    
    // éliminer un bot
    if (gameName === 'RedLightGreenLight' && alive.length % 2 !== 0 && alive.length > 2) {
      const botToKill = alive.find(p => p.isBot);
      if (botToKill) {
        botToKill.eliminate();
        this.eliminatedThisRound.push(botToKill.id);
        console.log(`🤖 Bot silencieusement sacrifié pour garantir une parité: ${botToKill.name}`);
        // actualiser joueurs vivants
        alive = this.getAlivePlayers();
      }
    }

    console.log(`💀 ${this.eliminatedThisRound.length} eliminated this round.`);

    // calcul cagnotte
    this.prizePoolOld = this.prizePool;
    this.prizePool += this.eliminatedThisRound.length * 100000;
    this.eliminatedDetails = this.eliminatedThisRound.map(id => {
      const p = this.players.get(id);
      return p ? { name: p.name, number: p.number, color: p.color } : null;
    }).filter(d => d !== null);

    // pré-déterminer prochain jeu
    // cohérence
    const nextIndex = this.currentGameIndex + 1;

    if (alive.length <= 1) {
      this.nextGameName = null;
    } else if (this.gameQueue && nextIndex < this.gameQueue.length) {
      this.nextGameName = this.gameQueue[nextIndex];
    } else {
      this.nextGameName = 'RockPaperScissors'; // fallback
    }

    // lancer animations transition
    this.phase = PHASE.TRANSITION_BANK;
    this.transitionTimer = 7; // 7 seconds bank screen
    this.currentGame = null;
    this.broadcastPhase();
  }

  getAlivePlayers() {
    if (this._cachedAlivePlayersDirty || !this._cachedAlivePlayers) {
      this._cachedAlivePlayers = Array.from(this.players.values()).filter(p => p.alive);
      this._cachedAlivePlayersDirty = false;
    }
    return this._cachedAlivePlayers;
  }

  invalidateAliveCache() {
    this._cachedAlivePlayersDirty = true;
  }

  broadcastState(frameCount) {
    const alivePlayers = this.getAlivePlayers();

    const state = {
      phase: this.phase,
      allGameNames: Object.values(GAME_NAMES),
      players: Array.from(this.players.values()).map(p => p.toJSON()),
      explanation: Math.ceil(this.explanationTimer),
      countdown: Math.max(0, Math.floor(this.countdownTimer)),
      transition: Math.ceil(this.transitionTimer),
      currentGame: this.currentGameIndex >= 0 && this.currentGameIndex < this.gameQueue.length ? {
        name: GAME_NAMES[this.gameQueue[this.currentGameIndex]],
        rules: GAME_RULES[this.gameQueue[this.currentGameIndex]],
        index: this.currentGameIndex,
        total: 4,
        state: this.currentGame ? this.currentGame.getState() : null
      } : null,
      nextGameName: this.nextGameName ? GAME_NAMES[this.nextGameName] : null,
      prizePool: this.prizePool,
      prizePoolOld: this.prizePoolOld,
      eliminatedDetails: this.eliminatedDetails,
      alivePlayers: alivePlayers.length,
      totalPlayers: this.players.size,
      eliminatedThisRoundCount: this.eliminatedThisRound.length,
      totalBets: this.bets ? this.bets.size : 0,
      bestBetResult: this.bestBetResult ? {
          bettorName: this.bestBetResult.bettor.name,
          targetName: this.bestBetResult.target.name,
          type: this.bestBetResult.type,
          targetRank: this.bestBetResult.targetRank,
          isWinnerBet: this.bestBetResult.isWinnerBet
      } : null
    };

    // envoi display
    this.io.to('displays').emit('game-state', state);

    // envoi manettes
    // toujours envoyer en transition
    const isImportantFrame = (this.phase !== PHASE.PLAYING) || (frameCount % 3 === 0);
    if (isImportantFrame) {
      const gameName = state.currentGame ? state.currentGame.name : null;
      const gameRules = state.currentGame ? state.currentGame.rules : null;
      for (const [socketId, player] of this.players) {
        if (player.isBot) continue; // ignorer bots
        const controllerState = {
          phase: this.phase,
          alive: player.alive,
          number: player.number,
          currentGame: gameName,
          currentGameRules: gameRules,
          countdown: state.countdown,
          explanation: state.explanation,
          playerX: Math.round(player.x / this.arenaWidth * 100) / 100,
          playerY: Math.round(player.y / this.arenaHeight * 100) / 100,
          gameState: this.currentGame ? this.currentGame.getControllerState(player) : null,
          isWinner: this.phase === 'gameover' && player.alive,
          playerName: player.name
        };
        this.io.to(socketId).emit('controller-state', controllerState);
      }
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
