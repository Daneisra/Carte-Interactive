# Déploiement VPS

Guide de déploiement pour la production actuelle de Carte Interactive Hesta.

## Production actuelle

- Domaine : `https://cartehesta.dannytech.fr`
- VPS : OVH Debian 12
- Dossier app : `/srv/cartehesta/app`
- Process PM2 : `carte-api`
- Node : `127.0.0.1:4173`
- Nginx sert les fichiers statiques et reverse-proxy `/api/` et `/auth/`.

## Connexion SSH

```bash
ssh debian@cartehesta.dannytech.fr
cd /srv/cartehesta/app
```

Adapter l'utilisateur et l'hôte si nécessaire :

```bash
ssh <VPS_USER>@<VPS_HOST>
```

## Arborescence

```txt
/srv/cartehesta/app
├── index.html
├── map/
├── timeline/
├── js/
├── assets/
├── server/
├── server.js
├── package.json
└── .env
```

## Node, npm et PM2

```bash
cd /srv/cartehesta/app
npm ci --omit=dev || npm i --omit=dev
pm2 start server.js --name carte-api
pm2 save
```

Après modification du `.env` :

```bash
cd /srv/cartehesta/app
pm2 restart carte-api --update-env
pm2 save
```

## GitHub Actions

Le workflow de déploiement synchronise le repo vers le VPS par rsync, exclut `.env`, `node_modules/`, `.git/`, `.github/` et certains médias lourds conservés sur le VPS, puis recharge `carte-api`.

Secrets GitHub attendus :

- `VPS_HOST`
- `VPS_USER`
- `VPS_KEY`
- `VPS_APP_DIR`

## Git LFS

Certains médias lourds peuvent être suivis par Git LFS, notamment `assets/map.png` et des fichiers audio. Si le budget LFS est dépassé, le checkout CI peut échouer. Le déploiement actuel évite de remplacer certains assets lourds côté VPS ; conserver cette logique tant que les médias ne sont pas sortis de LFS.

## Variables `.env`

Créer `/srv/cartehesta/app/.env` à partir de `.env.example`, avec des valeurs production.

À adapter en production :

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=4173
BASE_URL=https://cartehesta.dannytech.fr
ORIGIN=https://cartehesta.dannytech.fr
COOKIE_SECURE=true
DISCORD_REDIRECT_URI=https://cartehesta.dannytech.fr/auth/discord/callback
```

Ne pas ajouter `COOKIE_NAME` tant que le code utilise le cookie réel `map_session`.

## Nginx

Exemple de vhost :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name cartehesta.dannytech.fr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name cartehesta.dannytech.fr;

    root /srv/cartehesta/app;
    index index.html;

    client_max_body_size 25M;

    location ^~ /node_modules/ {
        deny all;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection "";
        proxy_read_timeout 1h;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection "";
        proxy_read_timeout 1h;
    }

    location /assets/ { try_files $uri =404; }
    location /js/ { try_files $uri =404; }
    location /map/ { try_files $uri $uri/ /map/index.html; }
    location /timeline/ { try_files $uri $uri/ /timeline/index.html; }
    location /docs/ { try_files $uri =404; }

    location / {
        try_files $uri $uri/ /index.html;
    }

    ssl_certificate /etc/letsencrypt/live/cartehesta.dannytech.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cartehesta.dannytech.fr/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

Important : `proxy_pass http://127.0.0.1:4173;` conserve les préfixes `/api` et `/auth`. Ne pas utiliser `proxy_pass http://127.0.0.1:4173/;` si cela strip les préfixes.

Tester et recharger :

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Certbot

```bash
sudo certbot --nginx -d cartehesta.dannytech.fr
sudo certbot renew --dry-run
```

## UFW

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw status
```

## Upload 25 Mo

Le serveur limite les uploads à 25 Mo. Nginx doit aussi avoir :

```nginx
client_max_body_size 25M;
```

Sans cette directive, les uploads peuvent échouer en 413 avant d'atteindre Node.

## `.htaccess`

`.htaccess` est inutile en production VPS Nginx. Il ne s'applique qu'à Apache.
