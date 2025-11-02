# Carte Interactive Roadmap 2025

## 1. Vision
Creer une carte narrative immersive, fiable et maintenable servant a la fois de support de jeu et de referentiel vivant de l'univers. Pour 2025, les priorites se structurent autour de trois axes : qualite des donnees, excellence UX et industrialisation.

## 2. Realisations recentes (T4 2025)
- Modules `DataService`, `MapController`, `UiController` stabilises et orchestres par `main.js`.
- Validation centralisee des datasets (coordonnees, types, doublons, chemins assets) et nettoyage exhaustif des contenus.
- Galerie media enrichie : miniatures video cliquables avec titres, gestion robuste des images et fallback propre.
- Lecteur audio reinitialise automatiquement avec gestion des cas d'autoplay bloques et bouton fallback.
- Fermeture automatique du panneau d'information hors interaction et synchronisation avec les marqueurs.
- Persistance locale avancee (`PreferencesService`) : filtres, vue carte, dernier lieu et favoris utilisateurs.
- Clustering Leaflet configure avec indicateurs de visibilite, pagination par continent et badge de resultats de recherche.
- Mode sombre/clair persistant, reglage de la taille des marqueurs, favoris et bouton Lieu aleatoire.
- Editeur in-app : creation/modification d'un lieu avec sauvegarde directe dans `assets/locations.json` (tri auto par continent/nom).
- Historique de navigation operationnel et scripts d'assainissement (`tools/validate_assets.py`).
- Upload direct d'images et d'audio depuis l'editeur (clic ou glisser-deposer) avec copie automatique dans `assets/images/` et `assets/audio/`.
- Validation/renommage automatique des fichiers importes (taille, extension, slug) et suppression d'un lieu depuis l'editeur.
- Synchronisation distante optionnelle : export JSON vers un endpoint configurable (`REMOTE_SYNC_URL`) avec audit JSONL.
- Authentification Discord (OAuth2) avec sessions signees et interface de connexion/deconnexion.
- Base utilisateurs/roles (JSON) avec API d'administration (GET/POST/PATCH/DELETE) pour la gestion des comptes.

## 3. Chantiers prioritaires (H1 2026)

### P0 - Essentiels (pre-P1)
- [x] Actualisation en temps reel des evenements (websocket/polling leger) pour synchroniser marqueurs, quetes et alertes entre clients.
- [x] Gestion complete des textes (titres, gras, italique, sauts de ligne) dans la fiche lieu et l'editeur.
- [x] Sauvegarde automatique/restauration du brouillon Markdown dans l'editeur.
- [x] Edition modulaire des sections Historique/Quetes/Lore avec rendu Markdown.
- [x] Recherche avancee multi filtres partagee entre UI, API et tests.
- [x] Normalisation/validation unifiees entre `DataService` et `UiController`.
- [x] Refactor `server.js` en routes modulees avec verrous, schemas et journalisation.
- [x] Exploitation complete de la carte 8k et zooms percentuels dans `types.json`.
- [x] Pipeline CI restaure (validation assets + tests).
- [x] Ajouter des tests d'integration couvrant `/auth/session`, `/auth/discord/*` et les routes admin protegees.
- [ ] Persister ou documenter le magasin OAuth/session pour eviter les connexions perdues apres redemarrage.
- [ ] Renforcer `tools/validate_assets.py` (champs requis, warnings) et exposer les alertes dans l'UI admin.
- [ ] Couvrir `renderMarkdown` et les filtres avances via tests unitaires/Playwright.
- [ ] Ajouter retours visuels et gestion d'erreurs dans le panneau admin (CRUD utilisateurs) avec telemetry serveur.
- [ ] Documenter la configuration OAuth (env vars, redirect) et ajouter un healthcheck pour CI/production.
- [ ] Mutualiser ou mettre en cache l'installation Playwright dans la CI pour reduire le temps de pipeline.

### P1 - Haute valeur
- [ ] Quetes interactives sur la carte (progression, jalons visuels, transitions d'etat) pilotees par le backend.
- [ ] Gestion d'evenements temporaires avec decompte visible et expiration automatique des marqueurs et panneaux d'information.
- [x] Possibilite d'ajouter des marqueurs personnalises/annotations directement sur la carte (persistance utilisateur, partage admin).
- [ ] Palette de couleurs et styles de marqueurs par type de lieu (coherence UI, legendes, compatibilite clustering).
- [ ] Liens interactifs dans le panneau d'information vers lieux proches, evenements lies et suggestions de quetes.
- [x] Tableau de bord des evenements en direct (journal temps reel, metrics pour monitorer websocket/polling).

### P2 - Differenciants
- [ ] Indicateur de position du joueur ou marqueur temporaire partageable (mode guide ou live session).
- [ ] Carte chronologique pour rejouer l'evolution des lieux et evenements (filtre par periode, playback).
- [ ] Export et partage des annotations/parcours (JSON et capture visuelle) pour preparer sessions et debriefs.
- [ ] Marqueurs evolutifs selon le temps ou les actions des joueurs (etats, couleurs, contenus du panneau info).
- [ ] Systeme de calques de carte (relief, frontieres, couches thematiques) avec bascule clavier et compatibilite clustering.

### P3 - Hygiene et dette
- [ ] Modulariser `UiController` (~100 Ko) en sous-modules alignes sur `ui/` (chargement lazy, couverture unitaire ciblee).
- [ ] Nettoyer les fichiers legacies (`legacy-script.js`, `tmp_locationEditor.js`, dossiers `test-results/`) et documenter les artefacts conserves.
- [ ] Harmoniser les encodages (UTF-8 sans BOM) sur les fichiers texte (`docs/remote-sync.md`, `js/i18n.js`, assets JSON) et ajouter un lint dedie.
- [ ] Eliminer les helpers ou exports non utilises et documenter les conventions de code partagees.

## 4. Initiatives moyen terme (H2 2026)
- [ ] Mise en ligne de la carte (hebergement Node, reverse proxy/HTTPS, supervision des erreurs).
- [ ] Mode hors-ligne et snapshots (export alluge des donnees + packaging media pour usage table).
- [ ] Renforcement de la synchronisation distante (file de retries, diff incremental, alerting grafcet).
- [ ] Observabilite unifiee (metrics serveur, traces client, dashboards temps reel).
- [ ] Support multi-langue complet (chargement dynamique, extraction i18n, qualite traduction).

## 5. Risques & parades
- **Volume de donnees croissant** : prevoir pagination cote backend ou moteur de recherche dedie.
- **Blocage audio/autoplay** : conserver bouton manuel et message contextuel, surveiller les politiques navigateurs.
- **Dette historique CSS/HTML** : suivi Lighthouse (performance/accessibilite) et plan de refactor progressif.
- **Montee en charge de la CI** : optimiser l'installation Playwright, surveiller la duree des tests et securiser le cache npm.

## 6. Annexes
- Backlog detaille : `idees.txt`
- Jeux de donnees : `assets/locations.json`, `assets/types.json`
- Modules front : `js/`
