/**
 * Squid Amphi — Contrôleur Téléphone
 * Gère la connexion Socket.io, les inputs et les transitions d'écran
 */

// ─── Connexion Socket.io ─────────────────────────────────────
const socket = io();

// ─── Gestion des erreurs globale ─────────────────────────────
window.onerror = function (msg, url, lineNo, columnNo, error) {
    socket.emit('client:error', {
        msg: msg,
        url: url,
        line: lineNo,
        ua: navigator.userAgent
    });
    return false;
};

// ─── Éléments DOM ────────────────────────────────────────────
const screens = {
    join: document.getElementById('screen-join'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game'),
    eliminated: document.getElementById('screen-eliminated'),
    victory: document.getElementById('screen-victory'),
    countdown: document.getElementById('screen-countdown'),
    bridge: document.getElementById('screen-bridge'),
    bridgeWait: document.getElementById('screen-bridge-wait'),
    groups: document.getElementById('screen-groups'),
    dalgona: document.getElementById('screen-dalgona'),
    marbles: document.getElementById('screen-marbles'),
    marblesWait: document.getElementById('screen-marbles-wait')
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
    victoryMessage: document.getElementById('victory-message'),
    lobbyList: document.getElementById('lobby-player-list'),
    // Bridge
    bridgeStepNum: document.getElementById('bridge-step-num'),
    bridgeTotal: document.getElementById('bridge-total'),
    bridgeTimer: document.getElementById('bridge-timer'),
    btnLeft: document.getElementById('btn-left'),
    btnRight: document.getElementById('btn-right'),
    bridgeCurrentPlayer: document.getElementById('bridge-current-player'),
    // Groups
    targetSize: document.getElementById('target-size'),
    groupsButtons: document.getElementById('groups-buttons'),
    groupsTimer: document.getElementById('groups-timer'),
    // Dalgona
    dalgonaScore: document.getElementById('dalgona-score'),
    dalgonaCracks: document.getElementById('dalgona-cracks'),
    dalgonaHint: document.getElementById('dalgona-hint'),
    dalgonaTapArea: document.getElementById('dalgona-tap-area'),
    dalgonaFeedback: document.getElementById('dalgona-feedback'),
    beatIndicator: document.getElementById('beat-indicator'),
    // Marbles
    marblesOpponent: document.getElementById('marbles-opponent'),
    marblesTimer: document.getElementById('marbles-timer'),
    btnPair: document.getElementById('btn-pair'),
    btnImpair: document.getElementById('btn-impair'),
    marblesWaitText: document.getElementById('marbles-wait-text')
};

// ─── État local ──────────────────────────────────────────────
let myPlayer = null;
let currentLight = 'GREEN';
let currentGameType = null;
let selectedGroup = null;

// ─── Navigation entre écrans ─────────────────────────────────
function showScreen(screenName) {
    for (const [name, el] of Object.entries(screens)) {
        if (el) el.classList.toggle('active', name === screenName);
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

// Liste des joueurs dans le lobby
socket.on('lobby:players', (data) => {
    if (!elements.lobbyList) return;
    elements.lobbyList.innerHTML = data.players.map(p =>
        `<span class="lobby-chip">${p.username}</span>`
    ).join('');
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

    // Déterminer le type de jeu en cours
    if (data.currentGame) {
        if (data.currentGame.includes('Soleil')) currentGameType = 'redlight';
        else if (data.currentGame.includes('Dalgona')) currentGameType = 'dalgona';
        else if (data.currentGame.includes('Corde')) currentGameType = 'tugofwar';
        else if (data.currentGame.includes('Billes')) currentGameType = 'marbles';
        else if (data.currentGame.includes('Pont')) currentGameType = 'bridge';
        else if (data.currentGame.includes('Manège')) currentGameType = 'groups';
        else if (data.currentGame.includes('Duel')) currentGameType = 'duel';
    }

    // Mettre à jour le feu (1,2,3 Soleil)
    if (data.light !== undefined && data.light !== currentLight) {
        currentLight = data.light;
        updateLightUI();
    }

    // Transition vers l'écran de jeu si on est en phase PLAYING
    if (data.gamePhase === 'PLAYING') {
        const onGameScreen = screens.game.classList.contains('active')
            || screens.bridge.classList.contains('active')
            || screens.bridgeWait.classList.contains('active')
            || screens.groups.classList.contains('active')
            || screens.dalgona.classList.contains('active')
            || screens.marbles.classList.contains('active')
            || screens.marblesWait.classList.contains('active');
        const isEliminated = screens.eliminated.classList.contains('active');

        if (!onGameScreen && !isEliminated) {
            if (currentGameType === 'bridge') {
                showScreen('bridgeWait');
            } else if (currentGameType === 'groups') {
                // Groups screen shown by groupTarget event
            } else if (currentGameType === 'dalgona') {
                elements.dalgonaScore.textContent = '0/12';
                showScreen('dalgona');
            } else if (currentGameType === 'marbles') {
                showScreen('marblesWait');
            } else {
                elements.gameName.textContent = data.currentGame || 'Mini-jeu';
                showScreen('game');
                updateLightUI();
            }
        }
    }

    // Retour au lobby entre les manches
    if (data.gamePhase === 'LOBBY') {
        showScreen('lobby');
        currentGameType = null;
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
socket.on('player:finished', () => {
    elements.tapHint.textContent = 'En sécurité';
    elements.tapHint.className = 'tap-hint go';
});

// ─── Corde : Assignation d'équipe ────────────────────────────
socket.on('game:teamAssign', (data) => {
    elements.gameName.textContent = `Jeu de la Corde — Équipe ${data.team}`;
    elements.tapHint.textContent = 'Tape le plus vite possible !';
    elements.tapHint.className = 'tap-hint go';
    showScreen('game');
});

// ─── Pont de Verre ───────────────────────────────────────────
socket.on('game:choosePanel', (data) => {
    elements.bridgeStepNum.textContent = data.step;
    elements.bridgeTotal.textContent = data.totalSteps;
    elements.bridgeTimer.textContent = data.timeLimit + 's';
    showScreen('bridge');

    // Timer countdown
    let time = data.timeLimit;
    const interval = setInterval(() => {
        time--;
        if (time > 0) {
            elements.bridgeTimer.textContent = time + 's';
        } else {
            clearInterval(interval);
        }
    }, 1000);
});

socket.on('game:bridgeTurn', (data) => {
    if (screens.bridge.classList.contains('active')) return; // C'est mon tour
    elements.bridgeCurrentPlayer.textContent = `C'est le tour de ${data.playerName}`;
    if (!screens.eliminated.classList.contains('active')) {
        showScreen('bridgeWait');
    }
});

socket.on('game:bridgeResult', (data) => {
    if (data.result === 'safe') {
        showScreen('bridgeWait');
        elements.bridgeCurrentPlayer.textContent = 'En sécurité !';
    }
});

elements.btnLeft.addEventListener('click', () => {
    socket.emit('player:input', { type: 'choose', choice: 'left' });
    elements.btnLeft.style.borderColor = 'var(--rose)';
    elements.btnRight.disabled = true;
    elements.btnLeft.disabled = true;
});

elements.btnRight.addEventListener('click', () => {
    socket.emit('player:input', { type: 'choose', choice: 'right' });
    elements.btnRight.style.borderColor = 'var(--rose)';
    elements.btnLeft.disabled = true;
    elements.btnRight.disabled = true;
});

// ─── Jeu du Manège : Choix de groupe ─────────────────────────
socket.on('game:groupTarget', (data) => {
    elements.targetSize.textContent = data.targetSize;

    // Générer les boutons de groupe
    elements.groupsButtons.innerHTML = '';
    selectedGroup = null;
    for (let i = 1; i <= data.numGroups; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-group';
        btn.innerHTML = `${i}<span class="group-count">0 joueurs</span>`;
        btn.addEventListener('click', () => {
            selectedGroup = i;
            socket.emit('player:input', { type: 'chooseGroup', groupId: i });
            // Highlight selected
            document.querySelectorAll('.btn-group').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        elements.groupsButtons.appendChild(btn);
    }

    elements.groupsTimer.textContent = data.timeLimit + 's';
    showScreen('groups');

    // Timer
    let time = data.timeLimit;
    const interval = setInterval(() => {
        time--;
        if (time > 0) {
            elements.groupsTimer.textContent = time + 's';
        } else {
            clearInterval(interval);
        }
    }, 1000);
});

socket.on('game:groupsUpdate', (data) => {
    // Update group counts
    const buttons = elements.groupsButtons.querySelectorAll('.btn-group');
    buttons.forEach((btn, idx) => {
        const gid = idx + 1;
        const group = data.groups[gid];
        if (group) {
            btn.innerHTML = `${gid}<span class="group-count">${group.count} joueur${group.count > 1 ? 's' : ''}</span>`;
            if (gid === selectedGroup) btn.classList.add('selected');
        }
    });
});

socket.on('game:groupJoined', (data) => {
    selectedGroup = data.groupId;
});

// ─── Duel ────────────────────────────────────────────────────
socket.on('game:duelStart', (data) => {
    elements.gameName.textContent = `Duel vs ${data.opponent}`;
    elements.tapHint.textContent = 'Tape le plus vite possible !';
    elements.tapHint.className = 'tap-hint go';
    showScreen('game');
});

socket.on('game:duelScore', (data) => {
    // On pourrait afficher le score en temps réel, mais gardons la manette simple
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

// Reset de la partie
socket.on('game:reset', () => {
    window.location.reload();
});

// ─── Dalgona ─────────────────────────────────────────────────

// Tap sur le dalgona
if (elements.dalgonaTapArea) {
    elements.dalgonaTapArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        socket.emit('player:input', { type: 'tap' });
    });
    elements.dalgonaTapArea.addEventListener('mousedown', (e) => {
        socket.emit('player:input', { type: 'tap' });
    });
}

// Beat visuel
socket.on('game:beat', (data) => {
    if (elements.beatIndicator) {
        elements.beatIndicator.textContent = '🔴';
        elements.beatIndicator.style.transform = 'scale(1.5)';
        setTimeout(() => {
            elements.beatIndicator.textContent = '🔵';
            elements.beatIndicator.style.transform = 'scale(1)';
        }, 300);
    }
    if (navigator.vibrate) navigator.vibrate(50);
});

// Feedback Dalgona
socket.on('game:dalgonaFeedback', (data) => {
    if (data.result === 'good') {
        elements.dalgonaScore.textContent = `${data.score}/${data.target}`;
        elements.dalgonaHint.textContent = 'Bien !';
        elements.dalgonaHint.style.color = '#00FF85';
    } else {
        elements.dalgonaHint.textContent = `Fissure ! (${data.cracks}/${data.maxCracks})`;
        elements.dalgonaHint.style.color = '#FF3B30';
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
    setTimeout(() => {
        elements.dalgonaHint.textContent = 'Tape en rythme !';
        elements.dalgonaHint.style.color = '';
    }, 600);
});

// ─── Billes ──────────────────────────────────────────────────

socket.on('game:marblesChoose', (data) => {
    elements.marblesOpponent.textContent = `vs ${data.opponent}`;
    elements.marblesTimer.textContent = data.timeLimit + 's';
    showScreen('marbles');

    let time = data.timeLimit;
    const interval = setInterval(() => {
        time--;
        if (time > 0) {
            elements.marblesTimer.textContent = time + 's';
        } else {
            clearInterval(interval);
        }
    }, 1000);
});

if (elements.btnPair) {
    elements.btnPair.addEventListener('click', () => {
        socket.emit('player:input', { type: 'chooseParity', choice: 'pair' });
    });
}

if (elements.btnImpair) {
    elements.btnImpair.addEventListener('click', () => {
        socket.emit('player:input', { type: 'chooseParity', choice: 'impair' });
    });
}

socket.on('game:marblesChosen', (data) => {
    showScreen('marblesWait');
    elements.marblesWaitText.textContent = `Tu as choisi : ${data.choice}`;
});

socket.on('game:marblesResult', (data) => {
    elements.marblesWaitText.textContent = `Nombre tiré : ${data.drawnNumber} (${data.correct})`;
});

socket.on('game:marblesMatch', (data) => {
    if (!screens.marbles.classList.contains('active') && !screens.marblesWait.classList.contains('active')) {
        elements.marblesWaitText.textContent = `${data.playerA.name} vs ${data.playerB.name}`;
        showScreen('marblesWait');
    }
});
