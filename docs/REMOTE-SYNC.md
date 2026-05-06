# Remote Sync

La remote sync pousse certaines données vers un endpoint externe après des modifications admin. Elle ne remplace pas le déploiement GitHub Actions et ne récupère pas automatiquement les assets de production vers le poste local.

## Variables

```env
REMOTE_SYNC_URL=
REMOTE_SYNC_METHOD=POST
REMOTE_SYNC_TOKEN=
REMOTE_SYNC_TIMEOUT=7000
```

- `REMOTE_SYNC_URL` : endpoint externe appelé après synchronisation.
- `REMOTE_SYNC_METHOD` : méthode HTTP, généralement `POST`.
- `REMOTE_SYNC_TOKEN` : jeton optionnel envoyé à l'endpoint distant.
- `REMOTE_SYNC_TIMEOUT` : timeout en millisecondes.

## Mock local

```bash
npm run sync:mock
```

Le mock écoute sur `http://localhost:4780/sync` et journalise les requêtes dans `assets/logs/remote-sync.log`.

Exemple local :

```env
REMOTE_SYNC_URL=http://localhost:4780/sync
REMOTE_SYNC_METHOD=POST
REMOTE_SYNC_TOKEN=dev-token
REMOTE_SYNC_TIMEOUT=7000
```

## À ne pas confondre

- Remote sync : le serveur pousse une charge utile vers un endpoint externe.
- Pullback assets : le poste local récupère les fichiers de production.
- GitHub Actions : déploie le repo vers le VPS.
- Rsync local : commande manuelle lancée depuis le poste de développement.

Un endpoint `/api/admin/pull-back`, s'il est ajouté plus tard côté serveur, ne pourra pas écrire directement sur le PC local. Le serveur tourne sur le VPS ; il ne peut écrire que dans son propre système de fichiers. Pour récupérer les assets de production vers le repo local, utiliser un pullback depuis la machine locale.

## Pullback recommandé des assets

```bash
rsync -azvr --delete --exclude="logs/" --exclude="icons/README.md" \
  debian@cartehesta.dannytech.fr:/srv/cartehesta/app/assets/ \
  ./assets/
```

Vérifier ensuite les changements avec Git avant de commiter.
