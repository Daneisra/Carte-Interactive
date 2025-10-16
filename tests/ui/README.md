# Tests UI (Playwright)

Cette batterie de tests automatise trois scénarios clés :

1. **Sélection d’un lieu** : vérifie que le panneau d’information se met à jour après clic sur la liste.
2. **Activation du clustering** : confirme que la case à cocher change bien d’état.
3. **Galerie média** : contrôle la présence d’au moins une vignette vidéo affichant un titre (Nikaïus).

## Pré-requis

- Node.js >= 18
- Les devDependencies déclarées dans `package.json`

```bash
npm install
```

Les tests démarrent automatiquement un serveur statique (via `http-server`) pour servir le projet.

## Lancement

```bash
npm run test:ui
```

Options utiles :

- `npm run test:ui:headed` pour observer le navigateur.
- `npm run test:ui:update` pour mettre à jour les éventuels snapshots (non utilisés pour l’instant).

## Structure

- `playwright.config.js` : configuration partagée (serveur, navigateurs, timeouts).
- `tests/ui/selection.spec.js` : scénarios Playwright.
- `assets/fixtures/` : jeux de données réduits pour des tests rapides ou des futurs scénarios spécifiques.
