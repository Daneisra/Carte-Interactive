# Architecture

## Vue d'ensemble

Carte Interactive Hesta combine un front statique, une API Node légère et des fichiers JSON persistants. Le projet ne repose pas sur Express : `server.js` utilise un routeur maison déclaré dans `server/routes/index.js`.

```txt
Navigateur
  ├─ charge /, /map/, /timeline/
  ├─ fetch /assets/*.json
  ├─ fetch /auth/session
  └─ fetch /api/*

Nginx
  ├─ sert /srv/cartehesta/app
  ├─ proxy /api/*  -> 127.0.0.1:4173
  └─ proxy /auth/* -> 127.0.0.1:4173

Node server.js
  ├─ routes auth
  ├─ routes locations
  ├─ routes annotations
  ├─ routes quest events
  ├─ routes timeline
  ├─ route health
  └─ persistance JSON dans assets/
```

## Front

- `index.html` : accueil.
- `map/index.html` : carte.
- `timeline/index.html` : chronologie.
- `js/main.js` : charge les données et initialise la carte.
- `js/dataService.js` : charge `assets/types.json` et `assets/locations.json`, puis lance la validation.
- `js/mapController.js` : carte, marqueurs, zoom, sélection.
- `js/uiController.js` : panneaux carte, profil, admin, édition.
- `js/home.js` et `js/home-admin.js` : accueil et admin accueil.
- `js/timeline.js` : frise et admin chronologie.

## Backend

`server.js` charge `.env`, prépare les chemins de données, les helpers de fichiers, les sessions, les uploads, le SSE et les routes.

Routes principales :

- `server/routes/auth.js`
- `server/routes/locations.js`
- `server/routes/annotations.js`
- `server/routes/questEvents.js`
- `server/routes/timeline.js`
- `server/routes/health.js`

## Routeur maison

`server/routes/index.js` crée un routeur minimal avec enregistrement par méthode HTTP et chemin. Les routes reçoivent un contexte partagé depuis `server.js` : accès fichiers, auth, broadcast SSE, validation, logs et configuration.

## Données JSON

- `assets/locations.json` : lieux par continent.
- `assets/types.json` : icônes et zooms par type.
- `assets/annotations.json` : annotations.
- `assets/groups.json` : groupes.
- `assets/timeline.json` : événements de chronologie.
- `assets/planning.json` : sessions candidates/confirmées du planning.
- `assets/site-config.json` : accueil.
- `assets/users.json` : utilisateurs.
- `assets/logs/*` : logs, audit, sessions.

Les écritures passent par des helpers serveur et des verrous fichiers lorsque nécessaire.

## Auth et sessions

Discord OAuth est géré par `server/routes/auth.js`. Les utilisateurs sont persistés dans `assets/users.json`. Les sessions sont signées, persistées dans `assets/logs/sessions.json` et exposées via le cookie réel `map_session`.

## SSE temps réel

`GET /api/events/stream` ouvre un flux Server-Sent Events. Il sert à diffuser notamment les changements d'annotations, de lieux et d'événements de quête.

## Assets

- Images : `assets/images/`, `assets/home/`
- Audio : `assets/audio/`
- Icônes : `assets/icons/`
- Carte principale : `assets/map.png`

Les uploads admin utilisent une limite applicative de 25 Mo. Nginx doit aussi définir `client_max_body_size 25M;`.

## Flux ajouter/modifier un lieu

1. L'admin ouvre le formulaire depuis la carte.
2. Le front normalise les champs via les modules partagés.
3. L'API admin vérifie la session et les droits.
4. Le serveur valide le dataset.
5. `assets/locations.json` est réécrit.
6. Un événement SSE informe les clients.
7. La remote sync peut pousser une charge utile vers un endpoint externe si configurée.

## Flux connexion Discord

1. Le front appelle `/auth/session`.
2. L'utilisateur clique login Discord.
3. `/auth/discord/login` génère l'URL Discord.
4. Discord redirige vers `/auth/discord/callback`.
5. Le serveur crée/met à jour l'utilisateur.
6. La session est persistée et le cookie `map_session` est posé.

## Flux annotations

1. Le client lit `GET /api/annotations`.
2. Un utilisateur connecté peut créer une annotation.
3. Un admin peut supprimer une annotation.
4. Les clients reçoivent les changements via SSE.

## Flux timeline

1. La page `/timeline/` charge les événements visibles via `/api/timeline`.
2. L'admin chronologie charge la config complète via `/api/admin/timeline-config`.
3. Les modifications sont sauvegardées dans `assets/timeline.json`.
4. Les liens carte/frise utilisent les IDs de lieux liés.

## Flux planning

1. La page `/planning/` charge les sessions via `GET /api/planning/sessions`.
2. Les disponibilités de semaine type restent stockées dans le profil utilisateur.
3. Les sessions candidates/confirmées sont persistées dans `assets/planning.json`.
4. L'admin peut créer, modifier et supprimer une session via `/api/admin/planning/sessions`.
5. Un utilisateur connecté peut répondre à une date précise via `/api/planning/sessions/:id/response`.
