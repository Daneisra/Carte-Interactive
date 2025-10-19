# Carte Interactive – Roadmap 2025

## 1. Vision
Creer une carte narrative immersive, fiable et maintenable servant a la fois de support de jeu et de referentiel vivant de l'univers. Pour 2025, les priorites se structurent autour de trois axes : qualite des donnees, excellence UX et industrialisation.

## 2. Realisations recentes (T4 2025)
- Modules `DataService`, `MapController`, `UiController` stabilises et orchestres par `main.js`.
- Validation centralisee des datasets (coordonnees, types, doublons, chemins assets) + nettoyage exhaustif des contenus.
- Galerie media enrichie : miniatures video cliquables avec titres, gestion robuste des images et fallback propre.
- Lecteur audio reinitialise automatiquement avec gestion des cas d’autoplay bloques et bouton fallback.
- Fermeture automatique du panneau d'information hors interaction et synchronisation avec les marqueurs.
- Persistance locale avancee (`PreferencesService`) : filtres, vue carte, dernier lieu et favoris utilisateurs.
- Clustering Leaflet configure avec indicateurs de visibilite, pagination par continent et badge de resultats de recherche.
- Mode sombre/clair persistant, reglage taille des marqueurs, favoris et bouton “Lieu aleatoire”.
- Editeur in-app : creation/modification d'un lieu avec sauvegarde directe dans `assets/locations.json` (tri auto par continent/nom).
- Historique de navigation operationnel et scripts d’assainissement (`tools/validate_assets.py`).
- Upload direct d'images et d'audio depuis l'editeur (clic ou glisser-deposer) avec copie automatique dans `assets/images/` et `assets/audio/`.
- Validation/renommage automatique des fichiers importes (taille, extension, slug) et suppression d'un lieu depuis l'editeur.
- Synchronisation distante optionnelle : export JSON vers un endpoint configurable (REMOTE_SYNC_URL) avec audit JSONL.
- Authentification Discord (OAuth2) avec sessions signees et interface de connexion/deconnexion.
- Base utilisateurs/roles (JSON) avec API d'administration (GET/POST/PATCH/DELETE) pour la gestion des comptes.

## 3. Priorites immediates (fin 2025)


### UX & Accessibilite
- [x] Completer les controles ARIA, libelles et annonces vocales (navigation clavier exhaustive).
- [x] Finaliser le responsive < 1024 px : layout mobile, repositionnement des controles et gestuelles tactiles.
- [x] Ajouter une aide contextuelle (infobulles ou onboarding leger) pour les favoris et le clustering.
- [x] Obtention des coordonees x et y en px via clique sur la carte et resultat afficher dans la console du navigateur.
- [x] Ajouter un outil de mesure des distances (conversion pixels → kilometres) pour faciliter l’estimation des trajets.
- [x] Ajouter un outil d'obtention des coordonnees a cote de l'outil de mesure des distances.

### Qualite des donnees
- [x] Etendre le pipeline `tools/validate_assets.py` : verification des images/audio manquants, coherence des PNJ et quetes.
- [x] Introduire la gestion officielle des titres video dans `assets/locations.json` avec harmonisation des champs.
- [x] Preparer des jeux d’essai alleges pour la recette et les tests automatises.

### Industrialisation
- [x] Ajouter une batterie de tests UI (Playwright/Cypress) couvrant la selection de lieux, le clustering et la galerie media.
- [x] Mettre en place un workflow CI (GitHub Actions) pour lint, build statique et validation des donnees.
- [x] Corriger les encodages UTF-8 des donnees (ex. Nikaius).
- [x] Instrumenter les performances (logs ou metriques) autour du cluster et du chargement initial.

### Edition in-app
- [x] Support de l'upload (clic ou glisser-deposer) pour les images et fichiers audio depuis l'editeur, avec copie automatique dans `assets/images/` et `assets/audio/`.
- [x] Validation et renommage automatique des fichiers importes (taille, extension, slug).
- [x] Suppression d'un lieu depuis le mode "Modifier un lieu".

## 4. Initiatives moyen terme (H1 2026)
- [x] Connecter les enregistrements a une couche persistante distante (API/export) pour synchronisation et sauvegarde.
- [x] **Edition in-app des lieux** : finaliser le workflow (upload medias, validations avancees, audit/logs).
- [x] Experience collaborative : roles admin/utilisateur (Bearer tokens) et API CRUD securisee (lieux/PNJ/quetes).
- la configuration du serveur distant reste a fournir, definir `REMOTE_SYNC_URL`, `REMOTE_SYNC_METHOD` (POST/PUT/PATCH), `REMOTE_SYNC_TOKEN` (optionnel) et `REMOTE_SYNC_TIMEOUT` avant de tester la synchro distante
- [x] Authentification OAuth (Discord) cote serveur
- [x] Gestion des sessions cote serveur (cookies signes, maintien deroles)
- [x] Interface de connexion (login/logout, affichage du profil)
- [x] Migration des routes REST vers une base utilisateurs/roles
- **Architecture UI modulaire** : decouper `UiController` en sous-modules testables, couverture unitaire ciblee.

## 5. Risques & parades
- **Volume de donnees croissant** : prevoir pagination cote backend ou moteur de recherche dedie.
- **Blocage audio/autoplay** : conserver bouton manuel + message contextuel, surveiller les politiques navigateurs.
- **Dette historique CSS/HTML** : suivi Lighthouse (performance/accessibilite) et plan de refactor progressif.
- **Absence de CI** : risque de regressions silencieuses — prioriser la mise en place du pipeline de tests.

## 6. Annexes
- Backlog detaille : `idees.txt`
- Jeux de donnees : `assets/locations.json`, `assets/types.json`
- Modules front : `js/`
