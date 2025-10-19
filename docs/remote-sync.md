# Configuration de la synchronisation distante

Le serveur server.js peut pousser une copie du dataset des lieux vers un endpoint HTTP externe apr�s chaque sauvegarde. Cette page r�capitule la marche � suivre.

## 1. Variables d'environnement

Remplis le fichier .env (ou exporte les variables �quivalentes) :

`
REMOTE_SYNC_URL=http://localhost:4780/sync
REMOTE_SYNC_METHOD=POST    # POST, PUT ou PATCH
REMOTE_SYNC_TOKEN=dev-sync-token   # optionnel
REMOTE_SYNC_TIMEOUT=5000    # en millisecondes
`

- REMOTE_SYNC_URL : URL du serveur distant.
- REMOTE_SYNC_METHOD : verbe HTTP utilis�.
- REMOTE_SYNC_TOKEN : si renseign�, il est envoy� dans le header Authorization: Bearer <TOKEN>.
- REMOTE_SYNC_TIMEOUT : d�lai maximum avant abandon.

## 2. Serveur distant de test (optionnel)

Pour tester en local, lance le mock fourni :

`
npm run sync:mock
`

Ce script (	ools/mockRemoteSync.js) �coute sur http://localhost:4780/sync et enregistre chaque requ�te dans ssets/logs/remote-sync.log.

## 3. Tester la synchro

1. D�marre le mock (
pm run sync:mock) ou ton vrai endpoint.
2. Lance l'application : 
pm run serve.
3. Depuis l'�diteur, ajoute/modifie un lieu puis sauvegarde.
4. V�rifie la r�ponse JSON : le bloc sync doit valider (status: 'ok').
5. Consulte ssets/logs/remote-sync.log pour voir la charge utile envoy�e (timestamp, diff, dataset).

En cas d'�chec, le serveur loggue l'erreur c�t� console ([sync] remote export failed �) et la r�ponse HTTP contient sync: 'error' et syncError.

## 4. Production

- D�ploie un endpoint HTTPS accessible depuis ton serveur.
- Configure REMOTE_SYNC_URL avec l'URL publique et REMOTE_SYNC_TOKEN avec un secret (ex: token Bearer).
- Active COOKIE_SECURE=true si ton site est servi en HTTPS.
