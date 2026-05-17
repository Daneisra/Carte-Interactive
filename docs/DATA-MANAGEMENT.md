# Gestion des données

Les données principales du projet sont stockées en JSON dans `assets/`. En production, les modifications faites via l'UI admin écrivent sur le VPS dans `/srv/cartehesta/app/assets/`.

## Fichiers JSON

- `assets/locations.json` : lieux, structurés par continent.
- `assets/annotations.json` : annotations de carte, peut être `[]`.
- `assets/types.json` : types de lieux, icônes, paramètres de zoom.
- `assets/timeline.json` : chronologie et événements.
- `assets/planning.json` : agenda planning, sessions candidates ou confirmées.
- `assets/site-config.json` : configuration éditoriale de l'accueil, version affichée et changelog public.
- `assets/users.json` : utilisateurs et rôles.
- `assets/groups.json` : groupes JDR, peut être `[]`.
- `assets/logs/*` : logs, audit, sessions et traces locales.

## Médias

- `assets/images/` : images des lieux et contenus.
- `assets/audio/` : ambiances et sons.
- `assets/icons/` : icônes de types et UI.
- `assets/home/` : visuels de l'accueil.
- `assets/map.png` : carte principale.

## Chargement front

`DataService` charge `assets/types.json` et `assets/locations.json`, puis lance la validation via `validateDataset`.

Les lieux sont organisés par continent. `types.json` associe les types de lieux à des icônes et paramètres de zoom utilisés par la carte.

## Écriture via l'UI admin

Peuvent être modifiés depuis l'UI admin :

- lieux ;
- annotations ;
- groupes ;
- utilisateurs ;
- événements de quête ;
- chronologie ;
- sessions candidates du planning via API dédiée, UI admin à finaliser ;
- images d'événements de chronologie ;
- configuration accueil ;
- médias uploadés.

Ces écritures modifient l'environnement où tourne le serveur. En production, cela signifie le VPS, pas le repo local.

## Versionnement Git

Les JSON de référence peuvent être versionnés dans Git. Les sessions et certains logs ne doivent pas l'être.

Points sensibles :

- `.env` ne doit jamais être versionné.
- `assets/logs/sessions.json` est ignoré.
- Les médias lourds peuvent dépendre de Git LFS.
- Un déploiement rsync peut écraser des données de production si le repo local est en retard.

## Stratégie recommandée

- Faire un pullback régulier des assets de production avant les gros chantiers data.
- Vérifier les diffs JSON avant commit.
- Garder les données produites par l'admin alignées avec le repo si elles doivent devenir la source officielle.
- Pour les médias lourds, éviter les doublons et vérifier l'impact Git LFS.

Pullback type :

```bash
rsync -azvr --delete --exclude="logs/" --exclude="icons/README.md" \
  debian@cartehesta.dannytech.fr:/srv/cartehesta/app/assets/ \
  ./assets/
```

## Validation

Commandes utiles :

```bash
npm run lint
npm run test:unit
python tools/validate_assets.py
```

Le dataset des lieux est validé via `validateDataset`. Les erreurs critiques doivent être corrigées avant déploiement ; les warnings doivent être traités ou explicitement acceptés.
