# geladen.ch ballistics Manuel de l'utilisateur — Concepteur de réticule

*Fait partie de la* [suite balistique geladen.ch](https://bc.geladen.ch)*. Dans les Utilitaires. Dessine les réticules intégrés à vos lunettes de l'Arsenal, ceux que montre la vue lunette du Calculateur de terrain.*

---

## 1. À quoi sert cet outil

Le Calculateur de terrain peut vous montrer votre contre-visée sur le réticule que vous voyez réellement, mais seulement s'il connaît ce réticule : où se trouvent chaque graduation, chaque point, chaque barre et chaque chiffre. Le Concepteur de réticule est l'endroit où vous le lui indiquez. Vous dessinez le réticule une fois, d'après la fiche technique du fabricant, vous l'enregistrez dans l'Arsenal, vous l'associez à la lunette avec laquelle il est livré, et vous montez cette lunette sur une carabine. Dès lors, la vue lunette du Calculateur de terrain dessine votre contre-visée sur ce réticule, inscrit sur ses repères BDC les distances auxquelles ils correspondent aujourd'hui, avec votre cartouche, et place les contre-visées de vent là où votre œil les cherchera.

L'application est livrée avec une série de réticules intégrés. Si le vôtre en fait partie, vous n'aurez peut-être besoin de cet outil que pour en faire une variante.

### Ce qu'il n'est pas

Ce n'est pas un logiciel de dessin. Chaque élément est un détail du réticule, avec une position et des dimensions angulaires, saisies ou réglées en faisant glisser, et chaque position se mesure depuis le centre du réticule. Pas de dessin à main levée, pas de couleur, pas de texte en dehors des chiffres. Un dessin que vous avez déjà peut entrer comme forme SVG (§12), mais il est alors un seul élément, que l'on place et met à l'échelle d'un bloc.

Il ne sait pas comment se comporte votre lunette en particulier. Un réticule est dessiné pour une *lunette de référence* — seulement son type et son grossissement (§5). La vraie lunette dans laquelle il finit, définie dans l'Arsenal, apporte son propre champ de vision, sa plage de grossissement et, pour une lunette au second plan focal, le grossissement auquel ses valeurs angulaires sont exactes.

---

## 2. Où votre travail est conservé

**Un réticule se conserve en l'enregistrant dans l'Arsenal.** Jusque-là, il ne vit que dans la mémoire de l'application : il survit au passage par un autre outil, avec son historique d'annulation, mais pas à un rechargement, à la fermeture de l'application ni à un redémarrage. La barre de fichier indique *« Non enregistré dans l'arsenal »* tant qu'il reste quelque chose à enregistrer, et le navigateur demande confirmation avant de recharger ou de fermer la page avec des modifications non enregistrées.

Les réticules enregistrés se trouvent dans l'onglet **Lunettes** de l'Arsenal, sous **Vos réticules**, stockés sur cet appareil uniquement, et sont sauvegardés et synchronisés avec le reste de l'Arsenal (voir le [manuel de l'Arsenal](#/manual/arsenal), §5.9 et §8). Un réticule contenant un dessin SVG importé peut être volumineux — des mégaoctets — et ce volume entre dans chaque fichier de sauvegarde et chaque synchronisation ; l'onglet Lunettes montre la place prise par chaque réticule.

Rien de ce que vous dessinez ne quitte votre appareil, en dehors des fichiers que vous enregistrez et du dossier de synchronisation que vous configurez vous-même.

---

## 3. Démarrage rapide

1. Ouvrez l'onglet **Lunettes** de l'Arsenal et appuyez sur **+ Ajouter un réticule**, ou ouvrez le **Concepteur de réticule** depuis les Utilitaires.
2. Sous **Lunette**, réglez le type de lunette et le grossissement pour lesquels le réticule est fait, tels que la fiche technique les donne.
3. Dans **Options**, choisissez **mrad** ou **MOA** — l'unité de la fiche technique.
4. Choisissez **Ligne verticale** dans la palette des éléments et faites-la glisser du centre jusqu'au bas du champ ; faites de même avec une **Ligne horizontale** vers un côté et cochez **Symétrie horizontale** dans ses réglages.
5. Ajoutez une courte ligne verticale pour une graduation sous le centre, cochez **Répéter**, et réglez la direction, le nombre et le pas.
6. Saisissez le fabricant et le modèle dans la barre de fichier et appuyez sur **Enregistrer dans l'arsenal**.
7. Dans l'Arsenal, associez le réticule à sa lunette (**Modifier** la lunette, cocher le réticule), et choisissez cette lunette pour votre carabine.

---

## 4. L'écran

De haut en bas :

- **La barre de fichier** — le **Fabricant** et le **Modèle** du réticule (tous deux nécessaires pour enregistrer ; le fabricant propose les fabricants de lunettes et de réticules connus de l'application), un champ facultatif **Source / notes** pour indiquer d'où viennent les valeurs angulaires, et les boutons **Nouveau réticule**, **Enregistrer dans l'arsenal**, **Abandonner les modifications** et **Insérer un réticule entier…** (§14, §15).
- **Lunette** — la lunette de référence pour laquelle le réticule est dessiné, et son illumination (§5).
- **L'espace de travail**, en cinq volets : **Options** (§6), **Éléments** — la palette et les boutons Grouper, Dégrouper, Dupliquer et Supprimer (§8, §10), la **Vue du réticule** (§7), les **Réglages** de ce qui est sélectionné, et **Éléments du réticule**, la liste de tout ce qui est dessiné.

Chaque modification du réticule — un élément placé, déplacé ou modifié, la lunette, l'illumination, le fabricant, le modèle et les notes — est une étape que l'on peut annuler. Un glissement entier, une suite de frappes dans un même champ ou un appui sur une flèche forment une seule étape. Les 1000 dernières étapes sont conservées.

---

## 5. La lunette de référence

La section **Lunette** définit ce pour quoi le réticule est dessiné :

- **Type de lunette** — **Grossissement fixe**, **Variable, premier plan focal** (FFP) ou **Variable, second plan focal** (SFP).
- **Grossissement** — une seule valeur pour une lunette fixe ; **Grossissement de** et **à** pour une lunette variable.
- **Valeurs exactes à** — SFP uniquement : le grossissement auquel les repères du réticule valent ce qu'indique la fiche technique. Il doit se trouver dans la plage de grossissement.

**Le champ de vision ne se saisit pas.** Il est déduit du grossissement — 12 m à 100 m à 3×, se rétrécissant en proportion quand le grossissement augmente — uniquement pour que la vue puisse dessiner le champ dans lequel se trouve le réticule. Il n'a pas à correspondre à la vraie lunette ; les vraies valeurs viennent de la lunette de l'Arsenal.

Si le réticule doit servir dans des lunettes au premier plan focal de grossissements différents, réglez le grossissement le plus faible de la lunette de référence sur le plus faible grossissement réel : ainsi, les éléments « sans fin » qui vont jusqu'au bord, comme les barres latérales, atteignent vraiment le bord au champ de vision le plus large.

Un réticule SFP est dessiné à son grossissement de calibrage, la vue montre donc le champ à ce grossissement.

**Illumination.** Cochez **Réticule illuminé** et choisissez **Rouge**, **Ambre** ou **Vert** pour un réticule éclairé ; chaque élément indique alors s'il est éclairé (§8). Le Calculateur de terrain s'en sert pour garder sa propre superposition lisible : sur un réticule éclairé en rouge ou en ambre, il dessine en bleu.

---

## 6. Options

Le volet **Options** change votre façon de travailler, pas le réticule ; aucune de ces options n'est une étape d'annulation.

- **mrad / MOA** — l'unité dans laquelle chaque angle est affiché et saisi. Elle est propre à l'outil, indépendante des unités que vous préférez ailleurs dans l'application, car un réticule se définit dans l'unité de ses valeurs angulaires, quelle que soit celle de vos tourelles. La changer ne modifie rien dans le réticule : chaque position et chaque dimension sont conservées sous forme d'angle, seul leur affichage change.
- **Grille (1 mrad)** / **Grille (1 MOA)** — une grille de repérage, une ligne sur cinq plus marquée. En zoom arrière prononcé, elle s'éclaircit d'elle-même à une ligne sur cinq, puis une sur 25, et ainsi de suite.
- **Aimanter à 0,1 mrad** / **Aimanter à 0,25 MOA** — les placements et déplacements tombent sur des multiples de ce pas, comptés depuis le centre. Les flèches du clavier déplacent du même pas (§16).
- **Afficher le zéro** — la croix rouge dans un cercle qui marque le centre du réticule. Elle ne fait pas partie du réticule.
- **Afficher les repères BDC** — les marqueurs bleus des repères BDC (§13). Placer un repère les réaffiche.
- **Afficher l'illumination** et **Assombrir le champ** — sur un réticule illuminé uniquement : dessiner les éléments éclairés dans leur couleur, et assombrir le champ comme en basse lumière.

---

## 7. La vue du réticule

La vue montre le réticule tel que vous le verriez : en noir sur un champ clair, dans un cercle figurant le champ de vision, tout ce qui est au-dehors sombre. x est positif vers la droite et y positif *vers le bas*, tous deux mesurés depuis le centre, si bien qu'une graduation 2 mrad sous le centre a y = 2.

**Placer.** Choisissez un élément dans la palette — il reste en surbrillance jusqu'à ce que vous en placiez un — puis cliquez dans la vue pour l'y placer, ou faites glisser l'icône directement dans la vue. Les lignes et les barres effilées se tracent par appui et glissement, d'une extrémité à l'autre. Un simple clic donne une ligne de 1 mrad (4 MOA) de long, orientée vers l'extérieur, et une barre effilée qui va jusqu'au bord du champ. Après le placement, l'outil revient à la flèche de sélection, et le nouvel élément est sélectionné.

**Sélectionner.** Avec la flèche, cliquez sur un élément pour le sélectionner ; un clic sur une copie symétrique ou répétée sélectionne l'élément auquel elle appartient. Un clic avec Maj, Ctrl ou Cmd ajoute un élément à la sélection ou l'en retire. Un glissement avec Maj, Ctrl ou Cmd sur le champ vide trace un rectangle qui ajoute chaque élément dont la forme propre se trouve entièrement à l'intérieur (ses copies ne comptent pas ; un groupe seulement s'il y est tout entier). Un clic sur un élément d'un groupe sélectionne le groupe. Le volet de liste sélectionne aussi, et y choisir la ligne d'un membre sélectionne ce membre seul.

**Déplacer.** Faites glisser un élément, un groupe ou une sélection pour le déplacer. Une seule ligne ou barre effilée sélectionnée montre une poignée à chaque extrémité, pour déplacer une extrémité à la fois. Pendant le glissement, les coordonnées s'affichent près du pointeur — au zoom normal, un pas d'aimantation est plus petit qu'un pixel, c'est donc à cet affichage que l'on voit l'aimantation agir.

**Zoomer et se déplacer.** La molette, un pincement ou les boutons **+** et **−** zooment ; faites glisser sur le champ vide (ou avec le bouton du milieu) pour vous déplacer. **Réinitialiser la vue** revient au champ entier, centré, au grossissement minimal.

**Grossissement.** Pour une lunette variable, le curseur **Grossissement** au-dessus de la vue prévisualise la bague de grossissement. Sur une lunette FFP, le champ se rétrécit quand on grossit, et le réticule grandit avec l'image, comme dans la lunette. Sur une lunette SFP, l'image ne change pas ; une note indique ce que valent les valeurs angulaires à ce grossissement, par ex. *« Valeurs ici : ×0.5 de la valeur nominale »*. Les icônes **Annuler** et **Rétablir** se trouvent à sa gauche.

---

## 8. Les éléments

| Élément | Placé par | Réglages | Un nouveau (mrad / MOA) |
|---|---|---|---|
| Ligne horizontale, ligne verticale | Son début, et sa fin le long de la ligne | Largeur | 0,05 / 0,15 de large |
| Point | Son centre | Diamètre | 0,05 / 0,15 |
| Barre horizontale et verticale effilée | Son début (l'extrémité fine), et sa fin | Largeur nominale, largeur en bout, longueur d'effilement | 0,5 / 1,5 de large, 0,25 / 0,75 en bout, effilée sur 2 / 7 |
| Cercle | Son centre | Diamètre extérieur, diamètre intérieur | 2 / 6 à l'extérieur, 1,8 / 5,4 à l'intérieur |
| Fer à cheval | Son centre | Diamètres extérieur et intérieur, angle de découpe en bas | comme le cercle, 60° découpés |
| Chevron | Sa pointe | Épaisseur de trait, largeur totale, hauteur | traits de 0,5 / 1,5 dans un carré de 1 / 3,5 |
| Nombre | Son ancrage | Chiffres, hauteur des chiffres, ancrage, police | 0,5 / 1,5 de haut |
| Forme SVG | L'origine propre du dessin | Échelle, largeur, hauteur, reflet | 5 / 15 sur son plus grand côté |
| Repère BDC | Sa hauteur sur l'axe vertical | — | — |

La position et les dimensions de chaque élément se règlent dans ses **Réglages** ; une valeur qui le rendrait impossible (un diamètre intérieur plus grand que l'extérieur, par exemple) est refusée avec un message et n'est pas appliquée. Une nouvelle ligne ou un nouveau point reprend la largeur ou le diamètre saisi en dernier pour l'un ou l'autre, un nouveau nombre la police, la hauteur et l'ancrage choisis en dernier, et un nouvel élément le dernier réglage d'éclairage donné.

- **Les lignes** sont de simples segments de largeur constante ; chaque extrémité peut aller n'importe où.
- **Les barres effilées** sont les barres épaisses au bord de nombreux réticules : fines à leur début, s'élargissant sur la longueur d'effilement jusqu'à leur largeur nominale, puis gardant cette largeur jusqu'à leur fin. L'extrémité fine fait toujours face au centre. La fin ne peut jamais être plus près du centre que le début, et une barre déplacée le long de son propre axe s'arrête quand son début atteint le centre. Une barre effilée n'est pas obligée de s'effiler : avec une largeur en bout égale à la largeur nominale, ou une longueur d'effilement de 0, c'est une simple barre de largeur constante. Utilisez-la pour toute barre épaisse d'un réticule, pas seulement pour les barres effilées.
- **Un cercle** est un anneau entre ses deux diamètres ; un diamètre intérieur de 0 donne un disque plein.
- **Un fer à cheval** est un anneau ouvert en bas, sur la largeur de l'angle de découpe.
- **Un chevron** pointe vers le haut, sa pointe à sa position ; ses deux branches vont aux coins inférieurs de sa largeur totale et de sa hauteur.
- **Les nombres** et **les formes SVG** ont leurs propres sections (§11, §12).
- **Les repères BDC** ne sont pas dessinés du tout (§13).

**Éléments éclairés.** Sur un réticule illuminé, chaque élément visible a une case **Illuminé** : les éléments éclairés sont dessinés dans la couleur d'illumination tant que **Afficher l'illumination** est coché. La liste les marque *illuminé*.

---

## 9. Symétrie et répétition

La plupart des réticules sont symétriques et réguliers : on dessine un détail une fois, et l'outil le copie.

**Symétrie horizontale** ajoute une copie reflétée par rapport à l'axe vertical : une graduation à x = 2 reçoit sa jumelle à x = −2. Les chiffres d'un nombre ne sont pas reflétés (ils se lisent toujours dans le bon sens), mais son ancrage l'est : un nombre qui se termine à x = 2 commence à x = −2.

**Répéter** ajoute des copies en rangée : une **Direction** (vers le haut, le bas, la gauche ou la droite), un **Nombre** de copies (en plus de l'élément lui-même, jusqu'à 500) et un **Pas** entre elles. Dix graduations le long du fil vertical, une tous les 1 mrad, sont une seule courte ligne avec Répéter réglé sur *vers le bas, 9, 1 mrad*.

Les deux se combinent : les répétitions sont faites d'abord, puis chacune d'elles est reflétée. Les copies ne sont pas des éléments à part entière — elles suivent l'élément, et un clic sur l'une d'elles le sélectionne. La liste marque un élément *symétrique* ou *répété ×n*. Activer Répéter reprend la direction, le nombre et le pas saisis en dernier.

---

## 10. Groupes, plusieurs à la fois, dupliquer, supprimer

**Plusieurs éléments à la fois.** Quand plus d'un élément est sélectionné, le volet Réglages montre la position de l'ensemble de la sélection (la moyenne de leurs positions) et chaque réglage qu'ils ont tous : une largeur quand ce sont toutes des lignes, Symétrie et Répéter sauf si un repère BDC en fait partie, et ainsi de suite. En changer un le change pour tous, en une seule étape d'annulation ; un champ où ils diffèrent indique *mixte* jusqu'à ce que vous le régliez.

**Grouper** réunit les éléments sélectionnés (deux ou plus) en un groupe, qui se sélectionne, se déplace et se modifie ensuite d'un bloc. Les groupes ne s'imbriquent pas : grouper des éléments d'un groupe existant avec d'autres forme un seul nouveau groupe de tous. **Dégrouper** dissout le groupe sélectionné. Un groupe réduit à un seul élément se dissout de lui-même.

**Dupliquer** copie la sélection 1 mrad (ou 1 MOA) à droite et en bas, et sélectionne la copie ; la copie d'un groupe entier forme son propre groupe. **Supprimer** (ou la touche Suppr ou Retour arrière) la retire.

---

## 11. Les nombres

Un nombre est une suite de chiffres, de 0 à 9 uniquement, 12 au plus — les réticules ne numérotent leurs graduations avec rien d'autre. Sa **Hauteur des chiffres** est la hauteur d'un chiffre ; son **Ancrage** est le point auquel se rapporte sa position : son **Extrémité gauche**, son **Centre** ou son **Extrémité droite**, à mi-hauteur des chiffres. Une étiquette à droite d'une graduation s'ancre le plus facilement par son extrémité gauche : elle garde ainsi sa distance quel que soit son nombre de chiffres.

Cinq polices sont proposées : **B612** Regular (par défaut, conçue pour les écrans de cockpit), **Barlow** Light et Regular, et **Overpass** Light et Regular. Toutes sont sous licence SIL Open Font License ; les chiffres sont intégrés à l'application sous forme de contours, aucune police n'est donc chargée.

---

## 12. Les formes SVG

Pour tout ce que les éléments ne savent pas dessiner — une marque de visée en forme de logo du fabricant, un anneau inhabituel, une échelle de télémétrie — importez un dessin SVG. Appuyez sur **Forme SVG** dans la palette, puis choisissez un fichier ou collez le code et appuyez sur **Lire le code collé**. Un aperçu montre ce qui va entrer ; **Insérer dans le réticule** l'ajoute.

Seules les formes sont conservées. Chaque remplissage et chaque contour visibles deviennent de l'encre du réticule, quelle que soit leur couleur, avec les épaisseurs de contour du fichier. Les tracés de découpe et les masques sont ignorés (les formes sont dessinées entières), les contours en pointillés sont dessinés pleins, et les marqueurs de ligne et les images intégrées sont omis ; l'aperçu le signale quand cela arrive. Le texte doit d'abord être converti en chemins (dans Inkscape : Chemin → Objet en chemin).

Le dessin entre avec l'origine propre du SVG au centre du réticule, mis à l'échelle pour que son plus grand côté mesure 5 mrad (15 MOA). Réglez sa vraie taille dans ses réglages, de trois façons qui modifient toutes la même échelle : **1 unité SVG =** un angle, ou la **Largeur** ou la **Hauteur** du dessin. **Refléter la forme lors de la symétrie** décide si une copie symétrique est un reflet ou le même dessin simplement déplacé de l'autre côté.

Au chargement, le fichier est contrôlé contre tout contenu trop compliqué ou malveillant, et refusé s'il dépasse 2 Mo, compte plus de 5000 éléments, est imbriqué sur plus de 32 niveaux, a plus de 100 000 segments de chemin ou 1000 copies réutilisées, utilise des longueurs dans d'autres unités que les simples unités utilisateur ou px, contient un DOCTYPE, ou prend trop de temps à lire. Un gros dessin fait un gros réticule (§2) : simplifiez-le si possible dans le logiciel de dessin avant de l'importer.

---

## 13. Les repères BDC

Un repère BDC (de l'anglais « Bullet Drop Compensation », c'est-à-dire « compensation de la chute de la balle » ; en clair, un repère de contre-visée) est un point de visée pour une distance autre que celle du zéro : la graduation, le point ou le chevron sous le centre avec lequel on est censé viser à 300, 400, 500 m. Dans le Concepteur, le détail visible est dessiné avec les éléments ci-dessus ; le repère BDC est un point distinct et invisible qui donne l'angle de cette contre-visée. Il se trouve sur l'axe vertical — seule sa hauteur se règle — et n'est jamais reflété, répété ni éclairé. La vue le montre par un marqueur bleu, que masque **Afficher les repères BDC**.

La vue lunette du Calculateur de terrain calcule, pour les conditions actuelles, à quelle distance correspond chaque repère BDC, et l'inscrit (voir **Vue lunette** dans le [manuel principal](#/manual)). Placez un repère à chaque niveau de contre-visée prévu par le réticule, à la hauteur que donne la fiche technique.

---

## 14. Insérer un réticule entier

**Insérer un réticule entier…** dans la barre de fichier copie un autre réticule — l'un des vôtres ou un réticule intégré — dans celui que vous modifiez : chaque élément, à sa place dans l'original, avec ses groupes et ses réglages d'éclairage. Rien n'est converti : chaque valeur angulaire entre telle qu'elle a été dessinée, même si l'original a été dessiné pour un autre type de lunette ou un autre grossissement de calibrage (le panneau le signale). Si votre réticule n'est pas illuminé et que l'original l'est, il reprend l'illumination de l'original ; si le vôtre n'a pas encore de fabricant ni de modèle, il reprend ceux de l'original.

Les éléments insérés arrivent sélectionnés, en une seule étape d'annulation, si bien que vous pouvez les déplacer ensemble ou les supprimer d'un coup. Insérer dans un réticule vide est le moyen rapide de commencer une variante : ouvrez un nouveau réticule, insérez celui dont il diffère, changez ce qui diffère, et enregistrez-le sous son propre nom de modèle.

---

## 15. Enregistrer, abandonner, recommencer

- **Enregistrer dans l'arsenal** enregistre le réticule dans l'Arsenal et vous laisse dans le Concepteur, avec un bref *« Enregistré dans l'arsenal. »* Un réticule ouvert depuis l'Arsenal est enregistré par-dessus lui-même ; un nouveau devient un nouveau réticule de l'Arsenal. Le fabricant et le modèle forment ensemble son nom : si un autre de vos réticules porte déjà ce nom, on vous demande s'il faut le remplacer. Tant que rien n'est à enregistrer, le bouton devient **Retour à l'arsenal** et vous ramène à l'onglet Lunettes.
- **Abandonner les modifications** revient au réticule tel qu'enregistré en dernier (ou à un réticule vide s'il ne l'a jamais été), après confirmation, et son historique d'annulation s'en va avec. Un réticule ouvert depuis l'Arsenal vous y ramène ensuite. Le bouton est désactivé tant qu'il n'y a rien à abandonner.
- **Nouveau réticule** commence un réticule vide, après confirmation si l'actuel a des modifications non enregistrées. Vos options, et les valeurs mémorisées pour les nouveaux éléments, restent telles quelles.

Un réticule peut être enregistré dans un fichier depuis l'Arsenal, seul ou avec tout le reste (voir le [manuel de l'Arsenal](#/manual/arsenal), §8).

---

## 16. Clavier

| Touche | Effet |
|---|---|
| Ctrl+Z / Cmd+Z | Annuler |
| Ctrl+Maj+Z, Ctrl+Y / Cmd+Maj+Z | Rétablir |
| Flèches | Déplacer la sélection d'un pas d'aimantation (0,1 mrad ou 0,25 MOA) |
| Maj + flèches | La déplacer de dix pas |
| Suppr, Retour arrière | Supprimer la sélection |
| Échap | Reposer l'élément choisi dans la palette ; s'il n'y en a pas, vider la sélection |
| Entrée, Espace (dans la liste) | Sélectionner la ligne active |

Aucune de ces touches n'agit pendant que vous tapez dans un champ.

---

## 17. Mise en pratique

### 17.1 Dessiner d'après une fiche technique

Les fiches techniques des fabricants donnent en général un dessin et un tableau de cotes. Quand les deux divergent, fiez-vous au tableau : le dessin est une illustration, le tableau est la spécification. Lisez chaque cote dans l'unité de la fiche, réglez le Concepteur sur cette unité, et saisissez les valeurs plutôt que de faire glisser les éléments en place. Remplissez **Source / notes** avec le nom et la date de la fiche, pour savoir plus tard d'où viennent les chiffres.

### 17.2 Un réticule à graduations typique

1. Une **Ligne verticale** du haut du champ jusqu'en bas et une **Ligne horizontale** d'un bord à l'autre, à la largeur des fils.
2. Une courte **Ligne horizontale** pour la première graduation sous le centre, à 1 mrad ; cochez **Répéter**, direction *vers le bas*, le nombre de graduations moins une, pas de 1 mrad.
3. Une plus courte pour la demi-graduation à 0,5 mrad, répétée de la même façon.
4. La même chose pour le fil horizontal, avec une courte **Ligne verticale**, **Répéter** vers la droite, et **Symétrie horizontale** pour le côté gauche.
5. Des **Nombres** à côté d'une graduation sur deux ou sur cinq, ancrés par leur extrémité gauche, symétriques là où la fiche numérote les deux côtés.
6. Des **barres effilées horizontales** et **verticales** jusqu'au bord du champ, commençant là où la fiche fait commencer les barres épaisses ; symétrie pour la barre horizontale.

### 17.3 Un réticule BDC

Dessinez d'abord les détails visibles — graduations, points ou chevrons, avec leurs chiffres s'il y en a. Placez ensuite un **Repère BDC** à chaque niveau de compensation que donne la fiche, en saisissant sa hauteur dans **Repère y**. Enregistrez, associez le réticule à sa lunette dans l'Arsenal, montez la lunette sur votre carabine, et regardez-le dans la vue lunette du Calculateur de terrain avec les distances BDC affichées : chaque repère indique la distance correspondant à la chute de votre balle, dans votre cartouche, dans l'air du jour.

---

## 18. Limites

- 500 copies répétées au plus par élément, et 12 chiffres au plus par nombre.
- Aucune position ni dimension au-delà d'un demi-tour.
- Formes SVG : les limites du §12.
- L'historique d'annulation conserve les 1000 dernières étapes, et repart de zéro avec un nouveau réticule, à l'ouverture d'un autre, avec Abandonner les modifications, et au rechargement.
- Le champ de vision dessiné est une hypothèse (§5), pas celui de votre lunette.
