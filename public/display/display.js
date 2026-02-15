/**
 * Squid Amphi — Écran d'Affichage (Projecteur)
 * Phaser.js pour le rendu graphique + Socket.io pour la synchro serveur
 */

// ─── Connexion Socket.io ─────────────────────────────────────
const socket = io();

// ─── État global ─────────────────────────────────────────────
let gameState = {
    phase: 'LOBBY',
    players: [],
    gameData: null
};

// Map des sprites Phaser par ID joueur
const playerSprites = {};
const playerLabels = {};

// ─── Configuration Phaser ────────────────────────────────────
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#05050a',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

let phaserGame;
let scene;
let finishLine;
let particles = [];

// ─── Phaser Scene ────────────────────────────────────────────

function preload() {
    // Pas d'assets externes pour l'instant, on utilise des formes géométriques
}

function create() {
    scene = this;

    // Grille de fond subtile
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1a1a2e, 0.15);
    for (let x = 0; x < this.scale.width; x += 60) {
        graphics.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 60) {
        graphics.lineBetween(0, y, this.scale.width, y);
    }

    // Ligne d'arrivée (cachée au début)
    finishLine = this.add.rectangle(
        this.scale.width - 80, this.scale.height / 2,
        6, this.scale.height,
        0x00ff85, 0.4
    );
    finishLine.setVisible(false);

    // Texte "Ligne d'arrivée"
    this.finishText = this.add.text(this.scale.width - 80, 80, '🏁 ARRIVÉE', {
        font: '18px Outfit',
        fill: '#00ff85',
        align: 'center'
    }).setOrigin(0.5).setVisible(false);

    // Ligne de départ
    this.startLine = this.add.rectangle(
        80, this.scale.height / 2,
        4, this.scale.height,
        0xff007f, 0.3
    ).setVisible(false);
}

function update() {
    // Interpolation douce des positions des joueurs
    for (const [id, sprite] of Object.entries(playerSprites)) {
        const player = gameState.players.find(p => p.id === id);
        if (player && sprite.active) {
            // Lerp vers la position cible
            const targetX = scaleX(player.position.x);
            const targetY = scaleY(player.position.y);
            sprite.x += (targetX - sprite.x) * 0.15;
            sprite.y += (targetY - sprite.y) * 0.15;

            // Mettre à jour le label
            if (playerLabels[id]) {
                playerLabels[id].x = sprite.x;
                playerLabels[id].y = sprite.y - 30;
            }
        }
    }

    // Mettre à jour les particules
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 0.02;
        if (p.life <= 0) {
            p.obj.destroy();
            particles.splice(i, 1);
        } else {
            p.obj.setAlpha(p.life);
            p.obj.x += p.vx;
            p.obj.y += p.vy;
            p.vy += 0.3; // gravité
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────

// Convertir les coordonnées du jeu (0-1000) en pixels écran
function scaleX(x) {
    return (x / 1000) * (scene?.scale?.width || window.innerWidth);
}

function scaleY(y) {
    return (y / 600) * (scene?.scale?.height || window.innerHeight);
}

// Convertir une couleur CSS en hex Phaser
function cssColorToHex(cssColor) {
    if (!cssColor) return 0xff007f;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return (r << 16) | (g << 8) | b;
}

// ─── Gestion des sprites joueurs ─────────────────────────────

function addPlayerSprite(player) {
    if (!scene || playerSprites[player.id]) return;

    const x = scaleX(player.position.x);
    const y = scaleY(player.position.y);
    const color = cssColorToHex(player.color);

    // Avatar : cercle coloré avec contour
    const container = scene.add.container(x, y);

    // Corps (cercle)
    const body = scene.add.circle(0, 0, 16, color, 1);
    body.setStrokeStyle(2, 0xffffff, 0.6);

    // Yeux
    const eyeL = scene.add.circle(-5, -4, 3, 0xffffff);
    const eyeR = scene.add.circle(5, -4, 3, 0xffffff);
    const pupilL = scene.add.circle(-4, -4, 1.5, 0x000000);
    const pupilR = scene.add.circle(6, -4, 1.5, 0x000000);

    container.add([body, eyeL, eyeR, pupilL, pupilR]);
    playerSprites[player.id] = container;

    // Label (pseudo)
    const label = scene.add.text(x, y - 30, player.username, {
        font: 'bold 12px Outfit',
        fill: '#ffffff',
        align: 'center',
        shadow: { offsetX: 0, offsetY: 0, blur: 4, color: '#000000', fill: true }
    }).setOrigin(0.5);
    playerLabels[player.id] = label;

    // Animation d'apparition
    container.setScale(0);
    scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        ease: 'Back.easeOut'
    });
}

function removePlayerSprite(id) {
    if (playerSprites[id]) {
        playerSprites[id].destroy();
        delete playerSprites[id];
    }
    if (playerLabels[id]) {
        playerLabels[id].destroy();
        delete playerLabels[id];
    }
}

function eliminatePlayerSprite(id) {
    const sprite = playerSprites[id];
    if (!sprite || !scene) return;

    // Explosion de particules
    const x = sprite.x;
    const y = sprite.y;
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 / 12) * i;
        const speed = 2 + Math.random() * 4;
        const size = 3 + Math.random() * 5;
        const particle = scene.add.circle(x, y, size, 0xff0040);
        particles.push({
            obj: particle,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            life: 1
        });
    }

    // Faire disparaître le sprite
    scene.tweens.add({
        targets: sprite,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
            sprite.setVisible(false);
        }
    });

    // Griser le label
    if (playerLabels[id]) {
        playerLabels[id].setColor('#555555');
        playerLabels[id].setText('💀 ' + playerLabels[id].text);
    }
}

// ─── UI Overlay Controls ─────────────────────────────────────
const overlays = {
    lobby: document.getElementById('overlay-lobby'),
    countdown: document.getElementById('overlay-countdown'),
    roundend: document.getElementById('overlay-roundend'),
    victory: document.getElementById('overlay-victory')
};

const ui = {
    roundLabel: document.getElementById('round-label'),
    gameName: document.getElementById('game-name'),
    aliveCount: document.getElementById('alive-count'),
    totalCount: document.getElementById('total-count'),
    lobbyCount: document.getElementById('lobby-count'),
    serverUrl: document.getElementById('server-url'),
    btnStart: document.getElementById('btn-start'),
    countdownTitle: document.getElementById('countdown-title'),
    countdownNum: document.getElementById('countdown-num'),
    roundendAlive: document.getElementById('roundend-alive'),
    victoryWinner: document.getElementById('victory-winner'),
    lightDisplay: document.getElementById('light-display'),
    lightCircle: document.getElementById('light-circle'),
    lightText: document.getElementById('light-text'),
    timerDisplay: document.getElementById('timer-display')
};

function showOverlay(name) {
    for (const [key, el] of Object.entries(overlays)) {
        el.classList.toggle('active', key === name);
    }
}

function hideAllOverlays() {
    for (const el of Object.values(overlays)) {
        el.classList.remove('active');
    }
}

// Afficher l'URL du serveur
ui.serverUrl.textContent = window.location.origin + '/controller';

// Bouton Start
ui.btnStart.addEventListener('click', () => {
    socket.emit('admin:start');
});

// ─── Socket.io Events ───────────────────────────────────────

// S'enregistrer comme écran d'affichage
socket.emit('display:join');

// État initial complet
socket.on('display:state', (state) => {
    gameState = state;
    updateUI();

    // Créer les sprites pour tous les joueurs existants
    for (const player of state.players) {
        addPlayerSprite(player);
    }
});

// Nouveau joueur
socket.on('player:add', (player) => {
    gameState.players.push(player);
    gameState.playerCount++;
    addPlayerSprite(player);
    updatePlayerCounts();
});

// Joueur déconnecté
socket.on('player:remove', (data) => {
    gameState.players = gameState.players.filter(p => p.id !== data.id);
    gameState.playerCount--;
    removePlayerSprite(data.id);
    updatePlayerCounts();
});

// Joueur éliminé
socket.on('player:eliminated', (data) => {
    eliminatePlayerSprite(data.id);
    // Petit flash rouge sur l'écran
    if (scene) {
        const flash = scene.add.rectangle(
            scene.scale.width / 2, scene.scale.height / 2,
            scene.scale.width, scene.scale.height,
            0xff0040, 0.15
        );
        scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });
    }
});

// État du jeu (chaque tick)
socket.on('game:state', (state) => {
    // Mettre à jour les positions des joueurs
    for (const player of state.players) {
        const existing = gameState.players.find(p => p.id === player.id);
        if (existing) {
            existing.position = player.position;
            existing.alive = player.alive;
            existing.score = player.score;
        }
    }

    gameState.phase = state.phase;
    gameState.aliveCount = state.aliveCount;
    gameState.playerCount = state.playerCount;
    gameState.gameData = state.gameData;
    gameState.roundNumber = state.roundNumber;

    updateUI();
});

// Countdown
socket.on('game:countdown', (data) => {
    ui.countdownTitle.textContent = data.gameName;
    showOverlay('countdown');
    ui.roundLabel.textContent = `MANCHE ${data.roundNumber}`;
    ui.gameName.textContent = data.gameName;

    let count = data.duration;
    ui.countdownNum.textContent = count;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            ui.countdownNum.textContent = count;
        } else {
            clearInterval(interval);
            hideAllOverlays();
        }
    }, 1000);
});

// Changement de feu
socket.on('game:lightChange', (data) => {
    updateLight(data.light);
});

// Fin de manche
socket.on('game:roundEnd', (data) => {
    ui.roundendAlive.textContent = data.aliveCount;
    showOverlay('roundend');
    ui.lightDisplay.classList.add('hidden');
});

// Victoire
socket.on('game:victory', (data) => {
    if (data.winner) {
        ui.victoryWinner.textContent = `🎉 ${data.winner.username} est le dernier survivant !`;
    } else {
        ui.victoryWinner.textContent = 'Partie terminée !';
    }
    showOverlay('victory');
    ui.lightDisplay.classList.add('hidden');
});

// ─── Mise à jour UI ──────────────────────────────────────────

function updateUI() {
    updatePlayerCounts();

    if (gameState.phase === 'LOBBY') {
        showOverlay('lobby');
        ui.roundLabel.textContent = 'LOBBY';
        ui.lightDisplay.classList.add('hidden');

        // Cacher les lignes de jeu
        if (finishLine) finishLine.setVisible(false);
        if (scene?.finishText) scene.finishText.setVisible(false);
        if (scene?.startLine) scene.startLine.setVisible(false);
    }

    if (gameState.phase === 'PLAYING') {
        hideAllOverlays();

        // Afficher les lignes pour 1,2,3 Soleil
        if (gameState.gameData) {
            if (finishLine) finishLine.setVisible(true);
            if (scene?.finishText) scene.finishText.setVisible(true);
            if (scene?.startLine) scene.startLine.setVisible(true);

            ui.lightDisplay.classList.remove('hidden');
            updateLight(gameState.gameData.light);

            if (gameState.gameData.timeRemaining !== undefined) {
                ui.timerDisplay.textContent = gameState.gameData.timeRemaining + 's';
            }
        }
    }
}

function updatePlayerCounts() {
    ui.aliveCount.textContent = gameState.aliveCount ?? gameState.players?.length ?? 0;
    ui.totalCount.textContent = gameState.playerCount ?? gameState.players?.length ?? 0;
    ui.lobbyCount.textContent = gameState.playerCount ?? gameState.players?.length ?? 0;
}

function updateLight(light) {
    if (light === 'GREEN') {
        ui.lightCircle.className = 'light-circle green';
        ui.lightText.className = 'light-text green';
        ui.lightText.textContent = 'Feu vert — Avancez';

        if (scene) {
            scene.cameras.main.setBackgroundColor('#020805');
        }
    } else {
        ui.lightCircle.className = 'light-circle red';
        ui.lightText.className = 'light-text red';
        ui.lightText.textContent = 'Feu rouge — Stop';

        if (scene) {
            scene.cameras.main.setBackgroundColor('#080202');
        }
    }
}

// ─── Initialiser Phaser ──────────────────────────────────────
phaserGame = new Phaser.Game(config);
