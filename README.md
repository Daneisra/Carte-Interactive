<div align="center">
  <strong>HESTA</strong><br>
  <em>Un univers, plusieurs outils.</em><br>
  <a href="https://hesta.dannytech.fr/">Portail Hesta</a> ·
  <a href="https://cartehesta.dannytech.fr/">Carte Hesta</a> ·
  <a href="https://pahesta.dannytech.fr/">Système PA</a>
</div>

# Carte Interactive Hesta

Hub narratif et carte interactive pour l'univers d'Hesta. Le projet sert à explorer les lieux, suivre les quêtes, relier la chronologie aux zones de la carte et administrer les contenus sans modifier les JSON à la main.

Version actuelle : `0.17.49`.

## Fonctionnalités principales

- Carte narrative avec filtres, recherche, favoris, clustering et fiches lieux enrichies.
- Édition admin des lieux, médias, groupes, annotations et événements de quête.
- Authentification Discord OAuth avec rôles utilisateur/admin.
- Accueil immersif avec liens communauté, dons, crédits et panneau admin dédié.
- Page convention Geek Unchained pour presenter Le Monde d'Hesta aux visiteurs et joueurs.
- Chronologie horizontale dédiée avec événements, filtres, médias et liens vers la carte.
- Planning JDR dédié pour saisir les disponibilités, repérer les créneaux communs et préparer les sessions.
- Page changelog publique pour consulter les versions et changements récents.
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
planning/index.html     Planning JDR
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

## Écosystème Hesta

| Application | Rôle | URL publique |
| --- | --- | --- |
| Hesta Hub | Portail central | [hesta.dannytech.fr](https://hesta.dannytech.fr/) |
| Carte Hesta — ce projet | Carte interactive, quêtes, chronologie, planning et communauté | [cartehesta.dannytech.fr](https://cartehesta.dannytech.fr/) |
| Système PA | Armures, matériaux, builds et outils de combat | [pahesta.dannytech.fr](https://pahesta.dannytech.fr/) |
