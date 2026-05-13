# Tests UI Playwright

Cette batterie de tests automatise les parcours navigateur clés :

1. Sélection d'un lieu et mise à jour du panneau d'information.
2. Filtres avancés, recherche, tags et réinitialisation.
3. Chronologie : chargement, filtres, liens profonds, navigation clavier et mobile.
4. Accueil : compteur Discord, patch notes, navigation et responsive mobile.
5. Changelog : chargement des entrées depuis l'API et lisibilité mobile.
6. Points d'entrée admin et sauvegardes mockées.

## Lancement local

```bash
npm run test:ui
```

Options utiles :

- `npm run test:ui:chromium` lance uniquement le projet Chromium.
- `npm run test:ui:firefox` lance uniquement le projet Firefox.
- `npm run test:api` lance les tests API Playwright.
- `npm run test:ui:headed` ouvre les navigateurs.

## CI

La CI lance les projets Playwright séparément pour rendre les échecs plus lisibles. En cas d'échec, les traces, captures et rapports HTML/JUnit sont conservés dans les artefacts GitHub Actions.

## Structure

- `playwright.config.js` : configuration partagée, serveur de test, navigateurs, timeouts et diagnostics.
- `tools/devServerWithStub.js` : serveur local avec stub Discord pour éviter les appels OAuth réels.
- `tests/ui/selection.spec.js` : sélection, clustering, galerie média et événements liés.
- `tests/ui/filters.spec.js` : filtres avancés et API de recherche.
- `tests/ui/timeline.spec.js` : chronologie dédiée.
- `tests/ui/home.spec.js` : accueil, compteur Discord, patch notes et mobile.
- `tests/ui/changelog.spec.js` : page changelog dédiée.
- `tests/ui/admin-entrypoints.spec.js` : entrées admin et sauvegardes mockées.
