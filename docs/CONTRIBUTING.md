# Contribution

## Workflow local

```bash
npm install
npm run serve
```

Travailler sur une branche dédiée, garder les changements petits et vérifier les diffs avant commit.

## Avant push

```bash
npm run lint
npm run test:unit
npm run test:ui
```

Si le changement est livré comme une évolution projet, mettre à jour dans le même commit :

- `package.json` et `package-lock.json`.
- `assets/site-config.json` avec `version` et une entrée `changelog` visible sur l'accueil.
- `ROADMAP.md`.
- `README.md` ou les docs concernées si le comportement/documentation change.

Si les changements touchent les assets ou les données :

```bash
python tools/validate_assets.py
```

## Commits et branches

- Utiliser des noms de commit courts, orientés résultat.
- Éviter de mélanger feature, refactor et nettoyage documentaire dans un même commit.
- Ne jamais commiter `.env`, tokens, secrets Discord ou clés VPS.

## Checklist PR

- Les routes touchées sont testées.
- Les données JSON sont valides.
- Les liens internes fonctionnent.
- Les changements admin ne cassent pas les rôles guest/user/admin.
- Les tests pertinents passent.
- Les risques de déploiement sont signalés.

## Modifications de données

Quand une modification vient de l'UI admin en production, elle écrit sur le VPS. Si elle doit être conservée dans Git, faire un pullback puis commiter les fichiers concernés.

```bash
rsync -azvr --delete --exclude="logs/" --exclude="icons/README.md" \
  debian@cartehesta.dannytech.fr:/srv/cartehesta/app/assets/ \
  ./assets/
```

## Conventions

- Front : modules ES.
- Serveur : CommonJS.
- Routes : routeur maison, pas Express.
- Données : JSON lisibles et validés.
- Docs : pas de secrets, chemins exacts, commandes copiables.

## Après déploiement

```bash
curl -i https://cartehesta.dannytech.fr/health
curl -i https://cartehesta.dannytech.fr/auth/session
curl -i https://cartehesta.dannytech.fr/api/annotations
curl -i https://cartehesta.dannytech.fr/api/events/stream
```

Vérifier aussi manuellement l'accueil, la carte, la chronologie et les panneaux admin concernés.
