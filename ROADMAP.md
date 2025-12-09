# Carte Interactive — Roadmap & Ops (2025–2026)

> But : carte narrative immersive, fiable et maintenable, utilisée en jeu et comme référentiel vivant de l’univers.  
> Axes : qualité des données, excellence UX, industrialisation (CI/CD & ops).



## 1) Réalisations récentes (T4 2025)

- Front unifié (Leaflet + modules `DataService`, `MapController`, `UiController`) orchestré par `js/main.js`. :contentReference[oaicite:0]{index=0}
- Validation centralisée des datasets + nettoyage massif (images/audio/JSON). :contentReference[oaicite:1]{index=1}
- Galerie média et audio robustes (fallback, hover, etc.). :contentReference[oaicite:2]{index=2}
- Persistance locale (filtres, vue carte, favoris). :contentReference[oaicite:3]{index=3}
- Editeur in-app (CRUD Lieux) avec réécriture dans `assets/locations.json`. :contentReference[oaicite:4]{index=4}
- Auth Discord OAuth2 + sessions signées + panneau admin (rôles). **En prod.** :contentReference[oaicite:5]{index=5}
- Temps réel par SSE (`/api/events/stream`). **En prod.** :contentReference[oaicite:6]{index=6}
- Pipeline CI rétabli + déploiement continu sur VPS (rsync + PM2 + Nginx). **En prod.**



## 2) Chantiers prioritaires (H1 2026)

### P0 — Essentiels
- [x] Healthchecks prod : `GET /auth/session`, `GET /api/annotations`, `GET /api/events/stream` (200 attendu).
- [x] Stockage persistant des sessions entre redémarrages.
- [x] Workflows GitHub Actions : lint/tests + déploiement (rsync) + reload PM2.
- [x] UI admin : retours d’erreurs & télémétrie (inclure 4XX/5XX des routes).
- [x] Doc OAuth/Discord “opinionated” + check-lists CI.
- [x] Bouton “Download ZIP”
- [ ] Fix various error
- [ ] Gros Polish UI

### P1 — Valeur
- [ ] Quêtes interactives avec états visuels et transitions.
- [ ] Markers thématiques/stylés par type + légende.
- [ ] Tableau de bord live (compteurs SSE/latences) côté admin.

### P2 — Différenciants
- [ ] Carte chronologique (replay des lieux/événements).
- [ ] Partage/Export (JSON + capture visuelle).
- [ ] Marqueurs évolutifs (temps/événements).

### P3 — Hygiène & dette
- [ ] Modularisation fine de `UiController` et nettoyage des artefacts legacy.
- [ ] Harmonisation encodages (UTF-8) & lint assets. :contentReference[oaicite:7]{index=7}



## 3) Architecture (prod)

- **Domaine** : `https://cartehesta.dannytech.fr`
- **Front** : fichiers statiques servis par **Nginx** depuis `/srv/cartehesta/app` (où se trouve `index.html`).
- **API Node** (PM2) : `carte-api` écoute **127.0.0.1:4173**.
- **Proxy Nginx** :
  - `/api/*` → `http://127.0.0.1:4173/api/*` (JSON + SSE)
  - `/auth/*` → `http://127.0.0.1:4173/auth/*` (OAuth, sessions)
- **HTTPS** : Let’s Encrypt (Certbot), Nginx TLS.

**Arborescence serveur (prod)**

/srv/cartehesta/app
├── index.html
├── js/ ...             # front
├── assets/             # images, audio, JSON (déployés)
├── server/             # routes Express /auth, /api, utils
├── .env                # variables prod (voir plus bas)
└── (pm2) process: carte-api



## 4) Variables d’environnement (prod)

Fichier : `/srv/cartehesta/app/.env`

env
# App
NODE_ENV=production
HOST=127.0.0.1
PORT=4173
BASE_URL=https://cartehesta.dannytech.fr
ORIGIN=https://cartehesta.dannytech.fr

# Sessions/cookies
SESSION_SECRET=xxxxxxxxxx
COOKIE_NAME=sid
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
SESSION_TTL_MS=43200000

# OAuth Discord
DISCORD_CLIENT_ID=xxxxxxxxxx
DISCORD_CLIENT_SECRET=xxxxxxxxxx
DISCORD_REDIRECT_URI=https://cartehesta.dannytech.fr/auth/discord/callback
DISCORD_SCOPES=identify
DISCORD_ADMIN_IDS=1172705521317449809


> ⚠️ **Après toute modification du `.env`** :
> `cd /srv/cartehesta/app && pm2 restart carte-api --update-env && pm2 save`



## 5) Nginx (vhost)

Fichier : `/etc/nginx/sites-available/cartehesta.conf` (symlinké vers `sites-enabled/`)

nginx
# HTTP -> HTTPS
server {
  listen 80;
  listen [::]:80;
  server_name cartehesta.dannytech.fr;
  return 301 https://$host$request_uri;
}

# HTTPS
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name cartehesta.dannytech.fr;

  # FRONT statique
  root /srv/cartehesta/app;
  index index.html;

  # Ne jamais exposer node_modules
  location ^~ /node_modules/ { deny all; }

  # Dossiers statiques
  location /assets/ { try_files $uri =404; }
  location /js/     { try_files $uri =404; }
  location /css/    { try_files $uri =404; }
  location /images/ { try_files $uri =404; }

  # SPA fallback
  location / { try_files $uri $uri/ /index.html; }

  # BACKEND: API
  location /api/ {
    proxy_pass http://127.0.0.1:4173/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off; proxy_cache off; proxy_set_header Connection "";
    proxy_read_timeout 1h;
  }

  # BACKEND: Auth (hors /api)
  location /auth/ {
    proxy_pass http://127.0.0.1:4173/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off; proxy_cache off; proxy_set_header Connection "";
    proxy_read_timeout 1h;
  }

  # TLS (Certbot)
  ssl_certificate     /etc/letsencrypt/live/cartehesta.dannytech.fr/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/cartehesta.dannytech.fr/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}


> **Reload** : `sudo nginx -t && sudo systemctl reload nginx`



## 6) Déploiement & données (local ↔ prod)

### Flux standard (recommandé)

1. **Tu travailles en local** (VS Code + Git).
2. **Commit & push** sur `main` → **GitHub Actions** déclenche :

   * rsync des fichiers vers `/srv/cartehesta/app` (exclusions `.git`, `node_modules`, etc.)
   * `pm2 reload` de `carte-api`
3. Le site est à jour en prod.

### Edition depuis le site (admin)

* Si tu modifies un Lieu via l’éditeur in-app (autorisations Discord requises), l’API écrit **en prod** dans `assets/locations.json` (et médias dans `assets/images|audio`).
* **Bon réflexe** : périodiquement, **pull** ou **rsync** les fichiers prod → local pour garder ton repo aligné (ou ajoute un job “pull-back” si tu préfères).



## 7) Runbook Ops (pour toi & ton IA dans VS Code)

### Process Node (PM2)

bash
pm2 ls
pm2 logs carte-api --lines 200
pm2 restart carte-api --update-env
pm2 save


### Healthchecks (doivent renvoyer 200)

bash
curl -i https://cartehesta.dannytech.fr/auth/session
curl -i https://cartehesta.dannytech.fr/api/annotations
curl -i https://cartehesta.dannytech.fr/api/events/stream


### Debug reverse-proxy

* `curl -I https://cartehesta.dannytech.fr/js/main.js` → `content-type: application/javascript`
* `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log`
* Erreur 502 : vérifier que PM2 tourne et que `PORT=4173` est correctement **proxifié**.

### Variables d’env / cookies

* `ORIGIN` et `BASE_URL` = `https://cartehesta.dannytech.fr`
* `COOKIE_SECURE=true` (HTTPS), `SameSite=lax`
* Après modif `.env` → `pm2 restart carte-api --update-env`

### Certificats (Let’s Encrypt)

bash
sudo certbot renew --dry-run


### Déploiement manuel (si besoin)

bash
# rsync front/app depuis ta machine locale (exemple générique)
rsync -avz --delete --exclude ".git/" --exclude ".github/" --exclude "node_modules/" \
  ./  debian@<VPS>:/srv/cartehesta/app/
ssh debian@<VPS> "cd /srv/cartehesta/app && pm2 restart carte-api --update-env && pm2 save"




## 8) Convention & checklist PR

* Pas de données/credentials en clair dans le code.
* JSON validés (`assets/locations.json`, `assets/types.json`) avant merge.
* Test manuel post-déploiement :

  * carte s’affiche (200 sur `index.html` et `main.js`),
  * `/auth/session` retourne l’objet user si connecté (sinon `{authenticated:false}`),
  * `/api/annotations` 200 (JSON),
  * `/api/events/stream` 200 (flux texte “event: …”).



## 9) Annexes

* Backlog / idées : `ROADMAPbackup`, `idees.txt`
* Données : `assets/locations.json`, `assets/types.json`
* Tests : `tests/`, `test-results/` (legacy)
* Historique et chantiers : **cf. sections 1 & 2** de ce fichier.