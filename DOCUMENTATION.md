# 📖 DOCUMENTATION TECHNIQUE — SQUID AMPHI

> **Dernière mise à jour** : 31 mars 2026
> **Auteurs** : JAHIER Maëlan, GRILLOT Thomas, SALLE-PIERRET Maxence (TP4A-G2)

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Stack technique](#2-stack-technique)
3. [Architecture générale](#3-architecture-générale)
4. [Structure des fichiers](#4-structure-des-fichiers)
5. [Backend — Serveur Node.js](#5-backend--serveur-nodejs)
6. [Protocole WebSocket (Socket.IO)](#6-protocole-websocket-socketio)
7. [Game Loop & Phases de jeu](#7-game-loop--phases-de-jeu)
8. [Le système de joueurs (Player)](#8-le-système-de-joueurs-player)
9. [Les 7 mini-jeux](#9-les-7-mini-jeux)
10. [Frontend — Grand Écran (Display)](#10-frontend--grand-écran-display)
11. [Frontend — Manette (Controller)](#11-frontend--manette-controller)
12. [Le moteur de rendu Canvas 2D](#12-le-moteur-de-rendu-canvas-2d)
13. [APIs Web utilisées](#13-apis-web-utilisées)
14. [Simulateur de bots](#14-simulateur-de-bots)
15. [Bots intégrés côté serveur](#15-bots-intégrés-côté-serveur)
16. [Déploiement sur Render](#16-déploiement-sur-render)
17. [Glossaire](#17-glossaire)

---

## 1. Vue d'ensemble du projet

### Concept

**Squid Amphi** est un jeu multijoueur en temps réel inspiré de la série *Squid Game*, conçu pour être joué dans un amphithéâtre avec jusqu'à **100 joueurs simultanés**. Le principe est simple :

- Un **grand écran** (projecteur de l'amphi) affiche l'arène de jeu
- Chaque joueur utilise son **téléphone portable** comme manette de jeu
- Les joueurs se connectent en scannant un **QR code** ou en entrant une URL
- Les joueurs s'affrontent à travers **7 mini-jeux** éliminatoires
- **Un seul joueur survit** à la fin

### Flux de jeu

```
Lobby (QR Code + connexion)
  → Explication du jeu (10s)
    → Compte à rebours (4s)
      → Partie en cours
        → Transition (éliminations affichées)
          → Prochain jeu... ou Game Over (1 survivant)
```

---

## 2. Stack technique

### Backend

| Technologie | Version | Rôle |
|------------|---------|------|
| **Node.js** | ≥ 18 | Runtime JavaScript côté serveur. Exécute toute la logique du jeu. |
| **Express** | ^4.21.0 | Framework web minimaliste. Sert les fichiers statiques et gère les routes HTTP. |
| **Socket.IO** | ^4.7.5 | Bibliothèque de communication temps réel via WebSockets. Gère toutes les interactions joueur ↔ serveur à 30 FPS. |
| **qrcode** | ^1.5.4 | Génère des QR codes en data URL pour que les joueurs puissent rejoindre facilement. |

### Frontend

| Technologie | Rôle |
|------------|------|
| **HTML5** | Structure des pages (display + controller) |
| **CSS3** | Mise en forme, animations, responsive design |
| **JavaScript Vanilla** | Toute la logique côté client, sans framework |
| **Canvas 2D** | Rendu graphique de l'arène de jeu sur le grand écran |
| **Socket.IO Client** | Communication temps réel avec le serveur |

### APIs Web natives

| API | Rôle |
|-----|------|
| **Touch Events API** | Gestion des contrôles tactiles sur mobile (joystick, tap, swipe) |
| **Vibration API** | Retour haptique sur le téléphone (élimination, taps) |
| **WakeLock API** | Empêche l'écran du téléphone de se mettre en veille pendant le jeu |
| **Canvas 2D API** | Rendu graphique 2D pour l'affichage du jeu |

### Outils de développement

| Outil | Rôle |
|-------|------|
| **nodemon** | Rechargement automatique du serveur en développement (`npm run dev`) |
| **npm** | Gestionnaire de paquets Node.js |

---

## 3. Architecture générale

### Modèle client-serveur

```
┌──────────────────────────────────────────────────────────────┐
│                     SERVEUR NODE.JS                          │
│                                                              │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Express   │  │ GameManager  │  │   Mini-jeux (×7)    │   │
│  │ (HTTP +    │  │ (Game Loop   │  │  RedLightGreenLight │   │
│  │  fichiers  │  │  30 FPS,     │  │  TugOfWar           │   │
│  │  statiques)│  │  phases,     │  │  GroupGame           │   │
│  │           │  │  transitions)│  │  NightFight          │   │
│  └─────┬─────┘  └──────┬───────┘  │  GlassBridge         │   │
│        │               │          │  FinalDuel            │   │
│        │         ┌──────┴───────┐  │  Dalgona             │   │
│        │         │  Socket.IO   │  └─────────────────────┘   │
│        │         │  Server      │                            │
│        │         └──────┬───────┘                            │
└────────┼────────────────┼────────────────────────────────────┘
         │                │
    HTTP (pages,     WebSocket (temps réel,
    QR code API)     30 messages/sec)
         │                │
    ┌────┴────┐     ┌─────┴──────────────────────────┐
    │         │     │                                │
┌───▼───┐ ┌──▼──┐  │  ┌─────────┐  ┌─────────┐     │
│Display│ │/play│  │  │Manette 1│  │Manette 2│ ... │
│(écran)│ │route│  │  │(phone)  │  │(phone)  │     │
└───────┘ └─────┘  │  └─────────┘  └─────────┘     │
                   └────────────────────────────────┘
```

### Flux de données

1. **Joueur → Serveur** : Le téléphone envoie des `player-input` (mouvement, tap, choix, swipe) via Socket.IO
2. **Serveur → Traitement** : Le `GameManager` traite les inputs dans sa game loop à 30 FPS
3. **Serveur → Display** : Le serveur envoie l'état complet du jeu (`game-state`) au grand écran
4. **Serveur → Controller** : Le serveur envoie un état minimal (`controller-state`) à chaque téléphone

---

## 4. Structure des fichiers

```
squid-amphi/
├── server/                          # Code serveur (backend)
│   ├── index.js                     # Point d'entrée : Express + Socket.IO + routes
│   ├── GameManager.js               # Chef d'orchestre : phases, transitions, game loop
│   ├── Player.js                    # Entité joueur : position, input, physique
│   ├── BotPlayer.js                 # Joueur bot avec IA intégrée côté serveur
│   └── games/                       # Les 7 mini-jeux
│       ├── RedLightGreenLight.js    # 1, 2, 3 Soleil
│       ├── TugOfWar.js             # Jeu de la Corde
│       ├── GroupGame.js            # Jeu du Manège
│       ├── NightFight.js           # Bataille du Dortoir
│       ├── GlassBridge.js          # Pont de Verre
│       ├── FinalDuel.js            # Duel Final
│       └── Dalgona.js              # Sablé Dalgona
│
├── public/                          # Fichiers statiques (frontend)
│   ├── display/                     # Grand écran (projecteur)
│   │   ├── index.html              # Page HTML du display
│   │   ├── display.js              # Client Socket.IO + gestion des écrans
│   │   └── renderer.js             # Moteur de rendu Canvas 2D
│   ├── controller/                  # Manette téléphone
│   │   ├── index.html              # Page HTML du controller
│   │   └── controller.js           # Contrôles tactiles + Socket.IO
│   └── css/
│       ├── display.css             # Styles du grand écran
│       └── controller.css          # Styles de la manette mobile
│
├── simulate-players.js              # Script de simulation avec bots externes (dev local)
├── package.json                     # Dépendances et scripts npm
└── README.md                       # Guide rapide
```

---

## 5. Backend — Serveur Node.js

### 5.1. Point d'entrée (`server/index.js`)

Le fichier `index.js` est le point d'entrée de l'application. Il :

1. **Crée le serveur Express** et configure le proxy trust (nécessaire pour Render/Railway qui utilisent un reverse proxy HTTPS)
2. **Initialise Socket.IO** avec CORS ouvert (`origin: '*'`) et des paramètres de heartbeat (`pingInterval: 10000ms`, `pingTimeout: 5000ms`)
3. **Sert les fichiers statiques** depuis le dossier `public/`
4. **Définit les routes HTTP** :
   - `GET /` → sert la page du grand écran (`display/index.html`)
   - `GET /play` → sert la page de la manette (`controller/index.html`)
   - `GET /api/qr?url=...` → génère un QR code en data URL (PNG base64) via la lib `qrcode`
5. **Instancie le `GameManager`** qui prend le contrôle de toute la logique de jeu
6. **Écoute les connexions Socket.IO** et les redirige vers `gameManager.handleConnection(socket)`

```javascript
const PORT = process.env.PORT || 3000;
```
Le port est configurable via variable d'environnement (utilisé par Render).

### 5.2. GameManager (`server/GameManager.js`)

C'est le **cœur du jeu**. Il gère :

#### Phases de jeu

```javascript
const PHASE = {
  LOBBY: 'lobby',           // En attente de joueurs
  EXPLANATION: 'explanation', // Explication du prochain jeu (10s)
  COUNTDOWN: 'countdown',    // Compte à rebours (4s)
  PLAYING: 'playing',        // Jeu en cours
  ELIMINATION: 'elimination', // Phase d'élimination
  TRANSITION: 'transition',   // Écran de transition (5s)
  GAME_OVER: 'gameover'       // Fin de la partie
};
```

#### Gestion des joueurs

- `this.players` : `Map<socketId, Player>` — stocke tous les joueurs connectés
- `this.playerCounter` : compteur incrémental pour numéroter les joueurs (1 à 100)
- `addPlayer(socket, name)` : vérifie que le lobby est ouvert et pas plein, crée un `Player`, le positionne aléatoirement, notifie tout le monde

#### File de mini-jeux

Le système de sélection des jeux est sophistiqué :

1. **1er jeu** : toujours `RedLightGreenLight` (classique de Squid Game)
2. **2ème jeu** : toujours `GroupGame` (forcé en position 2)
3. **Jeux suivants** : piochés aléatoirement (Fisher-Yates shuffle) depuis le pool `['Dalgona', 'TugOfWar', 'NightFight', 'GlassBridge']` avec des **contraintes** :
   - `TugOfWar` nécessite ≥ 4 joueurs vivants
   - `GroupGame` nécessite ≥ 6 joueurs vivants
   - `GlassBridge` nécessite ≤ 20 joueurs vivants
4. **Dernier jeu** : `FinalDuel` quand il ne reste plus de jeux dans le pool ou ≤ 2 joueurs

#### Game Loop (30 FPS)

```javascript
this.loopInterval = setInterval(() => this.gameLoop(), 1000 / 30);
```

La boucle de jeu s'exécute **33ms** par tick et gère :

1. **Phase EXPLANATION** : décompte de 10s, puis passage au countdown
2. **Phase COUNTDOWN** : décompte de 4s, puis `currentGame.start()` et passage à PLAYING
3. **Phase PLAYING** : appelle `currentGame.update(dt, alivePlayers)`, traite les éliminations, vérifie les conditions de fin
4. **Phase TRANSITION** : décompte de 5s, puis lance le prochain jeu
5. **Mise à jour physique** : appelle `player.update(dt, bounds)` pour chaque joueur vivant
6. **Broadcast** : envoie l'état à tous les clients via `broadcastState()`

#### Événements Socket.IO gérés

| Événement | Direction | Description |
|-----------|-----------|-------------|
| `register-display` | Client → Serveur | Le client rejoint le room `displays` |
| `register-player` | Client → Serveur | Inscription d'un joueur avec pseudo |
| `player-input` | Client → Serveur | Input de gameplay (mouvement, tap, etc.) |
| `admin-start` | Client → Serveur | Démarre la partie (lobby → 1er jeu) |
| `admin-skip` | Client → Serveur | Passe l'épreuve en cours |
| `admin-reset` | Client → Serveur | Réinitialise complètement la partie |
| `admin-add-bots` | Client → Serveur | Ajoute N bots côté serveur |

### 5.3. Player (`server/Player.js`)

Représente un joueur dans le jeu :

#### Propriétés

| Propriété | Type | Description |
|-----------|------|-------------|
| `id` | string | Socket ID (identifiant unique) |
| `name` | string | Pseudo du joueur |
| `number` | number | Numéro d'inscription (1-100) |
| `x`, `y` | number | Position dans l'arène (pixels) |
| `vx`, `vy` | number | Vélocité actuelle |
| `speed` | number | Vitesse de déplacement (200 px/s par défaut) |
| `radius` | number | Rayon de collision (16 px) |
| `color` | string | Couleur HSL aléatoire |
| `alive` | boolean | Statut vivant/éliminé |
| `moving` | boolean | En mouvement ou non |
| `direction` | `{x, y}` | Vecteur direction normalisé |
| `team` | number | Équipe (pour TugOfWar) |
| `input` | object | Dernier input reçu du controller |
| `locating` | boolean | Le joueur utilise "Me trouver" |

#### Méthode `update(dt, bounds)`

1. Gère le timer de localisation
2. Calcule la vélocité selon `moving` et `direction`
3. Met à jour la position : `x += vx × dt`, `y += vy × dt`
4. **Clampe** la position dans les limites de l'arène (0 à 1920 × 1080)

#### Méthode `processInput(data)`

Traite les différents types d'input :
- `move` : met à jour `moving` et `direction` (normalise le vecteur)
- `locate` : active le mode localisation (2 secondes)
- `tap` : marque `input.tap = true` (consommé par les jeux)
- `choice` : stocke le choix `'left'` ou `'right'`
- `swipe` : stocke `swipeX` et `swipeY`

---

## 6. Protocole WebSocket (Socket.IO)

### 6.1. Événements Client → Serveur

```
register-display          → {}
register-player           → { name: string }
player-input              → { type: 'move'|'tap'|'choice'|'swipe'|'locate', ... }
admin-start               → {}
admin-skip                → {}
admin-reset               → {}
admin-add-bots            → { count: number }
```

### 6.2. Événements Serveur → Client

```
phase                     → { phase: string, currentGame?: { name, index, total } }
player-list               → [{ name, number, color, alive }]
game-state (→ displays)   → { phase, players[], currentGame, alivePlayers, totalPlayers, ... }
controller-state (→ each) → { phase, alive, number, currentGame, countdown, gameState }
registered (→ player)     → { id, number, name, color }
eliminated (→ player)     → { game: string }
error (→ player)          → { message: string }
```

### 6.3. Format de `game-state` (détaillé)

```javascript
{
  phase: 'playing',
  players: [
    { id, name, number, x, y, alive, moving, direction, color, team, score, locating }
  ],
  explanation: 10,        // timer d'explication (secondes)
  countdown: 4,           // timer de countdown
  transition: 5,          // timer de transition
  currentGame: {
    name: '1, 2, 3… Soleil !',
    rules: { description: '...', controls: '...' },
    index: 0,             // index dans la file de jeux
    total: 7,             // nombre total de jeux prévus
    state: { ... }        // état spécifique au mini-jeu
  },
  alivePlayers: 42,
  totalPlayers: 50,
  eliminatedThisRound: 8
}
```

---

## 7. Game Loop & Phases de jeu

### Diagramme des transitions

```
    ┌─────────┐
    │  LOBBY  │ ←──── admin-reset
    └────┬────┘
         │ admin-start (≥1 joueur)
    ┌────▼──────────┐
    │  EXPLANATION   │ ← 10 secondes d'explication
    │  (règles/ctrl) │
    └────┬──────────┘
         │ timer = 0
    ┌────▼──────────┐
    │   COUNTDOWN    │ ← 4 secondes de décompte
    └────┬──────────┘
         │ timer = 0 → game.start()
    ┌────▼──────────┐
    │    PLAYING     │ ← game.update() à 30 FPS
    │                │   Éliminations en temps réel
    └────┬──────────┘
         │ game.isFinished() || prematureEnd
    ┌────▼──────────┐
    │  TRANSITION    │ ← 5 secondes (résumé des éliminations)
    └────┬──────────┘
         │ timer = 0
         │
    ┌────▼──────┐     ┌───────────┐
    │ Joueurs   │ OUI │ GAME_OVER │
    │ ≤ 1 ?     ├────►│ (Victoire)│
    └────┬──────┘     └───────────┘
         │ NON
         │
    (retour à EXPLANATION pour le prochain jeu)
```

### Le delta time (dt)

Chaque tick de la game loop calcule le **delta time** :
```javascript
const dt = (Date.now() - this.lastUpdate) / 1000; // en secondes
```
Cela garantit que le jeu tourne à la même vitesse indépendamment des variations de FPS.

---

## 8. Le système de joueurs (Player)

### Modèle physique

Le déplacement utilise un modèle simple :
- **Vitesse** : `speed` pixels/seconde (varie selon le jeu : 150-220)
- **Direction** : vecteur unitaire `{x, y}` normalisé à partir de l'input du joystick
- **Vélocité** : `vx = direction.x × speed` quand `moving = true`, sinon `0`
- **Position** : intégration d'Euler `pos += vel × dt`
- **Collision avec les bords** : clamping simple dans `[radius, width-radius]` × `[radius, height-radius]`

### Couleur

Chaque joueur reçoit une couleur HSL aléatoire :
```javascript
const hue = Math.random() * 360;
return `hsl(${Math.floor(hue)}, 70%, 55%)`;
```
Saturation 70% et luminosité 55% garantissent des couleurs vives et distinctes.

### Sérialisation réseau (`toJSON`)

Seules les données nécessaires au rendu sont envoyées. Les positions sont arrondies (`Math.round`) pour réduire la bande passante.

---

## 9. Les 7 mini-jeux

Chaque mini-jeu implémente l'interface suivante :

```javascript
class MiniGame {
  constructor(arenaWidth, arenaHeight)  // Initialisation
  setup(players)                        // Placement des joueurs
  start(players)                        // Démarrage du jeu
  update(dt, players) → { eliminated }  // Mise à jour (30 FPS)
  isFinished() → boolean               // Le jeu est-il terminé ?
  getState() → object                  // État pour le display
  getControllerState(player) → object  // État pour chaque manette
}
```

---

### 9.1. 🚦 1, 2, 3 Soleil ! (`RedLightGreenLight.js`)

**Concept** : Les joueurs doivent traverser l'arène du bas vers le haut. Quand le feu est rouge, tout mouvement = élimination.

**Paramètres** :
- Ligne d'arrivée : `y = 100`
- Départ : `y = arenaHeight - 80`
- Durée totale : 90 secondes
- Vitesse joueur : 180 px/s
- Durée feu vert : 2 à 5 secondes (aléatoire)
- Durée feu rouge : 3 secondes
- Avertissement : 1.5s avant le rouge (feu orange)

**Cycle vert/rouge** :
```
FEU VERT (2-5s) → AVERTISSEMENT (1.5s avant la fin) → FEU ROUGE (3s) → FEU VERT...
```

**Élimination** :
- `player.moving === true` pendant le feu rouge
- Ne pas avoir franchi la ligne à la fin du temps

**Controller** : Retourne `controls: 'move'`, plus `greenLight`, `warning`, `crossed`, `progress` (0-100%).

---

### 9.2. 🪢 Jeu de la Corde (`TugOfWar.js`)

**Concept** : Les joueurs sont divisés en 2 équipes. Ils tapent le plus vite possible pour tirer la corde.

**Paramètres** :
- Durée : 20 secondes
- `ropePosition` : -100 à +100 (0 = centre)
- Seuil de victoire : `|ropePosition| >= 100`
- Force par tap : 3 unités
- Decay vers le centre : 2 unités/s

**Mécanique** :
1. Joueurs mélangés aléatoirement et divisés en deux
2. Chaque tap d'un joueur déplace la corde de 3 unités vers son équipe
3. La corde tend à revenir au centre (decay)
4. L'équipe perdante est **intégralement éliminée**

**Controller** : Retourne `controls: 'tap'`, plus `team`, `ropePosition`, `timer`.

---

### 9.3. 🎠 Jeu du Manège (`GroupGame.js`)

**Concept** : Un nombre est annoncé. Les joueurs doivent se regrouper physiquement dans l'arène en groupes de ce nombre exact.

**Paramètres** :
- 3 manches
- Nombre cible : 2, 3, 4, ou 5 (aléatoire par manche)
- Temps de formation : 15 secondes
- Rayon de groupe : 60 pixels
- Vitesse joueur : 220 px/s

**Algorithme de groupes** (BFS) :
1. Pour chaque joueur non visité, lance un BFS
2. Explore les joueurs voisins dans un rayon de 60px
3. Forme un cluster = un groupe
4. Un groupe est **valide** si sa taille == `targetNumber`

**Élimination** : Les joueurs qui ne font pas partie d'un groupe valide à la fin du timer.

**Controller** : Retourne `controls: 'move'`, plus `targetNumber`, `phase`, `timer`.

---

### 9.4. 🌙 Bataille du Dortoir (`NightFight.js`)

**Concept** : Combat dans le noir. Les joueurs se déplacent et attaquent les autres. Chaque joueur a 3 PV.

**Paramètres** :
- Durée : 30 secondes
- Points de vie : 3 (maxHP)
- Portée d'attaque : 60 pixels
- Cooldown d'attaque : 0.5 seconde
- Vitesse joueur : 150 px/s

**Mécanique** :
1. L'écran est presque entièrement noir (overlay 85% opacité)
2. Les attaques créent des **flash lumineux** brefs (0.3s) qui révèlent la zone
3. Une attaque touche le joueur le plus proche dans le rayon de 60px
4. Chaque touche retire 1 PV
5. 0 PV = éliminé

**Controller** : Retourne `controls: 'tap-and-move'`, plus `timer`, `hp`, `maxHP`.

---

### 9.5. 🌉 Pont de Verre (`GlassBridge.js`)

**Concept** : Les joueurs traversent un pont de dalles de verre. À chaque étape, ils choisissent gauche ou droite. Un côté est solide, l'autre se brise.

**Paramètres** :
- 8 étapes (paires de dalles)
- Timer par choix : 8 secondes
- Joueurs passent par batches de 3
- Ordre aléatoire

**Mécanique** :
1. Les dalles `safe` (gauche ou droite) sont générées aléatoirement à la création
2. Les joueurs passent par groupes de 3
3. Bon choix → avance à l'étape suivante
4. Mauvais choix → éliminé
5. Timeout → éliminé
6. Les dalles déjà révélées par un joueur précédent sont **visibles** pour les suivants (stratégie !)

**Controller** : Retourne `controls: 'choice'`, plus `step`, `totalSteps`, `choosing`, `timer`, `finished`.

---

### 9.6. ⚔️ Duel Final (`FinalDuel.js`)

**Concept** : Les derniers survivants s'affrontent dans un cercle qui rétrécit. Objectif : pousser les autres hors du cercle.

**Paramètres** :
- Rayon initial : 400 px → minimum 80 px
- Vitesse de rétrécissement : 5 px/s
- Durée : 60 secondes
- Force de poussée : 300 unités
- Friction : 3 (ralentissement)
- Vitesse joueur : 160 px/s

**Mécanique** :
1. Les joueurs sont placés en cercle
2. **Swipe** : pousse les joueurs proches (< 80px) dans la direction du swipe
3. **Recul** : le pousseur subit 30% de la force en sens inverse
4. **Collisions** : les joueurs ne peuvent pas se traverser (séparation physique)
5. **Friction** : la vélocité diminue de `(1 - friction × dt)` par frame
6. **Hors du cercle** = éliminé

**Physique des collisions** :
```javascript
// Séparation quand deux joueurs se chevauchent
const overlap = minDist - dist;
p1.x -= nx * (overlap / 2);
p2.x += nx * (overlap / 2);
// + amortissement de la vélocité (×0.8)
```

**Controller** : Retourne `controls: 'swipe-and-move'`, plus `timer`, `circleRadius`.

---

### 9.7. 🍪 Sablé Dalgona (`Dalgona.js`)

**Concept** : Tapotez pour découper une forme dans le sablé. Attention à ne pas trop appuyer (tension) sinon il se brise !

**Paramètres** :
- Durée : 40 secondes
- Progression max : 100
- Tension max : 100
- Progression par tap : +2
- Tension par tap : +15
- Décroissance tension : 30/seconde

**Mécanique** :
1. Chaque tap augmente la **progression** de 2 et la **tension** de 15
2. La tension diminue naturellement à 30/s (il faut doser !)
3. Tension > 100 → le sablé se brise → éliminé
4. Progression ≥ 100 → forme découpée → sauvé
5. Timeout sans finir → éliminé

**Stratégie optimale** : Taper rapidement quand la tension est basse, s'arrêter quand elle monte, reprendre quand elle redescend.

**Controller** : Retourne `controls: 'tap'`, plus `timer`, `hp` (tension inversée), `maxHP`.

---

## 10. Frontend — Grand Écran (Display)

### Structure HTML

Le display est composé de **6 écrans superposés** (un seul visible à la fois) :

| Écran | ID | Phase |
|-------|----|-------|
| Lobby | `lobby-screen` | `LOBBY` |
| Explication | `explanation-screen` | `EXPLANATION` |
| Compte à rebours | `countdown-screen` | `COUNTDOWN` |
| Jeu (Canvas) | `game-screen` | `PLAYING` |
| Transition | `transition-screen` | `TRANSITION` |
| Game Over | `gameover-screen` | `GAME_OVER` |

Chaque écran a la classe CSS `.screen` et seul celui avec `.active` est affiché.

### Lobby

Le lobby affiche :
- Le **titre** avec les formes Squid Game (cercle, triangle, carré)
- Le **QR code** (généré via `/api/qr`)
- L'**URL de connexion** pour les joueurs
- Le **compteur de joueurs** et la **liste** des joueurs connectés
- Le bouton **"COMMENCER LE JEU"** (visible dès 1 joueur)
- Le panneau **"Ajouter des bots"** avec un input numérique

### Raccourcis clavier (admin)

| Touche | Action |
|--------|--------|
| `Entrée` / `Espace` | Démarrer la partie |
| `S` | Passer l'épreuve en cours |
| `R` | Réinitialiser la partie |

### `display.js` — Client Socket.IO

1. Se connecte au serveur et s'enregistre comme display (`emit('register-display')`)
2. Génère le QR code pour l'URL de connexion
3. Écoute `phase` pour changer d'écran
4. Écoute `player-list` pour mettre à jour la liste du lobby
5. Écoute `game-state` (30 FPS) pour :
   - Détecter les nouvelles éliminations (animations)
   - Mettre à jour le HUD (survivants, chrono, indicateurs)
   - Appeler `renderer.render(state)` pour dessiner le jeu

---

## 11. Frontend — Manette (Controller)

### Structure HTML

Le controller a **4 écrans** :

| Écran | Phase |
|-------|-------|
| `join-screen` | Saisie du pseudo |
| `waiting-screen` | En attente du début |
| `controller-screen` | Contrôles de jeu |
| `eliminated-screen` | Joueur éliminé |

### Types de contrôles

Le `controller-screen` contient **5 zones de contrôle** (une seule visible à la fois) :

| ID | Type | Jeux |
|----|------|------|
| `ctrl-move` | Joystick (touch zone) | RLGL, GroupGame |
| `ctrl-tap` | Zone de tap rapide | TugOfWar, Dalgona |
| `ctrl-tap-move` | Joystick + bouton attaque | NightFight |
| `ctrl-choice` | Boutons Gauche/Droite | GlassBridge |
| `ctrl-swipe` | Zone de swipe directionnel | FinalDuel |

### Joystick tactile

Le joystick fonctionne par Touch Events :

1. `touchstart` : enregistre la position de départ, commence le mouvement vers le haut par défaut
2. `touchmove` : calcule le delta (`dx`, `dy`) par rapport à l'origine, normalise et envoie comme direction
3. `touchend` : arrête le mouvement

Le thumb visuel est clampé à 50px max du centre.

### Bouton "Me trouver"

Envoie un `player-input` de type `locate` qui fait clignoter le joueur sur le grand écran pendant 2 secondes (cercle doré pulsant). Cooldown de 3 secondes.

### `controller.js` — Logique

1. Gère l'inscription (`register-player`) et affiche le badge numéroté
2. Écoute `phase` pour basculer entre les écrans
3. Écoute `controller-state` (30 FPS) pour :
   - Vérifier si le joueur est éliminé (`!state.alive`)
   - Afficher le bon type de contrôle (`switchControls()`)
   - Mettre à jour l'UI spécifique (indicateur vert/rouge, barre de HP, etc.)
4. Écoute `eliminated` pour afficher l'écran d'élimination avec vibration

---

## 12. Le moteur de rendu Canvas 2D

### `renderer.js`

Le renderer utilise l'API Canvas 2D pour dessiner le jeu à 30 FPS.

### Système de coordonnées

- **Arène de référence** : 1920×1080 pixels
- **Scaling** : le canvas s'adapte à la taille de la fenêtre avec `scaleX = canvas.width / 1920` et `scaleY = canvas.height / 1080`
- Toutes les positions sont en coordonnées d'arène (0-1920, 0-1080), le scaling se fait via `ctx.scale()`

### Pipeline de rendu

À chaque frame :
1. **Clear** : fond noir `#0f0f1e`
2. **Grille** : lignes roses translucides tous les 60px
3. **Éléments de jeu** : spécifique à chaque mini-jeu (appelé avant les joueurs)
4. **Joueurs** : morts d'abord (ghostly, 15% opacité), puis vivants
5. **Overlays** : NightFight (noir 85%) et Dalgona (anneaux de progression) après les joueurs
6. **Effets d'élimination** : croix rouges qui s'estompent

### Rendu d'un joueur (`drawPlayer`)

Chaque joueur est représenté par :
- Un **cercle coloré** (rayon 16px, couleur HSL unique)
- Un **contour blanc** (glow subtil)
- Le **numéro** du joueur au centre
- Le **pseudo** au-dessus
- Une **flèche directionnelle** quand le joueur bouge
- Un **anneau doré pulsant** en mode "Me trouver"
- Un **cercle externe** subtil quand le joueur est en mouvement

### Rendus spécifiques par jeu

| Jeu | Éléments visuels |
|-----|-----------------|
| RLGL | Ligne d'arrivée dorée en pointillés, feu tricolore géant (vert/orange/rouge) avec glow, timer |
| TugOfWar | Corde marron épaisse, drapeau doré, marqueur central rouge, labels d'équipes, barre de position |
| GroupGame | Nombre cible géant (160px), cercles de groupe en pointillés (vert si valide, rouge sinon), compteur de groupe |
| NightFight | Overlay noir 85%, flashs lumineux (gradients radiaux jaunes), barres de HP au-dessus des joueurs |
| GlassBridge | Dalles de verre (bleues translucides, vertes si sûres, rouges si brisées), labels DÉPART/ARRIVÉE |
| FinalDuel | Cercle d'arène rose avec fill translucide, zone de danger pulsante rouge, timer |
| Dalgona | Anneaux de progression verts, anneaux de tension (jaune→orange→rouge), timer |

### Effets d'élimination

Quand un joueur est éliminé, une animation se joue :
- Cercle rouge qui s'étend (20 → 70px)
- Croix rouge (×) au centre
- Fondu sur 1 seconde

---

## 13. APIs Web utilisées

### Touch Events API

Utilisée pour **tous les contrôles** de la manette mobile :

- `touchstart` : début du toucher → activation du contrôle
- `touchmove` : mouvement du doigt → mise à jour de la direction (joystick)
- `touchend` : fin du toucher → arrêt du contrôle
- `touchcancel` : interruption → nettoyage

**Points importants** :
- `e.preventDefault()` sur chaque handler pour empêcher le scroll/zoom/sélection
- Gestion du `touch.identifier` pour suivre le bon doigt (multi-touch)
- Le viewport HTML est configuré avec `user-scalable=no, maximum-scale=1.0`

### Vibration API

```javascript
navigator.vibrate(10);     // tap simple (10ms)
navigator.vibrate(20);     // attaque / me trouver
navigator.vibrate(30);     // choix de dalle
navigator.vibrate(15);     // swipe
navigator.vibrate([200, 100, 200, 100, 400]); // élimination (pattern dramatique)
```

Vérification de disponibilité : `if (navigator.vibrate) ...`

### WakeLock API

Empêche l'écran du téléphone de s'éteindre pendant le jeu :

```javascript
wakeLock = await navigator.wakeLock.request('screen');
```

Se réactive automatiquement quand l'onglet redevient visible (`visibilitychange`).

### Canvas 2D API

Méthodes principales utilisées :
- `fillRect`, `strokeRect`, `roundRect` — rectangles
- `arc` — cercles et arcs
- `beginPath`, `moveTo`, `lineTo`, `closePath` — tracés
- `fill`, `stroke` — remplissage et contour
- `createRadialGradient` — gradients pour les flashs
- `setLineDash` — lignes en pointillés
- `save`, `restore`, `translate`, `scale` — transformations
- `globalAlpha` — transparence
- `shadowColor`, `shadowBlur` — effets de lueur

---

## 14. Simulateur de bots (script externe)

### `simulate-players.js`

Script Node.js pour simuler des joueurs en local (développement).

**Architecture** :
1. Crée un **observer** Socket.IO qui se connecte comme display pour recevoir l'état global
2. Crée **N bots** (par défaut 100) avec connexion décalée (50ms entre chaque)
3. Chaque bot :
   - S'enregistre comme joueur avec le nom "Bot X"
   - Écoute les changements de phase
   - Lance un `setInterval(100ms)` quand le jeu commence
   - L'IA utilise le `globalState` (état observé) et le `ctrlState` (état controller) pour décider de ses actions

**IA par jeu** :
- **RLGL** : avance au feu vert, s'arrête au rouge (avec 0.5% d'erreur), hésite pendant le warning (40% de chance de bouger)
- **TugOfWar** : tape 40% du temps
- **GroupGame** : se dirige vers les groupes incomplets (BFS simple basé sur les positions)
- **NightFight** : cherche l'ennemi le plus proche, attaque à < 60px (5% par tick), se déplace aléatoirement sinon
- **GlassBridge** : attend presque la fin du timer puis choisit aléatoirement (50/50)
- **FinalDuel** : se dirige vers le centre ou l'ennemi le plus proche, swipe quand à portée
- **Dalgona** : tape à 60% quand tension < 80, sinon 5%

**Usage** :
```bash
node simulate-players.js
```

---

## 15. Bots intégrés côté serveur

### Fonctionnalité

Contrairement au simulateur externe, les bots côté serveur sont **intégrés directement dans le `GameManager`**. Cela permet de les utiliser sur **Render** (ou tout déploiement distant) sans avoir besoin d'un script séparé.

### Comment les ajouter

Sur le **grand écran** (lobby), un panneau permet de :
1. Choisir le nombre de bots à ajouter (input numérique)
2. Cliquer sur "Ajouter des bots"
3. Les bots apparaissent immédiatement dans la liste des joueurs

### `BotPlayer.js`

Étend la logique de `Player` avec :
- Un flag `isBot = true`
- Un comportement IA basé sur la méthode `botThink(gameState, currentGameName)`
- L'IA met à jour directement `this.input`, `this.moving` et `this.direction`
- Le `GameManager` appelle `botThink()` dans sa game loop pour tous les bots

---

## 16. Déploiement sur Render

### Configuration

1. **Type de service** : Web Service
2. **Build Command** : `npm install`
3. **Start Command** : `npm start`
4. **Port** : Détecté automatiquement via `process.env.PORT`

### Points d'attention

- `app.set('trust proxy', 1)` est **indispensable** pour que `req.protocol` retourne `https` derrière le reverse proxy de Render. Sans ça, le QR code pointe vers `http://` et les navigateurs mobiles bloquent les WebSockets.
- Socket.IO est configuré avec `cors: { origin: '*' }` pour accepter les connexions depuis n'importe quel domaine.
- Les bots côté serveur permettent de jouer même sans 50 vrais joueurs.

### Variables d'environnement

| Variable | Valeur | Description |
|----------|--------|-------------|
| `PORT` | (auto) | Port assigné par Render |

---

## 17. Glossaire

| Terme | Définition |
|-------|-----------|
| **Arène** | Zone de jeu virtuelle de 1920×1080 pixels |
| **Display** | Le grand écran (projecteur) qui affiche le jeu |
| **Controller** | Le téléphone d'un joueur utilisé comme manette |
| **Game Loop** | Boucle de mise à jour exécutée 30 fois par seconde |
| **Delta Time (dt)** | Temps écoulé depuis le dernier tick (en secondes) |
| **Phase** | État actuel du jeu (lobby, playing, transition, etc.) |
| **Socket.IO** | Bibliothèque de communication temps réel basée sur WebSockets |
| **Broadcast** | Envoi d'un message à tous les clients connectés |
| **Room** | Groupe de sockets (ex: `displays`) pour cibler les envois |
| **Emit** | Envoi d'un événement Socket.IO |
| **BFS** | Breadth-First Search — algorithme de parcours en largeur (GroupGame) |
| **Clamping** | Limiter une valeur dans un intervalle [min, max] |
| **Fisher-Yates** | Algorithme de mélange aléatoire (pour la file de jeux) |
| **Tick** | Une exécution de la game loop (~33ms) |
| **HUD** | Head-Up Display — informations superposées sur le jeu |
