/**
 * Squid Amphi — Écran d'Affichage (Projecteur / Amphi)
 * Phaser.js + Socket.io
 * Optimisé pour 50+ joueurs visibles depuis le fond de l'amphi
 */

const socket = io();

// ─── État global ─────────────────────────────────────────────
let gameState = {
    phase: 'LOBBY',
    players: [],
    gameData: null,
    playerCount: 0,
    aliveCount: 0
};

const playerSprites = {};
const playerLabels = {};
const playerNumbers = {};

// ─── Configuration visuelle pour amphi ───────────────────────
const SPRITE_RADIUS = 22;       // Gros points visibles de loin
const LABEL_FONT_SIZE = 14;     // Labels lisibles
const NUMBER_FONT_SIZE = 16;    // Numéro du joueur bien visible

// ─── Configuration Phaser ────────────────────────────────────
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
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

function preload() { }

function create() {
    scene = this;

    // Grille de fond subtile
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1a1a2e, 0.06);
    for (let x = 0; x < this.scale.width; x += 100) {
        graphics.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 100) {
        graphics.lineBetween(0, y, this.scale.width, y);
    }

    // Ligne d'arrivée
    finishLine = this.add.rectangle(
        this.scale.width - 80, this.scale.height / 2,
        6, this.scale.height,
        0x00ff85, 0.4
    );
    finishLine.setVisible(false);

    this.finishText = this.add.text(this.scale.width - 80, 100, 'ARRIVÉE', {
        font: `bold 18px -apple-system, sans-serif`,
        fill: '#00ff85',
        align: 'center'
    }).setOrigin(0.5).setVisible(false);

    this.startLine = this.add.rectangle(
        80, this.scale.height / 2,
        4, this.scale.height,
        0xff007f, 0.25
    ).setVisible(false);
}

function update() {
    // Interpoler les positions des sprites
    for (const [id, sprite] of Object.entries(playerSprites)) {
        const player = gameState.players.find(p => p.id === id);
        if (player && sprite.active) {
            const targetX = scaleX(player.position.x);
            const targetY = scaleY(player.position.y);
            sprite.x += (targetX - sprite.x) * 0.12;
            sprite.y += (targetY - sprite.y) * 0.12;

            if (playerLabels[id]) {
                playerLabels[id].x = sprite.x;
                playerLabels[id].y = sprite.y - SPRITE_RADIUS - 16;
            }
            if (playerNumbers[id]) {
                playerNumbers[id].x = sprite.x;
                playerNumbers[id].y = sprite.y;
            }
        }
    }

    // Particules d'élimination
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 0.015;
        if (p.life <= 0) {
            p.obj.destroy();
            particles.splice(i, 1);
        } else {
            p.obj.setAlpha(p.life);
            p.obj.x += p.vx;
            p.obj.y += p.vy;
            p.vy += 0.25;
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────

function scaleX(x) {
    return (x / 1000) * (scene?.scale?.width || window.innerWidth);
}

function scaleY(y) {
    return (y / 600) * (scene?.scale?.height || window.innerHeight);
}

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

// Compteur pour numéroter les joueurs
let playerCounter = 0;

// ─── Gestion des sprites joueurs (gros, visibles de loin) ────

function addPlayerSprite(player) {
    if (!scene || playerSprites[player.id]) return;

    playerCounter++;
    const x = scaleX(player.position.x);
    const y = scaleY(player.position.y);
    const color = cssColorToHex(player.color);

    const container = scene.add.container(x, y);

    // Cercle principal — gros et bien visible
    const body = scene.add.circle(0, 0, SPRITE_RADIUS, color, 1);
    body.setStrokeStyle(2.5, 0xffffff, 0.5);

    // Glow effect pour visibilité
    const glow = scene.add.circle(0, 0, SPRITE_RADIUS + 4, color, 0.15);

    container.add([glow, body]);
    playerSprites[player.id] = container;

    // Numéro du joueur (au centre du cercle)
    const num = scene.add.text(x, y, String(playerCounter), {
        font: `bold ${NUMBER_FONT_SIZE}px -apple-system, sans-serif`,
        fill: '#ffffff',
        align: 'center'
    }).setOrigin(0.5);
    playerNumbers[player.id] = num;

    // Label du pseudo (au-dessus)
    const label = scene.add.text(x, y - SPRITE_RADIUS - 16, player.username, {
        font: `bold ${LABEL_FONT_SIZE}px -apple-system, sans-serif`,
        fill: '#ffffff',
        align: 'center',
        shadow: { offsetX: 0, offsetY: 1, blur: 6, color: '#000000', fill: true }
    }).setOrigin(0.5);
    playerLabels[player.id] = label;

    // Animation d'entrée
    container.setScale(0);
    scene.tweens.add({
        targets: container,
        scaleX: 1, scaleY: 1,
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
    if (playerNumbers[id]) {
        playerNumbers[id].destroy();
        delete playerNumbers[id];
    }
}

function eliminatePlayerSprite(id) {
    const sprite = playerSprites[id];
    if (!sprite || !scene) return;

    const x = sprite.x;
    const y = sprite.y;

    // Explosion de particules rose
    for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 / 14) * i;
        const speed = 2 + Math.random() * 4;
        const size = 3 + Math.random() * 5;
        const particle = scene.add.circle(x, y, size, 0xff0040);
        particles.push({
            obj: particle,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            life: 1
        });
    }

    // Animation de mort
    scene.tweens.add({
        targets: sprite,
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => sprite.setVisible(false)
    });

    // Croix rouge sur le label
    if (playerLabels[id]) {
        playerLabels[id].setColor('#ff3b30');
        playerLabels[id].setText('✕');
        scene.tweens.add({
            targets: playerLabels[id],
            alpha: 0.3,
            duration: 1000
        });
    }

    if (playerNumbers[id]) {
        playerNumbers[id].setVisible(false);
    }
}

// ─── UI Elements ─────────────────────────────────────────────
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
    qrContainer: document.getElementById('qr-container'),
    btnStart: document.getElementById('btn-start'),
    btnReset: document.getElementById('btn-reset'),
    btnResetVictory: document.getElementById('btn-reset-victory'),
    btnEndGame: document.getElementById('btn-end-game'),
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
const controllerUrl = window.location.origin + '/controller';
ui.serverUrl.textContent = controllerUrl;

// Générer le QR Code
if (typeof QRCode !== 'undefined' && ui.qrContainer) {
    QRCode.toCanvas(controllerUrl, {
        width: 180,
        margin: 0,
        color: { dark: '#000000', light: '#ffffff' }
    }, (err, canvas) => {
        if (!err && canvas) {
            ui.qrContainer.appendChild(canvas);
        }
    });
}

// ─── Boutons ─────────────────────────────────────────────────
ui.btnStart.addEventListener('click', () => {
    socket.emit('admin:start');
});

ui.btnReset.addEventListener('click', () => {
    socket.emit('admin:reset');
});

ui.btnResetVictory.addEventListener('click', () => {
    socket.emit('admin:reset');
});

ui.btnEndGame.addEventListener('click', () => {
    if (confirm('Terminer la partie en cours ?')) {
        socket.emit('admin:reset');
    }
});

// ─── Socket.io Events ───────────────────────────────────────

socket.emit('display:join');

socket.on('display:state', (state) => {
    gameState = state;
    updateUI();
    for (const player of state.players) {
        addPlayerSprite(player);
    }
});

socket.on('player:add', (player) => {
    gameState.players.push(player);
    gameState.playerCount++;
    addPlayerSprite(player);
    updatePlayerCounts();
});

socket.on('player:remove', (data) => {
    gameState.players = gameState.players.filter(p => p.id !== data.id);
    gameState.playerCount--;
    removePlayerSprite(data.id);
    updatePlayerCounts();
});

socket.on('player:eliminated', (data) => {
    eliminatePlayerSprite(data.id);
    if (scene) {
        const flash = scene.add.rectangle(
            scene.scale.width / 2, scene.scale.height / 2,
            scene.scale.width, scene.scale.height,
            0xff0040, 0.08
        );
        scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });
    }
});

socket.on('game:state', (state) => {
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

socket.on('game:countdown', (data) => {
    ui.countdownTitle.textContent = data.gameName;
    showOverlay('countdown');
    ui.roundLabel.textContent = `manche ${data.roundNumber}`;
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

socket.on('game:lightChange', (data) => {
    updateLight(data.light);
});

socket.on('game:roundEnd', (data) => {
    ui.roundendAlive.textContent = data.aliveCount;
    showOverlay('roundend');
    ui.lightDisplay.classList.add('hidden');
});

socket.on('game:victory', (data) => {
    if (data.winner) {
        ui.victoryWinner.textContent = data.winner.username + ' est le dernier survivant';
    } else {
        ui.victoryWinner.textContent = 'Partie terminée';
    }
    showOverlay('victory');
    ui.lightDisplay.classList.add('hidden');
    ui.btnEndGame.classList.add('hidden');
});

socket.on('game:reset', () => {
    window.location.reload();
});

// ─── Mise à jour UI ──────────────────────────────────────────

function updateUI() {
    updatePlayerCounts();

    if (gameState.phase === 'LOBBY') {
        showOverlay('lobby');
        ui.roundLabel.textContent = 'lobby';
        ui.lightDisplay.classList.add('hidden');
        ui.btnEndGame.classList.add('hidden');

        if (finishLine) finishLine.setVisible(false);
        if (scene?.finishText) scene.finishText.setVisible(false);
        if (scene?.startLine) scene.startLine.setVisible(false);
    }

    if (gameState.phase === 'PLAYING') {
        hideAllOverlays();
        ui.btnEndGame.classList.remove('hidden');
        const gd = gameState.gameData;

        if (gd) {
            const gameType = gd.type || '';

            // Red Light Green Light
            if (gd.light !== undefined && gameType === 'redlightgreenlight') {
                if (finishLine) finishLine.setVisible(true);
                if (scene?.finishText) scene.finishText.setVisible(true);
                if (scene?.startLine) scene.startLine.setVisible(true);
                ui.lightDisplay.classList.remove('hidden');
                updateLight(gd.light);
            } else {
                if (finishLine) finishLine.setVisible(false);
                if (scene?.finishText) scene.finishText.setVisible(false);
                if (scene?.startLine) scene.startLine.setVisible(false);
            }

            // Dalgona
            if (gameType === 'dalgona') {
                ui.lightDisplay.classList.remove('hidden');
                ui.lightText.textContent = `Dalgona — Tape en rythme !`;
                ui.lightText.className = 'hud-text';
                ui.lightCircle.className = 'hud-dot green';
            }

            // Tug of War
            if (gameType === 'tugofwar') {
                ui.lightDisplay.classList.remove('hidden');
                const pos = gd.ropePosition || 0;
                const pct = Math.round((pos / gd.threshold) * 100);
                ui.lightText.textContent = `Corde : ${pct > 0 ? '+' : ''}${pct}%`;
                ui.lightText.className = 'hud-text ' + (pos <= 0 ? 'green' : 'red');
                ui.lightCircle.className = 'hud-dot ' + (pos <= 0 ? 'green' : 'red');
            }

            // Marbles
            if (gameType === 'marbles' && gd.currentMatch) {
                ui.lightDisplay.classList.remove('hidden');
                ui.lightText.textContent = `${gd.currentMatch.nameA} vs ${gd.currentMatch.nameB} — Match ${gd.matchNumber}/${gd.totalMatches}`;
                ui.lightText.className = 'hud-text';
                ui.lightCircle.className = 'hud-dot green';
            }

            // Glass Bridge
            if (gameType === 'glassbridge') {
                ui.lightDisplay.classList.remove('hidden');
                ui.lightText.textContent = gd.currentPlayerName
                    ? `Tour de ${gd.currentPlayerName} — Étape ${gd.currentStep}/${gd.totalSteps}`
                    : 'Attente…';
                ui.lightText.className = 'hud-text';
                ui.lightCircle.className = 'hud-dot green';
            }

            // Group Game
            if (gameType === 'groupgame') {
                ui.lightDisplay.classList.remove('hidden');
                ui.lightText.textContent = `Groupes de ${gd.targetSize} — Manche ${gd.round}/${gd.totalRounds}`;
                ui.lightText.className = 'hud-text';
                ui.lightCircle.className = 'hud-dot green';
            }

            // Final Duel
            if (gameType === 'finalduel' && gd.currentDuel) {
                ui.lightDisplay.classList.remove('hidden');
                const d = gd.currentDuel;
                ui.lightText.textContent = `${d.nameA} (${d.tapsA}) vs ${d.nameB} (${d.tapsB})`;
                ui.lightText.className = 'hud-text';
                ui.lightCircle.className = 'hud-dot green';
            }

            // Timer
            if (gd.timeRemaining !== undefined) {
                ui.timerDisplay.textContent = gd.timeRemaining + 's';
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
        ui.lightCircle.className = 'hud-dot green';
        ui.lightText.className = 'hud-text green';
        ui.lightText.textContent = 'Feu vert — Avancez';
        if (scene) scene.cameras.main.setBackgroundColor('#010804');
    } else {
        ui.lightCircle.className = 'hud-dot red';
        ui.lightText.className = 'hud-text red';
        ui.lightText.textContent = 'Feu rouge — Stop';
        if (scene) scene.cameras.main.setBackgroundColor('#060101');
    }
}

// ─── Initialiser Phaser ──────────────────────────────────────
phaserGame = new Phaser.Game(config);
