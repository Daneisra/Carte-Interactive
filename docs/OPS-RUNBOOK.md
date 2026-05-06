# Runbook Ops

Commandes utiles pour exploiter et dépanner la production.

## Connexion

```bash
ssh debian@cartehesta.dannytech.fr
cd /srv/cartehesta/app
```

## Modifier `.env`

```bash
cd /srv/cartehesta/app
nano .env
pm2 restart carte-api --update-env
pm2 save
```

## PM2

```bash
pm2 ls
pm2 describe carte-api
pm2 logs carte-api --lines 100
pm2 restart carte-api --update-env
pm2 save
```

## Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

## Healthchecks

Local VPS :

```bash
curl -i http://127.0.0.1:4173/health
curl -i http://127.0.0.1:4173/auth/session
curl -i http://127.0.0.1:4173/api/annotations
```

Production publique :

```bash
curl -i https://cartehesta.dannytech.fr/health
curl -i https://cartehesta.dannytech.fr/auth/session
curl -i https://cartehesta.dannytech.fr/api/annotations
curl -i https://cartehesta.dannytech.fr/api/events/stream
```

Vérifier que Node écoute :

```bash
ss -ltnp | grep 4173
```

## Relancer le déploiement GitHub

Depuis GitHub, utiliser `Actions > deploy > Run workflow`.

Depuis le VPS, pour un redémarrage sans redeploy :

```bash
cd /srv/cartehesta/app
pm2 restart carte-api --update-env
pm2 save
```

## Debug 502

```bash
pm2 ls
pm2 logs carte-api --lines 200
ss -ltnp | grep 4173
curl -i http://127.0.0.1:4173/health
sudo tail -n 100 /var/log/nginx/error.log
```

Causes probables :

- PM2 arrêté.
- Mauvais `PORT`.
- Node n'écoute pas sur `127.0.0.1:4173`.
- Erreur au démarrage liée à `.env`.

## Debug 404 `/api` ou `/auth`

```bash
curl -i http://127.0.0.1:4173/auth/session
curl -i https://cartehesta.dannytech.fr/auth/session
curl -i https://cartehesta.dannytech.fr/api/annotations
sudo nginx -T | grep -A20 "location /auth/"
sudo nginx -T | grep -A20 "location /api/"
```

Vérifier que Nginx conserve les préfixes :

```nginx
proxy_pass http://127.0.0.1:4173;
```

Ne pas mettre de slash final qui réécrit les chemins.

## Debug MIME JS

```bash
curl -I https://cartehesta.dannytech.fr/js/main.js
curl -I https://cartehesta.dannytech.fr/map/
curl -I https://cartehesta.dannytech.fr/timeline/
```

Si un fichier JS retourne `text/html`, le fallback Nginx sert probablement `index.html` à la place du fichier demandé.

## Debug 413 upload

```bash
sudo nginx -T | grep client_max_body_size
```

La valeur attendue est :

```nginx
client_max_body_size 25M;
```

Puis :

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Debug Discord OAuth

```bash
curl -i https://cartehesta.dannytech.fr/auth/session
pm2 logs carte-api --lines 200
```

Vérifier :

- `DISCORD_REDIRECT_URI=https://cartehesta.dannytech.fr/auth/discord/callback`
- URI identique dans Discord Developer Portal.
- `COOKIE_SECURE=true` en production.
- `/auth/` proxifié vers Node sans strip du préfixe.
- `.env` rechargé avec `pm2 restart carte-api --update-env`.

## Certificat

```bash
sudo certbot renew --dry-run
sudo systemctl reload nginx
```

## Permissions

```bash
ls -la /srv/cartehesta/app
ls -la /srv/cartehesta/app/assets
ls -la /srv/cartehesta/app/assets/logs
```

L'utilisateur qui exécute PM2 doit pouvoir écrire dans `assets/` et `assets/logs/`.
