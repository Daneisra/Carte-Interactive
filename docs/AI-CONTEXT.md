# Contexte IA / Codex

Ce document sert de point d'entrée pour une IA travaillant dans VS Code/Codex sur Carte Interactive Hesta.

## Architecture globale

- Front statique en HTML/CSS/JS.
- Front en modules ES avec `import/export`.
- Backend Node.js en CommonJS.
- `server.js` lance le backend et charge `.env` au démarrage.
- `server/routes/index.js` enregistre les routes via un routeur maison.
- Les données persistantes principales sont des JSON dans `assets/`.

## Fichiers principaux

- `index.html` : page d'accueil.
- `map/index.html` : page carte.
- `timeline/index.html` : page chronologie.
- `js/main.js` : initialisation de la carte.
- `js/dataService.js` : chargement de `assets/types.json` et `assets/locations.json`.
- `js/mapController.js` : logique carte et marqueurs.
- `js/uiController.js` : orchestration UI carte/admin.
- `js/preferencesService.js` : préférences locales.
- `js/home.js` et `js/home-admin.js` : accueil et admin accueil.
- `js/timeline.js` : chronologie.
- `js/shared/locationSchema.mjs` : normalisation des lieux.
- `js/shared/locationValidation.mjs` : validation des datasets.
- `js/shared/searchFilters.mjs` : filtres de recherche partagés.

## Routes serveur

- `server/routes/auth.js` : Discord OAuth, session, logout.
- `server/routes/annotations.js` : annotations.
- `server/routes/locations.js` : lieux, recherche, génération de description.
- `server/routes/timeline.js` : chronologie.
- `server/routes/questEvents.js` : événements de quête.
- `server/routes/health.js` : `/health`.

Routes utiles :

- `GET /health`
- `GET /auth/session`
- `GET /auth/discord/login`
- `GET /auth/discord/callback`
- `POST /auth/logout`
- `GET /api/annotations`
- `POST /api/annotations`
- `DELETE /api/annotations/:id`
- `GET /api/locations/search`
- `POST /api/locations`
- `GET /api/timeline`
- `GET /api/events/stream`
- `GET /api/admin/home-config`
- `PATCH /api/admin/home-config`
- `GET /api/admin/timeline-config`
- `PATCH /api/admin/timeline-config`

## Données

- `assets/locations.json` : lieux structurés par continent.
- `assets/annotations.json` : annotations de carte.
- `assets/types.json` : types de lieux, icônes et paramètres de zoom.
- `assets/timeline.json` : chronologie.
- `assets/site-config.json` : configuration de l'accueil.
- `assets/users.json` : utilisateurs persistés.
- `assets/groups.json` : groupes JDR.
- `assets/logs/sessions.json` : sessions persistées, ignoré par Git.

Les modifications faites via l'UI en production écrivent sur le VPS, pas dans le repo local. Si les données de production doivent revenir dans le repo, faire un pullback explicite des assets.

## Règles de modification

- Ne jamais lire, afficher ou commiter `.env`.
- Ne jamais commiter de secret réel.
- Ne pas présenter le backend comme une app Express : le projet utilise un routeur maison.
- Ne pas changer le comportement OAuth/session sans le signaler.
- Le cookie de session réel est actuellement `map_session`.
- Garder le front en modules ES et le serveur en CommonJS.
- Préférer des correctifs minimaux et ciblés.
- Respecter les données JSON existantes et valider avant livraison.

## Pièges connus

- Nginx conserve les préfixes `/api` et `/auth`.
- Ne pas mettre de slash final sur `proxy_pass http://127.0.0.1:4173;` si cela réécrit les chemins.
- `assets/map.png` et certains médias lourds peuvent dépendre de Git LFS.
- Les données modifiées en prod peuvent être écrasées par un déploiement si le repo local n'est pas synchronisé.
- `COOKIE_NAME` n'est pas une variable active tant que le code garde `map_session` en dur.
- `/api/events/stream` est un flux SSE : tester avec un client qui accepte une connexion longue.

## Commandes de test

```bash
npm run lint
npm run test:unit
npm run test:ui
python tools/validate_assets.py
```

Commandes utiles en prod :

```bash
curl -i https://cartehesta.dannytech.fr/health
curl -i https://cartehesta.dannytech.fr/auth/session
curl -i https://cartehesta.dannytech.fr/api/annotations
curl -i https://cartehesta.dannytech.fr/api/events/stream
```
