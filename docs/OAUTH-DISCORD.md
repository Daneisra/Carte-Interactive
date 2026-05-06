# OAuth Discord

Cette page documente uniquement l'authentification Discord de Carte Interactive Hesta.

## Routes

- `GET /auth/session` : retourne l'état de session courant.
- `GET /auth/discord/login` : démarre OAuth Discord.
- `GET /auth/discord/callback` : reçoit le callback OAuth.
- `POST /auth/logout` : déconnecte l'utilisateur.
- `DELETE /auth/session` : alias technique de révocation de session côté code.

## Configuration Discord Developer Portal

Créer une application Discord, récupérer le client ID et le client secret, puis déclarer les redirect URI.

Redirect URI local :

```txt
http://localhost:4173/auth/discord/callback
```

Redirect URI production :

```txt
https://cartehesta.dannytech.fr/auth/discord/callback
```

## Variables locales

```env
DISCORD_CLIENT_ID=xxxxxxxx
DISCORD_CLIENT_SECRET=xxxxxxxx
DISCORD_REDIRECT_URI=http://localhost:4173/auth/discord/callback
DISCORD_ADMIN_IDS=
SESSION_SECRET=xxxxxxxx
SESSION_TTL_MS=43200000
COOKIE_SECURE=false
```

## Variables production

```env
DISCORD_CLIENT_ID=xxxxxxxx
DISCORD_CLIENT_SECRET=xxxxxxxx
DISCORD_REDIRECT_URI=https://cartehesta.dannytech.fr/auth/discord/callback
DISCORD_ADMIN_IDS=1172705521317449809
SESSION_SECRET=xxxxxxxx
SESSION_TTL_MS=43200000
COOKIE_SECURE=true
```

`DISCORD_ADMIN_IDS` donne le rôle admin lors de l'upsert utilisateur à la connexion. Les tokens Discord et secrets OAuth ne doivent jamais être stockés dans Git.

## Cookies et sessions

- Le cookie réel actuel est `map_session`, codé en dur côté serveur.
- Ne pas documenter `COOKIE_NAME` comme variable active tant que le code n'utilise pas `process.env.COOKIE_NAME`.
- Les sessions sont persistées dans `assets/logs/sessions.json`.
- `SESSION_TTL_MS` contrôle la durée de vie serveur.
- `COOKIE_SECURE=true` doit être utilisé en production HTTPS.

## Fonctionnement local

```bash
cp .env.example .env
npm install
npm run serve
```

Tester :

```bash
curl -i http://localhost:4173/auth/session
```

## Fonctionnement production

- Domaine : `https://cartehesta.dannytech.fr`
- Login : `https://cartehesta.dannytech.fr/auth/discord/login`
- Callback : `https://cartehesta.dannytech.fr/auth/discord/callback`
- Session : `https://cartehesta.dannytech.fr/auth/session`

Nginx doit conserver le préfixe `/auth` :

```nginx
location /auth/ {
    proxy_pass http://127.0.0.1:4173;
}
```

Ne pas utiliser `proxy_pass http://127.0.0.1:4173/;` si cela réécrit les chemins.

## Dépannage

- `redirect_uri mismatch` : vérifier que `DISCORD_REDIRECT_URI` correspond exactement à une URI déclarée dans Discord.
- `state mismatch` : vérifier les cookies, `SESSION_SECRET`, le domaine et le reverse proxy.
- Session non persistée : vérifier les droits d'écriture sur `assets/logs/` et le redémarrage PM2 avec `--update-env`.
- Cookie absent en prod : vérifier `COOKIE_SECURE=true`, HTTPS et `SameSite=Lax`.
- `/auth/session` renvoie du HTML : Nginx ne proxifie pas `/auth/` correctement.
- `/auth/session` renvoie 502 : Node/PM2 ne tourne pas ou n'écoute pas sur `127.0.0.1:4173`.
- Secrets Discord régénérés : mettre à jour `.env`, puis relancer `pm2 restart carte-api --update-env`.
