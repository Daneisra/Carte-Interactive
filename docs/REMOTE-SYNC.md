# Configuration de la synchronisation distante

Le serveur `server.js` peut pousser une copie du dataset des lieux vers un endpoint HTTP externe apres chaque sauvegarde. Cette page recapitule la marche a suivre.

## 1. Variables d'environnement

Remplis le fichier `.env` (ou exporte les variables equivalentes) :

```
REMOTE_SYNC_URL=http://localhost:4780/sync
REMOTE_SYNC_METHOD=POST    # POST, PUT ou PATCH
REMOTE_SYNC_TOKEN=dev-sync-token   # optionnel
REMOTE_SYNC_TIMEOUT=5000    # en millisecondes
```

- `REMOTE_SYNC_URL` : URL du serveur distant.
- `REMOTE_SYNC_METHOD` : verbe HTTP utilise.
- `REMOTE_SYNC_TOKEN` : si renseigne, il est envoye dans le header `Authorization: Bearer <TOKEN>`.
- `REMOTE_SYNC_TIMEOUT` : delai maximum avant abandon.

## 2. Serveur distant de test (optionnel)

Pour tester en local, lance le mock fourni :

```
npm run sync:mock
```

Ce script (`tools/mockRemoteSync.js`) ecoute sur `http://localhost:4780/sync` et enregistre chaque requete dans `assets/logs/remote-sync.log`.

## 3. Tester la synchro

1. Demarre le mock (`npm run sync:mock`) ou ton vrai endpoint.
2. Lance l'application : `npm run serve`.
3. Depuis l'editeur, ajoute/modifie un lieu puis sauvegarde.
4. Verifie la reponse JSON : le bloc `sync` doit valider (`status: 'ok'`).
5. Consulte `assets/logs/remote-sync.log` pour voir la charge utile envoyee (timestamp, diff, dataset).

En cas d'echec, le serveur loggue l'erreur cote console (`[sync] remote export failed ...`) et la reponse HTTP contient `sync: 'error'` et `syncError`.

## 4. Production

- Deploie un endpoint HTTPS accessible depuis ton serveur.
- Configure `REMOTE_SYNC_URL` avec l'URL publique et `REMOTE_SYNC_TOKEN` avec un secret (ex: token Bearer).
- Active `COOKIE_SECURE=true` si ton site est servi en HTTPS.
