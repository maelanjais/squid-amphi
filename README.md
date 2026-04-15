# 🦑 Squid Amphi

**50 JOUEURS. 1 SEUL SURVIVANT.**

Squid Amphi est un jeu multijoueur inspiré de *Squid Game*, conçu pour être joué dans un amphithéâtre ou sur écran géant avec un large public de participants. Le grand écran de l'amphi affiche le terrain de jeu et les morts en temps réel, tandis que chaque joueur utilise son **propre téléphone comme manette intelligente**.

> **Auteurs** : JAHIER Maëlan, GRILLOT Thomas, SALLE-PIERRET Maxence  
> **Projet Universitaire** : BUT 2 - Architecture logicielle et web temps-réel

---

## 🎮 Le Concept et le Support

Le système se compose de deux parties :
- **Grand Écran (Display)** : Projeté à l'amphithéâtre. C'est l'écran de visionnage du jeu.
- **Téléphone (Manette)** : Les joueurs se connectent via un **QR code** au jeu. L'interface tactile de leur téléphone change *en direct* pour s'adapter mécaniquement au mini-jeu en cours. 

## 🏆 Les 4 Épreuves de la Mort

Les joueurs se voient affronter 4 épreuves mortelles, éliminatoires à la chaîne. La partie se termine que lorsqu'un ultime survivant en ressort.

| # | Épreuve | Objectif | Type de Contrôle Manette |
|---|---------|-------------|----------|
| 1 | 🚦 1, 2, 3 Soleil ! | Franchissez la ligne rouge en évitant d'être chopé en mouvement. | **Toucher-maintenir** pour courir |
| 2 | 🪢 Le Jeu de la Corde | Combat asymétrique ; tirez l'équipe adverse dans le vide. | **Pianoter (Tap)** très rapidement |
| 3 | 🌉 Le Pont de Verre | 50% de chance. Choisissez la bonne plaque ou tombez dans le vide. | **Choix Binaire** (Gauche / Droite) |
| 4 | ⚔️ Le Jeu Final (Pierre-Feuille-Ciseaux) | Tournoi éliminatoire à base de RPS avec un bracket live interactif. | **Trois Boutons** classiques |

---

## 🎲 Autres Fonctionnalités Clés

- 💰 **Système de Paris** : En début de partie, chaque participant doit parier sur un autre joueur. S'ils meurent, ils peuvent tout de même gagner une reconnaissance finale si leur poulain l'emporte !
- 🤖 **Bot IA Inclus** : Le jeu peut être rempli de bots (intelligences artificielles) pour palier le manque de joueurs.
- 🎵 **Sound Design complet** : Le jeu possède des ambiances variables, des fondus audio et des sons lors des éliminations (ex: effet Fusil à pompe dans certaines phases).

---

## 📖 Documentations Complémentaires

Le projet étant vaste, la documentation a été éclatée en dossiers pour que les lecteurs s'y retrouvent :
- **[A lire pour le mode d'emploi de Déploiement (VM & Local) 👉 `DEPLOYMENT.md`](./DEPLOYMENT.md)**
- **[Documentation complète, code, architecture réseau et détails d'implémentation 👉 `DOCUMENTATION.md`](./DOCUMENTATION.md)**

---

## ⌨️ Raccourcis Administrateur Secrêts (Grand Écran)

Le claviériste côté serveur dispose de touches secrètes cachées dans la page :

| Touche | Action |
|--------|--------|
| `D` | Ouvre/ferme la boite d'administration globale secrète |
| `R` | Bouton physique - Reset complet des parties et de la file d'attente |
