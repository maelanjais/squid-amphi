---
description: Deploy Squid Amphi to Render (free hosting)
---

# Déploiement sur Render

// turbo-all

## Prérequis
- Avoir un compte GitHub (ou GitLab)
- Avoir un compte Render (gratuit) : https://render.com

## Étapes

### 1. Initialiser le repo Git

```bash
cd "c:\Users\Chris\Desktop\Documents Maelan\Projets\PS4"
git init
git add .
git commit -m "Initial commit - Squid Amphi"
```

### 2. Créer un repo sur GitHub

1. Aller sur https://github.com/new
2. Créer un repo `squid-amphi` (privé ou public)
3. Copier l'URL du repo

### 3. Pousser le code

```bash
git remote add origin <URL_DU_REPO>
git branch -M main
git push -u origin main
```

### 4. Déployer sur Render

1. Aller sur https://dashboard.render.com
2. Cliquer **New → Web Service**
3. Connecter votre compte GitHub
4. Sélectionner le repo `squid-amphi`
5. Configurer :
   - **Name** : `squid-amphi`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Instance Type** : `Free`
6. Cliquer **Create Web Service**

### 5. Récupérer l'URL

Render va donner une URL du type :
```
https://squid-amphi.onrender.com
```

- **Manette** : `https://squid-amphi.onrender.com/controller`
- **Écran** : `https://squid-amphi.onrender.com/display`

### 6. Note importante

Le plan gratuit de Render met le serveur en veille après 15 min d'inactivité.
Le premier accès après une veille prend ~30 secondes.
Pour la démo/soutenance, charger la page 1-2 min avant pour "réveiller" le serveur.
