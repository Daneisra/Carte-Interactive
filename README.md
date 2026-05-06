# Carte Interactive Hesta

Hub narratif et carte interactive pour l'univers d'Hesta. Le projet sert à explorer les lieux, suivre les quêtes, relier la chronologie aux zones de la carte et administrer les contenus sans modifier les JSON à la main.

Version actuelle : `0.17.4`.

## Fonctionnalités principales

- Carte narrative avec filtres, recherche, favoris, clustering et fiches lieux enrichies.
- Édition admin des lieux, médias, groupes, annotations et événements de quête.
- Authentification Discord OAuth avec rôles utilisateur/admin.
- Accueil immersif avec liens communauté, dons, crédits et panneau admin dédié.
- Chronologie horizontale dédiée avec événements, filtres, médias et liens vers la carte.
- Flux temps réel SSE pour les changements utiles en session.

## Stack

- Front statique HTML/CSS/JS en modules ES.
- Backend Node.js CommonJS lancé par `server.js`.
- Routeur maison dans `server/routes/index.js`.
- Données persistées en JSON dans `assets/`.
- Tests unitaires Node et tests UI Playwright.
- Production : Nginx, PM2, VPS Debian 12.

## Lancement local

```bash
npm install
npm run serve
```

Le serveur local écoute par défaut sur `http://localhost:4173`.

## Commandes utiles

```bash
npm run lint
npm run test:unit
npm run test:ui
npm run build:static
npm run sync:mock
```

## Structure rapide

```txt
index.html              Accueil
map/index.html          Carte interactive
timeline/index.html     Chronologie
js/                     Front en modules ES
server.js               Point d'entrée backend Node
server/routes/          Routes du routeur maison
assets/                 Données JSON et médias
docs/                   Documentation projet, ops et contribution
tests/                  Tests unitaires et Playwright
```

## Documentation

- [Roadmap](ROADMAP.md)
- [Contexte IA/Codex](docs/AI-CONTEXT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Déploiement VPS](docs/DEPLOYMENT-VPS.md)
- [Runbook ops](docs/OPS-RUNBOOK.md)
- [OAuth Discord](docs/OAUTH-DISCORD.md)
- [Remote sync](docs/REMOTE-SYNC.md)
- [Gestion des données](docs/DATA-MANAGEMENT.md)
- [Crédits assets](docs/ASSETS-CREDITS.md)
- [Contribution](docs/CONTRIBUTING.md)

Les secrets vivent dans `.env` et ne doivent jamais être commités. Utiliser `.env.example` comme modèle local.
