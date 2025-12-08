# OAuth Discord – guide pragmatique

Ce projet expose une implémentation “opinionated” de l’OAuth Discord déjà câblée dans `server/routes/auth.js`. Voici comment l’activer, le tester et le dépanner rapidement.

## 1. Variables d’environnement à remplir (`.env`)

```
DISCORD_CLIENT_ID=xxxx
DISCORD_CLIENT_SECRET=xxxx
DISCORD_REDIRECT_URI=http://localhost:4173/auth/discord/callback
DISCORD_ADMIN_IDS=1172705521317449809,autres_ids_optionnels

# Sessions / cookies
SESSION_SECRET=change-me-base64
SESSION_TTL_MS=43200000
COOKIE_SECURE=false   # true en prod HTTPS

# (optionnel) API Discord alternative pour les tests
# DISCORD_API_ORIGIN=http://127.0.0.1:4174/discord
```

À configurer aussi dans le portail Discord :
- **Redirects** : ajouter exactement l’URI de `DISCORD_REDIRECT_URI` (par défaut `http://localhost:4173/auth/discord/callback`).
- **Scopes** : `identify` suffit (déjà imposé par le code).

Admins : tout utilisateur dont l’ID figure dans `DISCORD_ADMIN_IDS` devient `admin` à la première connexion. Les autres sont `user`.

## 2. Démarrer en local

```
npm install
npm run serve      # lance server.js
# Ouvre http://localhost:4173 puis clique "Connexion Discord"
```

- Les sessions sont persistées dans `assets/logs/sessions.json` (in-memory hydraté au démarrage + flush périodique). Supprime le fichier pour repartir à zéro.
- `COOKIE_SECURE=false` en local ; active-le en HTTPS prod.

## 3. Stub Discord pour les tests

Pour éviter d’appeler l’API Discord en CI/local automatisé :

```
# dans un terminal
node tools/devServerWithStub.js

# dans le terminal app
set DISCORD_API_ORIGIN=http://127.0.0.1:4174/discord
set DISCORD_CLIENT_ID=stub-client
set DISCORD_CLIENT_SECRET=stub-secret
set DISCORD_REDIRECT_URI=http://localhost:4173/auth/discord/callback
set DISCORD_ADMIN_IDS=discord:tester
npm run serve
```

Puis naviguer sur `/auth/discord/login` : le stub renvoie un code factice, la callback finalise la session “tester”.

## 4. Points de terminaison utiles

- `GET /auth/session` : payload `authenticated`, `role`, `username`, `authRequired`.
- `GET /auth/discord/login` : génère un `state` en mémoire (TTL 5 min) et redirige vers Discord/stub.
- `GET /auth/discord/callback` : valide `state`, échange le `code`, crée la session, renvoie une 302 vers `/` (ou `?redirect=` si fourni).
- `POST /auth/logout` : détruit la session et supprime le cookie.

## 5. Dépannage rapide

- **302 Not Found / mauvaise redirection** : vérifier `DISCORD_REDIRECT_URI` côté code *et* côté portail Discord (exact match).
- **401 partout** : la session a expiré ou `SESSION_SECRET` a changé ; vider `assets/logs/sessions.json` et reconnecter.
- **State mismatch** : callback retardée >5 min ou multiple onglets ; relancer `/auth/discord/login`.
- **Rôle incorrect** : s’assurer que l’ID Discord est listé dans `DISCORD_ADMIN_IDS` (séparés par des virgules, sans espaces).

## 6. Sécurité

- Les cookies sont `HttpOnly; SameSite=Lax`; activer `COOKIE_SECURE=true` en HTTPS.
- Les tokens Discord ne sont jamais stockés ; seule l’identité (`id`, `username`) est conservée.
- Le magasin de sessions est en mémoire + `assets/logs/sessions.json` (texte). Prévoir un store externalisé si besoin (Redis, SQLite, …).
