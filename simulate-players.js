const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:3000";
const NUM_BOTS = 100;
const bots = [];

console.log(`🤖 Démarrage du simulateur avec ${NUM_BOTS} bots...`);

// ---- OBSERVER SETUP ----
// S'enregistre comme un display pour pouvoir voir l'état global 
// (ce qui permet aux bots de voir le danger, etc.)
let globalState = null;
const observer = io(SERVER_URL);
observer.on("connect", () => {
  observer.emit("register-display");
  console.log("👁️  Observer connecté ! L'IA des bots est active.");
});
observer.on("game-state", (state) => {
  globalState = state;
});

// Lancement différé
for (let i = 0; i < NUM_BOTS; i++) {
  setTimeout(() => {
    createBot(i + 1);
  }, i * 50); // Connexion décalée
}

function createBot(index) {
  const socket = io(SERVER_URL, {
    reconnectionDelayMax: 10000,
  });

  const botName = `Bot ${index}`;
  let botNumber = 0;
  let alive = true;
  let currentGame = null;
  let currentPhase = 'lobby';
  let ctrlState = null;

  let behaviorInterval = null;

  socket.on("connect", () => {
    console.log(`[${botName}] Connecté. Enregistrement...`);
    socket.emit("register-player", { name: botName });
  });

  socket.on("registered", (data) => {
    botNumber = data.number;
  });

  socket.on("phase", (data) => {
    currentPhase = data.phase;
    if (data.currentGame) {
      currentGame = data.currentGame.name;
    }
    
    if (currentPhase === 'playing') {
       startBehavior();
    } else {
       stopBehavior();
    }
  });

  socket.on("controller-state", (data) => {
    alive = data.alive;
    if (data.gameState) ctrlState = data.gameState;
    if (data.phase) currentPhase = data.phase;
  });

  socket.on("error", (err) => {
    console.error(`[${botName}] Erreur: ${err.message}`);
  });

  socket.on("eliminated", () => {
    alive = false;
    stopBehavior();
  });

  socket.on("disconnect", () => {
    stopBehavior();
  });

  function startBehavior() {
    if (behaviorInterval) return;
    
    // Le bot actualise ses inputs 10 fois par seconde
    behaviorInterval = setInterval(() => {
      if (!alive || !globalState || !ctrlState) {
        if (!alive) stopBehavior();
        return;
      }
      
      const me = globalState.players?.find(p => p.id === socket.id);
      if (!me) return;

      if (currentGame === '1, 2, 3… Soleil !') actRLGL(me);
      else if (currentGame === 'Le Jeu de la Corde') actTugOfWar(me);
      else if (currentGame === 'Le Jeu du Manège') actGroupGame(me);
      else if (currentGame === 'La Bataille du Dortoir') actNightFight(me);
      else if (currentGame === 'Le Pont de Verre') actGlassBridge(me);
      else if (currentGame === 'Le Duel Final') actFinalDuel(me);
      else if (currentGame === 'Le Sablé Dalgona') actDalgona(me);

    }, 100); 
  }

  // --- ACTIONS DES BOTS ---

  function actRLGL(me) {
    let shouldMove = false;
    if (ctrlState.greenLight && !ctrlState.warning) {
      shouldMove = true;
    } else if (ctrlState.greenLight && ctrlState.warning) {
      shouldMove = Math.random() > 0.4;
    } else {
      shouldMove = Math.random() < 0.005; // Très faible erreur
    }

    if (ctrlState.crossed) shouldMove = false;

    socket.emit("player-input", {
      type: "move", pressing: shouldMove, dirX: (Math.random() - 0.5) * 0.3, dirY: -1 
    });
  }

  function actTugOfWar(me) {
    if (Math.random() < 0.4) {
       socket.emit("player-input", { type: 'tap' });
    }
  }

  function actGroupGame(me) {
     const gs = globalState.currentGame?.state;
     if (!gs || gs.phase === 'announce' || gs.phase === 'check') {
         socket.emit("player-input", { type: "move", pressing: false });
         return;
     }
     
     if (!me.targetClusterX) {
        me.targetClusterX = 100 + Math.random() * 1700;
        me.targetClusterY = 100 + Math.random() * 800;
     }

     if (gs.groups) {
         const myGroup = gs.groups.find(g => g.members.includes(me.id));
         if (myGroup && myGroup.valid) {
             socket.emit("player-input", { type: "move", pressing: false });
             return;
         }
         
         const invalidGroups = gs.groups.filter(g => !g.valid && g.members.length < gs.targetNumber);
         if (invalidGroups.length > 0) {
             const best = invalidGroups[0]; 
             me.targetClusterX = best.centerX;
             me.targetClusterY = best.centerY;
         }
     }
     
     const dx = me.targetClusterX - me.x;
     const dy = me.targetClusterY - me.y;
     const dist = Math.sqrt(dx*dx + dy*dy);
     
     if (dist > 30) {
         socket.emit("player-input", { type: "move", pressing: true, dirX: dx, dirY: dy });
     } else {
         socket.emit("player-input", { type: "move", pressing: false });
     }
  }

  function actNightFight(me) {
     const enemies = globalState.players.filter(p => p.alive && p.id !== me.id);
     if (enemies.length === 0) return;

     let closest = null;
     let minDist = Infinity;
     for (const e of enemies) {
         const dist = Math.sqrt((e.x - me.x)**2 + (e.y - me.y)**2);
         if (dist < minDist) {
             minDist = dist; closest = e;
         }
     }
     if (closest) {
         if (minDist < 60 && Math.random() < 0.05) {
             socket.emit("player-input", { type: "tap" });
         } else if (Math.random() < 0.5) {
             const dx = closest.x - me.x;
             const dy = closest.y - me.y;
             socket.emit("player-input", { type: "move", pressing: true, dirX: dx, dirY: dy });
         } else {
             socket.emit("player-input", { type: "move", pressing: false });
         }
     }
  }

  function actGlassBridge(me) {
      if (!ctrlState.choosing) return;

      const timeRemaining = ctrlState.timer;
      if (timeRemaining < 3 || Math.random() < 0.05) {
          socket.emit("player-input", { type: "choice", choice: Math.random() > 0.5 ? 'left' : 'right' });
      }
  }

  function actFinalDuel(me) {
      const gs = globalState.currentGame?.state;
      if (!gs) return;
      
      const enemies = globalState.players.filter(p => p.alive && p.id !== me.id);
      let closest = null, minDist = Infinity;
      for (const e of enemies) {
          const dist = Math.sqrt((e.x - me.x)**2 + (e.y - me.y)**2);
          if (dist < minDist) { minDist = dist; closest = e; }
      }

      const cx = gs.centerX, cy = gs.centerY;
      let targetX = cx, targetY = cy;
      
      if (closest && minDist < 200) {
          targetX = closest.x; targetY = closest.y;
      }
      
      const dx = targetX - me.x;
      const dy = targetY - me.y;
      
      socket.emit("player-input", { type: "move", pressing: true, dirX: dx, dirY: dy });
      
      if (closest && minDist < 50 && Math.random() < 0.3) {
          socket.emit("player-input", { type: "swipe", swipeX: dx, swipeY: dy });
      }
  }

  function actDalgona(me) {
     const gs = globalState.currentGame?.state;
     if (!gs || !gs.playerStates) return;
     const state = gs.playerStates[me.id];
     if (!state || state.done) return;

     if (state.tension < 80) {
         if (Math.random() < 0.6) {
             socket.emit("player-input", { type: "tap" });
         }
     } else {
         if (Math.random() < 0.05) {
             socket.emit("player-input", { type: "tap" });
         }
     }
  }

  function stopBehavior() {
    if (behaviorInterval) {
      clearInterval(behaviorInterval);
      behaviorInterval = null;
    }
    socket.emit("player-input", {
      type: "move", pressing: false, dirX: 0, dirY: 0
    });
  }

  bots.push(socket);
}
