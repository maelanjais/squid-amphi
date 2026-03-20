# 🦑 Squid Amphi

**50 JOUEURS. 1 SEUL SURVIVANT.**

Squid Amphi est un jeu multijoueur inspiré de Squid Game, conçu pour être joué dans un amphithéâtre avec jusqu'à 50 personnes en simultané. Le grand écran de l'amphi affiche l'arène de jeu, et chaque joueur utilise son téléphone comme manette.

> **TP4A-G2** : JAHIER Maëlan, GRILLOT Thomas, SALLE-PIERRET Maxence

## 🎮 Comment jouer ?

### Grand Écran (Projecteur)
1. Lancer le serveur : `npm start`
2. Ouvrir `http://localhost:3000/` sur le PC connecté au projecteur
3. Le lobby s'affiche avec un QR code

### Téléphone (Manette)
1. Scanner le QR code ou aller sur l'URL affichée (`/play`)
2. Entrer un pseudo et rejoindre
3. Utiliser les contrôles tactiles :
   - **Toucher** = courir
   - **Glisser** = diriger
   - **Lâcher** = s'arrêter

### Lancer la partie
- Appuyer sur **COMMENCER LE JEU** sur le grand écran (ou touche Entrée)
- Les 6 épreuves se lancent les unes après les autres

## 🏆 Les 6 Épreuves

| # | Épreuve | Contrôle | Description |
|---|---------|----------|-------------|
| 1 | 🚦 1, 2, 3 Soleil | Toucher/Lâcher + Glisser | Courir vers la ligne. Stop au feu rouge ! |
| 2 | 🪢 Jeu de la Corde | Tap rapide | 2 équipes, tapez vite pour tirer ! |
| 3 | 🎠 Jeu du Manège | Joystick | Formez des groupes du bon nombre |
| 4 | 🌙 Bataille du Dortoir | Joystick + Attaque | Combat dans le noir, 3 PV |
| 5 | 🌉 Pont de Verre | Gauche/Droite | Choisissez la bonne dalle ! |
| 6 | ⚔️ Duel Final | Swipe | Poussez les adversaires hors du cercle |

## 🛠️ Installation

```bash
# Cloner le projet
git clone https://git.iut-orsay.fr/mjahier/saes4.git
cd saes4

# Installer les dépendances
npm install

# Lancer le serveur
npm start
# ou en mode développement (avec rechargement auto)
npm run dev
```

Le serveur démarre sur le **port 3000** par défaut.

## 📁 Structure du projet

```
saes4/
├── server/
│   ├── index.js              # Serveur Express + Socket.IO
│   ├── GameManager.js         # Gestion du jeu (lobby, transitions)
│   ├── Player.js              # Entité joueur
│   └── games/                 # Les 6 mini-jeux
│       ├── RedLightGreenLight.js
│       ├── TugOfWar.js
│       ├── GroupGame.js
│       ├── NightFight.js
│       ├── GlassBridge.js
│       └── FinalDuel.js
├── public/
│   ├── display/               # Grand écran (Canvas 2D)
│   │   ├── index.html
│   │   ├── display.js
│   │   └── renderer.js
│   ├── controller/            # Téléphone-manette
│   │   ├── index.html
│   │   └── controller.js
│   └── css/
│       ├── display.css
│       └── controller.css
└── package.json
```

## 🔧 Technologies

- **Backend** : Node.js, Express, Socket.IO
- **Frontend** : HTML5 Canvas, Vanilla JavaScript, CSS3
- **QR Code** : `qrcode` (npm)
- **Contrôles** : Touch Events API, Vibration API

## ⌨️ Raccourcis Admin (Grand Écran)

| Touche | Action |
|--------|--------|
| `Entrée` / `Espace` | Démarrer la partie |
| `S` | Passer l'épreuve en cours |
