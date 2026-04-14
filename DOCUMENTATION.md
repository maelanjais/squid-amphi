# 📖 Documentation Technique — Squid Amphi

> **Auteurs** : JAHIER Maëlan, GRILLOT Thomas, SALLE-PIERRET Maxence  
> **Version** : 1.0.0  
> **Licence** : ISC

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Architecture technique](#2-architecture-technique)
3. [Installation et lancement](#3-installation-et-lancement)
4. [Communication Client-Serveur](#4-communication-client-serveur)
5. [Cycle de vie d'une partie](#5-cycle-de-vie-dune-partie)
6. [Description des fichiers](#6-description-des-fichiers)
7. [Les mini-jeux](#7-les-mini-jeux)
8. [Système de paris](#8-système-de-paris)
9. [Système de bots](#9-système-de-bots)
10. [Rendu visuel (Display)](#10-rendu-visuel-display)
11. [Contrôleur mobile](#11-contrôleur-mobile)
12. [Audio](#12-audio)
13. [Déploiement](#13-déploiement)

---

## 1. Présentation du projet

**Squid Amphi** est un jeu multijoueur en temps réel conçu pour être joué dans un amphithéâtre. Il s'inspire de la série *Squid Game* : les joueurs se connectent depuis leur smartphone (manette) et participent à une série de mini-jeux éliminatoires affichés sur un écran principal (vidéoprojecteur).

### Principe général
- Un **écran principal** (Display) est projeté et affiche le jeu en temps réel.
- Chaque **joueur** se connecte via son téléphone en scannant un QR code.
- Le téléphone devient une **manette** tactile adaptée à chaque mini-jeu.
- Les joueurs s'éliminent au fil des épreuves jusqu'à ce qu'il n'en reste qu'un.

### Technologies utilisées
| Technologie | Rôle |
|---|---|
| **Node.js** | Serveur applicatif |
| **Express** | Serveur HTTP, routes, fichiers statiques |
| **Socket.IO** | Communication temps réel bidirectionnelle (WebSocket) |
| **HTML5 Canvas** | Rendu 2D du jeu sur l'écran principal |
| **QRCode** (npm) | Génération du QR code de connexion |
| **CSS3** | Animations, design responsive |
| **Google Fonts (Outfit)** | Typographie |

---

## 2. Architecture technique

```
squid-amphi/
├── server/                     # 🖥️ Côté serveur (Node.js)
│   ├── index.js                # Point d'entrée, Express + Socket.IO
│   ├── GameManager.js          # Moteur de jeu central (boucle, phases, paris)
│   ├── Player.js               # Classe Player (position, input, sérialisation)
│   ├── BotPlayer.js            # Classe BotPlayer (IA des bots)
│   └── games/                  # Mini-jeux
│       ├── RedLightGreenLight.js   # 1, 2, 3… Soleil
│       ├── TugOfWar.js             # Jeu de la Corde
│       ├── GlassBridge.js          # Pont de Verre
│       ├── RockPaperScissors.js    # Pierre-Feuille-Ciseaux (Jeu Final)
│       └── FinalDuel.js            # Duel Final (non utilisé actuellement)
├── public/                     # 📁 Fichiers statiques (clients)
│   ├── display/                # Écran principal (projeté)
│   │   ├── index.html          # Structure HTML du display
│   │   ├── display.js          # Logique client du display (Socket.IO)
│   │   ├── renderer.js         # Rendu Canvas 2D
│   │   └── sounds.js           # Gestionnaire audio
│   ├── controller/             # Manette mobile (téléphone)
│   │   ├── index.html          # Structure HTML du contrôleur
│   │   └── controller.js       # Logique client de la manette (Socket.IO)
│   ├── css/
│   │   ├── display.css         # Styles de l'écran principal
│   │   └── controller.css      # Styles de la manette mobile
│   ├── audio/                  # Fichiers audio (.mp3)
│   └── assets/                 # Images et ressources
├── simulate-players.js         # Script de simulation (test sans téléphones)
├── package.json
└── fly.toml                    # Configuration de déploiement (Fly.io)
```

### Diagramme de communication

```
┌─────────────────┐       WebSocket        ┌──────────────────┐
│   📱 Manette    │ ◄──────────────────────► │   🖥️ Serveur     │
│  (controller)   │    player-input          │  (GameManager)   │
│  /play          │    player-bet            │                  │
│                 │    ◄── controller-state  │  Boucle 30 FPS   │
└─────────────────┘                          │                  │
                                             │  Phases:         │
┌─────────────────┐       WebSocket          │  lobby → betting │
│   📺 Display    │ ◄──────────────────────► │  → explanation   │
│  (renderer)     │    game-state (30fps)    │  → countdown     │
│  /              │    phase                 │  → playing       │
│                 │    player-list           │  → transitions   │
└─────────────────┘                          │  → gameover      │
                                             └──────────────────┘
```

---

## 3. Installation et lancement

### Prérequis
- **Node.js** v18+ 
- **npm** (inclus avec Node.js)

### Installation
```bash
git clone https://github.com/maelanjais/squid-amphi.git
cd squid-amphi
npm install
```

### Lancement
```bash
npm start
```

Le serveur démarre sur le port `3000` (ou la variable d'environnement `PORT`).

| URL | Fonction |
|---|---|
| `http://localhost:3000/` | Écran principal (Display) |
| `http://localhost:3000/play` | Manette mobile (Controller) |
| `http://localhost:3000/api/qr?url=...` | API de génération de QR code |

### Lancement en réseau local
Pour que les téléphones puissent se connecter, il faut utiliser l'**adresse IP locale** de la machine qui exécute le serveur (pas `localhost`). Le QR code affiché à l'écran pointe automatiquement vers la bonne URL.

---

## 4. Communication Client-Serveur

### Protocole : Socket.IO (WebSocket)

Toute la communication entre le serveur, l'écran principal et les manettes passe par **Socket.IO**. Voici les événements échangés :

### Événements Serveur → Clients

| Événement | Destinataire | Contenu | Fréquence |
|---|---|---|---|
| `game-state` | Display | État complet du jeu (joueurs, phase, scores, paris, etc.) | **30 fois/sec** |
| `controller-state` | Chaque manette | État personnalisé (contrôles, position, timer) | **10 fois/sec** |
| `phase` | Tous | Phase actuelle du jeu (lobby, playing, gameover, etc.) | À chaque changement |
| `player-list` | Display | Liste mise à jour des joueurs connectés | À chaque connexion/déconnexion |
| `start-betting` | Tous | Liste des joueurs vivants pour la phase de paris | 1 fois au début des paris |
| `registered` | 1 manette | Confirmation d'inscription (id, numéro, couleur) | 1 fois à la connexion |
| `eliminated` | 1 manette | Notification d'élimination du joueur | 1 fois à l'élimination |

### Événements Clients → Serveur

| Événement | Émetteur | Contenu | Description |
|---|---|---|---|
| `register-display` | Display | — | L'écran principal s'identifie |
| `register-player` | Manette | `{ name }` | Un joueur rejoint la partie |
| `player-input` | Manette | `{ type, pressing, dirX, dirY, ... }` | Input de gameplay (mouvement, tap, choix) |
| `player-bet` | Manette | `{ targetId }` | Le joueur parie sur un autre joueur |
| `admin-start` | Display | — | Lancer la partie |
| `admin-reset` | Display | — | Réinitialiser la partie |
| `admin-add-bots` | Display | `{ count }` | Ajouter des bots |
| `admin-skip` | Display | — | Passer l'épreuve en cours |

### Fonctions clés côté serveur

#### `GameManager.handleConnection(socket)` 
Enregistre les handlers Socket.IO pour chaque nouvelle connexion. Distingue les displays des joueurs.

#### `GameManager.broadcastState(frameCount)` 
Appelée à chaque tick (30fps). Sérialise l'état complet du jeu et l'envoie :
- Au display : `game-state` à pleine fréquence
- Aux manettes : `controller-state` à 10fps (1 frame sur 3), avec un état personnalisé par joueur

#### `GameManager.broadcastPhase()` 
Émet l'événement `phase` à tous les clients quand la phase du jeu change.

---

## 5. Cycle de vie d'une partie

### Diagramme des phases

```
LOBBY ──► BETTING ──► EXPLANATION ──► COUNTDOWN ──► PLAYING
                                                       │
                                         ┌─────────────┘
                                         ▼
                                   TRANSITION_BANK (7s)
                                         │
                                         ▼
                                   TRANSITION_DEAD (10s)
                                         │
                                         ▼
                                TRANSITION_ROULETTE (10s)
                                         │
                          ┌──────────────┤
                          ▼              ▼
                    EXPLANATION     GAME_OVER
                    (jeu suivant)   (fin de partie)
```

### Description de chaque phase

| Phase | Durée | Description |
|---|---|---|
| `lobby` | Illimitée | Les joueurs se connectent. Le QR code est affiché. L'admin peut ajouter des bots. |
| `betting` | Jusqu'à ce que tous aient voté | Chaque joueur parie sur le futur vainqueur via son téléphone. |
| `explanation` | 15 sec | L'écran affiche le nom et les règles du prochain mini-jeu. |
| `countdown` | 3 sec | Décompte "3, 2, 1" avant le début du jeu. |
| `playing` | Variable | Le mini-jeu est en cours. Les joueurs interagissent via leurs manettes. |
| `transition_bank` | 7 sec | Animation de la "tirelire" : affiche le nombre d'éliminés et la cagnotte virtuelle. |
| `transition_dead` | 10 sec | Grille mémorial : affiche les portraits des joueurs éliminés cette manche. |
| `transition_roulette` | 10 sec | Animation de la roulette qui tourne et s'arrête sur le prochain jeu. |
| `gameover` | Illimitée | Écran de victoire : nom du gagnant + résultat du meilleur pari. |

### Enchaînement des jeux

L'ordre des jeux est fixe et défini dans `GameManager.startNextGame()` :

```
1. 1, 2, 3… Soleil ! (RedLightGreenLight)
2. Le Jeu de la Corde (TugOfWar)
3. Le Pont de Verre (GlassBridge)
4. Jeu Final — Pierre-Feuille-Ciseaux (RockPaperScissors)
```

La partie se termine dès qu'il reste **1 ou 0** joueur(s) en vie. Si tous les joueurs meurent dans une épreuve, l'écran de fin affiche "Aucun survivant".

### Fonctions clés du cycle de vie

#### `GameManager.gameLoop()`
Boucle principale appelée **30 fois par seconde** via `setInterval`. Elle :
1. Calcule le `dt` (delta time) depuis le dernier tick
2. Gère les timers de chaque phase (explanation, countdown, transitions)
3. Appelle `currentGame.update(dt, alivePlayers)` pendant la phase `playing`
4. Détecte les éliminations et notifie les joueurs concernés
5. Appelle `broadcastState()` à la fin de chaque tick

#### `GameManager.startNextGame()`
Incrémente l'index du jeu courant, vérifie si la partie est finie (≤1 joueur), instancie le prochain mini-jeu et passe en phase `EXPLANATION`.

#### `GameManager.endCurrentGame()`
Appelée quand un mini-jeu se termine. Elle :
1. Calcule la cagnotte virtuelle (+100 000 par éliminé)
2. Détermine le prochain jeu pour la roulette
3. Lance la séquence de transitions (bank → dead → roulette)

---

## 6. Description des fichiers

### Serveur

#### `server/index.js`
Point d'entrée de l'application. Configure Express (routes `/` et `/play`, API QR code), crée le serveur HTTP, initialise Socket.IO et instancie le `GameManager`.

#### `server/GameManager.js` (~700 lignes)
C'est le **cerveau** du jeu. Il gère :
- La connexion/déconnexion de tous les clients
- L'inscription des joueurs et l'attribution des numéros
- Le cycle de vie complet (phases, transitions, timers)
- L'instanciation et la coordination des mini-jeux
- Le système de paris et le calcul du classement final
- La boucle de jeu à 30fps
- La sérialisation et la diffusion de l'état à tous les clients

#### `server/Player.js` (~120 lignes)
Classe de base d'un joueur :
- **Propriétés** : `id`, `name`, `number`, `x`, `y`, `vx`, `vy`, `speed`, `color`, `alive`, `team`, `score`, `roundDied`
- **`processInput(data)`** : Traite les inputs reçus du contrôleur (mouvement, tap, choix, swipe)
- **`update(dt, bounds)`** : Met à jour la position en fonction de la direction et de la vitesse
- **`eliminate()`** : Marque le joueur comme mort et stoppe son mouvement
- **`toJSON()`** : Sérialise le joueur pour l'envoi réseau
- **`generateColor()`** : Attribue une couleur HSL unique via le nombre d'or (137.5°)

#### `server/BotPlayer.js` (~135 lignes)
Hérite de `Player`. Ajoute une IA simple pour chaque mini-jeu via `botThink()` :
- **RLGL** : Se déplace pendant le feu vert (70% de chance), s'arrête pendant le rouge (99.7%)
- **Tug of War** : Tape aléatoirement (40% de chance par tick)
- **Glass Bridge** : Choisit le côté sûr si le panneau est révélé, sinon devine
- **RPS** : Choisit aléatoirement pierre/feuille/ciseaux avec un délai humain simulé

### Clients

#### `public/display/display.js` (~500 lignes)
Client Socket.IO de l'écran principal. Gère :
- La connexion au serveur et l'événement `register-display`
- La réception de `game-state` à 30fps et le rendu via `renderer.render(state)`
- La gestion des écrans (lobby, betting, explanation, transitions, gameover)
- L'animation de la roulette (JS-driven avec easing quintic)
- La mise à jour de l'écran de fin (vainqueur + résultat du pari)
- Les contrôles admin (boutons start, reset, ajout de bots)

#### `public/display/renderer.js` (~820 lignes)
Moteur de rendu Canvas 2D. Dessine :
- Les joueurs (cercles colorés avec noms)
- Le terrain de jeu adapté à chaque mini-jeu (finish line, pont, corde, etc.)
- Le HUD (timer, compteur d'éliminés, cagnotte)
- La grille mémorial des éliminés
- Le tableau du tournoi Pierre-Feuille-Ciseaux (bracket interactif)

#### `public/display/sounds.js` (~300+ lignes)
Gestionnaire audio centralisé :
- Charge et joue les musiques de fond (lobby, RLGL, Tug of War, RPS)
- Gère les effets sonores (tick, countdown, élimination)
- Fondus d'entrée/sortie (fade in/out) entre les phases
- Groupes de musique par phase pour des transitions fluides

#### `public/controller/controller.js` (~600 lignes)
Client Socket.IO de la manette mobile. Gère :
- L'inscription du joueur
- L'envoi des inputs tactiles au serveur
- L'affichage dynamique des contrôles selon le jeu :
  - **Zone de mouvement** (RLGL) : touch + joystick
  - **Zone de tap** (Tug of War) : tapotements rapides
  - **Choix gauche/droite** (Glass Bridge) : deux boutons
  - **Pierre/Feuille/Ciseaux** (RPS) : trois boutons
- L'affichage des écrans de transition, élimination et victoire

---

## 7. Les mini-jeux

Chaque mini-jeu implémente l'interface suivante :

```javascript
class MiniJeu {
  constructor(arenaWidth, arenaHeight)  // Initialisation
  setup(players)                        // Configuration des joueurs
  start(players)                        // Début du jeu
  update(dt, players) → { eliminated }  // Mise à jour (appelée 30x/sec)
  isFinished() → boolean               // Le jeu est-il terminé ?
  getState() → object                  // État pour le Display
  getControllerState(player) → object  // État personnalisé par joueur
}
```

### 7.1 — 1, 2, 3… Soleil ! (`RedLightGreenLight.js`)

**Règle** : Les joueurs avancent vers la ligne d'arrivée en haut de l'écran. Quand le feu passe au rouge, tout joueur encore en mouvement est éliminé.

**Mécanique serveur** :
- Cycles vert/rouge aléatoires (vert : 2-5s, rouge : 3s)
- Phase d'avertissement (`warning`) 1.5s avant le rouge
- Durée totale : 90 secondes
- Fin : tous les survivants ont franchi la ligne, ou le temps est écoulé (les retardataires sont éliminés)

**Contrôles** : Maintenir l'écran pour avancer, relâcher pour s'arrêter. Joystick pour diriger.

**État envoyé** : `greenLight`, `warning`, `finishLine`, `roundTimer`, `phaseTimer`

### 7.2 — Le Jeu de la Corde (`TugOfWar.js`)

**Règle** : Les joueurs sont répartis en 2 équipes. Ils doivent tapoter le plus vite possible pour tirer la corde de leur côté.

**Mécanique serveur** :
- Répartition aléatoire en 2 équipes
- `ropePosition` varie de -100 à +100 (0 = centre)
- Chaque tap d'un joueur déplace la corde de 3 unités vers son équipe
- Décroissance naturelle vers le centre (`decay = 2`)
- Fin : la corde atteint un seuil (`±100`) ou le temps est écoulé (20s)
- L'équipe perdante est intégralement éliminée

**Contrôles** : Tapoter l'écran le plus vite possible.

**État envoyé** : `ropePosition`, `timer`, `winThreshold`, `winningTeam`

### 7.3 — Le Pont de Verre (`GlassBridge.js`)

**Règle** : Les joueurs passent un par un dans un ordre aléatoire (Fisher-Yates). À chaque étape, ils choisissent gauche ou droite. Un mauvais choix les élimine. Les panneaux déjà révélés sont visibles pour les suivants.

**Mécanique serveur** :
- Nombre d'étapes adapté : `max(6, floor(nbJoueurs × 0.9))`
- Chaque panneau a un côté sûr aléatoire
- Timer de 10 secondes par tour
- Les survivants reviennent en fin de file et peuvent repasser si tous les panneaux ne sont pas révélés
- Quand tous les panneaux sont révélés, tous les joueurs restants survivent

**Contrôles** : Deux boutons "Gauche" / "Droite" quand c'est votre tour, sinon écran d'attente.

**État envoyé** : `currentPlayerId`, `choosing`, `choiceTimer`, `panels` (révélés uniquement), `queue`, `playerResults`

### 7.4 — Jeu Final : Pierre-Feuille-Ciseaux (`RockPaperScissors.js`)

**Règle** : Tournoi à élimination directe. Les joueurs sont placés dans un arbre (bracket) et s'affrontent en duel. Le perdant est éliminé. En cas d'égalité, le duel est rejoué.

**Mécanique serveur** :
- Arbre de tournoi basé sur la puissance de 2 la plus proche
- 3 sous-états : `bracket_full` (12s d'affichage), `countdown` (10s pour choisir), `resolution` (7s pour voir le résultat)
- Gestion des "byes" (joueurs sans adversaire qui passent automatiquement)
- Les gagnants sont avancés dans le bracket automatiquement
- Les égalités déclenchent un nouveau countdown immédiat

**Contrôles** : 3 boutons (🪨 Pierre, 📄 Feuille, ✂️ Ciseaux).

**État envoyé** : `state`, `timer`, `roundNumber`, `bracketTree`, `matches`

---

## 8. Système de paris

### Principe
Avant le premier jeu, chaque joueur parie sur celui qu'il pense être le futur vainqueur. À la fin de la partie, le résultat est affiché sur l'écran final.

### Flux

1. **`startBettingPhase()`** : Le serveur passe en phase `BETTING`, les bots parient automatiquement sur un joueur aléatoire, puis la liste des joueurs est envoyée aux manettes via `start-betting`.

2. **Sur le téléphone** : L'événement `start-betting` déclenche l'affichage d'une grille de cartes (mosaïque). Le joueur tape sur le joueur de son choix.

3. **`player-bet`** : Quand un joueur vote, le serveur enregistre son pari dans `this.bets` (Map : bettorId → targetId) et déclenche un `broadcastState()` immédiat pour mettre à jour le compteur de votes.

4. **`checkBettingComplete()`** : Vérifie si tous les joueurs vivants ont voté. Si oui, lance le premier jeu après un délai de 1.5s.

5. **`calculateBestBets()`** : Appelée quand la partie se termine. Algorithme :
   - Construit un classement final (tri par `alive` puis par `roundDied` décroissant)
   - Parcourt tous les paris :
     - Si quelqu'un a parié sur le **vainqueur** → "Pronostic Parfait" (type `exact`)
     - Sinon, le pari le plus proche = celui dont la cible a survécu le plus longtemps → "Meilleur Pronostic" (type `closest`) avec le rang final affiché

### Données envoyées au display

```javascript
bestBetResult: {
  bettorName: "Bob",        // Qui a parié
  targetName: "Alice",      // Sur qui
  type: "exact" | "closest",
  targetRank: 2,            // Position finale de la cible
  isWinnerBet: true|false   // La cible est-elle le vainqueur ?
}
```

---

## 9. Système de bots

### Ajout de bots
- Depuis l'écran principal, un panneau "BOTS" en bas à droite permet d'ajouter des bots (1-50).
- Les bots reçoivent un nom `Bot 1`, `Bot 2`, etc.
- Ils ont un ID unique préfixé `bot-`.

### IA (`BotPlayer.botThink()`)
Appelée 5 fois par seconde (1 tick sur 6) pendant la phase `playing`. L'IA est volontairement simple et imparfaite pour simuler des joueurs humains :

| Jeu | Comportement |
|---|---|
| RLGL | Se déplace 70% du temps au vert, 0.3% au rouge (erreurs volontaires) |
| Tug of War | Tape 40% du temps (simule un humain qui tapote) |
| Glass Bridge | Utilise le panneau révélé si possible, sinon devine aléatoirement |
| RPS | Choisit aléatoirement avec un délai simulé (3% de chance par tick) |

### Parité pour Tug of War
Si le nombre de joueurs vivants est impair après RLGL, un bot est **silencieusement sacrifié** pour garantir des équipes égales.

---

## 10. Rendu visuel (Display)

### Canvas 2D (`renderer.js`)

Le rendu utilise un `<canvas>` HTML5 de **1920×1080** pixels. La méthode principale est `render(state)` qui dessine tout en fonction de la phase actuelle.

### Fonctions de rendu principales

| Fonction | Description |
|---|---|
| `drawBackground(state)` | Fond adapté au jeu : terrain RLGL, pont, corde, arène RPS |
| `drawPlayers(state)` | Cercles colorés + noms au-dessus, croix rouge si éliminé |
| `drawHUD(state)` | Timer, compteur de survivants, cagnotte virtuelle |
| `drawTransitionBank(state)` | Animation de la tirelire avec icône cochon |
| `drawTransitionDead(state)` | Grille mémorial des éliminés avec rubans rouges |
| `drawRLGL(state)` | Ligne d'arrivée, indicateur vert/rouge, personnage "poupée" |
| `drawTugOfWar(state)` | Corde, indicateur de force, barre de progression |
| `drawGlassBridge(state)` | Pont, panneaux éclairés (vert/rouge), joueur actif |
| `drawTournamentBracket(state)` | Arbre du tournoi RPS avec cartes de matchs |

### Système d'écrans
Le display utilise un système d'écrans HTML superposés (`<div class="screen">`) contrôlés par la classe CSS `.active`. La fonction `showScreen(phase)` active l'écran correspondant :

- `lobby-screen` : QR code + liste des joueurs
- `betting-screen` : Écran "Faites vos paris" (overlay plein écran)
- `explanation-screen` : Nom et règles du prochain jeu
- `countdown-screen` : Décompte 3, 2, 1
- `game-screen` : Canvas de jeu
- `transition-bank-screen`, `transition-dead-screen`, `transition-roulette-screen`
- `gameover-screen` : Écran de victoire

---

## 11. Contrôleur mobile

### Flux de connexion

1. Le joueur scanne le QR code ou accède à `/play`
2. Il entre son pseudo et appuie sur "REJOINDRE"
3. Le client émet `register-player` au serveur
4. Le serveur répond avec `registered` (id, numéro, couleur)
5. Le téléphone affiche l'écran d'attente avec le badge du joueur

### Types d'input envoyés (`player-input`)

| Type | Données | Utilisé par |
|---|---|---|
| `move` | `{ pressing, dirX, dirY }` | RLGL (mouvement + direction) |
| `tap` | `{ tap: true }` | Tug of War (tapotements) |
| `choice` | `{ choice: 'left'/'right' }` | Glass Bridge (choix de côté) |
| `choice` | `{ choice: 'rock'/'paper'/'scissors' }` | RPS (choix de signe) |

### Adaptation dynamique des contrôles
Le serveur envoie un `controller-state` personnalisé à chaque joueur. Ce state contient un champ `controls` qui indique quel type d'interface afficher :

- `'move'` → Zone tactile + joystick directionnel
- `'tap'` → Zone de tapotement plein écran + compteur
- `'choice'` → Boutons choix gauche/droite
- `'rps'` → 3 boutons Pierre/Feuille/Ciseaux
- `'none'` → Écran d'attente

### Gestion des écrans mobiles
Le contrôleur gère aussi les écrans de :
- **Paris** : Grille de cartes cliquables pour choisir un joueur
- **Élimination** : Message rouge "ÉLIMINÉ" avec le nom du jeu
- **Survie** (RLGL) : Écran vert dès que le joueur franchit la ligne
- **Game Over** : Message "FIN DE PARTIE — Bravo !"

---

## 12. Audio

### Musiques de fond

| Fichier | Utilisé pendant | Démarrage |
|---|---|---|
| `lobby.mp3` | Lobby + Betting | Dès la connexion |
| `rlgl.mp3` | 1, 2, 3 Soleil | Au countdown |
| `rope.mp3` | Jeu de la Corde | 15s après le début |
| `final.mp3` | Jeu Final (RPS) | Au countdown, fondu 8-10s |

### Effets sonores
- `countdown_tick.mp3` : Tick du décompte 3-2-1
- `roulette_tick` : Tick de la roulette (synthétique via `playTick()`)
- Sons d'élimination et de victoire

### Gestion (`sounds.js`)
Le `SoundManager` détecte la phase courante et gère les transitions :
- **Fade in/out** : Les musiques démarrent et s'arrêtent progressivement
- **Groupes** : Chaque musique est associée à un groupe de phases (ex: `lobby.mp3` joue pendant `lobby` ET `betting`)
- **Volume** : Chaque musique a un volume indépendant configurable

---

## 13. Déploiement

### Fly.io (production)
Le fichier `fly.toml` contient la configuration minimale :
```toml
app = 'squid-amphi'
```

### Déploiement :
```bash
fly deploy
```

### Variables d'environnement
| Variable | Valeur par défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port d'écoute du serveur |

### Points d'attention
- **QR Code** : L'URL du QR code est générée dynamiquement en fonction du `req.protocol` et `req.get('host')`. Derrière un reverse proxy (Fly.io, Render), `app.set('trust proxy', 1)` est activé pour obtenir le bon protocole (HTTPS).
- **WebSocket** : Socket.IO est configuré avec `cors: { origin: '*' }` pour accepter les connexions de tous les domaines.
- **Audio** : La lecture automatique des musiques est soumise aux politiques de sécurité des navigateurs. Une interaction utilisateur initiale est nécessaire (clic sur l'écran du display).

---

*Documentation générée pour le projet Squid Amphi — Avril 2026*
