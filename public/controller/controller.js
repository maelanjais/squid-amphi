/**
 * Squid Amphi — Contrôleur Téléphone
 * Gère la connexion Socket.io, les inputs et les transitions d'écran
 */

// ─── Connexion Socket.io ─────────────────────────────────────
const socket = io();

// ─── Éléments DOM ────────────────────────────────────────────
const screens = {
    join: document.getElementById('screen-join'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game'),
    eliminated: document.getElementById('screen-eliminated'),
    victory: document.getElementById('screen-victory'),
    countdown: document.getElementById('screen-countdown')
};

const elements = {
    inputUsername: document.getElementById('input-username'),
    btnJoin: document.getElementById('btn-join'),
    playerName: document.getElementById('player-name'),
    gameName: document.getElementById('game-name'),
    gameLight: document.getElementById('game-light'),
    tapArea: document.getElementById('tap-area'),
    tapHint: document.getElementById('tap-hint'),
    tapFeedback: document.getElementById('tap-feedback'),
    countdownGameName: document.getElementById('countdown-game-name'),
    countdownNumber: document.getElementById('countdown-number'),
    victoryMessage: document.getElementById('victory-message')
};

// ─── État local ──────────────────────────────────────────────
let myPlayer = null;
let currentLight = 'GREEN';

// ─── Navigation entre écrans ─────────────────────────────────
function showScreen(screenName) {
    for (const [name, el] of Object.entries(screens)) {
        el.classList.toggle('active', name === screenName);
    }
}

// ─── Rejoindre la partie ─────────────────────────────────────
elements.btnJoin.addEventListener('click', joinGame);
elements.inputUsername.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinGame();
});

function joinGame() {
    const username = elements.inputUsername.value.trim();
    if (!username) {
        elements.inputUsername.style.borderColor = '#FF0040';
        elements.inputUsername.focus();
        return;
    }

    elements.btnJoin.textContent = 'Connexion...';
    elements.btnJoin.disabled = true;

    socket.emit('player:join', { username });
}

// ─── Événements Socket.io ────────────────────────────────────

// Connexion réussie
socket.on('player:joined', (data) => {
    myPlayer = data.player;
    elements.playerName.textContent = myPlayer.username;
    showScreen('lobby');
});

// Erreur
socket.on('error', (data) => {
    alert(data.message);
    elements.btnJoin.textContent = 'Rejoindre';
    elements.btnJoin.disabled = false;
});

// Countdown avant un mini-jeu
socket.on('game:countdown', (data) => {
    elements.countdownGameName.textContent = data.gameName;
    showScreen('countdown');

    let count = data.duration;
    elements.countdownNumber.textContent = count;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            elements.countdownNumber.textContent = count;
        } else {
            clearInterval(interval);
        }
    }, 1000);
});

// État du joueur (feedback serveur)
socket.on('player:state', (data) => {
    if (!myPlayer) return;

    // Mettre à jour le feu (1,2,3 Soleil)
    if (data.light !== undefined && data.light !== currentLight) {
        currentLight = data.light;
        updateLightUI();
    }

    // Transition vers l'écran de jeu si on est en phase PLAYING
    if (data.gamePhase === 'PLAYING' && screens.game.classList.contains('active') === false
        && screens.eliminated.classList.contains('active') === false) {
        elements.gameName.textContent = data.currentGame || 'MINI-JEU';
        showScreen('game');
        updateLightUI();
    }

    // Retour au lobby entre les manches
    if (data.gamePhase === 'LOBBY') {
        showScreen('lobby');
    }
});

// Changement de feu (1,2,3 Soleil)
socket.on('game:lightChange', (data) => {
    currentLight = data.light;
    updateLightUI();
});

// Éliminé !
socket.on('player:eliminated', () => {
    showScreen('eliminated');
    // Vibration haptique
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
    }
});

// Fin de manche
socket.on('game:roundEnd', () => {
    // Rester sur l'écran actuel
});

// Victoire
socket.on('game:victory', (data) => {
    if (data.winner) {
        if (data.winner.id === socket.id) {
            elements.victoryMessage.textContent = 'Tu es le dernier survivant !';
        } else {
            elements.victoryMessage.textContent = `${data.winner.username} a gagné !`;
        }
    } else {
        elements.victoryMessage.textContent = 'Partie terminée !';
    }
    showScreen('victory');
});

// Ligne franchie (1,2,3 Soleil)
socket.on('player:finished', (data) => {
    elements.tapHint.textContent = '✅ EN SÉCURITÉ';
    elements.tapHint.className = 'tap-hint go';
});

// ─── Contrôles : Tap ─────────────────────────────────────────
function updateLightUI() {
    const light = elements.gameLight;
    const hint = elements.tapHint;
    const area = elements.tapArea;

    if (currentLight === 'GREEN') {
        light.className = 'light-indicator green';
        hint.textContent = 'Tapote pour avancer';
        hint.className = 'tap-hint go';
        area.className = 'tap-area green-bg';
    } else {
        light.className = 'light-indicator red';
        hint.textContent = 'Ne bouge pas';
        hint.className = 'tap-hint stop';
        area.className = 'tap-area red-bg';
    }
}

// Envoi d'input au tap
elements.tapArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    sendTap(e.touches[0]);
}, { passive: false });

elements.tapArea.addEventListener('mousedown', (e) => {
    sendTap(e);
});

function sendTap(event) {
    socket.emit('player:input', { type: 'tap' });

    // Feedback visuel
    const feedback = elements.tapFeedback;
    feedback.style.left = (event.clientX || event.pageX) - 50 + 'px';
    feedback.style.top = (event.clientY || event.pageY) - 50 + 'px';
    feedback.classList.remove('flash');
    void feedback.offsetWidth; // force reflow
    feedback.classList.add('flash');
}

// Empêcher le zoom et le scroll sur mobile
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
