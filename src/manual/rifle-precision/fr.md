# geladen.ch ballistics Manuel de l'utilisateur — Calculette de précision de tir

*Fait partie de la* [suite balistique geladen.ch](https://bc.geladen.ch)*. Successeur de l'outil autonome TARAN.*

---

## 1. À quoi sert cet outil

Tout tireur a un chiffre qu'il cite à propos de sa carabine. Il est presque toujours faux, et il est presque toujours faux dans le même sens : trop optimiste.

La raison n'est pas la malhonnêteté, c'est l'arithmétique. La méthode traditionnelle pour mesurer la précision d'une carabine consiste à tirer un groupement de cinq coups, à mesurer la distance entre les deux trous les plus éloignés, et à appeler ce nombre « la précision de ma carabine ». Cette mesure est un tirage unique dans une distribution aléatoire très large. Tirez dix groupements de ce genre avec la même carabine, les mêmes munitions, depuis le même banc et le même jour : le meilleur fera couramment la moitié du pire. Si vous citez ensuite le meilleur — et tout le monde cite le meilleur — vous ne décrivez pas votre carabine. Vous décrivez la chance que vous avez eu sur ce coup-ci.

La Calculette de précision de tir fait l'inverse. Au lieu de demander *quelle était la taille de ce groupement*, elle demande *quelle est la dispersion sous-jacente de ce couple carabine/munition, et à quel point suis-je sûr de cette réponse*. Elle le fait en agrégeant **chaque coup que vous avez tiré dans le projet** — sur autant de cibles et autant de séries que vous voulez bien tirer — en une seule estimation, et en donnant un intervalle de confiance à côté de chaque chiffre, afin que vous voyiez immédiatement si vous avez mesuré quelque chose de réel ou simplement collectionné une anecdote de plus — ou une jolie photo à poster sur un forum.

Le mode opératoire est délibérément rustique. Vous n'avez besoin ni d'un chronographe, ni d'une cible acoustique, ni d'un télémètre laser, ni de quoi que ce soit de connecté. Il vous faut des cibles en papier, une règle, et l'appareil photo d'un téléphone.

### Ce qu'il n'est pas

Ce n'est pas un logiciel de comptage de points. Il se moque des zones, des mouches et de la valeur en match. Il mesure la dispersion et le point d'impact, rien d'autre.

Ce n'est pas non plus un substitut à l'outil **Probabilité d'impact**, qui combine la précision de la carabine avec le vent, l'erreur d'estimation de distance et l'habileté du tireur pour prédire la probabilité de toucher au premier coup à distance. Cet outil-ci mesure *une* des données que cet autre outil consomme — la précision mécanique de la carabine elle-même — et peut la lui transmettre directement (voir §10.3).

---

## 2. Confidentialité, stockage et prérequis

**Rien de ce que vous mettez dans cet outil ne quitte votre appareil.** Pas de compte, pas de téléversement, pas de télémétrie, pas de « statistiques d'usage anonymes ». Vos photos de cibles — qui sont, après tout, des photos de votre propriété, prises là où vous tirez — sont stockées dans la base IndexedDB de votre propre navigateur, sur votre propre machine, et relues depuis là. Tout le calcul, des coordonnées en pixels jusqu'aux intervalles de confiance, tourne en JavaScript dans votre navigateur.

Le corollaire est celui auquel vous vous attendez : **si vous effacez les données de site de votre navigateur, vos projets disparaissent.** Il n'existe aucune copie côté serveur pour les restaurer. Utilisez les fonctions de sauvegarde (§9) si ces données comptent pour vous.

**Prérequis.** N'importe quel navigateur raisonnablement récent. L'outil est utilisable sur téléphone — marquer les impacts en tapant sur une photo à l'écran est sans doute la façon la plus naturelle de s'en servir — mais le rapport de précision, avec son diagramme, sa légende et son tableau de chiffres côte à côte, est plus confortable sur une tablette ou un écran d'ordinateur. L'application s'installe en PWA et fonctionne entièrement hors ligne une fois chargée.

---

## 3. Le modèle de données : Projets, Cibles, Séries, Impacts

Quatre niveaux d'imbrication, et il vaut la peine de les comprendre avant de commencer à cliquer, car se tromper là-dessus est de loin la façon la plus courante de produire un rapport dénué de sens.

```
Projet          une carabine + un rechargement + une distance
  └─ Cible      une photo d'une feuille de papier
       └─ Série   un point de visée, et les coups tirés dessus
            └─ Impact   un trou de balle
```

**Un Projet** est l'unité d'analyse. Tout ce qui est à l'intérieur d'un projet est agrégé en une seule estimation statistique, ce qui veut dire que tout ce qui est à l'intérieur d'un projet doit être comparable : même carabine, mêmes munitions, même distance. Un projet porte un **titre**, la **distance à la cible** et le **calibre**. La distance est nécessaire parce que tout résultat angulaire (mrad, MOA) en dépend ; le calibre est nécessaire pour que le diagramme dessine les trous à leur taille réelle.

Si vous changez *quoi que ce soit* à la carabine ou au rechargement — une autre charge de poudre, une autre balle, un régime de nettoyage du canon auquel vous croyez vraiment — commencez un nouveau projet. Agréger deux rechargements différents ne vous donne la dispersion ni de l'un ni de l'autre.

**Une Cible** est une photo. Chaque cible porte sa propre calibration d'échelle, parce que chaque photo est prise depuis une distance et un angle légèrement différents. C'est pourquoi la calibration est par cible et non par projet : l'outil ne suppose jamais que deux photos ont le même nombre de pixels par millimètre.

**Une Série** est un point de visée plus les coups tirés dessus. Une même feuille peut, et devrait généralement, porter plusieurs séries — une feuille avec quatre losanges imprimés, cinq coups sur chacun, c'est une cible avec quatre séries.

**Un Impact** est un trou de balle, stocké comme une position sur la photo.

### Pourquoi les séries comptent statistiquement

Chaque coup est mesuré **relativement au point de visée de sa propre série**, et non par rapport à une origine absolue sur la feuille. C'est toute la raison d'être des séries comme niveau de la hiérarchie.

Imaginez quatre séries sur une feuille A4, visant quatre losanges différents. Si l'outil agrégeait simplement les positions brutes des trous, il calculerait une dispersion supérieure à 200 mm — l'écartement des *losanges*, pas celui de la *carabine*. En recentrant chaque coup sur le point de visée qui lui correspond, les quatre séries se superposent sur une origine commune, et il ne reste que la dispersion réelle coup à coup.

Cela veut dire aussi que vos marques de point de visée doivent être honnêtes. Si vous placez le point de visée au centre visuel du groupement plutôt qu'à l'endroit que vous avez réellement visé, vous flinguez la capacité de l'outil à mesurer votre erreur de zéro (§8.3) — et, franchement, tout le reste.

### 3.1 Note sur les unités

**Chaque nombre que cet outil vous montre, et chaque nombre qu'il vous laisse saisir, est dans les unités que vous avez choisies dans les Réglages.** Il n'y a aucune exception cachée, aucun champ qui attendrait discrètement autre chose. Si vous travaillez en pouces et en yards, vous ne voyez ni ne tapez jamais un millimètre dans cet outil.

Deux des groupes d'unités de la suite entrent en jeu :

- **Distance** (`m`, `yd`, `ft`) — la distance du projet.
- **Petite longueur** (`mm`, `cm`, `in`) — tout ce qui se mesure sur le papier : la règle de calibration que vous saisissez, le calibre, la dispersion maximale, et tous les résultats du rapport quand le sélecteur d'unités est réglé sur l'absolu plutôt que sur l'angulaire. Comme ce sont des mesures à l'échelle d'une balle, elles sont affichées plus finement que le réglage général de la suite : **2 décimales en mm, 3 en cm et en pouces**.

En interne, le moteur travaille exclusivement en millimètres et en mètres, et la conversion n'a lieu qu'à la frontière de l'affichage. Cela a une conséquence pratique qu'il est bon de connaître : **changer votre préférence d'unités ne modifie jamais les données stockées ni aucun résultat calculé.** Passez des mm aux pouces et chaque projet existant se réaffiche correctement — la calibration que vous aviez saisie à 100 mm l'an dernier affiche désormais 3,937 in, décrit la même règle, et donne exactement les mêmes statistiques de dispersion.

**Où les unités sont indiquées.** Les champs de saisie portent l'unité en suffixe vivant sur leur étiquette — *« Distance réelle (in) »* — qui se met à jour quand vous changez de préférence au lieu d'être figée dans la traduction. Les valeurs affichées portent l'unité en ligne : *« Disp. max. 1,78 in »*. L'export CSV nomme l'unité dans chaque en-tête de colonne (§8.7).

**La seule exception.** Le sélecteur **Unités d'affichage des résultats** du rapport (§8.1) peut réexprimer les statistiques en **mrad** ou en **MOA** au lieu d'une longueur. Il ne gouverne que la légende et le tableau Chiffres ; l'en-tête de page et l'échelle graphique du diagramme continuent de suivre votre préférence globale, et l'export CSV l'ignore entièrement, puisque des coordonnées brutes sont toujours une longueur.

Dans tout ce manuel, les exemples chiffrés sont écrits en millimètres et en mètres pour être concrets. Lisez-les comme « quelle que soit l'unité que vous avez configurée ».

---

## 4. Démarrage rapide

Pour les impatients. Les détails suivent aux §5–§9.

1. **Précision de tir** depuis le menu des outils → **Ajouter un projet**. Donnez-lui un titre, la distance, le calibre. Enregistrez.
2. **Ajouter une cible** → **Choisir une photo…** → prenez une photo de votre feuille de cible → tournez-la si besoin, resserrez les coins de recadrage si vous voulez → **Utiliser cette photo**.
3. Vous atterrissez directement dans l'espace de marquage, à l'étape **calibration**. Tapez sur une extrémité de la règle dans votre photo, puis sur l'autre, saisissez la distance réelle entre les deux points — dans vos propres unités, comme l'indique l'étiquette du champ — et tapez **Terminer l'étalonnage**.
4. Tapez là où vous avez visé. Cela place le **point de visée**.
5. Tapez chaque trou de balle. Continuez à taper. Quand c'est fini, **Terminer les impacts**.
6. **Ajouter une série** et reprenez à l'étape 4 pour chaque série supplémentaire sur la feuille.
7. Revenez au projet. **Ajouter une cible** pour la feuille suivante, ou, quand vous avez assez de coups, **Voir le rapport**.

N'attendez pas du rapport qu'il dise quoi que ce soit de fiable avant une vingtaine de coups. Voir §8.6.

---

## 5. Projets

### 5.1 Créer un projet

**Ajouter un projet** ouvre un formulaire court :

- **Titre du projet** — obligatoire. Si vous saisissez un titre qui existe déjà dans votre bibliothèque, un avertissement vous prévient que l'enregistrement écrasera l'entrée existante. C'est un avertissement, pas un blocage.
- **Distance** — la distance de la bouche à la cible. Saisie et affichée dans l'unité de distance configurée dans les **Réglages** (m, yd ou ft) ; stockée en interne en mètres quoi qu'il arrive, de sorte que changer votre préférence plus tard réaffiche correctement les projets existants au lieu de les corrompre.

  Cette valeur pilote toute conversion angulaire du rapport, alors assurez-vous que le nombre corresponde à l'unité affichée à côté. Si votre préférence est en mètres et que vous tapez `100` pour une cible que vous avez en réalité tirée à 100 *yards*, tous les chiffres en mrad et en MOA du rapport ressortent environ 9 % trop petits — et rien nulle part ne vous préviendra, parce que 100 m est parfaitement plausible.
- **Calibre** — choisi soit dans la liste déroulante des désignations standard (la même que celle de l'Arsenal), soit saisi directement, dans votre unité de petite longueur. Il sert à dessiner les impacts au diamètre réel du canon sur le diagramme du rapport, et à rien d'autre — il n'influence aucune statistique.

### 5.2 La liste des projets

Chaque projet enregistré affiche son titre et son nombre de cibles. Dès qu'un projet a assez d'impacts marqués pour calculer des statistiques agrégées, sa ligne affiche en plus le résultat principal — le **R50** agrégé en mrad et en MOA — et une **pastille de confiance** colorée donnant l'indice de confiance d'un coup d'œil (voir §8.6). Cela vous permet de parcourir une liste d'une douzaine de projets de développement de rechargement et de voir immédiatement lesquels vous avez réellement assez tirés pour y croire.

Deux indications peuvent apparaître sur la ligne d'un projet :

- **Cibles inutilisables présentes** — au moins une cible du projet est incomplète et se trouve exclue de l'analyse.
- **Aucune cible utilisable trouvée** — rien dans ce projet ne peut encore être analysé.

### 5.3 Actions par projet

- **Modifier** / **Supprimer** — supprimer un projet supprime toutes ses cibles, séries, impacts et photos. Une confirmation vous est demandée.
- **Sauvegarder dans un fichier** — écrit ce seul projet, photos comprises, dans un fichier JSON.
- **Définir comme précision de cartouche…** — transmet la précision mesurée de ce projet à une cartouche de l'Arsenal. Voir §10.3.

---

## 6. Ajouter une cible

### 6.1 Photographier la cible

La qualité de votre photo fixe un plafond dur à la qualité de tous les chiffres que l'outil produira ensuite. Trente secondes de soin en valent la peine.

- **Photographiez perpendiculairement au papier.** L'outil applique un facteur d'échelle unique et uniforme, dérivé de vos deux points de calibration. Il ne corrige pas la perspective. Une photo prise de biais comprime un axe par rapport à l'autre, et cette erreur passe directement dans vos chiffres de dispersion, différemment à l'horizontale et à la verticale. Placez-vous devant la cible, tenez l'appareil perpendiculaire au papier, et remplissez le cadre avec la feuille.
- **Incluez une règle, dans le plan du papier.** Scotchez un réglet métallique ou une échelle imprimée sur la face de la cible avant de tirer dessus, ou posez-en une avant de photographier. Une règle tenue devant la cible, plus près de l'appareil, paraîtra plus grande que le papier et fera paraître vos groupements plus petits qu'ils ne sont.
- **Utilisez une base de calibration longue.** L'erreur de calibration est une erreur en pourcentage sur chaque résultat. Si vous calibrez sur un détail de 20 mm et que vos points sont décalés d'un pixel, l'erreur relative est bien plus grande que le même pixel de jeu sur une base de 200 mm. Utilisez le plus long élément de longueur connue disponible.
- **Lumière plate et régulière.** Les trous de balle dans le papier sont des ombres. Un éclairage rasant et dur transforme chaque trou en comète avec un bord clair et une traîne sombre, et vous finirez par marquer l'ombre plutôt que le trou.
- **Ne redimensionnez pas à l'excès.** L'application réduit les images très grandes pour le stockage, mais il vous faut assez de résolution pour qu'un trou de balle fasse confortablement plusieurs pixels une fois zoomé.

### 6.2 Importer la photo

**Ajouter une cible** → **Choisir une photo…** ouvre le sélecteur de fichiers/appareil photo de votre appareil. Une fois un fichier choisi, vous obtenez un écran d'aperçu avec trois opérations :

- **Tourner à gauche** / **Tourner à droite** — 90° à la fois. Notez que tourner réinitialise la sélection de recadrage au cadre entier, car un rectangle de recadrage tracé avant une rotation ne désigne plus la même partie de l'image.
- **Recadrer** — tirez les poignées d'angle vers l'intérieur. Laissez-les sur les bords pour garder toute la photo. Recadrer les parties vides du cadre en vaut la peine : cela veut dire plus de cible à l'écran quand vous zoomez pour marquer.
- **Utiliser cette photo** — valide. Rotation et recadrage sont appliqués ensemble, en une seule passe, sur l'image originale en pleine résolution, et non sur l'aperçu réduit que vous regardiez. Choisir un fichier ne crée jamais une cible à soi seul ; seul ce bouton le fait.

La validation vous amène directement dans l'espace de marquage.

Si le fichier ne peut pas être décodé, vous obtenez *« Impossible de traiter cette photo »* — essayez un autre format (PNG et JPEG sont les choix sûrs).

---

## 7. Marquer une cible

L'espace de marquage est une vue plein écran de la photo, déplaçable et zoomable, avec un indicateur d'étape et des commandes en dessous. Il vous guide à travers trois étapes dans l'ordre — calibration, point de visée, impacts — puis se met au repos, état depuis lequel vous pouvez ajouter d'autres séries.

**Tout s'enregistre automatiquement.** Chaque point que vous placez, chaque point que vous déplacez, chaque impact que vous supprimez est écrit immédiatement en mémoire. Il n'y a pas de bouton d'enregistrement et aucun moyen de perdre son travail en quittant la page.

**Tout est déplaçable.** Il n'existe nulle part d'action séparée « confirmer ce point » : taper *c'est* placer. Si un point tombe légèrement à côté, zoomez et faites-le glisser. Les deux points de calibration, le point de visée de la série active et chacun de ses impacts peuvent être ajustés à tout moment.

Seuls les points de la série **active** sont déplaçables. Les points de visée des autres séries restent visibles sous forme de repères fixes, ce qui vous permet de voir la disposition de toute la feuille sans pouvoir déranger un travail déjà terminé.

### 7.1 Étape 1 — Calibrer l'échelle

*« Tapez sur la photo au premier point de calibration — une extrémité d'une règle ou un élément de longueur connue sur la cible. »*

Tapez une fois pour le premier point, une fois de plus pour le second, puis saisissez la **distance réelle** entre les deux points.

**Saisissez-la dans vos propres unités.** L'étiquette du champ porte un suffixe d'unité vivant — *« Distance réelle (mm) »*, *« (cm) »* ou *« (in) »* selon votre préférence de petite longueur — donc posez un réglet de 6 pouces sur la cible avec les pouces sélectionnés et vous tapez simplement **6**. Aucune conversion, aucune arithmétique, rien à inverser. La valeur est convertie vers les millimètres internes du moteur au moment d'être stockée, et c'est pourquoi changer votre préférence plus tard réaffiche correctement la même règle au lieu de la corrompre.

Le pas du champ et sa plus petite valeur acceptée sont la précision d'affichage de cette unité — 0,01 mm, ou 0,001 cm/in — de sorte que tout ce qui peut vous être montré peut aussi être saisi.

La ligne de calibration tracée sur la photo est étiquetée avec la même valeur dans la même unité, et elle supprime les zéros inutiles : une règle de 100 mm affiche *« 100 mm »*, pas *« 100,00 mm »*. Vérifiez cette étiquette avant de continuer ; c'est le seul nombre du projet par lequel tout le reste est mis à l'échelle, et une erreur ici met à l'échelle tous les résultats d'une cible sans rien produire qui ressemble à une erreur.

La ligne de calibration est tracée en vert, sa longueur indiquée. Zoomez et faites glisser les extrémités jusqu'à ce qu'elles reposent exactement sur les repères entre lesquels vous avez mesuré.

**Terminer l'étalonnage** fait avancer. C'est une étape explicite délibérée plutôt qu'un passage automatique, afin que tripoter les extrémités ou retaper la longueur pendant que vous vérifiez votre travail ne vous éjecte jamais de l'étape à l'improviste.

**Recalibrer**, disponible plus tard depuis l'état de repos, vous ramène ici sans jeter les points déjà placés. Recalibrer remet rétroactivement à l'échelle toutes les mesures de cette cible — les impacts sont stockés comme des positions sur la photo, pas comme des millimètres, donc corriger une mauvaise calibration des mois plus tard corrige aussi tous ses résultats.

### 7.2 Étape 2 — Point de visée

*« Tapez sur la photo pour placer le point de visée de cette série. »*

Une seule tape. Marquez là où vous avez *visé*, pas là où le groupement a atterri. Dessiné comme un réticule rouge.

Placer le point de visée fait immédiatement avancer à l'étape des impacts.

### 7.3 Étape 3 — Marquer les impacts

*« Tapez sur la photo pour enregistrer chaque trou de balle — continuez à taper pour en ajouter. »*

Tapez chaque trou. Chaque impact est dessiné comme un point numéroté dans votre **couleur d'impact** configurée (Réglages → Couleur d'impact, partagée avec l'outil Probabilité d'impact), cerclé d'un double liseré blanc et sombre pour qu'il reste visible sur n'importe quelle partie d'une vraie photo — noir du visuel, papier blanc ou impression. Aucune limite par série.

Dès qu'une série compte deux coups ou plus, la surimpression trace la ligne de **dispersion maximale** entre les deux trous les plus éloignés, étiquetée avec sa longueur, et marque le **point d'impact moyen** de la série — son barycentre. La ligne de dispersion suit aussi la couleur d'impact, pour que la série se lise comme un tout.

Les deux étiquettes à l'écran — la dispersion maximale et la longueur de calibration en vert — sont dans votre unité de petite longueur configurée.

Tapez de façon cohérente. Que vous marquiez le centre de chaque trou ou son bord supérieur gauche importe moins que de faire la même chose à chaque fois ; un décalage systématique appliqué à tous les coups s'annule dans la dispersion, un décalage aléatoire non.

**Supprimer un impact** bascule dans un mode de suppression : *« Tapez l'impact que vous voulez retirer, ou Annuler pour le conserver. »* Tapez le repère d'un coup pour le retirer, Annuler pour quitter le mode. C'est un mode séparé plutôt qu'un appui long ou un balayage précisément parce que retirer un coup d'un jeu de données que vous essayez de garder honnête devrait demander une intention.

Le bouton **Terminer les impacts** fait exactement ce que son nom indique — il ramène toute cette mécanique à l'état dit « de repos ».

### 7.4 Plusieurs séries par cible

Depuis l'état de repos — *« Choisissez une série ci-dessous pour continuer à y ajouter des coups, ou ajoutez une nouvelle série »* — vous obtenez une barre d'onglets, un par série, chacun étiqueté de son numéro et de son nombre de coups.

- Taper l'onglet d'une série la rend active et rentre à nouveau dans l'étape des impacts, de sorte que vous pouvez ajouter des coups à une série que vous pensiez terminée.
- **Ajouter une série** démarre une série neuve : vous êtes ramené à l'étape du point de visée, et les coups de la nouvelle série commencent à partir de là.

La ligne de chaque série affiche son nombre de coups et sa **Disp. max.** — la dispersion maximale, distance entre ses deux impacts les plus éloignés, dans votre unité de petite longueur. Ce nombre est affiché parce que tout le monde veut le voir et parce qu'il est utile pour repérer un coup mal marqué, mais gardez à l'esprit que c'est exactement la statistique dont cet outil tout entier existe pour vous détourner.

### 7.5 Enregistrer l'image d'ensemble de la série

Télécharge un PNG de la **série actuellement active** exactement telle que marquée — point de visée, impacts numérotés, ligne de dispersion maximale et son étiquette, point d'impact moyen, et ligne de calibration avec sa longueur — recadré sur ce que vous avez actuellement à l'écran, zoom et déplacement compris. Les impacts sont dessinés au calibre réel du projet.

L'image exportée est une copie fidèle de ce qui est à l'écran : même couleur d'impact, même double liseré, et les deux étiquettes — dispersion maximale et longueur de calibration — dans les unités que vous regardez. Bon à retenir si vous publiez l'image quelque part, puisque le destinataire n'a aucun moyen de savoir quelle préférence d'unités était active au moment de l'enregistrement. Si l'image part vers un public impérial, changez votre préférence avant d'exporter.

La ligne de calibration est incluse ici même si la vue de marquage ne la montre que pendant l'étape de calibration elle-même — une image exportée doit porter la preuve de sa propre échelle.

Utile pour un carnet de développement de rechargement, un message sur un forum, ou pour montrer à un armurier la preuve d'un problème, sans exporter tout le projet.

### 7.6 Quand une cible est-elle utilisable ?

Une cible doit avoir **les trois** éléments suivants avant de pouvoir contribuer à un rapport :

1. une **calibration** achevée (les deux points placés *et* une longueur réelle non nulle saisie),
2. au moins une série avec un **point de visée**,
3. au moins un **impact**.

Une cible à laquelle il manque l'un d'eux porte une pastille **Inutilisable** et une indication précisant exactement ce qui manque encore — *« Requis : calibration, au moins 1 impact »*. Les cibles inutilisables sont silencieusement exclues du rapport agrégé ; ce n'est pas une erreur, simplement quelque chose qui n'est pas encore fini.

---

## 8. Le rapport de précision

**Voir le rapport** apparaît sur un projet dès qu'au moins une de ses cibles est utilisable. Le rapport agrège tous les coups de toutes les séries utilisables de toutes les cibles utilisables en une seule analyse.

La ligne sous le titre rappelle les paramètres du projet et la taille de l'échantillon : *distance, calibre, N coup(s)*. Vérifiez-la. Si le nombre de coups n'est pas celui que vous attendez, vous avez une cible inutilisable quelque part.

### 8.1 Unités d'affichage des résultats

Un sélecteur en haut gouverne les unités de chaque valeur de la légende et du tableau Chiffres ci-dessous. Il offre trois choix :

- **votre unité de petite longueur configurée** — l'option est étiquetée avec l'unité réelle (`mm`, `cm` ou `in`, selon votre réglage), et non avec un mot générique, pour que vous voyiez d'un coup d'œil ce que vous vous apprêtez à lire. C'est la taille absolue, linéaire, sur le papier, affichée à 2 décimales en mm et 3 en cm ou pouces.
- **mrad** — milliradians, à 3 décimales.
- **MOA** — minutes d'angle, à 2 décimales.

Les unités angulaires sont converties à l'aide de la distance propre du projet. Les unités linéaires sont ce qui a réellement été mesuré ; les unités angulaires sont celles dans lesquelles votre tourelle est graduée. Pour comparer des carabines tirées à des distances différentes, utilisez l'angulaire — un groupement de 20 mm à 100 m et un de 40 mm à 200 m diffèrent d'un facteur deux en chiffres absolus, mais reflètent la même précision (angulaire). Pour réfléchir à savoir si une balle passera dans un trou, utilisez le linéaire.

### 8.2 Le diagramme agrégé

**Résultats agrégés** est le nuage de points agrégé : chaque coup du projet, dessiné relativement au point de visée de sa propre série, tous sur une origine commune. La **Légende** se tient à côté et liste chaque élément actuellement dessiné, avec sa couleur, son nom et sa valeur.

Trois éléments sont toujours dessinés et ne peuvent pas être désactivés :

- **Tous les impacts** — les coups agrégés, dessinés dans votre **couleur d'impact** configurée (Réglages → Couleur d'impact ; par défaut un rouge foncé profond) avec le même double liseré blanc et sombre que dans la vue de marquage, pour que les points restent lisibles là où ils se chevauchent entre eux ou avec la grille. La pastille de la légende lit la même source, elle ne peut donc jamais diverger de ce qui a été dessiné.
- **Point de visée** (réticule rouge) — à l'origine, par construction,
- **Point d'impact** (orange) — le barycentre agrégé.

La couleur d'impact est lue au moment du tracé : la changer dans les Réglages apparaît au rendu suivant du diagramme — y compris dans un SVG exporté.

Tout le reste est optionnel, et chaque élément optionnel se bascule depuis la colonne **Afficher sur l'image** du tableau Chiffres (§8.4) ou depuis les **Options de l'image** (§8.5). Basculer quoi que ce soit met à jour le diagramme, la légende et l'image exportée ensemble — ce que vous voyez est exactement ce que vous exportez.

### 8.3 Ce que signifient les chiffres

Chaque valeur ci-dessous est affichée dans ce que le sélecteur **Unités d'affichage des résultats** indique (§8.1). Les exemples chiffrés ici sont écrits en millimètres pour être concrets ; lisez-les dans votre propre unité.

**Nb. de coups** — combien de coups ont été agrégés. C'est le nombre qui compte le plus, et celui que tout le monde souhaite plus petit qu'il ne doit l'être.

**Intervalle de confiance** — exprimé en paire de pourcentages, p. ex. `-15%/+22%`. C'est l'intervalle de confiance à 95 % sur l'estimation de dispersion elle-même. Lisez-le ainsi : *la vraie dispersion de cette carabine se situe, avec 95 % de confiance, quelque part entre 15 % plus petite et 22 % plus grande que le nombre que je vous montre*. Cette seule ligne est le contrôle d'honnêteté de tout le reste de la page.

**Moyenne des impacts** — où se situe le centre du groupement par rapport au point de visée, en paire horizontale et verticale, toujours affichée avec un signe explicite. C'est votre erreur de zéro.

La convention est celle du tireur : **H positif vers la droite, V positif vers le haut**, les mêmes directions que celles gravées sur vos tourelles. Ainsi une lecture de `H +6 mm, V -14 mm` signifie que votre carabine tire **6 mm à droite et 14 mm bas**, et la corriger veut dire aller à gauche et vers le haut.

**Intervalle de confiance du point d'impact** — à quel point vous connaissez réellement cette erreur de zéro, sous la forme `H ±…, V ±…`. C'est le nombre qui vous dit s'il vaut la peine de toucher à vos tourelles. Si votre décalage est de 8 mm vers le bas et que l'intervalle de confiance dessus est de ±11 mm, vous n'avez pas mesuré une erreur de zéro ; vous avez mesuré du bruit. Continuez à tirer.

**Écart type (sigma, σ)** — le paramètre de dispersion du modèle ajusté. Pas directement utile au banc, mais c'est la grandeur dont tous les rayons ci-dessous sont dérivés, et c'est la grandeur à laquelle s'applique l'intervalle de confiance.

**R50** — le rayon du cercle, centré sur le point d'impact, contenant 50 % des coups. Classiquement appelé **écart circulaire probable** (CEP). C'est le meilleur chiffre unique pour la précision d'une carabine : c'est une médiane, donc robuste, et c'est la forme que consomme le reste de cette application (§10.3).

**R95** — le rayon contenant 95 % des coups.

**R99** — le rayon contenant 99 % des coups. Méfiez-vous d'en tirer trop de conclusions : vous extrapolez la queue d'un modèle ajusté bien au-delà de là où vous avez des données, et le modèle suppose qu'aucun coup aberrant n'existe.

**L'intervalle de confiance du R95** — le rayon R95 avec sa propre bande d'incertitude, montrée sur le diagramme comme un anneau pâle d'épaisseur finie plutôt que comme un trait. C'est un bon élément à laisser activé : il rend l'incertitude visible géométriquement au lieu de la cacher dans un tableau.

**ES5x** — la dispersion maximale moyenne que vous devriez *attendre* d'un groupement de cinq coups tiré par cette carabine. **ES10x** — de même pour dix coups.

Ces deux-là méritent un paragraphe, car ils sont le pont entre cet outil et la façon dont tout le monde parle de précision. Si votre projet dit ES5x = 22 mm, cela veut dire : si vous sortez tirer des groupements de cinq coups avec cette carabine, ils feront *en moyenne* 22 mm. Pas « feront » — *en moyenne*. Certains feront 14 mm et d'autres 32 mm, et c'est celui de 14 mm qui finit sur internet. ES5x est la version honnête du chiffre dont vous étiez sur le point de vous vanter, et il vous permet aussi de recouper cet outil avec vos propres relevés passés.

**Référence 1 MOA** — un cercle en pointillés d'exactement une MOA de diamètre à la distance du projet, sa taille réelle en légende. Une règle pour l'œil : cela transforme « est-ce une carabine sub-MOA ? » en une question à laquelle on répond en regardant plutôt qu'en calculant.

### 8.4 Le tableau Chiffres

Toutes les statistiques ci-dessus, en un seul tableau : **Description**, **Désignation**, **Valeur**, et **Afficher sur l'image**. La case à cocher de la dernière colonne ajoute cet élément au diagramme, à la légende et à l'image exportée simultanément. Le nombre de coups, l'intervalle de confiance et la moyenne des impacts n'ont pas de case — les deux premiers ne sont pas géométriques, et le point d'impact est toujours dessiné.

### 8.5 Options de l'image

- **Enregistrer la légende avec l'image des résultats** (activé par défaut) — si l'export SVG inclut le panneau de légende et l'indice de confiance, ou seulement le diagramme nu. Voir §8.7.
- **Grille** — une grille de référence optionnelle à **0,1 mrad**, **0,05 mrad**, **1/4 MOA** ou **1/8 MOA** d'écartement, ou aucune. L'écartement est angulaire, donc sa taille réelle est calculée à partir de la distance du projet. Réglez-la sur la valeur de clic de votre lunette et le diagramme devient directement lisible en clics de tourelle.
- **Impacts à l'échelle** (activé par défaut) — dessine chaque impact au diamètre réel du canon du projet au lieu d'une taille de repère fixe. C'est le rendu honnête, et c'est aussi celui qui fait ressembler une bonne carabine à courte distance à une bouillie illisible de cercles qui se chevauchent. Désactivez-le quand le chevauchement gêne.
- **1 MOA** — le cercle de référence en pointillés décrit plus haut.
- **Rayon de probabilité d'impact** — un curseur de 0 % à 99 %. Faites-le glisser et un cercle rouge foncé apparaît sur le diagramme au rayon contenant cette fraction des coups. L'affichage donne ce rayon de trois façons à la fois — dans votre unité de longueur configurée, en mrad et en MOA — pour que vous puissiez le confronter à une taille de cible, à une graduation de réticule ou à une échelle de tourelle sans rien convertir à la main.

  C'est la forme pratique de *« quelle taille doit faire la cible pour que je la touche neuf fois sur dix ? »* — et, à l'envers, *« quelle fraction de mes coups tombe dans une cible de cette taille ? »*

  **C'est un rayon, pas un diamètre.** Un gong de 100 mm a un rayon de 50 mm : faites glisser le curseur jusqu'à ce que l'affichage indique 50 mm et lisez le pourcentage sur le curseur. Oublier de diviser par deux est l'erreur la plus facile à commettre ici, et elle vous flatte largement.
- **Échelle** — une échelle graphique sur le diagramme, pour que l'image exportée soit lisible sans la légende.

Chacun de ces réglages — le sélecteur d'unités, chaque case Afficher sur l'image, la grille, les options de l'image, la position du curseur — est mémorisé et restauré la prochaine fois que vous ouvrez un rapport, y compris après un redémarrage de l'application. Ce sont des préférences d'affichage, pas des données de projet : elles vous suivent d'un projet à l'autre.

### 8.6 L'indice de confiance

Une jauge verticale avec un curseur, et le widget le plus important de la page.

Il répond à une seule question : **ai-je assez tiré pour pouvoir dire quoi que ce soit ?** La position du curseur est pilotée par la largeur de l'intervalle de confiance sur l'estimation de dispersion — intervalle étroit, curseur haut. La barre est divisée en bandes, de bas en haut : **VAUT RIEN DIRE**, **MAUVAIS**, **MOYEN**, **BON**, **EXCELLENT**, avec une ligne pointillée en haut de la bande VAUT RIEN DIRE légendée, avec la retenue qui caractérise cet outil, *« (seuil de foutaises) »*.

Sous cette ligne, vos données ne soutiennent aucune affirmation sur votre carabine.

Le panneau à côté de la jauge donne une qualité en toutes lettres, un **indice de confiance** sur une échelle de 0 à 4 avec des mentions plus, et la marge de confiance en pourcentage total plus ses deux bornes.

Voici ce que cela coûte en munitions. Ces chiffres sont exacts, et ils sont une propriété des mathématiques, pas de votre carabine — une bonne carabine n'atteint pas la confiance plus vite qu'une mauvaise :

| Coups | Marge de confiance | σ connu à | Indice | Qualité |
|---:|---:|:---|:---:|:---|
| 3 | 227 % | −40 % … +187 % | 0 | Inutile |
| 5 | 124 % | −32 % … +92 % | 0 | Inutile |
| 10 | 72 % | −24 % … +48 % | 0 | Inutile |
| 15 | 56 % | −21 % … +35 % | 0 | Inutile |
| **19** | 49 % | −19 % … +30 % | 1 | À peine intéressant |
| 22 | 45 % | −18 % … +27 % | 1+ | Faible |
| 27 | 40 % | −16 % … +24 % | 2 | Moyen |
| 35 | 35 % | −14 % … +20 % | 2+ | Au-dessus de la moyenne |
| 46 | 30 % | −13 % … +17 % | 3 | Bon |
| 65 | 25 % | −11 % … +14 % | 3+ | Très bon |
| 99 | 20 % | −9 % … +11 % | 4 | Excellent |

Lisez le haut de ce tableau, puis relisez-le. **Un groupement de cinq coups vous donne la dispersion de votre carabine à environ moins un tiers, plus un facteur deux près.** Dix coups — deux « groupements », une séance respectable selon la plupart des critères — vous laissent toujours incapable de distinguer une carabine d'une autre 40 % pire. Vous ne sortez pas d'*Inutile* avant dix-neuf coups, et vous n'obtenez pas de réponse vraiment serrée avant d'approcher la centaine.

Il s'ensuit que la seule chose que vous apprend réellement un groupement isolé de 3 coups posté sur internet, c'est quelque chose sur l'inculture statistique de son auteur — ou sur sa malhonnêteté intellectuelle.

Ce n'est pas un défaut de l'outil. C'est ce que coûte réellement la mesure d'une variable aléatoire à deux dimensions, et chaque affirmation de précision que vous avez jamais lue fondée sur un groupement de cinq coups était soumise exactement à la même arithmétique — elle ne vous le disait simplement pas.

La bonne nouvelle est que ces coups n'ont pas à être tirés d'une traite, ni le même jour, ni sur la même feuille de papier. C'est tout l'intérêt de la structure projet/cible/série : tirez cinq cartouches par semaine pendant cinq mois et laissez l'outil les accumuler.

### 8.7 Exports

**Enregistrer l'image** (à côté du titre Résultats agrégés) écrit le diagramme en **SVG** — vectoriel, donc il s'agrandit à n'importe quelle taille sans pixellisation. Avec *Enregistrer la légende avec l'image des résultats* activé, le fichier exporté porte une ligne d'en-tête avec le titre du projet, la distance, le calibre et le nombre de coups ; le panneau de légende complet ; et un rendu de l'indice de confiance, de sorte que l'image se suffit à elle-même et ne peut pas être citée dépouillée de son incertitude. L'export est généré à neuf sur fond blanc, il s'imprime et se colle donc proprement dans des documents quel que soit le thème d'application que vous utilisez.

**Exporter en CSV** écrit les coordonnées brutes de chaque coup agrégé, une ligne par coup :

| Colonne | Signification |
|---|---|
| `ShotRight (mm)` | décalage horizontal par rapport au point de visée de sa série, positif vers la **droite** |
| `ShotUp (mm)` | décalage vertical par rapport au point de visée de sa série, positif vers le **haut** |
| `Target` | le nom de la cible |
| `Group` | le numéro de la série au sein de sa cible |
| `Distance (m)` | la distance du projet |
| `Description` | le titre du projet |

**Chaque colonne nomme à la fois sa direction et son unité.** Réglez sur pouces et yards et les en-têtes deviennent `ShotRight (in)`, `ShotUp (in)`, `Distance (yd)`, les valeurs converties en conséquence — les coordonnées à la précision de votre petite longueur (2 décimales en mm, 3 en cm ou pouces), la distance à celle de son propre groupe. Le fichier dit donc ce qu'il veut dire sur sa face : rien n'a besoin d'être mémorisé, recherché, ou déduit des réglages qui se trouvaient actifs au moment de l'écriture. Les *noms* de colonnes restent en anglais quelle que soit la langue de l'application, car ce sont des identifiants pour l'outil auquel le fichier est destiné.

Le sélecteur **Unités d'affichage des résultats** n'atteint pas le CSV. Il peut exprimer les statistiques de façon angulaire, en mrad ou en MOA, mais ce sont ici des coordonnées brutes, qui sont toujours une longueur.

> **Changement de format.** Ces colonnes s'appelaient auparavant `ShotX` et `ShotY`, et `ShotY` était positif vers le *bas* — l'inverse de `ShotUp`. Le renommage est délibéré : un tableur qui référençait `ShotY` par son nom échoue désormais visiblement au lieu de lire silencieusement des nombres inversés. Si vous avez des exports archivés, ils sont dans l'ancienne convention ; inversez le signe de leur `ShotY` pour les comparer à un fichier récent.

Les séparateurs de champ et de décimale suivent vos préférences **Réglages → Export CSV**, de sorte que le fichier s'ouvre proprement dans la locale de tableur que vous utilisez — cela gouverne le *formatage* des nombres, indépendamment des unités ci-dessus. C'est la porte de sortie : si vous voulez faire votre propre analyse, ajuster votre propre modèle ou vérifier l'arithmétique de l'outil, voici vos données brutes.

---

## 9. Sauvegarde, restauration et gestion des données

Le stockage de l'outil vit dans votre navigateur. Sauvegardez-le.

- **Sauvegarder dans un fichier** (par projet) — un projet, autonome.
- **Sauvegarder la bibliothèque dans un fichier…** — une boîte de dialogue vous laissant choisir quels projets inclure, puis un unique fichier JSON les contenant tous.
- **Charger une sauvegarde depuis un fichier…** — importe un fichier précédemment enregistré.

Les photos voyagent à l'intérieur du fichier de sauvegarde, ce qui rend ces fichiers volumineux mais véritablement complets : un projet restauré est entièrement re-marquable et entièrement ré-analysable.

### Gestion des conflits à l'import

Les projets importés sont appariés à votre bibliothèque existante **par titre**, sans tenir compte de la casse ni des espaces. En cas de collision de titre, vous choisissez comment résoudre :

- **Écraser** — la version importée remplace l'existante.
- **Écraser si plus récent** — remplace seulement si l'horodatage de modification du projet importé est postérieur à celui de l'existant ; sinon il est ignoré. Le choix sûr pour fusionner deux appareils.
- **Renommer** — importe en copie, nommée *« <titre> - copie (1) »*, et ainsi de suite.

L'import indique combien d'éléments ont été enregistrés et combien ignorés. Si le fichier n'est pas du JSON valide, ou est du JSON valide mais pas un export de précision de tir, vous obtenez une erreur précise plutôt qu'une absence de réaction silencieuse.

---

## 10. Mise en pratique

### 10.1 Développement de rechargement

La tentation est de tirer un groupement de trois coups par charge de poudre, de choisir le plus petit et de déclarer un nœud. Le tableau du §8.6 vous dit exactement ce que vaut cette procédure : à trois coups, l'estimation de dispersion s'étend sur environ un facteur cinq. Vous sélectionnez du bruit.

La bonne procédure avec cet outil est :

1. Un **projet par rechargement**. Des titres identiques sauf pour le paramètre qui varie, pour que la liste des projets se trie raisonnablement.
2. Tirez chaque rechargement de façon répétée, sur plusieurs séances, en ajoutant des cibles à son projet au fur et à mesure.
3. Surveillez la pastille de confiance dans la liste des projets. Continuez à tirer jusqu'à ce que chaque candidat soit au moins sorti de la bande *Inutile*, et de préférence à *Moyen*.
4. Comparez les rechargements par **R50 avec son intervalle de confiance**, pas par R50 seul.

La règle de décision est simple et elle est stricte : **si les intervalles de confiance de deux rechargements se recouvrent, vous n'avez pas montré qu'ils sont différents.** Ils le sont peut-être bel et bien — mais pas d'après vos preuves. Soit vous tirez davantage, soit vous acceptez de ne pas pouvoir les départager et vous choisissez sur une autre base (régularité des vitesses, disponibilité des composants, ce dont vous avez déjà une caisse).

Cette règle disqualifiera, si vous l'appliquez honnêtement, la plupart des conclusions de développement de rechargement de la littérature de tir. C'est voulu — cette « majorité de conclusions » est de la foutaise inculte.

### 10.2 Réglage du zéro

La **moyenne des impacts** et son **intervalle de confiance** sont les outils de réglage du zéro, et c'est l'intervalle que les gens sautent.

La règle : **ne touchez pas aux tourelles tant que l'intervalle de confiance du point d'impact n'est pas plus petit que la correction que vous vous apprêtez à faire** — et idéalement plus petit qu'un clic de tourelle à votre distance. Si votre point d'impact indique 12 mm bas ±15 mm, corriger revient à jouer à pile ou face en déplaçant votre zéro vers un endroit que vous n'avez pas mesuré. Tirez davantage, regardez l'intervalle se resserrer, puis corrigez une fois.

Réglez les unités des résultats sur **mrad** ou **MOA** pour correspondre à vos tourelles, et la correction devient un nombre que vous pouvez afficher directement au lieu d'un nombre à convertir depuis une mesure linéaire à une distance dont il faut se souvenir.

Les signes sont ceux gravés sur vos bouchons de tourelle — V positif vers le haut, H positif vers la droite — donc la correction est la lecture avec le signe inversé : un point d'impact à `V -14 mm` demande 14 mm vers le haut.

Réglez la **Grille** sur la valeur de clic de votre lunette et lisez la correction directement sur le diagramme, en clics.

### 10.3 Alimenter le reste de la suite

**Définir comme précision de cartouche…** sur la ligne d'un projet transmet sa précision mesurée à une cartouche de l'Arsenal. La boîte de dialogue liste chaque projet dont les statistiques sont calculables, en montrant pour chacun son R50 agrégé en mrad et en MOA ainsi que sa pastille de confiance, pour que vous voyiez ce à quoi vous vous engagez. En choisir un écrit ce R50 dans la cartouche choisie.

De là, cela alimente **Probabilité d'impact**, qui le combine avec l'incertitude du vent, l'erreur d'estimation de distance et l'habileté du tireur pour produire des probabilités de toucher au premier coup à distance. C'est le gain de tout l'exercice : la différence entre une probabilité d'impact calculée à partir d'un R50 mesuré et borné par un intervalle de confiance, et une autre calculée à partir d'un nombre retenu d'un groupement de cinq coups, est la différence entre un calcul scientifique et une illusion en rose.

L'Arsenal stocke la précision en interne sous forme de R50 en mrad, mais accepte l'entrée dans la convention qui vous est la plus commode — R50, R95, R99, ES5 ou ES10 — en convertissant automatiquement vers R50 (§11.7). Si vous saisissez un nombre à la main plutôt que de choisir un projet, utilisez la convention que vous avez réellement mesurée.

### 10.4 Vérifier son matériel

Deux usages rapides qui découlent des chiffres :

**Le grossissement de ma lunette est-il adapté à ma carabine ?** *Une lunette vous aide à mieux voir, pas à mieux tirer.*

Si le R95 de votre carabine se situe autour de 1–1,5 MOA, une lunette en 12x ou 15x suffit largement à viser confortablement la plus petite cible que vous pouvez toucher avec confiance — et cela avant même le vent, la distance, la dispersion de vitesse initiale et les autres sources d'erreur qui s'ajoutent par-dessus. Un grossissement plus élevé peut être utile pour autre chose — identifier la cible, observer, lire le vent, etc. — mais pour la visée proprement dite, c'est du poids mort : vous avez plus de grossissement qu'il n'en faut, et l'argent dépensé pour ce supplément serait mieux employé ailleurs.

**Un « coup aberrant » en est-il vraiment un ?** Activez **R99** et regardez où tombe le coup en question. Un coup à l'intérieur du R99 n'est pas aberrant ; c'est la queue de votre distribution normale se comportant exactement comme prévu. Les vrais coups aberrants se placent ostensiblement à l'extérieur. Cela vous privera, dans la plupart des cas, de votre excuse préférée.

---

## 11. Le régal du geek : le modèle et les mathématiques

Tout ce qui suit est ce que l'outil calcule réellement, avec les dérivations. Ce n'est pas une lecture obligatoire pour se servir de l'outil, et c'est la partie la plus intéressante de l'outil.

**Les unités de cette section sont celles du moteur, pas les vôtres.** En interne, l'outil travaille exclusivement en **millimètres** pour les longueurs sur le papier et en **mètres** pour la distance, et chaque unité visible par l'utilisateur — mm, cm, pouces, yards, pieds, mrad, MOA — est une conversion appliquée à la frontière de l'affichage et nulle part ailleurs. Aucune statistique ci-dessous n'est affectée par vos préférences ; changer vos unités change la façon dont un nombre est imprimé, jamais ce qui a été calculé.

### 11.1 Le modèle sous-jacent

L'outil suppose que les écarts horizontal et vertical d'un coup, mesurés depuis le vrai centre du groupement, sont des **variables aléatoires normales indépendantes, de moyenne nulle et de même variance σ²** :

$$x \sim \mathcal{N}(0, \sigma^2), \qquad y \sim \mathcal{N}(0, \sigma^2), \qquad x \perp y$$

C'est le modèle circulaire-normal standard (normale bivariée isotrope) de la dispersion des coups. Sa conséquence est que l'écart **radial** $r = \sqrt{x^2 + y^2}$ suit une **loi de Rayleigh** de paramètre σ :

$$f(r) = \frac{r}{\sigma^2} \exp\left(-\frac{r^2}{2\sigma^2}\right), \qquad F(r) = 1 - \exp\left(-\frac{r^2}{2\sigma^2}\right)$$

Un seul paramètre, σ, décrit toute la dispersion. Chaque rayon que l'outil rapporte est un quantile de cette unique distribution, et l'intervalle de confiance de chacun d'eux est l'intervalle de confiance de cet unique paramètre.

**Les hypothèses, énoncées honnêtement.** Le modèle est isotrope : il suppose que les dispersions verticale et horizontale sont égales. Les carabines réelles violent fréquemment cela — l'étirement vertical dû à la variation de vitesse en est le cas classique, et l'étirement horizontal dû au vent un autre. Le modèle ne prévoit rien pour les coups aberrants, pour un mélange hétéroscédastique, ni pour un centre de groupement qui dérive d'une séance à l'autre (échauffement du canon, encrassement, un bipied qui marche). Il reste néanmoins le bon choix par défaut : il n'a qu'un paramètre, donc il converge à peu près aussi vite que possible, et ses modes de défaillance se voient à l'œil sur le nuage de points. Si votre nuage agrégé est visiblement une ellipse plutôt qu'un cercle, le σ qu'on vous montre est un compromis entre deux nombres différents, et cela vaut la peine d'être gardé en tête.

Notez également que l'outil mesure la dispersion du *système entier tel que vous avez tiré* — carabine, munitions, optique, appui et tireur. Il ne peut pas les séparer. Un projet tiré sur bipied dans le vent vous mesure vous et la météo autant que la carabine.

### 11.2 Agrégation

Pour chaque coup $i$ de la série $g$ sur la cible $T$ :

1. Le coup et le point de visée de sa série sont stockés comme des fractions des dimensions natives en pixels de la photo, dans $[0,1]^2$. Ils sont convertis en pixels natifs en multipliant par la largeur et la hauteur de la photo.
2. L'échelle $s_T$ de la cible (px/mm) vient de sa règle de calibration :

   $$s_T = \frac{\sqrt{(\Delta x_{\text{px}})^2 + (\Delta y_{\text{px}})^2}}{L_{\text{réel}}}$$

   où le numérateur est la distance en pixels entre les deux points de calibration et $L_{\text{réel}}$ la longueur que vous avez saisie, en mm.
3. Les coordonnées en pixels sont divisées par $s_T$ pour donner des millimètres.
4. Le coup est recentré sur le point de visée de sa propre série :

   $$(x_i, y_i) = (x_i^{\text{mm}} - x_{g,\text{PV}}^{\text{mm}},\; y_i^{\text{mm}} - y_{g,\text{PV}}^{\text{mm}})$$

Stocker les positions comme fractions de photo plutôt que comme millimètres est ce qui rend la recalibration rétroactive possible : corriger la règle des mois plus tard remet automatiquement à l'échelle tous les impacts de cette cible. C'est aussi ce qui rend l'outil agnostique aux unités par construction — un coup stocké n'a aucune unité, seulement une position sur une image. Les millimètres entrent pour la première fois à l'étape 2, via $L_{\text{réel}}$, elle-même convertie depuis l'unité dans laquelle vous l'avez saisie ; à partir de là toute la chaîne est métrique, et vos unités préférées ne réapparaissent qu'au moment où un nombre fini est imprimé.

**Repère de coordonnées.** L'origine de la fraction de photo est le coin supérieur gauche de l'image et son axe vertical croît **vers le bas**, donc les $y_i$ agrégés sont positifs *sous* le point de visée. Le moteur conserve ce repère de bout en bout, délibérément : c'est aussi le repère du SVG, et c'est ce qui permet au diagramme de dessiner les coups agrégés, les cercles de rayon, la grille et la boîte du point d'impact directement à partir de ces millimètres, sans aucune transformation.

Cela n'a aucun effet sur une quelconque statistique de dispersion. Chaque grandeur à partir du §11.3 ne dépend de $y$ qu'à travers des écarts au carré par rapport à la moyenne, invariants par changement de signe. Cela ne compte que pour l'unique grandeur signée que l'outil rapporte — le décalage vertical du zéro — qui est lue par un humain face à une tourelle et doit donc être positive *vers le haut*.

Cette conversion a lieu à un seul endroit, un utilitaire `toShooterFrame()` appliquant $(x, y) \mapsto (x, -y)$, par lequel passent les trois chemins lisibles par un humain : la moyenne des impacts du tableau Chiffres, la ligne point-d'impact de la légende (et avec elle la légende de l'export SVG), et la colonne `ShotUp` du CSV. Le moteur de rendu le contourne, parce que l'image, elle, a toujours été juste.

Les deux repères sont un danger réel quand ils restent implicites, ce qui est l'argument en faveur de nommer la frontière plutôt que d'éparpiller des changements de signe : des versions antérieures de cet outil portaient une seconde convention contradictoire, positive vers le haut, dans une paire de décalages par série inutilisée, et le commentaire qui l'accompagnait affirmait le contraire de ce que le rapport affichait réellement. Ces champs ont été supprimés.

L'échantillon agrégé est l'union de ces coups recentrés, sur toutes les séries et toutes les cibles. Chaque cible contribue à travers son propre facteur d'échelle, et c'est pourquoi des photos prises à des distances différentes se combinent correctement.

**Bornes.** Moins de 3 coups agrégés renvoie `tooFewShots` ; plus de 1000 renvoie `tooManyShots`. La liste agrégée brute est renvoyée dans tous les cas, de sorte que l'export CSV fonctionne même quand les statistiques ne le font pas.

### 11.3 Estimer σ

Soit $n$ le nombre de coups agrégés et $(\bar{x}, \bar{y})$ le barycentre de l'échantillon. Les variances d'échantillon par axe utilisent le dénominateur corrigé de Bessel $n-1$ :

$$v_x = \frac{1}{n-1}\sum_i (x_i - \bar{x})^2, \qquad v_y = \frac{1}{n-1}\sum_i (y_i - \bar{y})^2$$

et sont moyennées, puisque le modèle affirme qu'elles estiment la même grandeur :

$$v = \frac{v_x + v_y}{2}$$

Or, $\sqrt{v}$ n'est **pas** un estimateur sans biais de σ, même si $v$ est sans biais pour σ². La racine carrée est concave, donc par l'inégalité de Jensen $E[\sqrt{v}] < \sqrt{E[v]} = \sigma$ : l'estimateur naïf est biaisé vers le *bas*, et d'autant plus que l'échantillon est petit. L'outil corrige cela exactement.

Sous le modèle, $\dfrac{k \, v}{\sigma^2} \sim \chi^2_k$ avec

$$k = 2(n-1)$$

degrés de liberté — deux par coup, moins deux pour le barycentre estimé. L'espérance de la racine carrée d'une variable du khi-deux est connue sous forme fermée,

$$E\left[\sqrt{\chi^2_k}\right] = \sqrt{2}\,\frac{\Gamma\!\left(\frac{k+1}{2}\right)}{\Gamma\!\left(\frac{k}{2}\right)}$$

ce qui donne le facteur de débiaisage

$$c_n = \sqrt{\frac{k}{2}} \cdot \frac{\Gamma\!\left(\frac{k}{2}\right)}{\Gamma\!\left(\frac{k+1}{2}\right)}, \qquad k = 2(n-1)$$

et l'estimateur que l'outil utilise réellement :

$$\boxed{\hat{\sigma} = c_n \sqrt{v}}$$

C'est l'analogue exact du facteur de correction $c_4$ de la maîtrise statistique des procédés, généralisé à $2(n-1)$ degrés de liberté. Le facteur est livré sous forme de table précalculée indexée par $n$ de 2 à 1000, et il concorde avec la forme fermée ci-dessus jusqu'aux dix décimales stockées, pour chaque entrée :

| n | 2 | 3 | 5 | 10 | 20 | 50 | 100 | 1000 |
|---|---|---|---|---|---|---|---|---|
| $c_n$ | 1,1284 | 1,0638 | 1,0317 | 1,0140 | 1,0066 | 1,0026 | 1,0013 | 1,0001 |

À $n=2$ la correction vaut 12,8 %, ce qui n'est pas un détail d'arrondi — une estimation à deux coups non corrigée sous-estime la dispersion d'un huitième. À $n=20$ elle est sous le 1 % et à $n=100$ elle est cosmétique, mais elle coûte une consultation de table, alors il n'y a aucune raison de ne pas être exact.

### 11.4 L'intervalle de confiance sur σ

Même pivot du khi-deux, utilisé dans l'autre sens. Avec $k = 2(n-1)$,

$$\Pr\left(\chi^2_{0.025,k} \le \frac{k\,v}{\sigma^2} \le \chi^2_{0.975,k}\right) = 0.95$$

En réarrangeant pour σ² et en prenant les racines carrées, on obtient l'intervalle bilatéral à 95 %, exprimé en multiplicateurs de l'estimation ponctuelle :

$$\boxed{\;\lambda_{\text{lo}} = \sqrt{\frac{k}{\chi^2_{0.975,k}}}, \qquad \lambda_{\text{hi}} = \sqrt{\frac{k}{\chi^2_{0.025,k}}}\;}$$

de sorte que l'intervalle est $[\lambda_{\text{lo}}\hat\sigma,\ \lambda_{\text{hi}}\hat\sigma]$. L'outil stocke les bornes du rapport de *variances* $k/\chi^2$ dans ses tables et prend la racine carrée à l'usage ; le facteur de débiaisage et $\sqrt{v}$ s'annulent algébriquement dans le rapport, si bien que les multiplicateurs ne dépendent que de $n$ et pas du tout de vos données. Vérifiée contre les quantiles exacts du khi-deux, chaque entrée de la table concorde jusqu'à sept décimales.

La **marge de confiance** affichée dans l'interface est simplement $\lambda_{\text{hi}} - \lambda_{\text{lo}}$, et les pourcentages affichés sont $(\lambda_{\text{lo}} - 1)$ et $(\lambda_{\text{hi}} - 1)$.

L'asymétrie est sévère aux petits $n$ et c'est le cœur mathématique du §8.6. À $n=5$ : $\lambda_{\text{lo}} = 0.676$, $\lambda_{\text{hi}} = 1.916$. Votre estimation à cinq coups est compatible avec une vraie dispersion aux deux tiers de ce que vous avez mesuré, et tout aussi compatible avec près du double. À $n=2$ le multiplicateur supérieur vaut $\sqrt{39.5} = 6.28$.

L'intervalle se resserre en $O(1/\sqrt{n})$ — le rythme habituel, brutal. Diviser la largeur par deux coûte quatre fois plus de munitions.

### 11.5 Les rayons de précision

Chaque rayon est la fonction de répartition de Rayleigh inversée à la probabilité correspondante. En posant $F(r) = p$ et en résolvant :

$$r_p = \sigma\sqrt{-2\ln(1-p)}$$

ce qui donne directement les constantes rapportées :

| Statistique | Dérivation | Multiplicateur de σ | Utilisé |
|---|---|---|---|
| **R50** (CEP) | $\sqrt{2\ln 2}$ | 1,17741 | 1,18 |
| **R95** | $\sqrt{-2\ln 0.05}$ | 2,44775 | 2,45 |
| **R99** | $\sqrt{-2\ln 0.01}$ | 3,03485 | 3,03 |

R50 est la **médiane** de Rayleigh, ce qui explique pourquoi c'est le chiffre principal préféré : c'est le quantile le plus robuste de la distribution et le moins sensible aux hypothèses de queue du modèle.

Le **curseur de probabilité d'impact** interactif est la même formule évaluée en continu. Pour un pourcentage $p$, il calcule

$$r = \sigma\sqrt{-\ln\left((1 - p/100)^2\right)} \;=\; \sigma\sqrt{-2\ln(1 - p/100)}$$

— les deux formes sont algébriquement identiques. Le curseur est plafonné à 99 % parce que $p = 100$ envoie le logarithme à l'infini.

L'**intervalle de confiance du R95** dessiné sur le diagramme est $[\lambda_{\text{lo}} R_{95},\ \lambda_{\text{hi}} R_{95}]$ — l'intervalle de σ propagé par une mise à l'échelle linéaire, ce qui est exact puisque $R_{95}$ est proportionnel à σ.

### 11.6 Dispersion maximale attendue — ES5x et ES10x

La dispersion maximale est la plus grande distance entre paires parmi $n$ coups :

$$\text{ES}_n = \max_{i<j} \lVert p_i - p_j \rVert$$

C'est le **diamètre de l'enveloppe convexe** de l'échantillon, et il n'a pas de forme fermée exploitable pour la normale bivariée au-delà de $n=2$. Son espérance est obtenue numériquement (intégration Monte-Carlo à grand échantillon sur la circulaire-normale), et elle est linéaire en σ par invariance d'échelle :

$$E[\text{ES}_5] = 3.06\,\sigma, \qquad E[\text{ES}_{10}] = 3.79\,\sigma$$

Ce sont les chiffres ES5x et ES10x. Notez leur propriété la plus importante : **ce sont des espérances, pas des bornes.** La dispersion maximale d'un groupement isolé est elle-même une variable aléatoire avec sa propre dispersion considérable — ce qui est précisément pourquoi c'est un estimateur épouvantable et pourquoi cet outil se donne la peine de ne pas l'utiliser.

Remarquez aussi la forme de la relation. Passer de 5 à 10 coups par groupement augmente la taille *attendue* du groupement de 24 %, uniquement parce que vous avez donné à l'échantillon plus d'occasions de produire une paire extrême, sans le moindre changement de la carabine sous-jacente. C'est le mécanisme par lequel « ma carabine tire des groupements d'une demi-MOA » et « ma carabine tire des groupements d'une MOA » peuvent être toutes deux des affirmations vraies sur la même carabine, ne différant que par le nombre de coups tirés avant de mesurer. La dispersion maximale n'est pas une propriété de la carabine ; c'est une propriété de la carabine *et de la taille de l'échantillon*, et la citer sans cette dernière n'a pas de sens.

Parce que la dispersion maximale croît avec $n$ alors que σ, R50 et R95 ne le font pas, seuls ces derniers sont comparables entre tireurs. C'est l'argument en faveur du R50 en une phrase.

### 11.7 Conversions entre conventions

Pour l'interopérabilité avec le reste de la suite — l'Arsenal stocke la précision en R50 en mrad — toute convention se convertit en σ en divisant par son multiplicateur du §11.5, et σ se convertit en R50 en multipliant par 1,1774. ES5 et ES10 se divisent respectivement par 3,06 et 3,79. Ainsi, par exemple, une carabine annoncée comme faisant 1 MOA sur dix coups a

$$\sigma = \frac{1.0}{3.79} = 0.264\ \text{MOA} \quad\Rightarrow\quad R_{50} = 1.1774 \times 0.264 = 0.311\ \text{MOA}$$

ce qui est une chose utile à savoir faire de tête chez l'armurier.

### 11.8 L'intervalle de confiance sur le point d'impact

Un problème différent de celui de l'intervalle de dispersion, et un pivot différent. Le barycentre agrégé $(\bar{x}, \bar{y})$ estime le vrai centre du groupement ; son incertitude est l'erreur type d'une moyenne, ce qui, pour une population normale de variance inconnue, est un problème de *t* de Student :

$$\text{IC}_x = t_{q,\,n-1} \cdot \frac{\sqrt{v_x}}{\sqrt{n}}, \qquad \text{IC}_y = t_{q,\,n-1} \cdot \frac{\sqrt{v_y}}{\sqrt{n}}$$

Notez que les variances par axe $v_x$ et $v_y$ sont utilisées **séparément** ici, et non la moyenne agrégée $v$ — de sorte que l'intervalle de confiance du point d'impact est réellement elliptique et rapportera honnêtement qu'une carabine qui étire verticalement est mieux connue horizontalement que verticalement. (L'estimation de dispersion du §11.3 les agrège ; l'estimation du point d'impact non. C'est délibéré : l'hypothèse d'isotropie est un choix de modélisation pour les quantiles radiaux, mais il n'y a aucune raison de l'imposer à une simple moyenne.)

Le quantile est pris à

$$q = 1 - \frac{0.05}{4} = 0.9875$$

plutôt qu'au naïf 0,975. C'est une **correction de Bonferroni sur les deux axes** : l'intervalle affiché est une région à 95 % *conjointe* sur l'horizontale et la verticale simultanément, chaque axe se voyant donc allouer α/2 = 0,025 de l'erreur totale, répartie bilatéralement en 0,0125 par queue. Prendre 0,975 par axe donnerait deux intervalles marginaux à 95 % dont la couverture conjointe ne serait que d'environ 90 %. Vérifiée contre les quantiles exacts de *t* à $q = 0.9875$ avec $n-1$ degrés de liberté, la table livrée concorde jusqu'à cinq décimales partout.

L'intervalle est dessiné sur le diagramme comme une boîte en pointillés autour du repère du point d'impact.

### 11.9 L'échelle de l'indice de confiance

La jauge fait correspondre la marge de confiance $c = \lambda_{\text{hi}} - \lambda_{\text{lo}}$ à une position de curseur, et séparément à l'un de huit niveaux discrets.

L'**indice discret** est un balayage de seuils sur

$$[0.5,\ 0.45,\ 0.4,\ 0.35,\ 0.3,\ 0.25,\ 0.2,\ 0]$$

renvoyant l'index du premier seuil que $c$ dépasse — niveau 0 (« Inutile ») pour $c > 0.5$, niveau 7 (« Excellent ») pour $c \le 0.2$. Les niveaux sont étiquetés sur une échelle de 0 à 4 avec mentions plus : `0, 1, 1+, 2, 2+, 3, 3+, 4`.

La **position continue du curseur** $\phi \in [0,1]$ est une application linéaire en deux morceaux, bornée aux deux extrémités et se rejoignant exactement en $c = 0.5$ :

$$\phi = \begin{cases} (1.5 - c) \cdot 0.2 & c > 0.5 \\[4pt] 1 - (c - 0.2)\cdot\frac{8}{3} & c \le 0.5 \end{cases}$$

Vérifiez la jonction : en $c = 0.5$ la branche supérieure donne $(1.5-0.5)\times 0.2 = 0.2$ et l'inférieure donne $1 - 0.3 \times 8/3 = 0.2$. Continue.

La conséquence de conception est que les 20 % du bas de la jauge — la bande « VAUT RIEN DIRE », tout ce qui est sous le **seuil de foutaises** à $c = 0.5$ — absorbent tout l'intervalle $c \in (0.5, 1.5]$, tandis que les 80 % du haut étalent l'intervalle $c \in (0.2, 0.5]$ sur les six frontières de niveau qui comptent. Autrement dit, la jauge comprime délibérément la région où vos données ne valent rien en une seule bande visuelle et dépense sa résolution là où les distinctions comptent. Un groupement de 3 coups ($c = 2.27$) et un de 10 coups ($c = 0.72$) se placent tous deux près du bas, et à juste titre : ni l'un ni l'autre ne vous dit quoi que ce soit, et la jauge refuse de flatter la différence entre eux.

Le seuil à $c = 0.5$ correspond à $n = 19$. C'est l'opinion réfléchie de l'outil sur la taille d'échantillon minimale pour une affirmation de précision défendable, et elle est dérivée, non décrétée.

### 11.10 Conversion angulaire

Les résultats angulaires utilisent les conversions exactes partagées de la suite plutôt que les approximations habituelles de terrain. Les deux unités sont converties par leur mesure exacte en radians : un milliradian sous-tend exactement $1/1000$ de la distance, et une minute d'angle sous-tend

$$1' = \frac{\pi}{10800} = 2.908882 \times 10^{-4}\ \text{rad}$$

soit 0,29089 mm par mètre de distance, ou **1,0472 pouce à 100 yards** — et non le « 1 pouce » du raccourci de tireur. Ce raccourci porte une erreur de 4,7 %, plus grande que la différence entre bon nombre des rechargements que les gens essaient de départager.

$$\theta_{\text{mrad}} = \frac{d_{\text{mm}}}{\text{distance}_{\text{m}}}, \qquad \theta_{\text{MOA}} = \frac{d_{\text{mm}}}{0.29089 \cdot \text{distance}_{\text{m}}}$$

Les écartements de grille proposés dans les Options de l'image (0,1 mrad, 0,05 mrad, 1/4 MOA, 1/8 MOA) ont leur écartement réel en millimètres calculé à partir de la distance propre du projet au moment où vous les sélectionnez, et c'est pourquoi la grille reste une vraie référence angulaire quelle que soit la distance à laquelle vous avez tiré.

### 11.11 Notes numériques

- La recherche de la **dispersion maximale** est une force brute en $O(n^2)$ sur les paires d'une série. Les séries sont petites ; un diamètre d'enveloppe par rotation d'étriers serait asymptotiquement meilleur et pratiquement sans intérêt.
- Les tables ($c_n$, les deux multiplicateurs du khi-deux, les quantiles de *t*) sont livrées précalculées pour $n = 2 \ldots 1000$ plutôt qu'évaluées à l'exécution. Ce sont des constantes statistiques exactes, vérifiées analytiquement comme documenté ci-dessus, et les livrer évite d'embarquer une bibliothèque de fonctions spéciales pour gamma et bêta incomplète dans un paquet destiné au navigateur.
- Le plafond de 1000 coups est la borne de la table, pas une limite algorithmique. Si vous avez tiré plus de mille cartouches dans un seul projet, vous avez gagné le droit de le scinder.

---

## 12. Origine et licence

La Calculette de précision de tir est le successeur de **TARAN**, un outil autonome du même auteur. Le cœur statistique — le modèle, les facteurs de correction, les tables de confiance, l'indice de confiance et son irrévérence — est repris délibérément inchangé, afin que les résultats des deux outils soient directement comparables. La conversion en mrad est le seul écart délibéré : la constante héritée portait une erreur d'un facteur dix et a été corrigée d'après les conversions angulaires exactes de la suite.

Ce qui est nouveau, c'est la structure autour : une hiérarchie projet/cible/série avec calibration par cible en lieu et place d'un modèle unique et plat en coordonnées pixel, la recalibration rétroactive, le marquage ajustable par glisser-déposer, le stockage persistant avec sauvegarde et fusion, l'export SVG et CSV, et l'intégration au reste de la suite balistique.

La suite est sous licence **AGPL-3.0-or-later**. Le code TARAN hérité dont elle dérive est sous GPLv3, © 2015 le même auteur.

---

*Pacifique. Précis. Armé.*
