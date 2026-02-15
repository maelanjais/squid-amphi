/**
 * Squid Amphi — Simulateur de joueurs (bots)
 * 
 * Usage :  node test-bots.js [nombre_de_bots] [url]
 * Exemples :
 *   node test-bots.js 30
 *   node test-bots.js 10 https://squid-amphi.onrender.com
 */

const { io } = require('socket.io-client');

const NUM_BOTS = parseInt(process.argv[2]) || 30;
const SERVER_URL = process.argv[3] || 'http://localhost:3000';

const NOMS = [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Edgar', 'Fiona', 'Gaston', 'Hélène',
    'Igor', 'Julie', 'Kevin', 'Laura', 'Michel', 'Nadia', 'Oscar', 'Paula',
    'Quentin', 'Rosa', 'Simon', 'Tina', 'Ugo', 'Valérie', 'William', 'Xena',
    'Yann', 'Zoé', 'Antoine', 'Béa', 'Cyril', 'Daphné', 'Émile', 'Flora',
    'Gilles', 'Hanna', 'Ivan', 'Jade', 'Karl', 'Léa', 'Marco', 'Nina',
    'Olivier', 'Pauline', 'Raphaël', 'Sarah', 'Théo', 'Uma', 'Victor', 'Wendy'
];

const bots = [];

console.log(`\n🤖 Connexion de ${NUM_BOTS} bots à ${SERVER_URL}...\n`);

for (let i = 0; i < NUM_BOTS; i++) {
    const name = i < NOMS.length ? NOMS[i] : `Bot${i + 1}`;
    const socket = io(SERVER_URL);

    socket.on('connect', () => {
        socket.emit('player:join', { username: name });
        console.log(`  ✅ ${name} connecté`);
    });

    socket.on('player:joined', () => {
        // Bot rejoint avec succès
    });

    socket.on('player:eliminated', () => {
        console.log(`  ✕ ${name} éliminé`);
    });

    // Simuler des taps aléatoires pendant le jeu
    socket.on('player:state', (data) => {
        if (data.gamePhase === 'PLAYING') {
            // Taper aléatoirement (pas trop vite, pas trop lent)
            const delay = 200 + Math.random() * 800;
            setTimeout(() => {
                socket.emit('player:input', { type: 'tap' });
            }, delay);
        }
    });

    // Répondre aux choix (pont de verre, billes, groupes)
    socket.on('game:choosePanel', () => {
        const choice = Math.random() > 0.5 ? 'left' : 'right';
        setTimeout(() => {
            socket.emit('player:input', { type: 'choosePanel', choice });
        }, 500 + Math.random() * 2000);
    });

    socket.on('game:marblesChoose', () => {
        const choice = Math.random() > 0.5 ? 'pair' : 'impair';
        setTimeout(() => {
            socket.emit('player:input', { type: 'chooseParity', choice });
        }, 500 + Math.random() * 2000);
    });

    socket.on('game:groupTarget', (data) => {
        const group = Math.floor(Math.random() * data.numGroups) + 1;
        setTimeout(() => {
            socket.emit('player:input', { type: 'chooseGroup', group });
        }, 500 + Math.random() * 3000);
    });

    socket.on('game:reset', () => {
        socket.disconnect();
    });

    socket.on('disconnect', () => {
        console.log(`  🔌 ${name} déconnecté`);
    });

    bots.push(socket);
}

console.log(`\n⏳ Les bots vont rejoindre en quelques secondes...`);
console.log(`📺 Ouvre l'écran display et clique "Lancer" quand tu es prêt`);
console.log(`\n   Ctrl+C pour déconnecter tous les bots\n`);

// Déconnecter proprement les bots quand on quitte
process.on('SIGINT', () => {
    console.log('\n🛑 Déconnexion des bots...');
    bots.forEach(s => s.disconnect());
    setTimeout(() => process.exit(0), 500);
});
