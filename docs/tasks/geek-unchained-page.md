Je veux ajouter au projet **Carte Interactive Hesta** une nouvelle page dédiée à la **Convention Geek Unchained de Mulhouse**.



Cette page doit présenter **Le Monde d’Hesta**, mon univers de jeu de rôle, pour deux usages :



1. **Usage stand / accueil JDR**



   - Les personnes à l’accueil du stand jeux de rôle doivent pouvoir s’en servir pour présenter rapidement Le Monde d’Hesta aux visiteurs.

   - La page doit être claire, lisible, impactante, professionnelle et utilisable comme support de présentation.



2. **Usage visiteur / joueur**



   - Les visiteurs et joueurs potentiels doivent pouvoir consulter la page eux-mêmes sur téléphone.

   - Elle doit donner envie de découvrir l’univers, rejoindre une table, poser des questions, scanner un QR code ou aller vers la carte interactive.



Contexte projet :



- Ne pas casser l’accueil, la carte, la timeline, l’auth Discord ou les routes existantes.

- Garder une architecture simple et maintenable.



Objectif :

Créer une nouvelle page publique, par exemple :



```txt

/geek-unchained/

```



avec :



- `geek-unchained/index.html`

- `geek-unchained.css` ou un fichier CSS dédié cohérent avec le style existant

- éventuellement `js/geek-unchained.js` si nécessaire

- éventuellement `assets/geek-unchained/` pour les visuels placeholder



La page doit être :



- responsive mobile/tablette/desktop ;

- très lisible sur téléphone ;

- élégante et immersive ;

- professionnelle pour une convention ;

- rapide à charger ;

- accessible ;

- adaptée à un univers heroic fantasy sombre, épique, avec influences dark fantasy / grimdark / 40K / DnD sous stéroïdes ;

- sans dépendance lourde inutile.



## Contenu à intégrer



Voici le pitch utilisé l’année dernière, à améliorer et professionnaliser sans perdre l’énergie :



```txt

DnD sous stéroïde à la sauce 40K (et d’autres références)



Passionnés de jeux de rôle, amateurs d’imaginaire ou débutants en quête d’évasion, vous êtes tous les bienvenus à la table du Monde d'Hesta. Si vous voulez, le temps d’une aventure, endosser l’identité d’un personnage fictif dans notre univers Heroic Fantasy. Rejoins-nous !



Le lore d'Hesta écrit par nos soins mais aussi par les joueurs est évolutif, chaque partie, canon soit-elle, influence Le Monde d'Hesta. Notre principe "Par les joueurs, pour les joueurs !" te permet d'apposer ta pierre à cet édifice!



Voici de quoi te mettre de l'eau à la bouche :

"Les règles ont changées, Comosicus en réalisant l'impossible a unifié Vruliwen et en est devenu l’Empereur. Ce continent est devenu la puissance mondiale, pourtant, les forces chaotiques s'amassent et jouent leur pion alors que la guerre fait déjà rage avec les Vikings de Dipovia. Saurez vous tirer votre épingle du lot ou serez vous écrasé par le destin?"

```



Tu peux reformuler ce texte pour le rendre plus propre, plus fluide, plus professionnel, mais il faut conserver :



- l’idée “DnD sous stéroïdes à la sauce 40K” ;

- l’aspect accessible aux débutants ;

- l’aspect héroïque fantasy / sombre / épique ;

- le lore évolutif ;

- le principe “Par les joueurs, pour les joueurs” ;

- l’idée que les actions des joueurs deviennent canoniques et influencent le monde ;

- Comosicus ;

- Vruliwen ;

- l’Empire ;

- les forces chaotiques ;

- la guerre contre les Vikings de Dipovia ;

- l’accroche finale sur le destin.



## Structure souhaitée de la page



Créer une page avec les sections suivantes :



### 1. Hero / accroche principale



Titre possible :



```txt

Le Monde d’Hesta

```



Sous-titre possible :



```txt

Un univers de jeu de rôle heroic fantasy évolutif, façonné par ses joueurs.

```



Badge convention :



```txt

Présent à la Geek Unchained — Mulhouse

```



Phrase d’impact :



```txt

DnD sous stéroïdes, à la sauce 40K, dans un monde où chaque partie peut devenir canon.

```



CTA :



- “Découvrir la carte interactive” → lien `/map/`

- “Explorer la chronologie” → lien `/timeline/`

- “Rejoindre la communauté Discord” → lien configurable ou placeholder



Prévoir un emplacement visuel :



- logo Hesta si disponible ;

- illustration placeholder ;

- fond sombre/épique ;

- possibilité d’ajouter plus tard une image de convention ou une carte.



### 2. Pitch court pour visiteurs pressés



Une version courte en 4 à 6 lignes, lisible immédiatement par quelqu’un qui passe devant le stand.



Exemple de ton à viser :



```txt

Le Monde d’Hesta est un univers de jeu de rôle heroic fantasy sombre et épique, où les joueurs ne traversent pas simplement l’histoire : ils l’écrivent. Royaumes en guerre, empires sacrés, Vikings de Dipovia, complots divins, artefacts oubliés et choix impossibles composent un monde vivant, évolutif, et influencé par chaque partie jouée.

```



### 3. “Pourquoi jouer dans Hesta ?”



Créer 4 à 6 cartes/bullets :



- Univers vivant et évolutif

- Accessible aux débutants

- Choix des joueurs réellement importants

- Lore écrit avec la communauté

- Ambiance heroic fantasy / dark fantasy / grimdark

- Tables animées par des MJ passionnés



### 4. “Par les joueurs, pour les joueurs”



Section importante.



Expliquer clairement :



- Le lore n’est pas figé.

- Certaines parties deviennent canoniques.

- Les joueurs peuvent influencer les lieux, les factions, les événements et l’avenir du monde.

- Les campagnes contribuent à l’histoire globale.



Ton attendu :

professionnel, passionné, pas trop long.



### 5. “Le contexte actuel du monde”



Présenter le pitch narratif autour de Comosicus :



À reformuler proprement :



```txt

Les règles ont changé. En réalisant l’impossible, Comosicus a unifié Vruliwen et s’est élevé au rang d’Empereur. Le continent est devenu la première puissance mondiale, mais son âge d’or vacille déjà : les forces chaotiques avancent leurs pions, les tensions s’accumulent, et la guerre fait rage contre les Vikings de Dipovia.



Dans ce monde instable, chaque choix peut laisser une trace. Saurez-vous tirer votre épingle du jeu, ou serez-vous écrasé par le destin ?

```



Présenter cela dans une section immersive avec fond/encadré/citation.



### 6. “Quel type de joueur peut venir ?”



Expliquer :



- débutants bienvenus ;

- joueurs expérimentés bienvenus ;

- pas besoin de connaître tout le lore ;

- possibilité de découvrir en one-shot ;

- ambiance conviviale ;

- accompagnement par le MJ ;

- idéal pour celles et ceux qui aiment l’imaginaire, les histoires fortes, les choix moraux, les grandes batailles, les intrigues politiques, les artefacts et les moments épiques.



### 7. “À quoi ressemble une partie ?”



Créer une section simple :



- création ou choix d’un personnage ;

- immersion dans un scénario ou concept "full impro" ;

- exploration / enquête / combat / diplomatie ;

- durée à compléter avec placeholder ;

- nombre de joueurs à compléter avec placeholder ;

- niveau requis : débutant accepté.



Utiliser des placeholders clairs :



```txt

Durée d’une session : 1 a 2h

Nombre de joueurs : 2 a 6 ou +

Système utilisé : fais maison

Âge conseillé : 12+

```



### 8. “La carte interactive”



Section pour présenter le site lui-même :



- carte interactive du monde ;

- lieux ;

- lore ;

- chronologie ;

- fiches de lieux ;

- audio/visuels ;

- outil utilisé par le MJ et les joueurs.



CTA :



- bouton vers `/map/`

- bouton vers `/timeline/`



### 9. “Infos pratiques Geek Unchained”



Créer une section avec placeholders éditables :



- Convention : Geek Unchained — Mulhouse
- Stand / espace : JDR Skooma Club
- Présence : 13 et 14 juin
- Durée d’une session : 1 à 2h
- Nombre de joueurs : 2 à 6 ou plus selon format
- Système utilisé : système maison
- Âge conseillé : 12+
- Niveau requis : débutants acceptés
- Discord / QR code : à compléter



Important :

ne pas inventer d’horaires, de numéro de stand ou de dates précises si elles ne sont pas dans le code ou les données.



### 10. FAQ rapide



Créer une FAQ avec 6 à 8 questions :



- Je n’ai jamais fait de JDR, je peux venir ?

- Faut-il connaître l’univers ?

- Est-ce une campagne ou un one-shot ?

- Quel système de règles est utilisé ?

- Peut-on rejoindre la communauté après la convention ?

- Où voir la carte ?

- Puis-je venir juste regarder ou poser des questions ?



Réponses courtes, rassurantes et engageantes.



### 11. Section finale / appel à l’action



Texte de conclusion :



```txt

Que vous soyez vétéran du jeu de rôle ou simple curieux, Le Monde d’Hesta vous ouvre ses portes. Venez découvrir un univers vivant, prendre place à une table, poser vos questions, ou simplement explorer la carte avant votre première aventure.

```



Boutons :



- “Entrer sur la carte”

- “Voir la chronologie”

- “Rejoindre Discord”

- “Retour à l’accueil”



## Design attendu



Style :



- sombre ;

- épique ;

- professionnel ;

- lisible ;

- cartes avec bordures subtiles ;

- accents dorés / violets / bleutés possibles ;

- éviter le trop “fantasy kitsch” ;

- rester cohérent avec l’identité visuelle actuelle du site.



UI :



- hero immersif ;

- sections bien espacées ;

- cards ;

- encadré citation ;

- timeline/mini-étapes ;

- CTA visibles ;

- sticky mini-nav possible ;

- très bon rendu mobile.



Accessibilité :



- titres hiérarchisés ;

- contrastes suffisants ;

- liens et boutons visibles ;

- alt text sur images ;

- pas de texte important uniquement dans les images.



SEO / partage :

Ajouter des meta tags propres :



- title ;

- description ;

- Open Graph ;

- Twitter card.



Exemple :



```txt

Le Monde d’Hesta | Geek Unchained Mulhouse

```



## Contraintes techniques



- Ne pas casser `/`, `/map/`, `/timeline/`.

- Ne pas modifier le backend sauf si absolument nécessaire.

- Ne pas toucher à `.env`.

- Ne pas ajouter de secret.

- Ne pas ajouter de dépendance lourde.

- Préférer HTML/CSS/JS simple.

- Si des chemins docs/README doivent être mis à jour, le faire proprement.

- Ajouter un lien vers cette page depuis l’accueil si c’est pertinent, mais de manière discrète et propre.

- Si tu ajoutes des assets placeholder, utilise des noms clairs dans `assets/geek-unchained/`.

- Si aucun asset n’est disponible, faire une page qualitative avec CSS, gradients, blocs et placeholders propres.



## Fichiers attendus



Créer ou modifier selon besoin :



```txt

geek-unchained/index.html

geek-unchained.css

js/geek-unchained.js si nécessaire

assets/geek-unchained/ si nécessaire

README.md si ajout d’un lien pertinent

ROADMAP.md ou CHANGELOG.md seulement si le projet utilise déjà une convention de version/changelog

```



Si le projet a déjà une logique de versioning, proposer aussi une mise à jour de version patch si nécessaire, mais ne pas le faire sans expliquer.



## Résultat attendu



À la fin, donne-moi :



- les fichiers créés ;

- les fichiers modifiés ;

- le chemin final de la page ;

- les placeholders à compléter ;

- les points à vérifier avant déploiement ;

- les commandes de test à lancer.



Commence par analyser rapidement la structure actuelle du projet, puis implémente la page.

