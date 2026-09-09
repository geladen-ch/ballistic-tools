# geladen.ch ballistics Manuel de l'utilisateur — Armes/Arsenal

*Fait partie de la* [suite balistique geladen.ch](https://bc.geladen.ch)*. La bibliothèque de carabines et de balles partagée par tous les autres outils.*

---

## 1. À quoi sert cet outil

Tout autre outil de cette suite finit par vous poser les trois mêmes questions : quelle carabine, quelle balle, quelle charge. Trajectoire la pose. Probabilité de toucher la pose. Calculateur de terrain la pose. Y répondre à la main à chaque fois — retaper une hauteur de lunette, un coefficient balistique, une vitesse initiale que vous avez citée de mémoire cent fois — est fastidieux et un peu insultant pour votre intelligence, et les ordinateurs ont été inventés précisément pour que personne n'ait à faire ça à la main.

L'Arsenal est l'endroit où vous répondez à ces questions **une fois**, pour chaque carabine et chaque balle que vous possédez réellement, et plus jamais ensuite. Une carabine que vous enregistrez porte sa hauteur de lunette, sa distance de réglage, son pas de rayure, les valeurs de clic de sa lunette. Une balle que vous enregistrez porte son calibre, sa masse, ses données de traînée. Une cartouche — une charge précise tirée par une carabine précise — relie une balle à une vitesse initiale, et éventuellement aux deux chiffres les plus durement acquis de toute la balistique extérieure : la régularité réelle de la vitesse de cette charge, et la précision réelle avec laquelle cette carabine la tire — deux choses que vous seriez sinon tenté de deviner.

Une fois enregistrées, vos carabines et vos balles apparaissent **partout** où une carabine ou une balle peut être choisie dans cette application, aux côtés de la bibliothèque intégrée et marquées d'un `*` en préfixe pour que vous sachiez toujours lesquelles sont les vôtres. Choisissez votre carabine une fois dans Armes, et Trajectoire, Probabilité de toucher et Calculateur de terrain savent déjà tous les trois avec quoi vous tirez.

### Ce que cet outil n'est pas

Ce n'est pas un calculateur balistique en soi. L'Arsenal stocke les *entrées* — BC, pas de rayure, vitesse initiale, et ainsi de suite — que le moteur de Trajectoire et Probabilité de toucher consomment ; il ne calcule pas lui-même de courbe de chute, hormis la petite fonction de comparaison décrite au §7, qui existe précisément pour vous permettre de comparer deux configurations enregistrées l'une à l'autre.

Ce n'est pas la **Calculette de précision de tir**, qui mesure la dispersion mécanique réelle d'une carabine à partir de photographies de groupements. L'Arsenal consomme la sortie de cet outil — voir §5.6 — il ne la produit pas.

---

## 2. Confidentialité, stockage et prérequis

**Rien de ce que vous mettez dans cet outil ne quitte votre appareil.** Pas de compte, pas de téléversement, pas de télémétrie. Vos carabines et vos balles sont stockées dans le `localStorage` propre à votre navigateur, sur votre propre machine, et relues depuis là. Tout le calcul tourne en JavaScript dans votre navigateur.

La conséquence est celle à laquelle on s'attend : **si vous effacez les données de site de votre navigateur, votre Arsenal a disparu.** Il n'existe aucune copie côté serveur à partir de laquelle restaurer. Utilisez les fonctions de sauvegarde (§8) si ces données comptent pour vous — et l'Arsenal vous signale, élément par élément, quand quelque chose n'a jamais été sauvegardé (§9).

Contrairement à la précision de tir, l'Arsenal ne stocke aucune photographie ni donnée binaire volumineuse, si bien que son empreinte dans le `localStorage` reste faible, quel que soit le nombre de carabines et de balles que vous conservez. Il n'existe aucune limite intégrée au nombre de l'une ou l'autre que vous pouvez enregistrer.

**Prérequis.** N'importe quel navigateur raisonnablement récent. L'application s'installe comme PWA et fonctionne entièrement hors ligne une fois chargée.

---

## 3. Le modèle de données : Balles, Carabines, Cartouches

Trois sortes d'enregistrements, et une relation entre eux qu'il vaut la peine de comprendre avant de commencer à cliquer :

```
Balle          un projectile précis : calibre, masse, données de traînée
Carabine       une carabine précise : hauteur de lunette, distance de réglage, pas de rayure, valeurs de clic
  └─ Cartouche   une charge tirée par cette carabine : une Balle + une vitesse initiale
```

**Une Balle** existe seule. Elle décrit un projectile — son calibre, sa masse, et soit un coefficient balistique associé à un modèle standard, soit une courbe de traînée mesurée personnalisée — et rien sur ce qui la tire. Le même enregistrement de balle peut être référencé par des cartouches sur plusieurs carabines différentes.

**Une Carabine** existe seule elle aussi, dans le même sens : elle décrit la plateforme — hauteur de lunette au-dessus de l'âme, la distance à laquelle vous la réglez habituellement, son pas de rayure (taux et sens), et la valeur de clic des tourelles de sa lunette — et rien sur ce qu'elle tire. Une carabine n'a **aucun calibre propre** ; son calibre est celui que dictent les balles de ses cartouches (§5.5).

**Une Cartouche** est ce qui relie réellement les deux. Elle vit imbriquée dans une carabine, jamais seule, et nomme une balle plus la vitesse initiale que cette carabine atteint avec elle. C'est également là, en option, que résident les deux chiffres les plus lourds de conséquences et les plus souvent devinés de toute la balistique extérieure : la régularité de vitesse de la charge (§5.4) et la précision propre mesurée de la carabine (§5.6) — les deux alimentant directement Probabilité de toucher.

**Une carabine chambre un calibre.** Dès qu'une cartouche d'une carabine se résout en une balle réelle, la sélection de balle de chaque autre cartouche que vous ajoutez à cette carabine se verrouille sur les balles de ce même calibre (§5.5). C'est imposé, pas simplement suggéré — cela reflète un fait sur les carabines, pas une limitation de l'outil. (Et si vous possédez un drilling ou une autre arme combinée à plusieurs calibres, pas la peine de faire le malin — créez simplement une entrée séparée par calibre.)

### 3.1 Une remarque sur les unités

**Chaque nombre que cet outil vous affiche, et chaque nombre que vous pouvez saisir, est dans les unités que vous avez choisies dans les Paramètres** — à deux exceptions délibérées près, toutes deux signalées ci-dessous.

Les groupes d'unités en jeu :

- **Vitesse** (`m/s`, `ft/s`, `mph`, `km/h`) — vitesse initiale et son écart-type.
- **Distance** (`m`, `yd`, `ft`) — la distance de réglage d'une carabine, et la distance maximale du graphique de comparaison.
- **Petite longueur** (`mm`, `cm`, `in`) — hauteur de lunette, calibre et longueur de balle. Le calibre et la longueur s'affichent avec une précision plus fine à l'échelle des projectiles (2 décimales en mm, 3 en cm et en pouces), la même précision que la Calculette de précision de tir utilise pour la même raison.
- **Pas de rayure** (`mm`, `in`) — son propre groupe d'unités, délibérément **indépendant** de la petite longueur. Un tireur qui pense en millimètres pour la hauteur de lunette cite très souvent malgré tout le pas de rayure à la manière traditionnelle, en pouces par tour, et changer votre préférence générale de petite longueur ne convertira pas silencieusement un pas de rayure saisi comme « 1:8 in » en un nombre en millimètres que vous ne reconnaîtriez plus.
- **Température** (`°C`, `°F`) — la température de référence d'une cartouche pour la sensibilité vitesse-température.
- **Masse** — le poids de la balle est le seul champ qui ne se cache jamais derrière une seule préférence d'unité. Il s'affiche comme une **paire de champs liés en direct**, grammes et grains côte à côte ; saisissez dans l'un et l'autre se met à jour immédiatement. Cela reflète la façon dont le poids d'une balle est réellement cité dans la pratique — en grains dans les cercles du rechargement, en grammes presque partout ailleurs en système métrique — plutôt que d'imposer un choix.

**Les deux exceptions**, toutes deux voulues :

- **Les clics de la lunette** (valeur de clic horizontal et vertical d'une carabine) portent leur **propre** choix d'unité, mrad ou MOA, fixé une fois par carabine et indépendant de votre préférence globale de dispersion angulaire. Le champ le dit directement : *« Toujours dans l'unité choisie ici, indépendamment des préférences d'unités des Paramètres. »* La tourelle d'une lunette est gravée dans une unité pour toute sa durée de service — et les propriétaires de lunettes graduées en MOA souffrent déjà bien assez sans que cet outil leur impose en plus une conversion manuelle vers des unités sensées.
- **La valeur de précision d'arme d'une cartouche** (§5.6) porte de même son propre choix d'unité, mrad ou MOA, indépendant de cette même préférence globale, pour la raison identique : la taille de groupement propre mesurée d'une carabine ne devrait pas se réinterpréter silencieusement la prochaine fois que vous basculez un réglage des Paramètres sans rapport avec cette carabine.

En interne, le moteur travaille exclusivement en mètres, mètres par seconde et kilogrammes ; la conversion n'a lieu qu'à la frontière de l'affichage. Changer votre préférence d'unité n'altère jamais les données stockées — une hauteur de lunette saisie comme 45 mm continue de s'afficher comme 1,772 in si vous basculez, et décrit exactement la même carabine.

---

## 4. Démarrage rapide

Pour les impatients. Les détails suivent aux §5–§9.

1. **Armes** depuis le menu des outils, ou le lien **Modifier** affiché à côté du résumé actuel de carabine/balle dans Trajectoire, Probabilité de toucher ou Calculateur de terrain → onglet **Arsenal**.
2. **+ Ajouter une balle** d'abord si vous n'en avez pas encore enregistré une. Nommez-la, donnez-lui un calibre et une masse, et soit un coefficient balistique avec un modèle standard, soit une table Cd-Mach collée. **Enregistrer la balle**.
3. **+ Ajouter une carabine**. Nommez-la, réglez au minimum sa hauteur de lunette et sa distance de réglage ; pas de rayure et valeurs de clic si vous les connaissez. **Enregistrer la carabine**.
4. Sur la carabine désormais active, **+ Ajouter une cartouche**. Nommez la charge, choisissez la balle que vous venez d'enregistrer (ou ajoutez-en une directement), et saisissez la vitesse initiale. **Enregistrer la cartouche**.
5. Votre carabine est maintenant prête à être choisie n'importe où dans l'application. Appuyez sur **Terminé** pour en faire la carabine active de l'application, ou continuez d'ajouter des carabines et des cartouches d'abord.

Une carabine sans aucune cartouche est enregistrée mais marquée **Inutilisable** (§6.4) — elle ne peut devenir la carabine active de l'application tant qu'elle n'en a pas au moins une.

---

## 5. Balles et cartouches

### 5.1 Ajouter une balle

**+ Ajouter une balle** ouvre un formulaire :

- **Nom** — requis. Un avertissement en direct apparaît si le nom existe déjà dans votre bibliothèque ; l'enregistrement écrase l'entrée existante. C'est un avertissement, pas un blocage.
- **Fabricant** — texte libre, avec autocomplétion tirée à la fois des bibliothèques de balles intégrées et de vos propres balles enregistrées. Laissé vide, il est stocké comme *« Custom »*.
- **Calibre** — **requis**. Un contrôle double : une liste déroulante de désignations de calibre standard (*« Choisir un calibre… »*) plus un nombre saisi librement dans votre unité de petite longueur configurée. Choisissez une désignation et le diamètre d'âme exact est renseigné ; saisissez plutôt un nombre et, s'il tombe à moins de 0,03 mm d'une désignation connue, celle-ci est sélectionnée automatiquement — sinon la liste affiche **Autre** sans jeter ce que vous avez saisi. C'est exactement la même liste de désignations et la même logique de correspondance que la Calculette de précision de tir utilise pour son propre champ de calibre.
- **Longueur** — facultatif, laissé vide si inconnu. Elle n'alimente que deux choses et rien d'autre : la stabilité de la balle (formule de Miller) et la dérive gyroscopique, décrites aux §5.5 et §9.3 — les deux méthodes de calcul de la dérive gyroscopique que propose cette suite, la formule simple de Litz et le modèle plus complet McCoy 4-DOF, en ont également besoin.
- **Masse** — requis, saisie sous forme de la paire grammes/grains liée décrite au §3.1.
- **Données de traînée** — requis, et mutuellement exclusives :
  - **Coefficient balistique + modèle standard** — une valeur de BC (0,05–1,5) associée à un modèle standard (G1, G7, et les autres modèles standard de la suite).
  - **Table Cd-Mach personnalisée** — pour une balle dont vous possédez la propre courbe de traînée mesurée (par exemple issue de données radar publiées), collée en texte brut : une ligne par paire Mach-Cd, au moins deux lignes, un Mach strictement croissant sur toute la liste, chaque Cd compris entre 0,05 et 3,0. Le formulaire l'analyse en direct et signale combien de lignes il a trouvées, ou exactement quelle ligne pose problème — par exemple « Ligne 3 : le Mach doit strictement augmenter d'une ligne à l'autre. » — plutôt qu'une erreur d'analyse générique.
- **Source / notes** — texte libre, facultatif. D'où vient ce chiffre, ou ce que vous avez réellement mesuré et comment.

### 5.2 La liste des balles

**Vos balles** liste chaque balle enregistrée : nom, une pastille **Sans sauvegarde** si elle n'a jamais été exportée vers un fichier depuis sa dernière modification, puis fabricant, calibre et poids, ainsi qu'une date de dernière modification. Chaque ligne propose **Sauvegarder dans un fichier**, **Modifier**, et **Supprimer**.

**Supprimer une balle entraîne une cascade.** Si une cartouche, sur n'importe quelle carabine, référence actuellement la balle que vous supprimez, la confirmation indique précisément combien de configurations de cartouche seront supprimées avec elle. Il n'existe aucun moyen de supprimer une balle en laissant derrière soi une référence orpheline.

### 5.3 Ajouter une carabine

**+ Ajouter une carabine** ouvre un formulaire :

- **Nom** — requis, avec le même avertissement d'écrasement que pour les balles.
- **Hauteur de la lunette** — requis, hauteur de l'axe optique de la lunette au-dessus de l'âme, dans votre unité de petite longueur (plage 0–500 mm). Alimente le calcul de chute de Trajectoire pour toute configuration utilisant cette carabine.
- **Distance de réglage** — requis, la distance à laquelle vous réglez habituellement cette carabine, dans votre unité de distance (plage 0–5000 m).
- **Pas de rayure (distance par tour)** et **Sens de rayure** (droite ou gauche) — facultatif, laissé vide si inconnu, dans l'unité indépendante de pas de rayure décrite au §3.1 (plage 1–1000 mm/in). Nécessaire uniquement pour la stabilité et la dérive gyroscopique, rien d'autre.
- **Unité du clic**, **Valeur du clic horizontal**, **Valeur du clic vertical** — les propres valeurs de tourelle de la lunette, en mrad ou en MOA selon le choix fait ici (0,01–5, indépendant de votre préférence globale, selon le §3.1).
- **Source / notes** — texte libre, facultatif.

Une carabine tout juste créée s'enregistre avec une liste de cartouches vide ; vous ajoutez ses cartouches ensuite, depuis la propre ligne de la carabine (§5.4).

### 5.4 Ajouter une cartouche

Les cartouches se gèrent depuis la carte de la **carabine active**, jamais depuis un formulaire autonome — une cartouche n'a pas de sens sans la carabine à laquelle elle appartient. **+ Ajouter une cartouche** ouvre un formulaire :

- **Nom** — requis, p. ex. *« 175 SMK, 41,5 gr N550 »*. Un avertissement en direct apparaît si une autre cartouche de la *même* carabine porte déjà ce nom ; les noms peuvent librement se répéter d'une carabine à l'autre.
- **Balle** — **requis**. Une liste déroulante propose chaque balle de votre Arsenal, préfixée d'un `*`, aux côtés des bibliothèques intégrées visibles, chacune entre crochets avec le nom de sa propre bibliothèque. Une nouvelle cartouche démarre sur **« + Ajouter une nouvelle balle… »** plutôt que sur une première entrée arbitraire, afin qu'un enregistrement distrait ne rattache pas le mauvais projectile.

  **Choisir une balle intégrée en copie une dans votre bibliothèque.** Comme une cartouche doit pointer vers un enregistrement de balle qui vous *appartient* (afin que des modifications ultérieures du catalogue intégré ne puissent pas changer rétroactivement une charge que vous avez déjà caractérisée), enregistrer une cartouche contre une balle intégrée en crée silencieusement une copie unique dans **Vos balles**, et fait pointer la cartouche vers cette copie à partir de là. Un avis vous le signale avant l'enregistrement ; si une balle du même nom existe déjà dans votre bibliothèque, un second avertissement vous indique que la copie l'écrasera.

  Si la carabine possède déjà une autre cartouche avec une balle résolue, la sélection est **verrouillée sur le calibre de cette balle** — voir §5.5.
- **Vitesse initiale** — requis, dans votre unité de vitesse (50–1500 m/s).
- **La vitesse initiale varie avec la température** — une paire de cases à cocher facultative : **Température de référence** (la température à laquelle la vitesse initiale ci-dessus a été mesurée) et **Variation de vitesse par degré** (plage 0–20 m/s par °C pour la valeur de sensibilité elle-même). Laisser la case décochée omet les deux ; l'indication au-dessus de la paire — *« Suppose que la cartouche est à la même température que l'air (température saisie ci-dessus). »* — vaut la peine d'être lue si vous tirez la même charge sur une large plage de températures saisonnières.
- **Régularité de la vitesse initiale (SD)** — facultatif ; selon l'indication du champ, utilisé uniquement par l'outil Probabilité de toucher. Si vous disposez de l'écart-type rapporté par votre chronographe pour cette charge, saisissez-le ici (0–20 m/s), et Probabilité de toucher l'offrira comme option toute prête **« Cette carabine »** pour son entrée d'incertitude de vitesse, au lieu de vous obliger à vous en souvenir ou à le ressaisir là-bas.
- **Indiquer la précision de l'arme pour cette cartouche** — facultatif, décrit en détail au §5.6 ; selon l'indication du champ, utilisé également uniquement par l'outil Probabilité de toucher.

### 5.5 Verrouillage du calibre et stabilité

Une carabine ne porte pas de champ de calibre propre (§3). À la place, **la première cartouche que vous attachez à une carabine fixe son calibre**, implicitement, pour chaque cartouche ajoutée ensuite : la sélection de balle de toute cartouche *suivante* sur cette carabine n'offre alors que des balles du diamètre d'âme correspondant. Le verrou ne se relâche que si vous modifiez la dernière cartouche restante de la carabine — à ce moment il ne reste plus rien avec quoi rester cohérent, et vous pouvez à nouveau choisir n'importe quel calibre.

Chaque ligne de cartouche, ainsi que le formulaire de cartouche lui-même, affiche en plus une **pastille de stabilité** calculée en direct — `Stable`, `Marginale`, ou `Instable`, avec le facteur de stabilité gyroscopique Sg calculé à côté — dès que les cinq entrées nécessaires sont connues : masse de la balle, calibre, longueur, vitesse initiale de cette cartouche, et pas de rayure de la carabine. Si l'une des cinq manque, la pastille affiche **« Stabilité inconnue »** à la place, avec une indication repliable *« Quelles données ? »* énumérant précisément laquelle des cinq est absente. Voir §9.3 pour la formule.

### 5.6 Précision d'arme sur une cartouche

C'est le pont direct entre l'Arsenal, la Calculette de précision de tir et Probabilité de toucher.

Cocher **« Indiquer la précision de l'arme pour cette cartouche »** révèle :

- **Précision exprimée comme** — un choix entre **« Précision propre (au banc) de l'arme »** et **« Précision simplifiée (combinée) arme + tireur »**. La première est ce que la carabine groupe elle-même, mécaniquement, depuis un appui. La seconde est ce que vous, cette carabine, et votre position de tir habituelle produisez ensemble — un chiffre plus grossier, plus honnête pour quiconque n'est pas un benchrester. Probabilité de toucher traite les deux de façon complètement différente : la première y est combinée *avec* une estimation séparée de l'habileté du tireur ; la seconde *remplace* cette combinaison purement et simplement, et active en conséquence le propre bouton « Utiliser la saisie simplifiée de précision combinée » de Probabilité de toucher.
- **Valeur de précision**, exprimée selon celle des cinq conventions pour laquelle vous avez réellement un chiffre — **R50**, **R95**, **R99**, **ES sur 5 coups**, ou **ES sur 10 coups** — et en mrad ou en MOA, indépendamment de votre préférence angulaire globale (§3.1). Quel que soit votre choix, la valeur est convertie et stockée en interne comme **R50 en mrad**, si bien que saisir la même taille de groupement physique sous une convention ou une unité différente produit toujours la même précision stockée — il n'existe qu'une seule représentation interne, et le formulaire n'existe que pour vous permettre de saisir le chiffre sous la forme sous laquelle vous l'avez réellement mesuré. Changer le sélecteur d'unité convertit le nombre affiché sur place, de sorte que la taille de groupement physique que vous avez saisie soit préservée plutôt que réinterprétée.
- L'indication qui l'accompagne ne mâche pas ses mots : *« Soyez honnête. Utilisez la moyenne, pas le meilleur résultat. Consultez la « Calculette de précision de tir » pour des valeurs pertinentes et fiables. »*
- **« Choisir depuis un projet de précision de tir… »** — ouvre un sélecteur listant chaque projet de la Calculette de précision de tir ayant assez de coups regroupés pour calculer un chiffre utilisable, chaque ligne montrant son R50 en mrad et en MOA aux côtés de sa propre pastille de confiance (la pastille identique à celle qu'utilise le rapport de la Calculette de précision de tir, §8.6 du manuel de cet outil) — vous choisissez donc un chiffre dont vous pouvez aussi voir la fiabilité, pas un nombre nu. Choisir un projet renseigne automatiquement R50/mrad/« Propre » ; vous devez encore appuyer sur **Enregistrer la cartouche** pour que cela reste acquis. Si aucun projet ne se qualifie encore, le sélecteur le dit sans détour : *« Vous n'avez pas encore de cartouche dans l'Arsenal — ajoutez d'abord une carabine et une cartouche. »* apparaît côté Calculette de précision de tir quand c'est l'inverse qui est vrai (aucune carabine/cartouche éligible pour recevoir une mesure) ; le message équivalent ici est *« Aucun projet de précision de tir n'a encore assez de données pour une valeur de précision utilisable. »*

**Le chemin inverse — de la Calculette de précision de tir vers l'Arsenal — est documenté en intégralité au §10.1.**

### 5.7 Régler une cartouche avec une cartouche différente

Régler le zéro d'une carabine, au fond, consiste à orienter la lunette selon l'angle qui envoie la balle au point de visée à une distance précise — la distance de réglage. Chaque autre correction de visée, à chaque autre distance, se calcule ensuite par rapport à ce même angle de zéro. Cet angle dépend naturellement de la cartouche et de la balle en question : plus une balle atteint vite la distance de réglage, plus cet angle doit être petit. Si vous tirez ensuite une cartouche différente sans rien changer au réglage, les calculs de trajectoire pour celle-ci seront faux — exactement dans la mesure où la balistique des deux cartouches diffère à la distance de réglage. Le cas classique : vous réglez la carabine avec des munitions bon marché ou d'entraînement, puis vous chargez une cartouche de chasse ou de service haut de gamme dont le point d'impact réel, à n'importe quelle distance, est décalé par rapport à celui que lui aurait donné son propre zéro indépendant.

La version extrême du même problème est une carabine qui tire à la fois une charge supersonique et une charge subsonique suppressée, sans jamais être réglée à nouveau entre les deux — une configuration courante pour un travail discret à courte distance. Les trajectoires des deux charges divergent énormément au-delà d'une courte distance (une balle subsonique chute bien plus vite), si bien que déclarer la cartouche subsonique réglée avec la supersonique n'est pas ici une simple question d'ordre — c'est la seule façon pour que le tableau de chute de l'une ou l'autre charge reflète ce que la carabine, physiquement inchangée, fait réellement.

**Réglée avec**, un champ du formulaire de cartouche, permet d'indiquer à l'Arsenal quelle cartouche a réellement établi le zéro physique, afin que tout outil qui calcule la hausse pour celle-ci puisse tenir compte de la différence, au lieu de supposer silencieusement que cette cartouche a établi son propre zéro.

- Le champ n'apparaît qu'une fois que la carabine possède **au moins une autre cartouche** à désigner, et seulement sur une cartouche qui n'est pas **elle-même** déjà donneuse du zéro d'une autre cartouche (voir ci-dessous).
- Choisir une cartouche dans la liste déroulante en fait la **donneuse** ; celle-ci devient sa **receveuse**. La hausse de la receveuse est alors calculée en cherchant « quel angle de tir enverrait la balistique de la *donneuse* à travers la ligne de mire à la distance de réglage de cette carabine », puis en faisant voler la vitesse initiale et la balle *propres à la receveuse* depuis cet angle emprunté — et non en réglant la receveuse indépendamment.
- **Pas de chaînage.** Une cartouche déjà donneuse pour une autre n'offre jamais elle-même le champ « Réglée avec » — elle ne peut pas, à son tour, emprunter le zéro d'une troisième cartouche. La relation reste une paire simple, jamais une chaîne arbitrairement profonde.
- **Le partage est permis.** Plusieurs cartouches peuvent toutes être réglées avec la même donneuse — le cas courant si vous tirez une charge d'entraînement avant plusieurs charges haut de gamme différentes sur la même carabine.
- Seule la **hausse** est empruntée. Le réglage du zéro en dérive (vent/dérive gyroscopique, §9.3, activé séparément dans les Réglages) se calcule toujours depuis la balistique propre de la receveuse.
- **Outils concernés :** Trajectoire, Résolveur de distance et le graphique de Comparaison (§7) calculent tous la hausse de la receveuse à partir de sa donneuse dès qu'une donneuse est définie. **Probabilité de toucher ne le fait pas** — il calcule toujours la hausse depuis la balistique propre de la cartouche, quelle que soit la donneuse qui lui est assignée. Voir §9.5 pour la raison.

La liste des cartouches de l'Arsenal signale les deux moitiés de la relation — voir §6.4. Supprimer une donneuse efface la référence sur toutes les cartouches qui la désignaient, immédiatement, plutôt que de la laisser pointer dans le vide ; ces receveuses reviennent alors simplement à calculer leur propre zéro.

---

## 6. La page Arsenal : listes, filtres, activation

### 6.1 Disposition de la page, de haut en bas

1. Une courte introduction rappelant que tout ici vit sur cet appareil et apparaît marqué d'un `*` partout où une carabine ou une balle peut être choisie.
2. Le résumé **Pour comparaison** et la section Comparaison, affichés seulement une fois 1–2 configurations mises en file d'attente pour cela (§7).
3. **Sauvegarder la bibliothèque dans un fichier…** / **Charger une sauvegarde depuis un fichier…** (§8).
4. **Carabine active** — la carabine actuellement sous votre main.
5. Une **carte de filtres** — filtres de calibre et de fabricant, entièrement masquée quand votre bibliothèque est vide.
6. **Autres carabines**.
7. **Vos balles**.

### 6.2 La carabine active et l'activation

Exactement une combinaison carabine+cartouche est « active » dans toute l'application à un instant donné — la même configuration que lisent Trajectoire, Probabilité de toucher et Calculateur de terrain. Sur la page Arsenal, elle s'affiche dans sa propre carte **Carabine active**, préremplie avec la configuration déjà en cours si elle se trouve être une carabine de l'Arsenal ; si la configuration actuelle de l'application est au contraire saisie à la main, la carte le signale : *« La carabine actuellement sélectionnée est définie manuellement et ne figure pas dans votre arsenal. »*

**Cliquer sur une ligne sous « Autres carabines » l'active** — la déplace vers la carte Carabine active — plutôt que de l'ouvrir directement en modification ; **Modifier** n'est proposé que sur la carabine actuellement active. C'est délibéré : choisir une carabine et modifier une carabine sont des intentions différentes, et la plus fréquente des deux (je veux tirer avec celle-ci) obtient le simple clic.

L'activation sur la page Arsenal est provisoire. **Rien n'est appliqué à la configuration partagée de l'application avant que vous n'appuyiez sur Terminé.** Vous pouvez parcourir librement les carabines, en modifier plusieurs d'affilée, et seule celle affichée dans la carte Carabine active au moment où vous partez prend effet. Si cette carabine n'a actuellement aucune cartouche, Terminé laisse intacte la configuration précédemment en cours, plutôt que de la remettre à rien.

Le sélecteur de cartouche de la carabine active se souvient de la cartouche que vous aviez choisie pour elle en dernier, et la rétablit à votre prochaine visite.

### 6.3 Cartouches sous la carabine active

Chaque cartouche de la carabine active est sa propre ligne : nom, une pastille **Active** sur celle actuellement choisie, sa vitesse initiale, et la pastille de stabilité en direct du §5.5. Cliquer sur une ligne en fait la cartouche active. **+ Ajouter une cartouche** se trouve sous la liste.

Une carabine sans cartouche affiche un avertissement à la place de la liste : *« Aucune cartouche n'est définie pour cette carabine. Cette configuration est inutilisable et ne sera pas activée. »*

### 6.4 Pastilles

- **Sans sauvegarde** — cette balle ou cette carabine a été créée, modifiée ou importée depuis sa dernière écriture dans un fichier de sauvegarde. Jamais affichée sur une entrée intégrée, puisque celles-ci n'ont besoin d'aucune sauvegarde.
- **Inutilisable** — une carabine sans aucune cartouche. Texte d'infobulle au survol : *« Aucune cartouche définie — cette carabine ne peut pas être activée. »* Une telle carabine reste cliquable, afin que vous puissiez l'atteindre pour lui ajouter une première cartouche.
- **Active** — la cartouche actuellement choisie sur la carabine active.
- **Donneur de zéro** — le zéro en hausse propre à cette cartouche est actuellement emprunté par une ou plusieurs autres cartouches de la carabine (§5.7).
- **Receveur de zéro** — cette cartouche est réglée avec une cartouche différente ; le survol indique laquelle.

### 6.5 Filtres

Deux listes déroulantes, **Filtrer par calibre** et **Filtrer par fabricant**, par défaut sur **Tous calibres** / **Tous fabricants**. Elles se restreignent mutuellement : choisir un fabricant réduit la liste de calibres à ceux que ce fabricant propose réellement, et inversement. Les options de calibre sont ordonnées par diamètre d'âme réel plutôt qu'alphabétiquement, si bien que `.223`, `6.5mm` et `.308` se trient comme le ferait un râtelier de munitions, pas comme un dictionnaire. Une carabine ne correspond à un filtre qu'à travers les balles de ses cartouches — les carabines ne portent aucun calibre propre, comme noté au §3.

**Réinitialiser les filtres** efface les deux. La carte entière disparaît quand votre bibliothèque — balles et carabines ensemble — est vide, puisqu'il n'y a alors rien à filtrer.

Il n'existe pas de recherche en texte libre ; le filtrage se fait uniquement par calibre et par fabricant.

---

## 7. Comparer deux configurations

Toute ligne carabine+cartouche porte un bouton **Ajouter à la comparaison**, plafonné à **deux** emplacements — une fois deux mises en file d'attente, le bouton de chaque autre ligne se désactive avec *« Retirez d'abord une configuration de la comparaison »*. Une carte de résumé **Pour comparaison** liste ce qui est actuellement en attente, chacune avec son propre bouton Retirer.

Une fois exactement deux configurations en file d'attente, une section complète **Comparaison** apparaît : un contrôle partagé d'atmosphère et de vent, un champ partagé de distance maximale, et un graphique de trajectoire — les mêmes choix de colonnes, contrôles de zoom et de déplacement, et export SVG que le propre graphique de l'outil Trajectoire — traçant les deux configurations comme deux séries avec une légende partagée.

La comparaison est **résolue à nouveau en direct** contre votre Arsenal à chaque rendu, ancrée sur l'identité de la carabine et de la cartouche plutôt que sur un instantané figé : modifiez l'une des deux carabines pendant qu'elle est en attente, et le graphique se met à jour immédiatement.

Cette sélection est **propre à la session** — ce ne sont pas des données enregistrées, et elle se réinitialise au prochain rechargement de l'application. Son but est une comparaison côte à côte rapide (« la trajectoire plus plate de la balle plus lourde vaut-elle son départ plus lent, aux distances où je tire réellement ») plutôt qu'un enregistrement permanent.

---

## 8. Sauvegarde, restauration et gestion des données

Le stockage de l'Arsenal vit dans votre navigateur. Sauvegardez-le — voir §2 pour ce qui se passe si vous ne le faites pas.

### 8.1 Exporter

- **Sauvegarder dans un fichier**, sur n'importe quelle ligne de balle ou de carabine, n'exporte que cet unique élément. Pour une carabine, le fichier la regroupe avec chaque balle que ses cartouches référencent réellement, si bien que la sauvegarde d'une seule carabine est toujours autosuffisante et réimportable telle quelle.
- **Sauvegarder la bibliothèque dans un fichier…** ouvre la boîte de dialogue **Enregistrer la bibliothèque** : une case à cocher pour chaque balle et chaque carabine que vous possédez, toutes cochées par défaut. Cocher une carabine coche automatiquement les balles dont ses cartouches ont besoin ; décocher une balle décoche automatiquement toute carabine qui en a besoin — la boîte de dialogue ne vous laissera pas exporter une carabine avec une référence de balle orpheline. **Exporter** écrit un unique fichier JSON contenant tout ce qui est coché.

Chaque export réussi efface la pastille **Sans sauvegarde** sur tout ce qu'il incluait.

### 8.2 Importer

**Charger une sauvegarde depuis un fichier…** ouvre un sélecteur de fichier (JSON uniquement). Un fichier qui n'est pas du JSON valide, ou du JSON valide qui n'est pas un export de l'Arsenal, est rejeté avec un message précis plutôt qu'un échec silencieux. Un fichier bien formé ouvre la boîte de dialogue **Charger une bibliothèque** :

- Tout élément dont le nom correspond à un élément existant de votre bibliothèque — comparé sans tenir compte de la casse ni des espaces — porte une **pastille de conflit** indiquant si la copie entrante est plus récente, plus ancienne, du même âge, ou d'âge inconnu par rapport à votre copie existante, d'après l'horodatage de dernière modification de chaque élément.
- **Si un nom existe déjà dans votre bibliothèque** — une sélection offrant trois stratégies, appliquées à chaque élément en conflit de cet import :
  - **Écraser l'existant** — la version importée remplace la vôtre purement et simplement.
  - **Écraser seulement si plus récent** — remplace uniquement si l'horodatage de l'élément entrant est strictement postérieur à celui de votre élément existant ; sinon cet élément est ignoré. Le choix sûr par défaut lors de la fusion de sauvegardes de deux appareils.
  - **Conserver les deux (renommer la copie importée)** — importe comme un nouvel élément nommé *« \<nom\> - copie (1) »*, en incrémentant jusqu'à ce que le nom soit libre, de sorte que rien de déjà présent dans votre bibliothèque ne soit jamais touché.
- **Importer** applique vos choix et rapporte le résultat : *« {{n}} élément(s) importé(s), {{n}} ignoré(s). »*

Les carabines s'importent après les balles, et la référence de balle de chaque cartouche est réaffectée à l'id sous lequel sa balle a réellement fini dans *votre* bibliothèque — de sorte qu'une balle importée renommée pour éviter une collision ne laisse pas les cartouches de la carabine importée pointer dans le vide.

---

## 9. Données balistiques et qui les consomme

Cette section est le pendant plaisir-de-technicien du §5 — à quoi sert mathématiquement chaque champ, une fois qu'il quitte l'Arsenal.

### 9.1 Données de traînée → Trajectoire et Comparaison

Les données de traînée d'une balle — BC-et-modèle ou une table Cd-Mach personnalisée — sont, avec sa masse, exactement l'entrée dont le moteur de trajectoire a besoin pour intégrer une trajectoire de vol freinée par la traînée. Le propre graphique de Comparaison de l'Arsenal (§7) fait tourner le même moteur de trajectoire que Trajectoire lui-même, alimenté par la carabine de chaque configuration en attente (hauteur de lunette, distance de réglage) et sa cartouche (vitesse initiale, et sa sensibilité optionnelle à la température, évaluée par rapport à la température de référence que vous avez indiquée).

### 9.2 Régularité de la vitesse initiale → Probabilité de toucher

La **régularité de la vitesse initiale (SD)** d'une cartouche, si vous la fournissez, ne fait rien à l'intérieur de l'Arsenal lui-même. Elle existe uniquement pour que, lorsque cette combinaison carabine+cartouche est celle qui est active, l'entrée d'incertitude de vitesse propre à Probabilité de toucher puisse offrir une option toute prête **« Cette carabine »**, au lieu de vous demander de vous rappeler ou de remesurer le chiffre de votre propre chronographe — avec une indication explicite que cette cartouche en fournit un.

### 9.3 Stabilité et dérive gyroscopique

La pastille de stabilité en direct (§5.5) calcule le facteur de stabilité gyroscopique Sg via la **règle de rayure de Miller**, re-dérivée directement dans les propres unités métriques du moteur de cette application plutôt que de convertir à travers les entrées impériales traditionnelles de la formule à chaque appel. La formule publiée de Miller elle-même est une estimation en atmosphère standard sans aucun terme d'altitude ou de densité de l'air ; ce moteur y applique le raffinement habituel de mise à l'échelle par densité, si bien qu'une balle calculée comme marginale au niveau de la mer peut se montrer stable en altitude ou par une journée chaude, et inversement. Les trois bandes publiées sont :

| Sg | Évaluation |
|---|---|
| < 1,0 | Instable |
| 1,0 – 1,3 | Marginale |
| ≥ 1,3 | Stable |

Ces mêmes cinq entrées — masse, calibre, longueur, vitesse initiale, pas de rayure — pilotent aussi, dans le moteur de Trajectoire, la **dérive gyroscopique** pour toute configuration construite à partir d'une carabine et d'une balle de l'Arsenal. La suite propose deux méthodes de calcul de la dérive gyroscopique, choisies dans les Réglages : la formule simple et empirique de Litz, et un modèle physique plus complet, McCoy 4-DOF. Malgré la différence de sophistication, les deux méthodes ont actuellement besoin exactement des mêmes cinq entrées — ce qui explique pourquoi il vaut la peine de renseigner la longueur de balle et le pas de rayure dès que vous les connaissez, même s'ils sont marqués facultatifs partout dans ce manuel : en laisser un des deux vide vous coûte, silencieusement, la dérive gyroscopique et une estimation de stabilité, partout où cette carabine est utilisée, quelle que soit la méthode choisie.

### 9.4 Précision d'arme → Probabilité de toucher

Traité en détail au §5.6 et, dans l'autre sens, au §10.1. En bref : la `precision` stockée d'une cartouche — mode (`own` ou `combined`) plus un R50 en mrad — est lue par Probabilité de toucher au moment précis où cette combinaison carabine+cartouche y devient la configuration active. Une valeur **« own »** préremplit l'entrée de précision au banc de Probabilité de toucher et laisse l'habileté du tireur comme entrée séparée, indépendante, à combiner avec elle. Une valeur **« combined »** préremplit à la place l'entrée simplifiée, déjà combinée, et active le mode simplifié de cet outil, puisqu'un chiffre combiné a déjà l'habileté du tireur incorporée et ne devrait pas y être combiné une seconde fois.

### 9.5 Donneur de zéro → Trajectoire, Résolveur de distance, Comparaison

Le donneur d'une cartouche (§5.7), lorsqu'il est défini, modifie exactement une étape du calcul de trajectoire : au lieu de chercher l'angle de tir qui envoie la balistique *propre* à cette cartouche à travers la ligne de mire à la distance de réglage de la carabine, le moteur cherche l'angle qui ferait de même pour la vitesse initiale, la sensibilité à la température et le profil de balle **du donneur** — tout le reste (distance de réglage, hauteur de visée, angle de ligne de mire, atmosphère, vent) restant fixé aux valeurs propres de la receveuse — puis fait voler la balistique **propre à la receveuse** depuis cet angle emprunté. Le résultat est exactement ce qui se produit réellement en aval quand une carabine réglée avec une charge est tirée avec une autre.

Cette substitution intervient exactement au point où tout autre calcul d'angle de zéro de ce moteur intervient déjà, si bien qu'elle se compose gratuitement avec tout ce que le moteur de trajectoire fait déjà pour une cartouche normale — atmosphère, vent, dérive gyroscopique, l'intégrateur 4-DOF — rien de tout cela n'a besoin de savoir qu'un donneur est impliqué.

Le réglage du zéro en dérive (§9.3) n'est pas affecté par un donneur : il se calcule toujours depuis la balistique propre de la receveuse, puisqu'il s'agit d'une fonctionnalité distincte et séparément activée.

**Probabilité de toucher est délibérément exclu.** Son propre modèle de dispersion calcule la hausse indépendamment, à la *distance de la cible elle-même* (ou à un zéro de combat défini séparément) plutôt qu'à la distance de réglage configurée de la carabine, et ne lit jamais le donneur d'une cartouche — un choix de conception, pas un oubli : Probabilité de toucher estime comment un tir groupe réellement autour d'un point de visée que vous réglez pour ce tir, une question différente de celle de savoir où un zéro physique fixe, déjà établi, place une charge de substitution.

---

## 10. Mise en pratique

### 10.1 Réinjecter une précision d'arme mesurée dans l'Arsenal

La Calculette de précision de tir mesure la dispersion réelle, bornée par un intervalle de confiance, de votre carabine à partir de véritables groupements tirés (voir le propre manuel de cet outil). Une fois qu'un projet là-bas a assez de coups regroupés pour calculer un chiffre utilisable, sa ligne fait apparaître un bouton **« Définir comme précision de cartouche… »**.

L'actionner ouvre un sélecteur listant chaque carabine de l'Arsenal ayant au moins une cartouche, chacune avec une liste déroulante de cartouches. Choisissez la carabine et la charge avec lesquelles vous avez réellement tiré ce projet, et vous atterrissez directement dans l'Arsenal, avec exactement cette carabine et cette cartouche déjà rendues actives et leur formulaire **Modifier la cartouche** déjà ouvert — prérempli avec **« Précision propre (au banc) de l'arme »** cochée et le R50 agrégé du projet, converti en mrad, posé dans le champ de valeur. Rien n'est écrit avant que vous n'appuyiez sur **Enregistrer la cartouche** — c'est une transmission vers un formulaire que vous vérifiez, pas une écriture silencieuse en arrière-plan.

C'est le flux de travail le plus important que cet outil prenne en charge, parce que c'est celui qui rend le reste de la suite honnête : un chiffre de Probabilité de toucher calculé à partir d'une valeur de précision au banc que vous avez réellement mesurée, avec son propre intervalle de confiance connu, vaut catégoriquement plus qu'un autre calculé à partir d'un nombre retenu d'un groupement de cinq coups. Faites-le à chaque fois que vous terminez un projet de développement de charge dans la précision de tir, pas seulement une fois quand vous configurez d'abord une carabine — votre estimation de précision ne fait que s'améliorer à mesure que ce projet accumule des coups, et l'enregistrement de la cartouche ne se met pas à jour de lui-même.

### 10.2 Configurer une nouvelle carabine à partir de zéro

1. **Ajoutez d'abord la ou les balles.** Si vous tirez plus d'une charge à travers une carabine, enregistrez chaque balle avant de commencer sur les cartouches — l'option intégrée « + Ajouter une nouvelle balle… » du formulaire de cartouche est pratique pour une charge unique, mais précharger votre bibliothèque de balles rend une carabine à charges multiples plus rapide à configurer et garde votre liste de balles comme un véritable catalogue plutôt qu'un sous-produit de la cartouche que vous avez ajoutée en premier par hasard.
2. **Mesurez précisément la hauteur de lunette et la distance de réglage.** Ces deux valeurs alimentent directement le calcul de chute de Trajectoire et sont les deux chiffres les plus susceptibles de déjà figurer dans le carnet de données de votre carabine si vous en tenez un — recopiez-les plutôt que de les estimer.
3. **Renseignez le pas de rayure même si vous pensez qu'il n'aura pas d'importance.** C'est une information gratuite déjà imprimée sur votre canon ou dans sa fiche technique, et c'est le seul champ qui sépare « Stabilité inconnue » d'une pastille utile en direct sur chaque cartouche que porte cette carabine — sans coût supplémentaire par cartouche, puisqu'il ne vit qu'une fois, sur la carabine.
4. **Ajoutez une cartouche par charge, pas par séance de tir.** Un enregistrement de cartouche décrit une charge, pas une sortie ; la nommer quelque chose comme *« 175 ELD-M, 2650 fps, N550 »* la garde identifiable des mois plus tard, quand vous avez plusieurs entrées similaires réparties sur plusieurs carabines.
5. **Laissez la précision d'arme vide tant que vous ne l'avez pas réellement mesurée.** Un chiffre qui sonne bien, saisi de mémoire, est pire qu'aucun chiffre, parce que Probabilité de toucher ne peut pas faire la différence — il traitera une estimation avec exactement le même poids qu'une mesure de cent coups bornée par un intervalle de confiance. Utilisez plutôt la transmission du §10.1 une fois que vous avez de vraies données.

### 10.3 Comparer deux charges avant de vous engager sur l'une d'elles

Supposons que vous hésitiez entre deux balles pour la même carabine, ou entre la même balle à deux profondeurs d'assise différentes avec des vitesses correspondantes différentes. Enregistrez les deux comme des cartouches séparées sur la carabine (ou sur deux entrées de carabine, si le changement de profondeur d'assise représente pour vous deux configurations nommées différemment), mettez les deux en file d'attente pour la comparaison (§7), et réglez la distance maximale partagée sur ce qui vous intéresse réellement. Le graphique répond à la question pratique — laquelle est la plus plate, laquelle conserve le plus de vitesse, où les deux trajectoires se croisent-elles — sans que vous ayez besoin de lancer Trajectoire deux fois et de garder deux jeux de chiffres en tête à la fois.

### 10.4 Garder une collection de plusieurs carabines gérable

Une fois que vous possédez plus de deux ou trois carabines de la même famille de calibre générale, la carte de filtres (§6.5) est ce qui garde la page navigable — filtrez par calibre pour ne voir que les carabines chambrées pour ce sur quoi vous travaillez en ce moment, ou par fabricant si vous comparez plusieurs carabines à partir des balles du même fabricant. La pastille **Sans sauvegarde** (§6.4) sert aussi de liste de tâches courante : à la fin d'une session où vous avez ajouté ou modifié plusieurs entrées, parcourez la page du regard à la recherche de cette pastille plutôt que d'essayer de vous souvenir de ce que vous avez touché, et lancez **Sauvegarder la bibliothèque dans un fichier…** pour les effacer toutes d'un coup.

### 10.5 Régler le zéro avec une cartouche de substitution

Supposons que vous régliez le zéro d'une carabine avec des munitions bon marché, surplus ou à étui acier — moins coûteuses à consommer pendant une séance de réglage et pour vérifier le zéro périodiquement — mais que vous emportiez ou chassiez réellement avec une charge premium, du commerce ou rechargée. Enregistrez les deux comme cartouches séparées sur la même carabine, ouvrez le formulaire **Modifier la cartouche** de la charge premium, et réglez **Réglée avec** sur la charge d'entraînement. Dès lors, Trajectoire, Résolveur de distance et le graphique de Comparaison affichent tous la trajectoire de la charge premium telle qu'elle s'imprimera réellement, plutôt que l'hypothèse (fausse, si votre réglage a réellement été fait avec la charge bon marché) qu'elle a été réglée avec elle-même.

Si vous réglez ensuite à nouveau le zéro de la carabine directement avec la charge premium, retournez effacer **Réglée avec** sur cette cartouche — elle redevient son propre zéro, et rien d'autre dans l'Arsenal ne le fait automatiquement pour vous.

---

## 11. Origine

L'Arsenal fait partie de la suite depuis son tout premier commit, et a grandi progressivement : plusieurs bibliothèques de balles intégrées et l'autocomplétion de fabricant ; des corrections de préférence d'unité à travers la liste de cartouches et la longueur de balle ; le moteur de trajectoire à 4 degrés de liberté actuel et les champs de dérive gyroscopique/sens de rayure qu'il utilise ; et, plus récemment, la régularité de vitesse initiale et la précision d'arme sur les cartouches, avec la transmission directe depuis la Calculette de précision de tir décrite au §10.1 — l'intégration qui transforme deux outils autrefois séparés en un seul pipeline mesuré ; et, plus récemment encore, la possibilité pour une cartouche d'emprunter le zéro physique d'une autre (§5.7), pour le cas courant où l'on règle le zéro avec une charge et où l'on emporte une autre.

La suite est sous licence **AGPL-3.0-or-later**.

---

*Pacifique. Précis. Armé.*
