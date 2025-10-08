# Carte Interactive - Roadmap 2025

## 1. Vision
CrÃ©er une carte narrative immersive, fiable et maintenable qui serve Ã  la fois de support de jeu et de rÃ©fÃ©rentiel vivant pour l'univers. La feuille de route s'articule autour de trois axesÂ : qualitÃ© des donnÃ©es, excellence UX et industrialisation.

## 2. RÃ©alisations Ã  date
### Architecture & QualitÃ© logicielle
- Refactoring complet du monolithe `script.js` en modules `DataService`, `MapController`, `UiController` orchestrÃ©s par `main.js`.
- Mise en place d'une validation centralisÃ©e des jeux de donnÃ©es (norme des coordonnÃ©es, types, doublons, chemins assets).
- Normalisation UTF-8 gÃ©nÃ©ralisÃ©e (HTML/CSS/JSON) avec restauration des Ã©mojis originaux.
- Script de validation automatisÃ©e (`tools/validate_assets.py`) pour contrÃ´ler cohÃ©rence JSON et prÃ©sence des mÃ©dias.

### ExpÃ©rience utilisateur & carte
- RÃ©activation et fiabilisation du bouton de reset, des icÃ´nes par dÃ©faut et des champs manquants dans la sidebar.
- Modernisation du panneau d'informationÂ : onglets stables, sections (histoire, quÃªtes, PNJ, lore) pleinement opÃ©rationnelles.
- Lecteur audio robuste (dÃ©tection des Ã©lÃ©ments, reset source, fallback Ã©lÃ©gant) et titres contextualisÃ©s.
- Tooltips de survol sur les marqueurs et synchronisation du panneau de commandes (zoom, plein Ã©cran, niveau de zoom).
- Badge de rÃ©sultats, surlignage des correspondances et navigation clavier sur la recherche.
- Animation fluide d'ouverture/fermeture des continents, focus clavier visible et relance audio manuelle en cas de blocage navigateur.
- Pagination continent par continent avec commandes de navigation, compteur dynamique et toggle global de repli.
- Persistance locale des filtres, de l'Ã©tat de la carte et du dernier lieu via `PreferencesService` et restauration automatique au chargement.
- Clustering Leaflet.markerclusterÂ : regroupement dynamique, icÃ´nes agrÃ©gÃ©es et mÃ©triques de visibilitÃ© en sidebar.
- Curseur persistant de taille des marqueurs (70-130Â %) avec sauvegarde automatique.
- Favoris utilisateursÂ : Ã©toile dans le panneau info, liste dÃ©diÃ©e et bouton alÃ©atoire.
- Mode sombre/clair avec bascule persistante intÃ©grÃ©e Ã  la barre de contrÃ´les de la carte.
- Barre de contrÃ´les carte iconographiÃ©e (zoom/reset/plein Ã©cran) avec intÃ©gration directe du sÃ©lecteur de thÃ¨me.
- Ã€ planifierÂ : Ã©dition in-app des lieux.

### DonnÃ©es & contenus
- Nettoyage exhaustif des textes (`assets/locations.json`, `assets/types.json`, `style.css`) avec suppression des artefacts d'encodage.
- Consolidation des chemins mÃ©dias (audio/images) et filtrage des entrÃ©es vides.

### UtilisabilitÃ© & support
- Documentation d'amÃ©lioration initiale (`idÃ©es.txt`) et backlog priorisÃ©.
- Historique de navigation fonctionnel (pile de retours, synchronisation carte â†” panneau).

## 3. Roadmap opÃ©rationnelle
### Correctifs prioritaires (retour a l'etat pre-corruption)

2. Reappliquer le style visuel des favoris (icones, badges, layout) afin d'eviter l'affichage brut par defaut.
3. Limiter l'historique affiche a quatre entrees tout en conservant le bouton Retour.
4. Corriger le mode plein ecran pour laisser les panneaux (exploration, info, historique) visibles sur la carte.
5. Retablir les encadres pour les sections texte (histoire, quetes, PNJ, lore) dans le panneau d'information.
6. Permettre l'agrandissement des images (lightbox/modale) dans l'onglet Image.
7. Restaurer les vignettes video cliquables dans l'onglet Image au lieu d'un lien texte simple.
8. Reconfigurer le declenchement automatique de l'audio lors de l'ouverture d'un lieu (avec fallback navigateur).
9. Fermer automatiquement le panneau d'information lorsqu'un clic intervient sur la carte Leaflet.

| Horizon | Objectifs clÃ©s | Livrables / Indicateurs | PrÃ©-requis |
| --- | --- | --- | --- |
| **Sprint 1 (Semaine 39)** | Pagination & navigation latÃ©rale | Pagination continent (page de 8), toggle global, scroll auto (livrÃ©) | Modules UI stabilisÃ©s |
|  | Persistance locale des prÃ©fÃ©rences | Sauvegarde filtres, type, carte et dernier lieu via `PreferencesService` (livrÃ©) | Support `localStorage` disponible |
|  | Clustering des marqueurs | ImplÃ©mentation markercluster (livrÃ©), icÃ´nes agrÃ©gÃ©es, logs perfs | Cartographie des zones denses, audit datasets |
| **Sprint 2** | Pipeline de validation automatisÃ©e | Script `tools/validate_assets.py` (premiÃ¨re itÃ©ration) + rapport CLI | Convention de nommage assets, plan CI |
|  | AccessibilitÃ© & UX fine | Animation ouverture continents, focus states, audio manuel fallback (livrÃ©) | Recette design |
| **Sprint 3** | Personnalisation avancÃ©e | âœ… Mode sombre/clair, âœ… rÃ©glage taille marqueurs, âœ… favoris utilisateurs, ðŸ†• auto-dÃ©tection du thÃ¨me & import/export des prÃ©fÃ©rences | RÃ©sultats Ã©tude UX |
|  | Navigation & dÃ©couverte | âœ… Onglet Â« Favoris Â», âœ… bouton Â« Lieu alÃ©atoire Â», ðŸ†• raccourcis clavier & tri personnalisable | Favoris persistants, dataset complet |
|  | Internationalisation & accessibilitÃ© | ðŸ†• Normalisation UTF-8/I18N, annonces ARIA cohÃ©rentes, prÃ©paration multi-langue | Audit des libellÃ©s et assets texte |
|  | Infrastructure de tests & CI | Suite `Playwright`/`Cypress` + workflow GitHub Actions | Environnement de dÃ©mo stable |
| **Sprint 4** | Architecture & performance UI | ðŸ†• Scinder `UiController` en sous-modules, couverture unitaire, instrumentation clusters | Design modules & harness de test |
|  | ExpÃ©rience mobile | ðŸ†• Layout responsive < 1024px, repositionnement des contrÃ´les, gestuelles tactiles | Charte responsive, jeux d'essai mobiles |
| **Ã‰tape suivante** | IntÃ©gration temps rÃ©el & Ã©dition collaborative | API CRUD (lieux/PNJ/quÃªtes), socket/webhook pour Ã©vÃ©nements, interface admin | Choix stack backend, auth |
|  | Ã‰diteur de carte | Gestion in-app des lieux (ajout, modification, suppression) | Back-end d'authentification et validation temps rÃ©el |

## 4. CapacitÃ© & gouvernance
- **Cadence**Â : sprints de 2Â semaines, comitÃ© de suivi en fin d'itÃ©ration.
- **Rituels**Â : daily courte (â‰ˆ10Â min), revue croisÃ©e code/UI, dÃ©mo Ã  chaque incrÃ©ment.
- **KPIs**Â : temps de chargement (<Â 1,5Â s), taux de rÃ©ussite validation donnÃ©es (100Â %), couverture E2E (>Â 80Â %).

## 5. Risques & parades
- *Volume de donnÃ©es croissant*Â : anticiper pagination cÃ´tÃ© serveur ou backend de recherche.
- *Bloqueurs audio/autoplay*Â : prÃ©voir bouton Play forcÃ© + message contextuel si le navigateur refuse.
- *Dette historique CSS/HTML*Â : suivre Lighthouse (accessibilitÃ©, performance) et prioriser les refactors critiques.

## 6. Annexes
- Backlog dÃ©taillÃ©Â : `idÃ©es.txt`
- Jeux de donnÃ©esÂ : `assets/locations.json`, `assets/types.json`
- Modules frontÂ : `js/`

> Document mis Ã  jour le 2025-09-25. Ã€ rÃ©viser Ã  chaque fin de sprint.
