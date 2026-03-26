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
- [x] Vrai panneau admin séparer avec centralisation de la Gestion utilisateurs, téléchargement assets, alerte de validation, erreurs, télémétrie etc
- [x] Possibilité de pouvoir ajouter/choisir les tags directement depuis ajouter un lieu et modifier un lieu
- [x] Masquer bouton Ajouter un lieu pour guest et user + masquer bouton Ouvrir le panneau admin pour guest et user
- [x] Polish UI

### P1 — Valeur
- [x] Amélioration du player audio, meilleur gestion de la lecture, meilleur gestion du volume, possiblités de loop etc
- [x] Ajout d'un champ famille nobles dans les lieux
- [x] Possiblités de créer des liens interlieux pour passer d'un lieu a l'autre directement depuis les textes des lieux
- [x] Création automatique de suggestion d'hyperlien dans les textes avec posibilités d'appliquer ou non la suggestions
- [x] Déplacer le cadre "connexion" dans un coin de la page (surement en haut a droite) et peut-être modifier la forme pour transformer ça en vrai bouton "profil" avec centralisation des informations de l'utilisateur et un début de personnalisation de profil
- [x] Création et gestion de groupe depuis panneau admin pour ensuite attribuer les groupes de jdr au profil utilisateur
- [x] Possiblités de placement des différents groupes sur la carte avec visualisation des utilisateurs a l'intérieur du groupe
- [x] Dans le profil utilisateur création de personnage avec nom, bio, avatar et groupe
- [x] Les personnages associés aux utilisateur apparaitrons dans les groupes sur la carte
- [x] Dans le profil possiblités de renseigner ces disponibilités a la semaine, remonter des information coté admin pour analyse et trouver les meilleurs créneaux de jeux selon les utilisateurs
- [x] Tableau de bord live (compteurs SSE/latences) côté admin.
- [x] Polish UI

### P2 — Menu profil (UX + contenu)
- [x] Carte profil plus claire: avatar grand, pseudo, rôle, groupe(s) en chips, statut/présence.
- [x] Multi‑personnages: carrousel + filtres, tag “actif”, duplication rapide, import/export.
- [x] Personnalisation: bannière, couleur d’accent, bio riche (markdown léger), liens sociaux.
- [x] Actions rapides: changer thème, raccourcis admin, accès “Mes lieux favoris”.
- [x] Feedback clair: état de sauvegarde, erreurs inline, historique des edits récents.
- [x] Sécurité/compte: bouton “révoquer session”, infos Discord, date dernière connexion.
- [x] Polish UI

### P3.1 — Page d’accueil (MVP pré-carte)
- [x] Créer une page d’accueil dédiée avant la carte (route `/`).
- [x] Déplacer l’accès carte sur une route dédiée (`/map`) ou équivalent sans casser l’accès direct.
- [x] Ajouter un CTA principal **“Entrer sur la carte”**.
- [x] Ajouter un bouton secondaire **“Continuer sans se connecter”** (lecture seule).
- [x] Ajouter **Connexion Discord** sur la page d’accueil.
- [x] Afficher état session si connecté (avatar, pseudo, rôle, bouton “Aller à la carte”).
- [x] Ajouter une section courte de présentation (univers + objectif de la carte).
- [x] Ajouter une section **Réseaux / Communauté** : YouTube, Discord, Reddit.
- [x] Ajouter un footer avec **copyright**, crédits, contact, mentions du projet.
- [x] Design responsive propre (mobile + desktop).

### P3.2 — UX & contenu de l’accueil
- [x] Hero immersif (visuel/illustration + tagline).
- [x] Bloc **Fonctionnalités** (exploration, quêtes live, groupes, audio, annotations).
- [x] Bloc **Comment commencer** (3 étapes simples).
- [x] Bloc **Nouveautés** (derniers événements/ajouts majeurs).
- [x] CTA **Rejoindre le Discord**.
- [x] CTA **Voir le contenu YouTube**.
- [x] Bloc “Reprendre” pour utilisateur connecté (favoris / accès rapide carte).
- [x] Message d’état clair si API/session indisponible.

### P3.3 — Auth, session & navigation
- [x] Réutiliser `/auth/session` pour hydrater l’accueil.
- [x] Gérer les états `guest / user / admin` sur l’accueil.
- [x] Gérer redirects login propres (`/auth/discord/login?redirect=/map` ou retour accueil).
- [x] Ajouter bouton **Se déconnecter** depuis l’accueil.
- [x] Afficher infos compte minimales (provider, Discord, dernière connexion).
- [x] Prévoir accès rapide admin (si admin connecté).

### P3.4 — Réseaux sociaux & footer (propre / maintenable)
- [x] Externaliser les URLs sociales (config JSON ou `.env`) pour éviter le hardcode.
- [x] Icônes sociales accessibles (labels/aria).
- [x] Liens externes sécurisés (`target="_blank"` + `rel="noopener noreferrer"`).
- [x] Footer avec crédits assets (images/audio/icônes).
- [x] Mention “fan project” / cadre IP (si nécessaire).
- [x] Lien vers support / bugs / contact.

### P3.5 — Perf, SEO, accessibilité
- [x] Ne pas charger Leaflet + assets carte lourds sur l’accueil (chargement à la demande).
- [x] Meta `title` + `description` dédiés à l’accueil.
- [x] Open Graph (image de partage, titre, description).
- [x] Structure HTML sémantique (`header`, `main`, `section`, `footer`).
- [x] Navigation clavier complète + focus visibles.
- [x] Support `prefers-reduced-motion`.
- [x] Vérifier contraste et lisibilité mobile.

### P3.6 — Polish UI (accueil)
- [x] Direction artistique forte (hero, textures, typo, ambiance).
- [x] Animations légères (entrées, hover CTA, transitions sections).
- [x] Version mobile soignée (CTA visibles sans trop scroller).
- [x] États de chargement élégants (session/auth/API).
- [x] Cohérence visuelle avec la carte et le menu profil.

### P3.7 — Bonus (plus tard)
- [x] Preview du flux temps réel sur l’accueil (mini bloc live).
- [x] Mise en avant de lieux/continents (cards).
- [x] Widget communauté (ex: lien invitation Discord enrichi).
- [x] Écran d’accueil personnalisable côté admin (textes/liens/hero).

### Ordre recommandé (exécution)
- [x] Phase 1 : `/` + CTA carte + login + footer/socials.
- [x] Phase 2 : états de session + redirects auth.
- [x] Phase 3 : contenu (hero, fonctionnalités, nouveautés).
- [x] Phase 4 : perf/SEO/accessibilité.
- [x] Phase 5 : polish UI final.

### P3.8 - Refonte premium de l'accueil
- [x] Refaire le hero en version premium plein ecran.
- [x] Ajouter un fond illustre immersif avec profondeur, brume et halos.
- [x] Ajouter un render personnage HD integre au hero.
- [x] Ajouter une preview mockup de la carte avec mini fiche lieu flottante.
- [x] Ajouter une preuve sociale visuelle (bloc communauté, widget Discord, avatars).
- [x] Ajouter un header plus premium (logo, navigation courte, CTA clairs).
- [x] Brancher les visuels/textes hero dans la configuration admin de l'accueil.
- [x] Finaliser responsive mobile/tablette de la landing premium.
- [x] Polish final : ombres, micro-interactions, animations legeres, coherence typographique.

### Direction artistique recommandee - Hesta
- [x] Palette : bleu nuit, ivoire, or doux, cyan froid pour les accents interactifs.
- [x] Typographies : une fonte editoriale pour les titres + une fonte UI tres lisible pour l'interface.
- [x] Composition : grand titre centre, sous-texte court, CTA alignes, preuve sociale sous les CTA.
- [x] Showcase : carte en mockup central avec perspective legere et overlays narratifs.
- [x] Personnage : silhouette detouree cote droit avec halo discret et ancrage visuel fort.
- [x] Background : illustration panoramique avec gradients, texture et profondeur atmospherique.
- [x] UI tone : sobre, premium, epure, plus 'univers vivant' que 'dashboard'.

### Assets a produire / reunir
- [x] Un fond hero large HD (desktop + mobile).
- [x] Un render personnage detoure propre (PNG/WebP).
- [x] Un screenshot tres propre de la carte pour le mockup.

### Fix Pré P3
- [x] Fix la suppression des annotations
- [x] Sur la carte ajouter un bouton pour revenir a l'acceuil
- [x] Possibilité de fermer/réduire le panneaux "Flux temps réel"

### P4 — Frise chronologique
- [x] Frise chronologique complète (axe horizontal gauche -> droite, année, titre, texte, médias, liens vers la carte)
- [x] Etat actuel : MVP technique livré (page dédiée, admin, médias, filtres, liens carte <-> frise, tests UI).
- [x] Avancement récent : regroupement visuel par période ajouté dans la frise horizontale.
- [x] Avancement récent : état de la frise partageable par URL (événement actif + filtres synchronisés).
- [x] Avancement récent : navigation rapide par période ajoutée dans la page chronologie.
- [x] Avancement récent : période active et accent du panneau détail synchronisés pour une lecture plus premium.
- [x] Avancement récent : bandeau de lecture active ajouté dans la frise pour ancrer le contexte courant.
- [x] Avancement récent : enrichissement éditorial des événements, regroupements avancés par époque et raffinement du détail de lecture.
- [x] Avancement récent : affichage des images fiabilisé via chemins médias normalisés et noms de fichiers alignés avec les assets réels.
- [x] Recommandation produit : page dédiée `/timeline` d'abord, intégration légère dans la carte ensuite.
- [x] P4.1 - Cadrage produit V2 de la frise : tri chronologique ascendant, regroupement visuel par périodes contiguës, densité moyenne (carte résumée + détail riche), page dédiée comme point d'entrée principal, état partageable par URL, personnalisation éditoriale avancée limitée à l'accent, l'image, les tags, les lieux liés et la visibilité.
- [x] Décision P4.1 - La carte reste un point d'entrée secondaire vers la frise, sans intégrer la timeline complète dans l'interface principale de navigation.
- [x] Décision P4.1 - Les évolutions V2 hors périmètre immédiat sont : replay cartographique, exports, calendriers complexes, embranchements narratifs et filtres ultra spécialisés.
- [x] P4.2 - Modèle de données chronologie : `id`, `annee`, `titre`, `resume`, `texte`, `epoque`, `periode`, `tags`, `image`, `mediaAlt`, `lieux lies`, `ordre`, `visible`.
- [x] P4.3 - Source de données / persistance : fichier JSON ou API admin dédiée pour CRUD, ordre manuel, publication/masquage.
- [x] P4.4 - Page dédiée chronologie : route `/timeline`, header cohérent avec l'accueil et la carte, CTA retour accueil/carte.
- [x] P4.5 - UI frise horizontale MVP : navigation gauche -> droite, cartes événement, scroll/drag horizontal, état vide, responsive propre.
- [x] P4.6 - Détail événement : année, titre, texte long, image optionnelle, tags, lieux liés, CTA "Voir sur la carte".
- [x] P4.7 - Admin chronologie : créer / éditer / supprimer / réordonner les événements, gérer visibilité, aperçu rapide.
- [x] P4.8 - Lien frise -> carte : ouvrir la carte sur un lieu ou groupe de lieux liés depuis un événement.
- [x] P4.9 - Lien carte -> frise : depuis un lieu, afficher plus tard les événements historiques liés dans un panneau ou une section dédiée.
- [x] P4.10 - Filtres chronologie : époque, région, faction, type d'événement, recherche texte.
- [x] P4.11 - QA chronologie : accessibilité clavier, performances, mobile/tablette, validation des contenus et tests navigateur ciblés.

### Note produit - Frise chronologique
- [x] Page dédiée : meilleure lisibilité, plus de place pour une vraie frise horizontale, plus simple à rendre premium et responsive.
- [x] Décision recommandée : construire la version complète sur page dédiée, puis ajouter un point d'entrée compact sur la carte.
- [x] MVP recommandé : année + titre + texte + image optionnelle + lieux liés + bouton "Voir sur la carte".

### P5 — Séparation des panneaux admin
- [x] Séparer l'administration en trois panneaux dédiés : accueil, chronologie et carte, pour éviter de tout piloter depuis le panneau admin de la carte.
- [x] Constat actuel : l'admin carte concentre encore trop de responsabilités transverses (carte, accueil, frise), ce qui nuit à la lisibilité et à la maintenabilité.
- [x] Cible produit : un panneau admin par surface fonctionnelle, accessible depuis la page concernée, avec auth/rôles mutualisés mais périmètres clairement séparés.
- [x] Décision d'architecture : conserver une base UI/admin mutualisée quand c'est pertinent, mais découper les entrées, états et handlers par domaine (`home`, `timeline`, `map`).
- [x] P5.1 - Cadrage fonctionnel : périmètres définis pour éviter tout recouvrement flou entre accueil, chronologie et carte.
- [x] Inventaire actuel : le panneau admin de `/map` contient aujourd'hui `Statut`, `Actions`, `Accueil`, `Chronologie`, `Disponibilites joueurs`, `Live`, `Alertes de validation` et `Télémétrie / erreurs`.
- [x] P5.1.a - Admin accueil : hero, CTA, liens sociaux, blocs communauté, textes, visuels, mises en avant, support/dons, footer, patch notes et configuration éditoriale de `/`.
- [x] Décision P5.1.a - Le futur panneau admin accueil reprend l'actuelle section `Accueil` du panneau carte, sans logique lieux/carte/temps réel.
- [x] P5.1.b - Admin chronologie : méta de `/timeline`, événements, périodes, médias, tags, lieux liés, ordre, visibilité et aperçu rapide de la frise.
- [x] Décision P5.1.b - Le futur panneau admin chronologie reprend l'actuelle section `Chronologie` du panneau carte, sans outils runtime de la carte.
- [x] P5.1.c - Admin carte : lieux, annotations, quêtes, groupes JDR, couches, assets, disponibilités, live metrics, validation et télémétrie, c'est-à-dire tout ce qui reste opérationnellement lié à l'expérience carte ou au pilotage en jeu.
- [x] Décision P5.1.c - En l'absence d'un 4e panneau "ops", `Gestion utilisateurs`, `Gestion groupes`, `Disponibilites`, `Live`, `Alertes` et `Télémétrie` restent rattachés à l'admin carte pour cette phase.
- [x] Règle P5.1 - Aucun écran admin ne doit éditer des données dont il n'est pas propriétaire : pas d'édition accueil depuis `/map`, pas d'édition frise depuis `/map`, pas d'édition lieux depuis `/` ou `/timeline`.
- [x] Règle P5.1 - Auth, permissions, feedback de sauvegarde, conventions visuelles et composants de formulaire peuvent rester mutualisés entre les trois panneaux.
- [x] P5.2 - Points d'entrée UI : accès admin dédié sur l'accueil et sur la page chronologie, avec deep link vers la bonne section du panneau admin carte en attendant la séparation complète.
- [x] P5.3 - Isolation des états front : la carte ouvre désormais le panneau admin avec un scope explicite (`map`, `home`, `timeline`) et ne précharge plus l'état accueil/chronologie hors du contexte demandé.
- [x] P5.4 - Isolation des handlers front : la logique admin `accueil` et `chronologie` est maintenant regroupée dans des modules dédiés, `uiController` gardant seulement l'orchestration du panneau et des wrappers de transition.
- [x] P5.5 - Base UI mutualisée : un socle partagé gère maintenant les patterns UI communs des admins (`status`, erreurs inline, disable des champs, boutons reload/save), prêt à être réutilisé par les trois panneaux.
- [x] P5.6 - API / persistance accueil : l'admin accueil pointe maintenant vers un endpoint dédié `/api/admin/home-config`, adossé à la même persistance `assets/site-config.json`, avec compatibilité transitoire conservée sur l'ancien endpoint générique.
- [x] P5.7 - API / persistance chronologie : l'admin chronologie pointe maintenant vers un endpoint dédié `/api/admin/timeline-config`, adossé à la même persistance `assets/timeline.json`, avec alias legacy `/api/admin/timeline` conservé pendant la transition.
- [x] P5.8 - Recentrage admin carte : l'accueil et la chronologie ont maintenant leurs panneaux admin dédiés sur `/` et `/timeline`, les anciens deep links sont redirigés vers ces panneaux, et les sections `Accueil` / `Chronologie` ont été retirées du panneau admin carte.
- [x] P5.9 - Navigation admin cohérente : intitulés harmonisés (`Admin accueil`, `Admin chronologie`, `Admin carte`), raccourcis croisés ajoutés dans les trois surfaces, et compatibilité conservée pour les anciens liens vers `/map/?adminSection=...`.
- [x] P5.10 - QA et non-régression : tester l'ouverture/fermeture, les sauvegardes, les permissions et les parcours admin sur les trois surfaces.
  - Couverture Playwright etendue sur les parcours admin/invite, les redirections legacy, les raccourcis croises et les sauvegardes home/timeline mockees.
- [x] Ordre recommandé :
- [x] Phase 1 : cadrage des périmètres + inventaire des sections admin existantes.
- [x] Phase 2 : créer les points d'entrée accueil/chronologie et la base UI mutualisée.
- [x] Phase 3 : brancher le panneau admin accueil.
- [x] Phase 4 : brancher le panneau admin chronologie.
- [x] Phase 5 : nettoyer et recentrer le panneau admin carte.
- [x] Phase 6 : QA complète et polish.
  - Couverture UI complete relancee sur Chromium et Firefox, avec verrouillage des fermetures clavier, du retour focus au declencheur, du scroll lock et du comportement fullscreen des panneaux admin dedies.

### P6 — Homogénéisation des descriptions de lieux (assistée par IA)
- [ ] Recentrer les fiches lieux sur une structure claire : `description` courte, `lore` long, `histoire` longue.
- [ ] Cesser d'utiliser `description`, `lore` et `histoire` comme zones interchangeables dans l'édition des lieux.
- [ ] Définir `description` comme résumé court officiel affiché dans la carte et les aperçus.
- [ ] Définir `lore` / `histoire` comme sources narratives principales pour générer ce résumé.
- [ ] Ajouter dans l'admin lieu un bouton `Generer la description` depuis `lore` / `histoire`.
- [ ] Utiliser une assistance IA pour proposer une description courte, homogène et non hallucinée.
- [ ] Conserver une validation humaine systématique : la description générée reste éditable avant sauvegarde.
- [ ] Empêcher l'écrasement silencieux d'une description existante sans confirmation explicite.
- [ ] Définir un format cible pour la génération : 2 a 4 phrases, ton neutre, informatif, sans invention.
- [ ] Clarifier l'UI admin avec aide contextuelle sur le rôle de chaque champ narratif.
- [ ] Prévoir un mode `Regenerer` et un mode `Ameliorer la description existante`.
- [ ] Tester la cohérence sur plusieurs lieux aux fiches hétérogènes avant généralisation.

### P7 — Différenciants
- [ ] Possiblités de pouvoir peindre sur la carte de manière éphémère pour dessiner des schémas, créer des routes, instruction etc
- [ ] Carte chronologique (replay des lieux/événements).
- [ ] Partage/Export (JSON + capture visuelle).
- [ ] Marqueurs évolutifs (temps/événements).
- [ ] Markers thématiques/stylés par type + légende.
- [ ] Quêtes interactives avec états visuels et transitions.
- [ ] Narateur audio
- [ ] Polish UI

### P8 — Hygiène & dette
- [ ] Modularisation fine de `UiController` et nettoyage des artefacts legacy.
- [ ] Harmonisation encodages (UTF-8) & lint assets. :contentReference[oaicite:7]{index=7}
- [ ] Fiabiliser le compteur Discord automatique de l’accueil (invite/widget/API) avec fallback propre.
- [ ] Automatiser les patch notes de l’accueil depuis GitHub ou l’historique git de production.
- [ ] Polish UI




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

