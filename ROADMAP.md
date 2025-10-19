# Carte Interactive – Roadmap 2025

## 1. Vision
Créer une carte narrative immersive, fiable et maintenable servant à la fois de support de jeu et de référentiel vivant de l'univers. Pour 2025, les priorités se structurent autour de trois axes : qualité des données, excellence UX et industrialisation.

## 2. Réalisations récentes (T4 2025)
- Modules `DataService`, `MapController`, `UiController` stabilisés et orchestrés par `main.js`.
- Validation centralisée des datasets (coordonnées, types, doublons, chemins assets) + nettoyage exhaustif des contenus.
- Galerie média enrichie : miniatures vidéo cliquables avec titres, gestion robuste des images et fallback propre.
- Lecteur audio réinitialisé automatiquement avec gestion des cas d’autoplay bloqués et bouton fallback.
- Fermeture automatique du panneau d'information hors interaction et synchronisation avec les marqueurs.
- Persistance locale avancée (`PreferencesService`) : filtres, vue carte, dernier lieu et favoris utilisateurs.
- Clustering Leaflet configuré avec indicateurs de visibilité, pagination par continent et badge de résultats de recherche.
- Mode sombre/clair persistant, réglage taille des marqueurs, favoris et bouton “Lieu aléatoire”.
- Editeur in-app : creation/modification d'un lieu avec sauvegarde directe dans `assets/locations.json` (tri auto par continent/nom).
- Historique de navigation opérationnel et scripts d’assainissement (`tools/validate_assets.py`).
- Upload direct d'images et d'audio depuis l'editeur (clic ou glisser-deposer) avec copie automatique dans `assets/images/` et `assets/audio/`.
- Validation/renommage automatique des fichiers importes (taille, extension, slug) et suppression d'un lieu depuis l'editeur.
- Synchronisation distante optionnelle : export JSON vers un endpoint configurable (REMOTE_SYNC_URL) avec audit JSONL.

## 3. Priorités immédiates (fin 2025)


### UX & Accessibilité
- [x] Compléter les contrôles ARIA, libellés et annonces vocales (navigation clavier exhaustive).
- [x] Finaliser le responsive < 1024 px : layout mobile, repositionnement des contrôles et gestuelles tactiles.
- [x] Ajouter une aide contextuelle (infobulles ou onboarding léger) pour les favoris et le clustering.
- [x] Obtention des coordonées x et y en px via clique sur la carte et résultat afficher dans la console du navigateur.
- [x] Ajouter un outil de mesure des distances (conversion pixels → kilomètres) pour faciliter l’estimation des trajets.
- [x] Ajouter un outil d'obtention des coordonnées à côté de l'outil de mesure des distances.

### Qualité des données
- [x] Étendre le pipeline `tools/validate_assets.py` : vérification des images/audio manquants, cohérence des PNJ et quêtes.
- [x] Introduire la gestion officielle des titres vidéo dans `assets/locations.json` avec harmonisation des champs.
- [x] Préparer des jeux d’essai allégés pour la recette et les tests automatisés.

### Industrialisation
- [x] Ajouter une batterie de tests UI (Playwright/Cypress) couvrant la sélection de lieux, le clustering et la galerie média.
- [x] Mettre en place un workflow CI (GitHub Actions) pour lint, build statique et validation des données.
- [x] Corriger les encodages UTF-8 des données (ex. Nikaïus).
- [x] Instrumenter les performances (logs ou métriques) autour du cluster et du chargement initial.

### Edition in-app
- [x] Support de l'upload (clic ou glisser-deposer) pour les images et fichiers audio depuis l'editeur, avec copie automatique dans `assets/images/` et `assets/audio/`.
- [x] Validation et renommage automatique des fichiers importes (taille, extension, slug).
- [x] Suppression d'un lieu depuis le mode "Modifier un lieu".

## 4. Initiatives moyen terme (H1 2026)
- [x] Connecter les enregistrements a une couche persistante distante (API/export) pour synchronisation et sauvegarde.
- [x] **Edition in-app des lieux** : finaliser le workflow (upload medias, validations avancees, audit/logs).
- **Experience collaborative** : definir des roles admin/utilisateur (admins ajoutent/modifient, utilisateurs explorent/favorisent) et preparer une API CRUD securisee (lieux/PNJ/quetes).
- **Architecture UI modulaire** : decouper `UiController` en sous-modules testables, couverture unitaire ciblee.
- la configuration du serveur distant reste à fournir

## 5. Risques & parades
- **Volume de données croissant** : prévoir pagination côté backend ou moteur de recherche dédié.
- **Blocage audio/autoplay** : conserver bouton manuel + message contextuel, surveiller les politiques navigateurs.
- **Dette historique CSS/HTML** : suivi Lighthouse (performance/accessibilité) et plan de refactor progressif.
- **Absence de CI** : risque de régressions silencieuses — prioriser la mise en place du pipeline de tests.

## 6. Annexes
- Backlog détaillé : `idées.txt`
- Jeux de données : `assets/locations.json`, `assets/types.json`
- Modules front : `js/`
