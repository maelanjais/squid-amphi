# 🚀 Guide de Déploiement — Squid Amphi

Ce guide décrit la marche à suivre pour démarrer **Squid Amphi** sur une machine locale ou le déployer de manière persistante sur une Machine Virtuelle (VM) Linux / Serveur.

---

## 1. Lancement en Local (Développement ou LAN)

Pour jouer chez soi ou faire une démonstration rapide sur le réseau local.

### 📋 Prérequis
- **Git** installé.
- **Node.js** (version 18 ou supérieure) et **npm** installés.

### 💻 Étapes
1. **Cloner le projet** dans le dossier de votre choix :
   ```bash
   git clone https://github.com/maelanjais/squid-amphi.git
   cd squid-amphi
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Démarrer le serveur** :
   ```bash
   npm start
   ```

> [!TIP]
> **Important :** Pour que les smartphones puissent s'y connecter, ils doivent être sur le **même réseau WiFi** que votre ordinateur. Le jeu écoutera par défaut sur le port `3000`.

- **Pour projeter le jeu :** Accédez à [http://localhost:3000](http://localhost:3000) depuis la machine qui fait tourner le serveur.
- Le QRCode généré pointera automatiquement vers votre IP locale (exemple : `http://192.168.1.50:3000/play`), ce qui permet aux téléphones de s'y connecter sans configurations supplémentaires.

---

## 2. Déploiement sur une Machine Virtuelle (Serveur Linux)

Ce mode est idéal pour garantir que le jeu est accessible à tout moment, sans être lié à votre IP locale courante. Typiquement utilisé en amphi pour assurer la robustesse.

### 📋 Prérequis Serveur
- Une VM tournant sous **Ubuntu** (ou tout autre distribution Linux Debian-based).
- **Node.js** et **npm** pré-installés.
- Accès distant (SSH) à la machine.
- Nom de domaine (optionnel mais souhaité pour le HTTPS).

### 🛠️ Etape 1 : Cloner et préparer l'application

1. Connectez-vous à la machine virtuelle en SSH :
   ```bash
   ssh utilisateur@votre-ip-vm
   ```

2. Clonez le dépôt et installez les dépendances :
   ```bash
   git clone https://github.com/maelanjais/squid-amphi.git ~/squid-amphi
   cd ~/squid-amphi
   npm install
   ```

### ⚙️ Etape 2 : Lancer le projet en arrière-plan avec PM2

Afin d'éviter que le serveur Node.js ne se coupe lorsque vous fermez la console SSH, nous utiliserons `pm2`, un gestionnaire de processus pour Node.js.

1. **Installer PM2 globalement** :
   ```bash
   sudo npm install -g pm2
   ```

2. **Démarrer l'application** avec PM2 :
   ```bash
   pm2 start server/index.js --name "squid-amphi"
   ```

3. **Sauvegarder l'état** pour que le serveur redémarre tout seul en cas de redémarrage de la machine :
   ```bash
   pm2 startup
   pm2 save
   ```

### 🌐 Etape 3 : Exposer le jeu avec un reverse proxy (NGINX)

Par défaut, l'application tourne sur le port `3000`. Pour y accéder proprement sur les ports Web traditionnels (80 / 443) sans devoir l'écrire dans l'URL.

1. Installer NGINX :
   ```bash
   sudo apt update && sudo apt install nginx
   ```

2. Créer une nouvelle configuration :
   ```bash
   sudo nano /etc/nginx/sites-available/squid-amphi
   ```

3. Insérer la règle suivante (Proxy pass vers le port 3000 + support des WebSockets nécessaires à Socket.IO) :
   ```nginx
   server {
       listen 80;
       server_name votre-domaine.com ou_ip_de_la_machine;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

4. Activer le site et redémarrer NGINX :
   ```bash
   sudo ln -s /etc/nginx/sites-available/squid-amphi /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

> [!NOTE]
> Le QRCode sur l'écran principal obéira à l'adresse URL et au réseau sur lequel les joueurs le scannent.

### 🔒 Etape 4 (Optionnelle) : Ajouter le HTTPS via Let's Encrypt

Si vous utilisez un nom de domaine, la méthode la plus propre est d'ajouter un certificat HTTPS. Le micro du téléphone et certaines API tactiles pourraient l'exiger.
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```
