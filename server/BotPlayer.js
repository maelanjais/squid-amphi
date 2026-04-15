const Player = require('./Player');

class BotPlayer extends Player {
  constructor(id, name) {
    super(id, name);
    this.isBot = true;
    this.botTargetX = 0;
    this.botTargetY = 0;
  }

  botThink(gameState, currentGameName, allPlayers) {
    if (!this.alive || !gameState) return;

    if (currentGameName === '1, 2, 3… Soleil !') this.actRLGL(gameState);
    else if (currentGameName === 'Le Jeu de la Corde') this.actTugOfWar();
    else if (currentGameName === 'Le Pont de Verre') this.actGlassBridge(gameState);
    else if (currentGameName === 'Jeu Final') this.actRockPaperScissors(gameState);
  }

  actRockPaperScissors(gs) {
    if (gs.state === 'countdown' && !this.choiceMade) {
      // délai humain
      if (Math.random() < 0.03) {
        const choices = ['rock', 'paper', 'scissors'];
        this.input.choice = choices[Math.floor(Math.random() * choices.length)];
        this.choiceMade = true;
      }
    }
    if (gs.state !== 'countdown') {
      this.choiceMade = false; // reset tour suivant
    }
  }

  actRLGL(gs) {
    let shouldMove = false;
    if (gs.greenLight && !gs.warning) {
      shouldMove = Math.random() < 0.7;
    } else if (gs.greenLight && gs.warning) {
      shouldMove = Math.random() > 0.6;
    } else {
      shouldMove = Math.random() < 0.003;
    }

    if (this.y <= gs.finishLine) shouldMove = false;

    this.moving = shouldMove;
    if (shouldMove) {
      this.direction.x = (Math.random() - 0.5) * 0.6;
      this.direction.y = -1;
      const len = Math.sqrt(this.direction.x ** 2 + this.direction.y ** 2);
      this.direction.x /= len;
      this.direction.y /= len;
    }
  }

  actTugOfWar() {
    if (Math.random() < 0.4) {
      this.input.tap = true;
    }
  }

  actGlassBridge(gs) {
    // agir si c'est mon tour
    if (gs.currentPlayerId !== this.id || !gs.choosing) return;

    // utiliser dalles révélées
    const currentStep = gs.playerStep;
    const panel = gs.panels[currentStep];

    if (panel) {
      // dalle révélée
      this.input.choice = panel.safe;
    } else {
      // dalle inconnue
      if (gs.choiceTimer < 6 || Math.random() < 0.08) {
        this.input.choice = Math.random() > 0.5 ? 'left' : 'right';
      }
    }
  }


}

module.exports = BotPlayer;
