# Carte Interactive Hesta - Roadmap produit

## Vision

Carte Interactive Hesta est un hub narratif pour explorer l'univers d'Hesta, préparer les sessions JDR, suivre les quêtes, relier les lieux à la chronologie et garder une base de connaissance vivante.

Objectifs produit :

- rendre l'exploration de la carte claire et immersive ;
- centraliser lieux, lore, historique, quêtes, groupes et événements ;
- permettre une administration fiable sans éditer les JSON à la main ;
- garder une expérience lisible pour les joueurs, les MJ et les contributeurs ;
- conserver un socle technique simple : front statique, API Node légère, données JSON versionnables.

Version actuelle : `0.17.48`.

## Réalisations majeures livrées

- [x] Carte interactive modulaire chargée par `js/main.js`, avec `DataService`, `MapController`, `UiController` et préférences locales.
- [x] Données de lieux validées côté front et serveur via les modules partagés de schéma/validation.
- [x] Recherche avancée, filtres, tags, favoris, clustering, pagination par continent et historique de navigation.
- [x] Fiches lieux enrichies : description, lore, historique, quêtes, médias, audio, PNJ, familles nobles, liens inter-lieux.
- [x] Édition admin des lieux avec création, modification, suppression, upload médias et sauvegarde JSON.
- [x] Aperçu des icônes de type dans les formulaires de création/modification de lieu.
- [x] Annotations personnalisées sur la carte avec persistance et suppression synchronisée.
- [x] Flux temps réel par SSE pour annotations, quêtes, lieux et informations live.
- [x] Authentification Discord OAuth, sessions persistées et rôles admin.
- [x] Mini-profil utilisateur : avatar, rôle, personnages, groupes, personnalisation et actions rapides.
- [x] Groupes JDR, personnages liés aux utilisateurs et visualisation des groupes sur la carte.
- [x] Page d'accueil immersive avec CTA carte, état de session, communauté, dons, crédits et panneau admin dédié.
- [x] Page chronologie dédiée avec frise horizontale, filtres, détail événement, liens carte/frise et panneau admin dédié.
- [x] Page planning dédiée avec agenda mensuel, sessions candidates, réponses joueur, disponibilités datées et admin planning.
- [x] Page convention Geek Unchained dédiée a la presentation publique du Monde d'Hesta.
- [x] Séparation des panneaux admin : accueil, chronologie et carte.
- [x] Admin accueil branché sur `/api/admin/home-config`.
- [x] Admin chronologie branché sur `/api/admin/timeline-config`.
- [x] Admin carte recentré sur lieux, carte, groupes, annotations, live, validation et télémétrie.
- [x] Mise a jour globale des groupes JDR depuis l'admin carte.
- [x] CI avec lint, tests unitaires, validation assets et tests Playwright.
- [x] Déploiement continu vers VPS avec rsync, PM2 et Nginx.

## Roadmap par phases

### P3 - Accueil et expérience pré-carte

- [x] Accueil dédié sur `/` avec entrée vers `/map/`.
- [x] Hero immersif, visuels configurables, CTA principaux et liens communauté.
- [x] Session Discord visible sur l'accueil.
- [x] Footer avec crédits, contact, mentions du projet et easter egg visuel.
- [x] Liens de don : PayPal, Ko-fi et wishlists Roll20.
- [x] Panneau admin accueil pour textes, visuels, liens, support/dons et configuration éditoriale.
- [x] Correction des libellés d'état obsolètes de l'accueil.

### P4 - Chronologie

- [x] Page dédiée `/timeline`.
- [x] Frise horizontale gauche vers droite avec année, titre, résumé, texte, image, tags et lieux liés.
- [x] Navigation clavier et responsive mobile.
- [x] Filtres par période, tag et recherche.
- [x] Regroupement visuel par époque/période.
- [x] État partageable par URL.
- [x] Liens profonds depuis la carte vers la frise.
- [x] Liens depuis la frise vers la carte.
- [x] Admin chronologie pour créer, éditer, supprimer, réordonner et masquer des événements.
- [x] Différenciation visuelle des événements de lore écrit et des événements joueurs.
- [x] Images de frise fiabilisées via chemins médias normalisés.
- [x] Ouvrir les images d'événements de chronologie en grand dans une modale ou une vue plein écran.
- [x] Upload direct d'image lors de la création/édition d'un événement.
- [x] Ordre public de la chronologie aligné entre API, UI et tests navigateur.
- [x] Navigation rapide par période stabilisée dans les tests navigateur Firefox.
- [x] Dernier polish éditorial : densité, transitions, lisibilité des longues périodes.

### P5 - Séparation des panneaux admin

- [x] Cadrage des périmètres : admin accueil, admin chronologie, admin carte.
- [x] Points d'entrée dédiés depuis `/`, `/timeline/` et `/map/`.
- [x] Isolation des états et handlers front par domaine.
- [x] Base UI admin mutualisée pour statuts, erreurs, boutons et patterns de formulaire.
- [x] API/persistance dédiée pour accueil et chronologie.
- [x] Redirection des anciens liens admin vers les nouveaux panneaux dédiés.
- [x] QA Playwright sur les parcours admin, invités, sauvegardes mockées et raccourcis croisés.

### P6 - Homogénéisation des descriptions de lieux

- [x] Définir `description` comme résumé court officiel affiché dans la carte et les aperçus.
- [x] Définir `lore` et `histoire` comme sources narratives longues.
- [x] Clarifier l'ordre d'affichage des fiches lieux : lore, historique, quêtes, puis le reste.
- [x] Ajouter un bouton admin de génération de description depuis lore/historique.
- [x] Conserver une validation humaine : la description proposée reste éditable avant sauvegarde.
- [x] Empêcher l'écrasement silencieux d'une description existante sans confirmation.
- [x] Définir le format cible : 2 à 4 phrases, ton neutre, informatif, sans invention.
- [x] Déplacer les descriptions existantes vers le lore lorsque cela évite les doublons.
- [ ] Brancher une vraie assistance IA côté serveur ou via outil contrôlé.
- [x] Ajouter un audit admin listant les lieux sans description courte exploitable.
- [x] Pouvoir réordonner par glisser-déposer les blocs de lore, historique, quêtes et sections longues.

### P7 - Planning et calendrier JDR

Socle livré : agenda daté, sessions candidates, disponibilités par date/heure, création multi-date et admin planning.

- [x] Créer une page planning/calendrier dédiée à la logistique des parties.
- [x] Permettre à chaque utilisateur de renseigner ses disponibilités à une date et une heure précises.
- [x] Visualiser rapidement les réponses et conflits sur chaque date candidate.
- [x] Lier le planning aux groupes JDR et aux personnages lorsque c'est utile.
- [x] Ajouter des statuts de réponse : disponible, incertain, indisponible, non renseigné.
- [x] Prévoir une vue agenda lisible sur desktop et mobile.
- [x] Ajouter une synthèse MJ directement sur chaque session candidate.

### P7.1 - Rework agenda/calendrier réel

- [x] Transformer la page planning en véritable agenda daté, avec navigation mois précédent/suivant et semaine courante.
- [x] Ajouter un modèle de sessions candidates : titre, date, heure de début, durée, groupe, description et statut.
- [x] Permettre au MJ/admin de proposer plusieurs dates candidates en une seule soumission depuis l'admin planning.
- [x] Permettre à chaque utilisateur de déclarer une même disponibilité sur plusieurs dates en une seule soumission.
- [x] Permettre aux joueurs de répondre à une date précise : disponible, incertain, indisponible, commentaire optionnel.
- [x] Afficher les événements confirmés dans une vue calendrier mensuelle, pas seulement une projection de semaine type.
- [x] Retirer l'ancienne semaine type de l'interface planning et du mini-profil carte pour éviter les doublons.
- [x] Ajouter une synthèse par session candidate : nombre de oui/incertain/non.
- [x] Ajouter les meilleurs créneaux et conflits visibles par session candidate, avec prise en compte des disponibilités datées quand elles existent.
- [x] Prévoir une vue mobile agenda claire : liste chronologique + mini calendrier compact.
- [x] Préparer la persistance JSON dédiée, par exemple `assets/planning.json`, avec API de lecture publique.
- [x] Ajouter l'API admin/utilisateur d'écriture des sessions candidates.
- [x] Ajouter une interface admin planning pour créer, modifier et supprimer les sessions candidates.
- [x] Ajouter des tests API/UI sur création de session candidate, réponse joueur et affichage mensuel.

### P8 - Différenciants carte et narration

- [x] Carte : déplacement complètement libre sans blocage sur les bords.
- [x] Carte : corriger les lieux non cliquables lorsqu'ils sont trop proches du bord.
- [x] Peinture éphémère sur la carte pour routes, schémas, instructions et préparation de session.
- [ ] Indicateur de position joueur ou marqueur temporaire partageable.
- [ ] Carte chronologique/replay des lieux et événements.
- [ ] Marqueurs évolutifs selon période, quête ou action joueur.
- [ ] Palette de couleurs et styles de marqueurs par type de lieu.
- [ ] Légende avancée et icônes adaptatives/animées.
- [ ] Quêtes interactives avec progression, jalons et transitions d'état.
- [ ] Événements temporaires avec compte à rebours et expiration automatique.
- [ ] Système de calques : relief, frontières, couches thématiques.
- [ ] Export/partage des annotations et parcours en JSON, PNG ou PDF.
- [ ] Narrateur audio ou mode lecture guidée.

### P9 - Hygiène, exploitation et dette technique

- [x] Carte : bouton theme clair de la barre d'outil fiabilise avec etat accessible et preference locale.
- [x] Carte : suppression des annotations fiabilisee cote API, persistance JSON et synchronisation temps reel.
- [x] Mobile carte : barre d'outils compacte, flux temps reel repositionne et panneau lieu prioritaire en bottom sheet.
- [x] Mobile accueil : navigation tactile, CTA homogènes et blocs support lisibles sans débordement horizontal.
- [x] Mobile chronologie : header compact, navigation tactile, filtres pleine largeur et lightbox bornée au viewport.
- [x] Mobile admin : panneaux accueil, chronologie et carte exploitables en plein écran sans débordement horizontal.
- [ ] Intégration mobile fluide et complète sur accueil, carte, chronologie, planning et panneaux admin, sans dégrader la version desktop.
- [x] QA responsive dédiée : navigation tactile, panneaux latéraux, modales, formulaires longs, scroll, performance et lisibilité sur téléphone.
- [x] Maintien fiable de la connexion Discord : reprise, expiration contrôlée, TTL 30 jours par défaut et messages d'état.
- [x] Améliorer le téléchargement des assets : rapidité, packaging, exclusions et robustesse.
- [x] Fiabiliser le compteur Discord automatique de l'accueil avec fallback clair.
- [x] Créer une page changelog dédiée pour consulter l'historique complet des versions et changements.
- [x] Automatiser les patch notes de l'accueil depuis le changelog produit et l'API changelog.
- [ ] Modulariser davantage `UiController` et réduire les dépendances croisées UI. En cours : modèles disponibilités, personnalisation profil, personnages et annotations extraits dans `js/ui/`.
- [ ] Nettoyer les artefacts legacy conservés seulement pour compatibilité. En cours : ancien placeholder de test unitaire supprimé, alias API legacy conservés car couverts par tests.
- [x] Harmoniser les encodages UTF-8 et conserver le lint dédié.
- [x] Optimiser la CI Playwright : cache npm/Playwright, scripts par projet et diagnostics en échec.
- [ ] Observabilité plus complète : métriques serveur, traces client, dashboard admin.
- [ ] Étudier une base de données si les JSON deviennent un frein réel.

## Backlog futur

- Recherche globale avec raccourci clavier `Ctrl+K`.
- Animation d'ouverture/fermeture des continents dans le panneau exploration.
- Icônes devant les noms de continents et lieux dans les listes.
- Surlignage automatique sur la carte depuis l'historique ou les panneaux.
- Suppression/annulation d'entrées d'historique.
- Transparence réglable de la carte.
- Heatmap ou agrégation des zones trop denses.
- Mode hors ligne et snapshots pour usage en table.
- Support multilingue complet.
- Collaboration temps réel MJ/joueurs plus poussée.

## Dette technique connue

- `UiController` reste volumineux malgré les extractions progressives.
- Les données JSON de prod peuvent diverger du repo si elles sont éditées via l'UI admin sans pullback.
- Certains médias lourds restent sensibles à Git LFS et aux limites de bande passante.
- Les docs et tests doivent rester alignés avec les routes réelles du routeur maison.
- Le cookie de session réel est actuellement `map_session` en dur côté serveur.

## Décisions produit importantes

- Chaque commit fonctionnel doit mettre à jour la version projet si le changement est livré : `package.json`, `package-lock.json`, `assets/site-config.json`, changelog de l'accueil, roadmap et docs concernées.
- La chronologie complète vit sur une page dédiée ; la carte ne doit proposer qu'une intégration légère.
- Les trois surfaces administrables restent séparées : accueil, chronologie, carte.
- Les textes longs doivent vivre dans lore/historique ; la description courte est un résumé de consultation.
- Les éditions faites en production écrivent sur le VPS, pas dans le repo local.
- Les opérations, commandes VPS, OAuth et synchronisation distante sont documentées dans `docs/`, pas dans la roadmap.
