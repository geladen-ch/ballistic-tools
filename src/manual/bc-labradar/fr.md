# geladen.ch ballistics Manuel de l'utilisateur — BC Labradar

*Fait partie de la* [suite balistique geladen.ch](https://bc.geladen.ch)*. L'un des quatre onglets de la page Outils BC. Successeur de l'outil autonome Labrabaco.*

---

## 1. À quoi sert cet outil

Le coefficient balistique est le seul nombre de tout le calcul de trajectoire que l'on attend de vous que vous preniez pour argent comptant. La vitesse initiale, vous pouvez la mesurer. La hauteur de lunette, vous pouvez la prendre au pied à coulisse. La distance de réglage, c'est vous qui la fixez. Le BC, lui, vient du flanc d'une boîte ou du site d'un fabricant, et il décrit une balle tirée dans le canon de quelqu'un d'autre, dans l'air de quelqu'un d'autre, mesurée selon une méthode que personne ne vous montrera.

C'est aussi le nombre auquel la trajectoire est la plus sensible à distance, et celui qui a le plus de chances d'être flatteur. Les BC publiés sont aussi souvent des chiffres marketing que des mesures.

**BC Labradar mesure le vôtre.** Il lit les fichiers de piste qu'un chronographe Labradar écrit sur sa propre carte SD — un enregistrement complet vitesse/temps de chaque coup, échantillonné environ toutes les millisecondes sur la centaine de mètres initiale du vol — et ajuste un coefficient balistique coup par coup, contre la même physique de traînée que le reste de la suite utilise pour calculer les trajectoires. Il nettoie ensuite les pistes que le radar a ratées, écarte les coups qui ne s'accordent pas avec les autres, et fait la moyenne de ce qui survit.

Ce qui en sort est un BC pour **votre** balle, sortie de **votre** canon, dans **votre** air. Reportez-le dans l'Arsenal et tous les autres outils de la suite travaillent alors sur une mesure au lieu d'une affirmation.

Rien de ce nettoyage ni de cet ajustement n'a été conçu sur le papier puis lâché en espérant. L'ensemble a été calibré sur un corpus de **1 297 pistes Labradar réelles**, à partir duquel le bruit propre du radar — sa croissance le long de la piste, et l'ampleur de ses écarts d'une séance à l'autre — a été mesuré et non supposé. Le §12 expose ce que cette mesure a révélé, et ce qui a été bâti dessus.

Ce que cette méthode a de remarquable, c'est qu'elle ne demande aucun équipement en aval. Pas de second chronographe à 300 m, pas de cible acoustique, pas de radar Doppler de la taille d'une voiture. L'appareil enregistre déjà les données — il ne vous dit simplement pas ce qu'elles valent.

### Ce qu'il n'est pas

**Ce n'est pas un afficheur de chronographe.** Votre vitesse initiale, votre écart extrême, votre écart-type en fps ne l'intéressent pas. Le fichier de rapport de l'appareil vous les donne, et cet outil l'ignore. Ce qu'il veut, c'est la *forme* de la décroissance de vitesse — précisément ce que le rapport de synthèse jette.

**Il ne fonctionne qu'avec le Labradar v1** — la grande boîte orange, celle qui écrit des fichiers `Shot0001 Track.csv`. Les appareils ultérieurs, et toutes les autres marques de chronographe, soit n'enregistrent aucune piste, soit ne l'écrivent pas dans ce format. Il n'existe pas de voie d'import pour eux.

**Ce n'est pas un solveur de courbe Cd.** Il ajuste un seul nombre contre un modèle de traînée standard. Si la forme de traînée réelle de votre balle n'est pas celle de ce modèle, l'ajustement vous donne le meilleur BC unique pour ce modèle sur la bande de vitesse mesurée, et non la vérité sur la balle. C'est l'outil **Courbe Cd–Mach** qui remonte à la courbe de traînée propre d'une balle, et il réclame un type de mesure entièrement différent.

**Il vous dit à quel point il est sûr des coups, et de rien d'autre.** À côté de la moyenne il donne un intervalle de confiance à 95 % sur cette moyenne, en pourcentage de celle-ci, calculé à partir de la dispersion des BC coup par coup qu'il a retenus. Cet intervalle est honnête quant aux chiffres qu'on lui a donnés et à l'échantillonnage, et muet sur tout le reste — une atmosphère mal saisie décale la moyenne et l'intervalle ensemble, et aucune statistique calculée sur les pistes ne peut le voir. §10.3.

---

## 2. Confidentialité, stockage et prérequis

**Rien de ce que vous confiez à cet outil ne quitte votre appareil.** Le fichier zip que vous choisissez n'est jamais téléversé. Il est décompressé dans votre navigateur, analysé dans votre navigateur et ajusté dans votre navigateur, par du JavaScript qui tourne sur votre propre machine. Pas de compte, pas de serveur, pas de télémétrie.

**Rien n'est stocké non plus.** Contrairement à l'Arsenal ou à la Calculette de précision de tir, cet outil ne tient aucune bibliothèque. Votre lot chargé, vos choix de filtres, votre modèle de traînée et votre atmosphère survivent à un aller-retour vers un autre outil — ils vivent en mémoire le temps de la session — mais ne survivent pas à un rechargement de page. Rechargez, et vous rechoisissez le zip. C'est délibéré : un lot de pistes est un intermédiaire, pas un document. Ce qui mérite d'être conservé, c'est le BC obtenu, et sa place est dans l'Arsenal (§11.1).

**Prérequis.** N'importe quel navigateur raisonnablement récent. L'ajustement est réellement gourmand — une intégration de traînée complète est lancée quelques centaines de fois par piste — il est donc réparti sur un pool de workers d'arrière-plan, une tâche par piste, et les lignes se remplissent au fur et à mesure. Un lot de trente pistes se résout en quelques secondes sur un ordinateur de bureau et prend nettement plus longtemps sur un téléphone. L'application s'installe en PWA et cet outil fonctionne entièrement hors ligne une fois chargé — ce qui compte, car l'endroit où vous voudrez le plus le faire tourner est un stand sans réseau.

---

## 3. Ce qu'est réellement un export Labradar

Comprendre l'agencement des fichiers évite bien des perplexités sur les lignes de la liste qui annoncent *pas une trajectoire*.

> **Une note de vocabulaire.** Ce manuel appelle **piste** l'enregistrement radar d'un coup, et réserve **trajectoire** au vol réel de la balle. L'interface, elle, dit « trajectoire » pour les deux : le fichier `Shot0001 Track.csv` y est une « trajectoire », la liste s'intitule « Trajectoires » et le statut de rejet se lit *pas une trajectoire*. La distinction compte à partir du §5.2, où l'axe du faisceau radar et le vol de la balle sont précisément deux droites différentes, et il devient alors impossible de les nommer pareil sans embrouiller le propos. Les étiquettes citées de l'interface gardent partout son mot à elle.

Quand vous copiez une séance depuis la carte SD de l'appareil, vous obtenez un dossier de cette forme :

```
SR0013/
  SR0013.lbr            le fichier projet de l'appareil
  SR0013 Report.csv     le récapitulatif de séance — vitesses, ES, SD
  TRK/
    Shot0001 Track.csv  un fichier par coup : la piste radar proprement dite
    Shot0002 Track.csv
    ...
```

Zippez ce dossier — le tout, sous-dossiers compris — et c'est ce zip que l'outil réclame.

**Le fichier de piste** est celui qui nous intéresse. Après un court en-tête d'appareil, il porte une ligne par écho radar :

```
Time (s);Vel (m/s);Dist (m);SNR
0.000000;767.75;0.00;-
0.007021;765.35;5.37;33.07
0.008021;765.05;6.14;40.15
0.009021;764.57;6.90;39.80
...
```

Quatre colonnes : temps écoulé en secondes, vitesse, distance à l'appareil, et rapport signal/bruit (SNR) en décibels. Environ une ligne par milliseconde, de la bouche jusqu'à l'endroit où le radar a perdu la balle — une centaine de lignes pour un coup de carabine typique.

Trois choses valent d'être sues sur ce tableau, car l'outil les traite toutes différemment :

- **La première ligne n'est pas une mesure.** Son temps vaut exactement zéro, sa distance exactement zéro, et son champ SNR est littéralement un tiret. L'appareil la calcule à rebours — c'est sa propre vitesse initiale extrapolée, pas un écho radar. Cet outil l'exclut de tout ajustement et de toute mesure de qualité. Elle est tracée sur le graphique, et par ailleurs ignorée.
- **Le SNR est un indicateur de qualité par point**, et il varie énormément le long de la piste. Dans l'extrait ci-dessus il part d'environ 40 dB et tombe à 8 sur les dernières lignes. Cet outil pondère chaque point par son SNR (§12.4), de sorte que les échos initiaux, sûrs, dominent l'ajustement et que les derniers, douteux, ne le déplacent guère.
- **La colonne des vitesses n'est pas monotone.** Regardez les dernières lignes d'une vraie piste et vous trouverez souvent la vitesse qui *remonte*. Ce n'est pas la balle qui accélère ; c'est le radar qui lit une réflexion sur autre chose. Nettoyer cela est l'essentiel de ce que fait cet outil avant d'ajuster quoi que ce soit (§12.3).

**Les unités sont lues dans l'en-tête du fichier lui-même.** Si votre appareil est réglé en fps et en yards, l'en-tête le dit et l'outil convertit à l'entrée. Vous n'avez pas à le lui signaler, ni à faire coïncider son réglage avec votre préférence d'affichage.

### 3.1 Note sur les unités

C'est le seul outil de la suite où les unités interviennent à peine, car un coefficient balistique n'en a aucune que vous reconnaîtriez. Il se cite traditionnellement en livres par pouce carré de charge en section, ce qui s'écrit depuis toujours comme un nombre nu, et cet outil l'écrit comme un nombre nu à quatre décimales.

Les unités apparaissent tout de même à trois endroits :

- **Les champs d'atmosphère** — température, pression station, humidité — suivent votre préférence des Réglages comme tout autre bloc atmosphère de la suite, l'unité s'affichant en suffixe vivant sur l'étiquette du champ.
- **Les fichiers de piste** portent leurs propres unités dans leurs propres en-têtes, converties à l'import comme décrit plus haut. Votre préférence n'a aucun effet sur eux.
- **Les axes du graphique de piste** font exception, et c'est une exception honnête : l'axe horizontal est en millisecondes et l'axe vertical en mètres par seconde, toujours, quelle que soit l'unité de vitesse configurée ailleurs. C'est un tracé de diagnostic sur des valeurs internes au moteur, pas un rapport.

---

## 4. Prise en main rapide

Pour les impatients. Les détails suivent au §5–§10.

1. Tirez une séance au Labradar, en soignant la visée, le décalage projectile et le reste des §5.1–§5.5. Vingt coups ou plus, tous avec la même balle.
2. Notez la température, la pression **station** et l'humidité **au pas de tir** (§5.6). Pas la météo annoncée.
3. Copiez le dossier de séance depuis la carte SD et zippez-le, sous-dossiers compris.
4. **Outils BC** depuis le menu des outils → onglet **BC Labradar**.
5. Réglez le **modèle de traînée** — G7 pour un boat-tail moderne, G1 pour un culot plat ou une ogive ronde (§6.1).
6. Renseignez l'**atmosphère** d'après vos notes.
7. **Choisir un .zip Labradar…** et sélectionnez le fichier. La liste des pistes apparaît aussitôt.
8. **Calculer**. Les lignes se remplissent à mesure que l'ajustement de chaque coup se termine.
9. Lisez le BC moyenné sur la carte **Résultat**, avec son intervalle de confiance à 95 % à côté et l'écart-type au-dessus.
10. Cliquez n'importe quelle ligne pour voir la piste de ce coup, ses points conservés et écartés, et la courbe qui y a été ajustée.

Ne faites pas confiance à un résultat issu de moins de dix coups, et lisez le §10.3 avant d'en croire un issu de moins de vingt.

---

## 5. Obtenir des données qui méritent l'analyse

L'outil ne sait que nettoyer du bruit. Il ne peut pas inventer une mesure qui n'a jamais eu lieu, et il ne peut pas détecter une erreur systématique dans les conditions que vous avez saisies. Tout ce qui figure dans cette section se joue avant l'ouverture de l'application, et chacune de ces fautes est invisible ensuite.

**Commencez par le manuel de l'appareil**, ou au minimum par son guide de mise en route. Il y a des images. Chaque recommandation qu'il contient a sa raison d'être, et les raisons ci-dessous en sont pour l'essentiel le développement. Ce qui suit est la partie qui pèse de façon disproportionnée quand l'objectif est un coefficient balistique plutôt qu'une vitesse initiale — car une installation qui produit d'excellentes lectures de V0 peut tout de même produire des pistes inexploitables au-delà de trente mètres, et l'appareil ne vous dira pas laquelle des deux séances vous venez de faire.

### 5.1 Viser avec le radar

**Pointez-le sur la cible que vous visez réellement**, pas sur la carabine, ni vaguement dans l'axe du stand. L'appareil suit la balle le long de son propre axe de faisceau, et plus la trajectoire longe cet axe, plus chaque écho est fort et propre.

Il ne s'agit pas d'un ou deux mètres de piste en plus. L'alignement du faisceau détermine jusqu'où l'appareil tient la balle tout court, et la longueur de piste est le plus grand levier dont vous disposiez sur la qualité d'un ajustement de BC : une piste plus longue, c'est plus de décroissance de vitesse à mesurer, plus de points sur lesquels ajuster, et proportionnellement moins d'influence du bruit de fin de course.

### 5.2 Le décalage projectile

L'appareil possède un réglage nommé *proj. offset*, qui lui indique à quelle distance du radar passe la balle. Le fausser rend fausse chaque vitesse de chaque piste, de façon cohérente et parfaitement plausible à l'œil.

**Pourquoi il existe.** Le radar ne peut mesurer que la vitesse *radiale* — le rythme auquel la balle s'éloigne de l'appareil — qui n'est pas la vitesse réelle dans l'axe du tir, car l'axe du faisceau et la trajectoire ne sont pas la même droite. Passer de l'une à l'autre relève de la trigonométrie élémentaire, et c'est ce que fait l'appareil avant d'afficher quoi que ce soit. Mais cette trigonométrie a besoin de savoir de combien les deux droites sont écartées, et c'est ce nombre que vous réglez.

**Respectez-le.** Si le réglage indique 30 cm, placez le canon à 25–30 cm du radar. Mettez-le à un mètre et l'appareil enregistrera encore quelque chose, mais chaque lecture portera une erreur importante.

**C'est la distance à l'axe du canon, mesurée sur le côté du radar.** Pas la distance de la bouche à l'appareil, qui est une oblique plus longue. Si votre bouche se trouve un peu en avant ou un peu en arrière du boîtier, ce n'est pas un problème en soi — pourvu que l'écart latéral au canon soit juste, l'erreur sur la vitesse initiale affichée est négligeable et l'erreur sur le BC calculé ici est nulle.

**Et cela compte davantage ici que sur l'afficheur de l'appareil.** Une erreur de décalage perturbe modérément la V0. Elle perturbe bien plus un BC tiré de la *forme* de la piste. Si vous tolérez d'habitude un décalage approximatif parce que vos chiffres de chronographe restent crédibles, cette tolérance ne se transporte pas jusqu'à cet outil. Le §12.1 explique pourquoi.

### 5.3 Garder le radar absolument immobile

Si l'appareil bouge pendant une mesure, les résultats ne sont pas dégradés — ils sont aléatoires.

- **Prenez un trépied vraiment solide, bien planté.** N'hésitez pas à lester la plateforme. C'est un de ces rares cas où la solution la plus lourde et la plus laide est tout simplement la bonne.
- **Si vous tirez quoi que ce soit doté d'un frein de bouche sérieux, protégez l'appareil du souffle.** Une planche, une caisse de munitions, n'importe quoi de consistant entre la bouche et le radar. Le boîtier est en plastique résistant aux chocs et y survivra ; il ne s'agit pas de protéger le plastique mais d'empêcher que l'onde de pression secoue la boîte. Un appareil qui tressaille à chaque coup produit une séance où les pistes se dégradent sourdement au fil de la série — exactement le mode de défaillance le plus difficile à repérer après coup.

### 5.4 Le stand lui-même

Le radar Doppler se réjouit de tout ce qui réfléchit, et chaque réflexion parasite est une candidate aux queues de vitesse montante décrites au §3.

- **Préférez un terrain dégagé.** Aucune bosse haute dans la portée du radar, et la trajectoire dégagée d'obstacles sur environ cinq mètres à gauche, à droite et au-dessus.
- **Surveillez aussi ce qui entoure le pas de tir** : un merlon, un support de cible, une table, un véhicule, le tireur du couloir voisin. Un couloir encombré produit des pistes sur lesquelles le nettoyage doit peiner bien davantage, et davantage de pistes rejetées d'emblée.
- **N'utilisez pas de cibles en acier à moins de 200 m environ.** Bois, carton ou papier uniquement. Une petite balle métallique sur fond de grande plaque métallique est un problème de détection réellement difficile, et l'appareil perdra la balle tôt ou suivra la plaque à sa place.

### 5.5 Un réglage de l'appareil qui concerne spécifiquement le BC

**Réglez la distance d'affichage maximale sur 200 m, ou 200 yd.**

La piste n'ira très probablement pas jusque-là — en pratique, seuls de très gros calibres à trajectoire tendue s'en approchent. Ce que fait ce réglage, c'est dire à l'appareil de continuer d'essayer tant que le signal tient, plutôt que de s'arrêter à une limite configurée plus courte. Piste plus longue, plus de décroissance, meilleur ajustement. Il n'y a pas d'inconvénient, puisque l'appareil coupe de toute façon le faisceau radar dès qu'il perd la balle.

### 5.6 L'atmosphère : la donnée qui vous mordra vraiment

Des ordures en entrée, des ordures en sortie, et une atmosphère de mauvaise qualité en entrée peut provoquer de sérieuses erreurs en sortie.

La force de traînée sur la balle est proportionnelle à la densité de l'air, et le BC que l'outil recherche est celui qui fait coïncider la traînée modélisée avec la décélération observée. Trompez-vous de 3 % sur la densité et votre BC est faux d'environ 3 %, en silence, sans que rien nulle part n'indique que quelque chose cloche.

- **Mesurez au pas de tir.** Un Kestrel ou équivalent suffit. « Ce que l'appli météo disait pour la ville la plus proche » ne suffit pas — cette station peut être à quarante kilomètres et trois cents mètres plus bas.
- **Utilisez la pression station — la pression absolue, à votre altitude réelle.** C'est de loin l'erreur la plus fréquente, et il vaut la peine d'être pointilleux, car Kestrel emploie malencontreusement le terme *pression barométrique* pour la valeur ramenée au niveau de la mer, qui est précisément celle dont vous ne voulez **pas**. Cet outil prend ce que vous saisissez au pied de la lettre à votre propre altitude et en déduit une altitude à rebours (§12.10).

  Le test de bon sens : si vous lisez 1000 hPa ou plus à 500 m d'altitude ou au-dessus (29,5 inHg à 1500 ft, pour nos amis handicapés du métrique), vous lisez presque à coup sûr une valeur ramenée au niveau de la mer — ou bien il se passe dans l'atmosphère quelque chose qui vous préoccupera bientôt davantage que votre coefficient balistique.
- **Si vous ignorez vraiment l'humidité, mettez 50 %.** C'est de loin la moins influente des trois, et 50 % n'est jamais bien loin du compte.

### 5.7 Combien de coups

Un coup, c'est un coup. Il ne dit à peu près rien, et l'outil en calculera volontiers un BC à quatre décimales.

- **Munition d'usine correcte : vingt cartouches**, c'est le minimum de travail. De quoi faire retomber la dispersion coup par coup à quelque chose de défendable.
- **Surplus bon marché, lots mélangés, douilles fatiguées : trente ou plus.** La dispersion est plus grande et demande plus de coups pour se moyenner.
- **Projectiles match réellement bons : dix peuvent suffire.** Ils sont assez réguliers pour que les pistes s'accordent étroitement entre elles, et l'écart-type sur la carte Résultat vous le dira.

Plus, c'est toujours mieux, et le coût marginal est d'une cartouche.

Tirez-les toutes dans les mêmes conditions, avec la même carabine, avec la même balle. Cet outil fait la moyenne sur le lot. Moyenner deux balles différentes ne donne le BC ni de l'une ni de l'autre. Notez que les vitesses initiales n'ont pas à être identiques, ni même voisines ; mesurer un BC sur une série de mise au point de charge est parfaitement acceptable.

### 5.8 Sortir le zip de l'appareil

Copiez le dossier de séance entier depuis la carte SD et compressez-le. Inutile d'aller déterrer le dossier `TRK`, inutile de renommer quoi que ce soit, et il n'y a aucun mal à y laisser le rapport et le fichier projet — ils sont ignorés automatiquement (§7.2). Les sous-dossiers ne posent pas de problème.

L'outil prend exactement un zip à la fois. Pour réunir plusieurs séances en un seul BC, mettez-les soit dans un même zip, soit traitez-les séparément et moyennez à la main.

---

## 6. La carte « Configuration »

Tout ce qui figure sur la carte de gauche, de haut en bas.

### 6.1 Modèle de traînée

Le modèle de traînée standard contre lequel le BC est exprimé. Par défaut **G7** ; le sélecteur liste tous les modèles pris en charge par la suite, filtrés par ce que vous avez choisi d'afficher dans les Réglages.

Le choix pèse davantage ici qu'ailleurs, car l'ajustement se fait contre la forme réelle de la courbe du modèle sur la bande de vitesse réelle de votre balle, et non par une conversion :

- **G7** pour les balles boat-tail modernes — ogive longue, culot rétreint. En pratique, toute balle match ou de chasse conçue ces trente dernières années.
- **G1** pour les culots plats, les ogives rondes et la plupart des dessins anciens ou émoussés. C'est aussi ce que citent la plupart des fabricants, ce qui est une raison distincte de l'employer.

Le modèle choisi est figé dans chaque ajustement de piste ; le changer après coup impose un nouveau **Calculer** (§6.7). Il n'a aucun effet sur l'étape de nettoyage.

Rien n'interdit de passer le même lot deux fois, une fois par modèle, et de garder les deux nombres. Pour les calculs de trajectoire, utilisez le modèle qui correspond le mieux à la forme de votre balle.

### 6.2 Atmosphère

Température, pression station, humidité relative. Le §5.6 explique pourquoi cela compte et comment obtenir ces valeurs.

Contrairement aux blocs atmosphère ailleurs dans la suite, **celui-ci n'a aucun préréglage** ni champ d'altitude distinct. Pas d'« atmosphère standard », pas de condition de référence suisse ni soviétique. Cet outil sert à dépouiller une mesure réelle faite dans de l'air réel, et un préréglage ne serait jamais qu'une façon de faire mine de savoir ce qu'on ne sait pas.

Les valeurs par défaut — 15 °C, 1013,25 hPa, 0 % d'humidité — sont un point de départ neutre, pas une estimation de votre météo. Ce sont les conditions standard OACI au niveau de la mer, et à moins d'avoir tiré au niveau de la mer un jour standard, elles sont fausses. Remplacez les trois.

L'altitude n'est pas demandée et n'a pas à l'être : elle est déduite de la pression station que vous avez saisie (§12.10).

Comme le modèle de traînée, l'atmosphère est figée au moment de l'ajustement. La changer ensuite impose un nouveau **Calculer**.

### 6.3 Seuil de qualité du signal

Le premier des deux filtres portant sur la piste entière. Il décide quelles pistes sont assez fiables pour être moyennées, d'après la netteté avec laquelle les points nettoyés du coup s'alignent sur une droite.

Trois réglages :

- **Normal (R² > 0,95)** — le réglage par défaut, et le bon pour la plupart des séances.
- **Bruit élevé (R² > 0,90)** — pour un couloir réellement encombré, où trop de coups parfaitement bons se font rejeter. À employer quand vous constatez, en parcourant les lignes, que les pistes rejetées ont bonne mine.
- **Aucun** — pas de contrôle de qualité du tout. Tout ce qui a produit un BC entre dans la moyenne.

Le R² affiché dans la liste des pistes est le nombre auquel ce seuil est comparé. Le §12.8 explique ce qu'il mesure réellement, et pourquoi une droite est la bonne référence pour un contrôle de *qualité* alors qu'elle est la mauvaise référence pour un *ajustement*.

Changer ce réglage redécide quelles pistes sont retenues et met à jour la moyenne **immédiatement**. Aucun recalcul n'est nécessaire, car aucun BC ne change — seul change le verdict porté sur chacun.

### 6.4 Rejeter les valeurs aberrantes

Le second filtre portant sur la piste entière, et un test d'une tout autre nature : celui-ci ne se soucie pas du tout de la qualité du signal, seulement de savoir si le BC d'une piste s'accorde avec ceux des autres.

Trois réglages :

- **Conservateur (2,0σ)** — le réglage par défaut. Une piste est écartée quand son BC s'éloigne de la moyenne du lot plus que ne devraient jamais le faire tous les coups honnêtes sauf quelques pour cent. Cet éloignement se mesure en écarts-types — c'est ce que signifie le σ dans le nom de l'option — et ce réglage trace la limite à deux d'entre eux.
- **Agressif (1,64σ)** — écarte davantage. Utile sur un stand fréquenté avec des calibres voisins à côté, ou quand vous n'avez pas réaligné le radar entre les cibles. Il jettera aussi de vraies données valides, ce qui coûte de la précision par la réduction de l'échantillon. À employer quand vous avez des coups de reste.
- **Aucun** — pas de rejet des aberrantes. Recourez-y quand vous avez confiance dans vos données et que l'échantillon est petit. En dessous d'une dizaine de coups, le lot ne s'accorde pas encore assez avec lui-même pour juger lequel de ses membres détonne, si bien que le test jette plus souvent de bons coups que de mauvais.

Le grand classique que cela attrape est une piste qui n'est pas du tout votre balle : le radar a capté un coup du couloir voisin, l'a suivi de façon parfaitement propre et a produit un magnifique ajustement pour le projectile de quelqu'un d'autre. Son R² sera excellent. Seul son désaccord avec le reste de votre lot le trahit.

Comme pour le seuil de qualité, tout changement ici redécide et remoyenne immédiatement.

### 6.5 Seuil de débruitage

Celui-ci diffère des deux précédents par nature, et pas seulement par degré. Les deux filtres jettent des *pistes* entières. Ce curseur règle avec quelle vigueur les mauvais *points* sont écartés **à l'intérieur** de chaque piste, avant même que cette piste soit ajustée.

Il va de **Souple** (0,970) à **Normal** (0,990) par pas de 0,005, et se place par défaut sur 0,990, à la butée droite. La valeur numérique s'affiche à côté de l'étiquette.

**Laissez-le sur 0,990.** Cette valeur n'est ni une supposition ni un goût ; elle sort d'un balayage direct sur des pistes réelles portant des aberrantes injectées connues, et elle réduit à peu près de moitié l'erreur de BC obtenue par rapport à l'ancien 0,970, plus doux (§12.7). La seule raison de le déplacer est un environnement réellement extrême où vous constatez que de vrais bons points sont écartés — parcourez quelques lignes et regardez le graphique avant de trancher.

0,970 existe comme option parce que c'est ce que l'outil précédent a employé pendant des années. Si vous cherchez à reproduire un ancien résultat, c'est le réglage qui le reproduira.

Contrairement aux deux filtres précédents, celui-ci modifie l'ajustement lui-même ; le changer impose donc un nouveau **Calculer**.

### 6.6 Choisir un .zip Labradar…

Ouvre le sélecteur de fichiers de votre appareil. Une fois un fichier choisi, l'outil le décompresse aussitôt, repère les entrées CSV et détermine lesquelles sont de vraies pistes — le tout dans votre navigateur, rien n'est téléversé. Le nom du fichier apparaît à côté du bouton et la liste des pistes se remplit immédiatement.

Cette étape ne calcule **rien**. Chaque piste atterrit dans la liste avec le statut *pas encore calculé*, hormis les entrées qui ne sont pas des pistes du tout et sont marquées comme telles sur-le-champ (§7.2).

Deux erreurs peuvent apparaître ici :

- ***Impossible d'ouvrir ce fichier***, avec la raison sous-jacente — le fichier n'était pas une archive zip valide.
- ***Aucun fichier de piste trouvé dans ce zip*** — il s'est ouvert, mais ne contenait absolument rien portant un nom en `.csv`. Cela signifie d'ordinaire que le mauvais dossier a été compressé, ou que l'archive contient un zip imbriqué plutôt que les fichiers eux-mêmes.

Choisir un nouveau zip efface tout lot en cours, y compris chaque décision manuelle d'inclusion ou d'exclusion que vous aviez prise.

### 6.7 Calculer

Délibérément un bouton distinct du choix du fichier, afin que vous puissiez régler modèle de traînée et atmosphère *après* avoir vu ce que contient le zip et avant d'y consacrer le moindre calcul.

Un clic lance en arrière-plan un ajustement pour chaque piste analysée. Les lignes se mettent à jour une à une à mesure que leur tâche s'achève — vous pouvez regarder le lot se résoudre — et la moyenne est recalculée à chacune. Le bouton est désactivé pendant le traitement et réactivé quand la dernière piste est stabilisée.

**Ce qui recalcule quoi** mérite votre attention, pour savoir quand cet outil peut vous montrer discrètement un nombre périmé :

| Changement | Effet |
|---|---|
| Seuil de qualité du signal | Verdicts et moyenne mis à jour immédiatement |
| Rejeter les valeurs aberrantes | Verdicts et moyenne mis à jour immédiatement |
| Une case **Inclure** | Verdicts et moyenne mis à jour immédiatement |
| Modèle de traînée | **Exige Calculer** — rien ne bouge tant que vous ne cliquez pas |
| Atmosphère | **Exige Calculer** |
| Seuil de débruitage | **Exige Calculer** |

Recliquer sur **Calculer** jette tous les résultats de piste existants et réajuste le lot entier à partir de zéro avec les réglages du moment. Le graphique et le récapitulatif sont également vidés pendant l'opération. Vos décisions manuelles d'inclusion ou d'exclusion y survivent.

---

## 7. La liste des pistes

Intitulée « Trajectoires » dans l'interface. Une ligne par entrée CSV trouvée dans le zip, dans l'ordre propre du zip — qui, pour un export normal, est l'ordre des coups.

### 7.1 Les colonnes

- **Fichier** — le chemin complet de l'entrée à l'intérieur du zip, donc `SR0013/TRK/Shot0007 Track.csv` et non le seul numéro de coup. Verbeux, mais sans ambiguïté quand un zip contient plus d'une séance.
- **Statut** — le verdict, sous forme de pastille colorée. Voir §7.2.
- **BC** — le coefficient balistique ajusté pour ce coup, à quatre décimales, ou un tiret s'il n'a pas encore été calculé.
- **R²** — la netteté avec laquelle les points nettoyés de ce coup s'alignent sur une droite, à quatre décimales. C'est ce que teste le seuil de qualité du signal (§6.3). C'est un indicateur de qualité de données, **pas** une mesure de la réussite de l'ajustement du BC.
- **Inclure** — une case à cocher qui prend le pas sur le verdict automatique.

Cliquer n'importe où sur une ligne sauf sur sa case sélectionne cette piste et la trace dans le graphique au-dessus (§8).

### 7.2 Les statuts

| Statut | Signification |
|---|---|
| **pas encore calculé** | Analysé avec succès, en attente de **Calculer** |
| **calcul en cours…** | Sa tâche est en file ou en cours |
| **pas une trajectoire** | Le fichier n'est pas une piste Labradar. Entièrement ignoré |
| **valide** | Ajustée, les deux filtres passés, incluse dans la moyenne |
| **signal de faible qualité** | Ajustée, mais R² sous le seuil (§6.3) |
| **valeur aberrante** | Ajustée, de bonne qualité, mais son BC détonne dans le lot (§6.4) |
| **exclu** | Vous avez décoché la case à la main |
| **erreur** | L'ajustement a échoué. Voir §10.4 |

***Pas une trajectoire*** est l'état normal de plusieurs entrées dans tout export réel, et ce n'est pas un problème. Le `Report.csv` de l'appareil l'obtient, car c'est un récapitulatif et non une piste. De même tout ce qui se termine par hasard en `.csv` — y compris les fichiers compagnons invisibles en `._` que macOS sème dans les archives qu'il a touchées. L'outil tranche d'après le contenu et non d'après le nom : un fichier est une piste s'il contient un en-tête de piste Labradar avec une unité de vitesse déclarée, et s'il livre au moins quatre lignes de données exploitables.

### 7.3 La case « Inclure »

La case reflète le verdict courant — cochée pour *valide*, décochée pour les trois états de rejet — et cliquer dessus prend le pas sur ce verdict à la main.

- **Cocher une piste rejetée** la force dans la moyenne, par-dessus le contrôle de qualité. Elle devient de surcroît **exempte de l'écrêtage des aberrantes** : une décision manuelle est faite pour tenir, pas pour être discrètement re-rejetée par la statistique même qu'elle contredisait.
- **Décocher une piste valide** l'en chasse, et elle reste dehors quels que soient les deux filtres.

La case n'est disponible que sur les lignes qui ont réellement un verdict à contredire. Une ligne non calculée, qui n'est pas une piste, ou qui a échoué, n'a rien à inclure, et sa case est désactivée.

Les décisions manuelles survivent à un **Calculer** et sont effacées quand vous choisissez un nouveau zip.

Usez-en avec parcimonie et pour des raisons que vous savez formuler. « J'ai regardé le graphique, le radar s'est visiblement accroché à autre chose à mi-course, et le filtre automatique ne l'a pas vu » est une raison. « L'enlever a déplacé le BC dans le sens que j'espérais » n'en est pas une, et c'est exactement le mécanisme par lequel on se persuade d'un chiffre.

---

## 8. Le graphique de la trajectoire

Cliquez une ligne et sa courbe vitesse/temps se trace au-dessus de la liste.

Trois séries :

- **Conservé** — les points qui ont survécu au nettoyage et contre lesquels l'ajustement a été fait.
- **Écarté** — les points que le nettoyage a retirés, dans leur propre couleur, afin que vous voyiez exactement ce qui a été rejeté et jugiez si vous êtes d'accord.
- **BC = *n*** — un trait plein : la courbe de vitesse que le BC ajusté prédit réellement, tracée sur la même plage de temps que les données. C'est une prédiction du modèle et non des données mesurées, d'où le trait alors que tout le reste est en nuage de points.

La courbe ajustée commence à la première mesure réelle survivante et non à la bouche. C'est là qu'est ancré l'ajustement, et on ne peut que le dérouler vers l'avant depuis ce point (§12.5). Le point de bouche fabriqué par l'appareil est tout de même tracé — il fait partie de la piste — mais rien n'est ajusté à travers lui.

La courbe est prolongée jusqu'au temps le plus tardif de **n'importe quel** point tracé, conservé ou écarté, afin qu'une aberrante tardive reste visuellement comparable à la courbe qui l'a correctement ignorée. C'est la chose la plus utile de ce graphique : sur une bonne piste, les points écartés se détachent vers le haut d'une courbe qui reste collée aux points conservés.

**Télécharger le graphique en SVG** l'exporte, comme les autres graphiques de la suite.

Sélectionner une piste en erreur trace tout de même quelque chose : puisqu'il n'y a ni ajustement ni partage conservé/écarté, chaque point brut hormis le point de bouche fabriqué par l'appareil est dessiné comme rejeté, de sorte que vous puissiez au moins voir ce que le radar a enregistré et vous faire votre propre idée sur ce qui a empêché tout ajustement.

L'axe horizontal est en millisecondes et l'axe vertical en mètres par seconde, toujours. Voir §3.1.

---

## 9. La carte « Résultat »

Trois lignes, au-dessus du graphique.

- **Trajectoires valides** — l'étiquette de l'interface ; comprenez « pistes valides ». Combien, sur le total, entrent actuellement dans la moyenne. `24 / 31` signifie que trente et un coups ont produit un coefficient balistique et que vingt-quatre d'entre eux sont moyennés. Le dénominateur ne compte que les pistes réellement ajustées ; les entrées qui n'ont jamais été des pistes, et celles en erreur, sont absentes des deux moitiés. Si ce dénominateur est inférieur au nombre de coups que vous avez tirés, parcourez la liste à la recherche d'erreurs.
- **Écart-type du BC** — la dispersion des BC individuels, coup par coup, entrés dans la moyenne, à cinq décimales. C'est le nombre qui vous dit s'il faut croire celui d'en dessous. Voir §10.3.
- **Le BC lui-même** — en grand, dans la couleur d'accent, à quatre décimales. La simple moyenne arithmétique non pondérée des BC de toutes les pistes retenues. À côté, plus discret, l'intervalle de confiance à 95 % sur cette moyenne, écrit en pourcentage de celle-ci : `0.2812 (± 1.6%)`. Avec une seule piste valide, aucun intervalle n'apparaît, un coup unique n'ayant aucune dispersion d'où le tirer. Voir §10.3.

Les trois se mettent à jour à l'instant où vous changez un filtre ou cochez une case.

---

## 10. Lire le résultat

### 10.1 Ce que vous avez réellement mesuré

Ce nombre est le meilleur BC unique, contre le modèle de traînée que vous avez choisi, qui reproduise la décélération que votre balle a réellement montrée sur la centaine de mètres initiale de son vol, dans l'air que vous avez déclaré à l'outil.

Trois réserves à cela, toutes bien réelles :

**C'est une mesure de la balle, telle qu'elle sort de votre canon et traverse votre air.** Pas de la charge de poudre. La vitesse initiale ne fait pas partie de ce qui est mesuré — l'ajustement lit la *forme* de la décroissance, et une balle qui part à 780 m/s décélère selon la même courbe de traînée qu'une balle partie à 700 m/s. C'est pourquoi le §5.7 peut dire qu'un lot n'a pas à être homogène en vitesse. Ce que le canon apporte, en revanche, est bien réel : l'encrassement, l'usure du cône de forcement et tout ce qui perturbe la balle à la sortie peuvent changer sa manière de voler, et cela se verra ici.

**Il est ajusté sur une bande de vitesse limitée.** La balle n'est dans le champ du radar que sur une fraction de son vol, et elle y est rapide tout du long. Un BC unique contre un modèle standard est un compromis sur la bande où il a été ajusté — plus la courbe de traînée réelle de votre balle épouse la forme du modèle, mieux ce compromis s'extrapole vers le domaine transsonique, là où il compte le plus. Mais le segment proche que le radar enregistre réellement ne permet pas de dire quel modèle extrapole le mieux à longue distance. C'est une propriété de la balle, pas de l'outil, et c'est pourquoi les deux modèles de traînée peuvent tous deux bien s'ajuster ici et pourtant se contredire à distance.

**Il ne vaut que ce que vaut votre atmosphère.** Encore une fois. Voir §5.6.

### 10.2 La comparaison avec le chiffre publié

Attendez-vous à une différence. Il serait plus surprenant qu'il n'y en ait pas.

Un BC mesuré **inférieur** au chiffre publié est le cas courant, et généralement le cas honnête. Les chiffres publiés sont fréquemment mesurés dans des conditions idéales, sur la bande de distance qui les flatte le plus, sur un lot qui n'est peut-être pas le vôtre.

Un BC mesuré **très** inférieur — trente pour cent, disons — n'est pas un problème de balle. C'est un problème de saisie. Vérifiez d'abord la pression (station contre ramenée au niveau de la mer, §5.6), puis le modèle de traînée, puis le décalage projectile.

Un BC mesuré **supérieur** au chiffre publié mérite un second regard sur votre atmosphère avant de célébrer.

### 10.3 Lire l'intervalle de confiance et l'écart-type

Les deux nombres répondent à des questions différentes, et toute la question est là.

**L'écart-type** est la dispersion des BC individuels, coup par coup. C'est une propriété de votre tir, de votre munition et de la journée qu'a passée votre radar, et tirer davantage ne le réduira pas nécessairement.

**L'intervalle de confiance** dit à quel point ces coups ont cerné la moyenne. Contrairement à la dispersion, celui-ci se resserre bel et bien à mesure que vous tirez — mais lentement. Quatre fois plus de coups pour la moitié de l'intervalle. Il s'élargit quand vos coups se contredisent davantage, et il est délibérément généreux sur les petits lots, parce qu'une poignée de coups ne peut sincèrement pas dire grand-chose. Le §12.9 donne la formule.

Ainsi un lot de 25 pistes valides avec un écart-type de BC de 0,010 donne un intervalle d'environ ±0,004 autour de la moyenne. Contre un BC de 0,250, cela se lit ±1,6 %, ce qui est une mesure réellement utile.

Le même écart-type sur seulement 4 pistes valides donne environ ±0,016, soit ±6 %, ce qui ne l'est pas. L'essentiel de cet écart tient simplement à l'échantillon plus petit ; le reste, c'est l'outil qui refuse de flatter un lot de quatre coups.

**Ce que couvre l'intervalle.** La dispersion d'un coup à l'autre, et rien d'autre. Il n'inclut pas l'erreur de votre atmosphère, l'inadéquation entre votre balle et le modèle de traînée standard, ni le décalage projectile que vous avez estimé. Ceux-là déplacent la moyenne elle-même, et une moyenne fausse reste fausse, aussi serré que soit l'intervalle qui l'entoure — voyez §5.6 et §10.2 avant de croire un petit pourcentage.

Deux règles empiriques en découlent directement, et elles sont la raison d'être de ce que dit le §5.7 :

- **La dispersion est une propriété de vos données ; la précision est une propriété de la taille de votre échantillon.** Des pistes bruitées se soignent en en tirant davantage.
- **Une dispersion est large relativement à ce que la cartouche et la fenêtre rendent normal.** Dans les campagnes de validation derrière cet outil (§12.6) — des pistes synthétiques portant du bruit copié d'enregistrements Labradar réels, nettoyées et ajustées exactement comme le fait l'outil livré — la dispersion par piste allait d'environ 1,5 % à 5 % du coefficient, la plus large pour des cartouches lourdes et lentes à décélérer sur une fenêtre courte, la plus étroite pour des rapides sur une fenêtre longue. Une valeur dans cette bande ne dit rien de particulier. Nettement au-dessus, parcourez les lignes et regardez les graphiques avant de moyenner par-dessus : le radar peinait, le couloir était encombré, le décalage était faux, ou votre munition est réellement aussi irrégulière. Notez que ces campagnes mesuraient le bruit radar contre une vérité connue ; un lot réel porte la véritable variation d'une balle à l'autre par-dessus cette bande, et non dedans.

### 10.4 Quand une piste est en erreur

Une ligne marquée *erreur* signifie que l'ajustement lui-même a échoué, et non qu'il a produit une mauvaise réponse. En pratique, cela veut dire que les points de cette piste impliquaient une balle comme il n'en existe pas — un coefficient très en dehors de la plage de tout ce qui a jamais été tiré, ou une vitesse de départ sans rapport avec ce que le radar a lui-même enregistré — si bien que l'outil a refusé d'avancer un nombre. Les limites exactes figurent au §12.11.

L'outil traite cela comme un échec plutôt que de rapporter le bord de plage vers lequel il a dérivé ; c'est le bon comportement, mais cela signifie que la ligne vous dit seulement qu'il a échoué, pas pourquoi. Sélectionnez-la et regardez le graphique : une piste en erreur se révèle presque toujours n'être visiblement pas une piste de balle.

Une ou deux erreurs dans un grand lot n'ont rien de remarquable. Un lot où la plupart des pistes échouent signale un problème d'installation — le plus souvent un mauvais alignement entre le radar et la trajectoire de la balle, puis un modèle de traînée qui ne colle pas du tout aux données, ou une atmosphère assez fausse pour placer le BC requis hors de la plage de recherche.

---

## 11. Le mettre au travail

### 11.1 Reporter la valeur dans l'Arsenal

C'est le but de l'exercice. Ouvrez **Armes → Arsenal**, modifiez la balle que vous venez de mesurer et remplacez le BC publié par le vôtre, contre le modèle de traînée avec lequel vous l'avez ajusté.

Il n'y a pas de transfert automatique — vous saisissez le nombre. Ce sont quatre chiffres, et la lenteur en vaut la peine : c'est vous qui décidez que votre mesure supplante l'affirmation du fabricant, et cette décision mérite d'être consciente.

Dès cet instant, tous les outils de la suite — Trajectoire, Probabilité de touche, Calculateur de terrain, le graphique de comparaison — travaillent sur une valeur de traînée mesurée. L'amélioration est invisible à cent mètres et très visible au-delà de six cents.

### 11.2 Comparer des lots et des charges

Parce que l'outil rapporte un écart-type coup par coup en plus d'une moyenne, c'est un assez bon instrument pour des questions qui n'ont rien à voir avec la traînée :

- **Deux lots de la même balle.** Tirez-en vingt de chaque et traitez-les comme deux lots séparés. Un BC moyen sensiblement différent signifie que les lots diffèrent réellement, le plus probablement par la régularité de l'ogive ou du culot.
- **L'effet d'une matrice à pointer, ou d'un tri sur la cote culot-ogive.** Même traitement. Le nombre intéressant est ici l'*écart-type*, pas la moyenne : des balles régulières donnent des BC réguliers.
- **Enduit contre non enduit, moly, ou quel que soit l'engouement du moment.** La mesure est honnête et l'effet est d'ordinaire plus petit que le discours commercial.

Gardez l'atmosphère honnête d'une comparaison à l'autre, sans quoi vous mesurerez la météo.

Un lot vous est offert : **une série de mise au point de charge est déjà une séance de BC valide.** Puisque l'ajustement se moque de la vitesse initiale (§5.7), vingt ou trente cartouches couvrant une plage de charges de poudre, toutes avec la même balle, se moyennent en un coefficient balistique parfaitement valable. Vous alliez la tirer de toute façon, et le Labradar allait enregistrer chaque piste de toute façon. Zippez la séance et lancez-la.

---

## 12. Le régal du geek : ce qui arrive réellement à vos pistes

Tout ce qui suit est ce que l'outil calcule réellement, avec le raisonnement et les preuves. Ce n'est pas une lecture obligatoire pour se servir de l'outil, et c'est la partie la plus intéressante de l'outil.

**Les unités de toute cette section sont celles du moteur.** En interne tout est métrique — mètres, secondes, mètres par seconde, températures rapportées au kelvin — et la conversion n'a lieu qu'aux deux frontières : les unités déclarées par le fichier de piste à l'entrée, et votre préférence d'affichage à la sortie.

### 12.1 Ce que l'appareil mesure, et ce qu'il ne mesure pas

Un chronographe Doppler ne mesure pas la position pour ensuite la dériver. Il mesure le décalage de fréquence de sa propre émission réfléchie par la balle, lequel est directement proportionnel à la composante de vitesse de la balle *le long du faisceau*. La vitesse est la mesure primaire. La distance en est intégrée, ce qui explique que la colonne des distances soit lisse même quand celle des vitesses ne l'est pas.

Deux conséquences façonnent tout le reste :

**Le décalage projectile est une vraie correction géométrique, pas une coquetterie.** Ce que voit le faisceau est la composante radiale de la vitesse. La convertir en vitesse réelle dans l'axe du tir réclame l'angle entre le faisceau et la trajectoire, lequel se déduit du décalage que vous avez réglé. Une erreur de décalage est une erreur en cosinus, et les erreurs en cosinus sont les pires : petites, systématiques et entièrement invisibles en sortie.

Cela explique aussi l'asymétrie affirmée au §5.2 — pourquoi un décalage négligé coûte plus cher à une mesure de BC qu'à une vitesse initiale. L'angle entre le faisceau et la trajectoire n'est pas constant : il est le plus ouvert juste à la bouche et se referme vers zéro à mesure que la balle s'éloigne. Le facteur de correction est donc une *fonction de la distance*, et se tromper de décalage ne met pas toute la piste à une mauvaise échelle constante. Cela la cintre. Les points initiaux sont corrigés davantage que les derniers, ou moins, et il en sort une courbe de décroissance de vitesse de la mauvaise forme.

Une vitesse initiale est un point unique sur cette courbe et absorbe l'erreur comme un décalage modéré. Un coefficient balistique est ajusté à la forme de la courbe et l'absorbe comme un biais. Le même laisser-aller qui laisse vos lectures de chronographe parfaitement raisonnables peut déplacer un BC de plusieurs pour cent.

**Le SNR est une mesure directe de ce que l'écho a de réel.** Il est donné point par point, en décibels, et se dégrade régulièrement à mesure que la balle s'éloigne — la puissance de retour décroît comme la puissance quatrième de la distance, si bien qu'une balle deux fois plus loin renvoie un seizième du signal. C'est la bonne pondération pour un ajustement, et l'outil s'en sert comme telle (§12.4).

### 12.2 À quoi ressemble réellement le bruit

Avant que rien de tout cela ne soit conçu, le bruit a été mesuré et non supposé : 1 297 pistes réelles distinctes, dédoublonnées depuis un export en masse, avec des résidus pris contre une droite de référence ajustée uniquement sur les **30 premiers pour cent** de la fenêtre temporelle de chaque piste — délibérément à l'abri de toute contamination par la queue.

Résidu de vitesse agrégé, en m/s, par décile de position le long de la piste :

| Décile | moyenne | écart-type | p5 | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| 0 (début) | -0,00 | 0,69 | -0,68 | 0,01 | 0,65 | 1,97 |
| 2 | -0,01 | 0,82 | -1,15 | -0,03 | 1,13 | 2,53 |
| 4 | 0,41 | 3,69 | -2,07 | 0,01 | 3,12 | 18,65 |
| 6 | 1,97 | 8,64 | -2,86 | 0,28 | 15,78 | 43,25 |
| 8 | 5,77 | 15,67 | -3,97 | 1,18 | 38,97 | 67,87 |
| 9 (fin) | 10,41 | 19,46 | -3,62 | 3,44 | 52,06 | 81,03 |

Lisez les deux queues l'une contre l'autre, car toute l'histoire est là. Au début de la piste le bruit est serré et vraiment symétrique — un écho Doppler bien élevé, à SNR élevé. En fin de piste, le côté **bas** bouge à peine : le p5 reste autour de -3 à -4 m/s tout du long. Le côté **haut** croît de près de deux ordres de grandeur, jusqu'à un 99e centile de 81 m/s.

Les mauvais points Labradar surestiment pratiquement toujours la vitesse, et ne la sous-estiment jamais. C'est exactement l'allure d'un écho parasite — une réflexion sur quelque chose de plus proche, ou une arrivée par trajets multiples, qui se lisent l'une comme l'autre comme une moindre perte de vitesse radiale que celle réellement subie par la balle. Ce n'est pas un bruit symétrique et il ne faut pas le traiter comme tel.

Deux autres faits issus du même corpus, tous deux porteurs pour la conception :

- **55 % des pistes réelles n'ont besoin d'aucun élagage de points.** Le nettoyage n'est pas une passe de lissage de routine ; c'est un traitement d'exception.
- **La sévérité varie énormément d'une séance à l'autre et n'est pas prévisible depuis l'intérieur d'une piste.** Le nombre de points écartés va de 0 à 73 sur le corpus. Le calibre (le pouvoir réfléchissant du culot), l'encombrement près de la ligne de vol, l'alignement du faisceau et la stabilité de la boîte sous le souffle contribuent tous indépendamment.

Ce dernier point a tué deux conceptions distinctes de seuil adaptatif par piste, qui toutes deux tentaient de calibrer la vigueur du nettoyage sur la partie initiale de chaque piste. Cela ne peut pas marcher : la sévérité réelle loge presque entièrement dans la queue, et un signal calibré sur la tête est structurellement incapable de la voir. L'une des deux a été écartée sur une piste synthétique *sans bruit*, où elle jetait 18 à 26 points parfaitement bons ; l'autre a passé ce contrôle mais n'a jamais différé, pas une fois, d'un seuil fixe sur des pistes réelles à sévérité véritable. Toutes deux sont documentées dans le rapport d'expérience sur le nettoyage du dépôt, et le seuil fixe qui les a remplacées a fait mieux que les deux.

### 12.3 Nettoyage : retrait glouton du pire point avec barrière de restauration sur R²

Chaque piste est nettoyée avant que quoi que ce soit n'y soit ajusté. L'algorithme est hérité de l'outil précédent, porté délibérément sans modification, et n'est ni un sigma-clipping ni un RANSAC :

1. Ajuster une droite des moindres carrés pondérée par le SNR à travers les points.
2. Trouver le point de plus grand résidu absolu à cette droite. Le retirer. Noter le R² de l'ajustement *avant* le retrait.
3. Répéter, jusqu'à un plancher de 10 points restants.
4. Puis parcourir l'historique de R² noté depuis le début. Au **premier** pas dont le R² était déjà dans un seuil relatif du meilleur R² jamais vu pendant l'élagage, restaurer le point de ce pas **et tout ce qui a été écarté après lui**.

Le pas 4 est la partie subtile et la raison pour laquelle l'algorithme fonctionne. La boucle d'élagage va toujours jusqu'au plancher, jetant de bons points en même temps que des mauvais ; la passe de restauration demande alors « à partir de quand élaguer davantage n'a plus rien rapporté ? » et déroule tout jusque-là. Une piste qui n'avait besoin d'aucun nettoyage a son meilleur R² possible dès le pas zéro, si bien que la toute première vérification de restauration passe et que chaque point écarté revient aussitôt. C'est ainsi que 55 % des pistes réelles ressortent correctement intactes d'une boucle qui avait retiré sans condition des dizaines de leurs points.

Trois asymétries d'indice dans cette routine ressemblent à des bugs et n'en sont pas :

- **Le point synthétique t = 0 de l'appareil est exclu de l'ajustement, du R² et de la recherche du pire point.** Ce n'est pas une mesure (§3), et son champ SNR est littéralement un tiret. Il ne peut pas être autorisé à influencer un ajustement et ne peut pas non plus être « retiré » de manière sensée.
- **Le dernier point est exclu de l'ajustement et du R², mais reste éligible au retrait.** L'appareil est le plus bruité précisément en fin de piste, donc un mauvais dernier point ne doit pas corrompre l'indicateur de qualité — tout en restant un candidat légitime à l'élagage. La conséquence est un comportement précis et vérifiable : une piste dont le *seul* problème est un mauvais dernier point a déjà son meilleur R² possible au pas zéro, donc la première vérification de restauration passe et ce point revient. Il ne reste élagué que s'il coïncide avec un vrai problème à l'intérieur de la plage d'ajustement.
- **Deux plages d'ajustement différentes** servent à ce qui est mathématiquement la même régression linéaire pondérée : l'une excluant le dernier point (pour le R² et la recherche du pire point), l'autre l'incluant (pour y lire des vitesses, dans l'ancien estimateur à deux points). Les confondre est une faute facile et réellement dommageable — les deux plages produisent des vitesses qui ne s'accordent qu'à trois chiffres significatifs, ce qui est invisible au R² et vaut sourdement environ un demi pour cent de BC.

Il subsiste un accident honnête hérité de l'original : la condition d'arrêt est vérifiée *après* le retrait, si bien que la boucle peut retirer, et retire typiquement, un point de plus que le plancher, s'arrêtant à neuf plutôt qu'à dix. Aucune justification métier n'en a été trouvée dans le code d'origine. Il est conservé parce que le portage a été validé dans son ensemble sur des pistes réelles, et que le modifier invaliderait cette validation sans gain connu.

### 12.4 Pondération par le SNR

La colonne SNR est en décibels. Le poids de chaque point est cette valeur reconvertie en rapport de puissance linéaire :

$$w_i = 10^{\,\text{SNR}_i/10}$$

ce qui n'est pas une transformation cosmétique. Un point à 40 dB pèse 10 000 ; un point à 10 dB pèse 10. Sur une piste réelle, cela fait un facteur mille entre les échos initiaux, sûrs, et les derniers, douteux — exactement la forme qu'exige le tableau de bruit du §12.2. L'ajustement est dominé par la portion de piste dont le radar était réellement sûr, et la queue bruitée n'y contribue presque rien — tout en restant *présente*, de sorte qu'une queue qui contredit réellement le modèle apparaît encore dans les résidus et se fait encore attraper par le nettoyage.

Le point synthétique t = 0 n'a aucun SNR et se voit attribuer un poids nul — mais en pratique il n'atteint jamais une pondération, puisque chaque ajustement de l'outil l'exclut structurellement par son indice avant même que la pondération n'intervienne.

### 12.5 L'ajustement : la physique sur toute la fenêtre

C'est la partie qui a été rebâtie plutôt que portée, et c'est de là que vient la justesse.

L'approche évidente, celle que le prédécesseur a suivie pendant des années, consiste à : passer une droite par les points nettoyés, y lire une vitesse à chaque extrémité, et dichotomiser sur le BC qui fait passer le modèle de traînée de la première vitesse à la seconde dans le temps écoulé. Deux points, une forme de courbe présupposée.

Ce que fait cet outil à la place, c'est ajuster la **physique elle-même** contre tous les points conservés à la fois. Deux paramètres sont résolus conjointement :

- $v_1$, la vitesse vraie au point d'ancrage, et
- le coefficient balistique.

Pour un couple candidat, l'intégrateur de trajectoire de l'application est déroulé vers l'avant depuis l'ancre et sa vitesse prédite est évaluée au temps propre de chaque échantillon conservé. L'objectif est la somme pondérée par le SNR des carrés des résidus :

$$\text{SSE}(v_1, \text{BC}) = \sum_i w_i \left(v_{\text{modèle}}(t_i;\, v_1, \text{BC}) - v_i\right)^2$$

et elle est minimisée par une **recherche par nombre d'or imbriquée** — recherche interne sur le BC pour un $v_1$ candidat, recherche externe sur $v_1$ — plutôt que par dichotomie, car il s'agit ici de minimiser une somme de carrés et non de chercher la racine d'une grandeur monotone. Trente itérations chacune, avec le BC encadré sur [0,05, 1,5] et $v_1$ à 15 % près autour de la vitesse d'ancrage brute.

Trois choix de conception méritent d'être énoncés :

**L'ancre est le premier point *intérieur conservé***, pas le point t = 0 de l'appareil ni le premier échantillon brut. Sa vitesse enregistrée n'est que la *valeur de départ* ; le $v_1$ réel est ajusté. Cela compte parce que cette lecture unique est elle-même une mesure bruitée, et la figer propagerait son erreur directement dans le BC.

**Ajuster $v_1$ ne coûte presque rien en risque de surajustement**, et c'est l'argument en sa faveur. Deux paramètres physiquement signifiants forment un modèle bien plus serré qu'une parabole à trois coefficients, et il ne peut pas courir après le bruit comme le ferait un terme polynomial supplémentaire — la forme est contrainte par une vraie physique de traînée et non par un terme de courbure libre.

**La forme de la courbe n'est jamais présupposée.** C'est ce que le modèle de traînée produit réellement à ces vitesses dans cet air, et c'est tout l'enjeu.

L'intégration emploie le pas de calcul RK4 partagé de la suite, à pas fixe de 20 ms hors de la bande transsonique et de 3 ms à l'intérieur, l'atmosphère étant réévaluée à chaque pas depuis l'altitude courante de la balle. Atteindre exactement un temps cible passe par la même interpolation quadratique à trois points que le reste du moteur emploie pour atteindre une distance cible — lire le pas brut qui dépasse ferait une erreur bien réelle à ces vitesses, de l'ordre de plusieurs dizaines de mètres.

### 12.6 Pourquoi pas une droite, et pourquoi pas une parabole

Les deux solutions de rechange ont été éprouvées plutôt qu'écartées, contre des pistes synthétiques portant du **vrai** bruit — rééchantillonné par bootstrap depuis le corpus de 1 297 pistes du §12.2 plutôt que tiré d'un modèle paramétrique, précisément parce que le modèle paramétrique sous-estimait la queue sévère. Quatre configurations de référence, trois longueurs de fenêtre, 300 essais par cellule.

Le résultat isolé le plus net vient du cas sans aucun bruit — une piste synthétique parfaitement propre pour un BC connu de 0,202 :

| Méthode | BC retrouvé | Erreur |
|---|---|---|
| Linéaire | 0,1838 | -9,0 % |
| Quadratique | 0,2028 | +0,4 % |
| Ajustement physique | 0,2020 | **+0,01 %** |

Cela isole ce que les essais bruités ne peuvent pas isoler seuls : **une droite est un modèle réellement médiocre de la décroissance de vitesse véritable, physiquement courbe**, sur une fenêtre de 150 à 200 m. Neuf pour cent d'erreur, avec un chronographe parfait, avant même d'envisager le bruit. C'est un biais structurel, pas un problème de robustesse.

Avec du vrai bruit ajouté, sur toutes les configurations et longueurs de fenêtre éprouvées :

- **La quadratique surestime le BC dans chaque cellule sans exception**, de +4 % à +9 %. Elle épouse trop bien la queue bruitée — et puisque le §12.2 a établi que les erreurs de queue sont unilatérales vers le haut, bien les épouser signifie être tiré vers le haut. Cela reproduit exactement l'échec que l'auteur de l'outil précédent avait déjà trouvé à la main.
- **Le biais du linéaire dépend de la configuration et croît avec la longueur de fenêtre.** Presque plat pour un .338 lourd et décélérant doucement ; un biais négatif fort et croissant pour un 5,56 rapide à faible BC — de -3,4 % à 120 m jusqu'à -8,4 % à 200 m. C'est le biais de forme ci-dessus, cumulé à la sensibilité au bruit.
- **L'ajustement physique a eu la plus petite erreur dans chaque cellule sans exception**, typiquement trois à neuf fois plus petite que l'une ou l'autre solution, et la dispersion la plus serrée par-dessus le marché.

L'amélioration résiste au contact du cas d'usage réel : se servir du BC ajusté par chaque méthode pour prédire la vitesse à 300 m — au-delà de la fenêtre mesurée, ce à quoi un BC *sert* — donne le même classement.

La réserve honnête : tout ceci est synthétique. Des pistes réelles ont servi à caractériser le bruit que portent les pistes synthétiques, non à redériver de bout en bout et indépendamment le BC d'une vraie balle.

### 12.7 Pourquoi le seuil de débruitage est à 0,990 par défaut

Le seuil de nettoyage a été balayé directement, sur 40 pistes à bruit réel :

| Seuil | Points écartés (moy.) | Erreur absolue de BC (moy.) |
|---|---|---|
| 0,95 | 0,70 | 1,09 % |
| 0,97 (l'ancienne valeur) | 2,42 | 1,08 % |
| **0,99** | **3,10** | **0,96 %** |
| 0,999 | 11,40 | 0,56 % |

Sur le corpus plat, l'effet paraît modeste. Sur les pistes qui avaient réellement besoin de nettoyage — celles à plus de quinze points écartés véritables — il est spectaculaire : l'erreur moyenne de BC était **plate autour de 21 % sur toute la plage 0,80 à 0,97**, et n'est tombée à 6–7 % qu'à 0,99. Le rappel contre les aberrantes injectées connues est passé de 14–54 % à 74–98 %.

L'erreur continuait de s'améliorer au-delà de 0,99, mais au prix d'une explosion du nombre de points écartés — plus de soixante sur des pistes qui en comptaient 100 à 140 au départ, bien au-delà de ce que montrent les pistes réelles, et jusque dans un régime proche du plancher où l'ajustement manque de données. **0,99 est la valeur que les preuves soutiennent ; rien au-delà n'a été cru sur cette base.**

Deux constats de la même expérience méritent d'être consignés parce qu'ils sont négatifs :

- **Nettoyage et ajustement ne sont pas interchangeables indépendamment.** Associé à l'*ancien* ajustement linéaire, le seuil relevé n'aidait pas de façon fiable et rendait une configuration mesurablement pire. Il ne gagne sa place qu'aux côtés de l'ajustement physique. Évaluez le couple, pas les pièces.
- **Mesurer les résidus du nettoyage contre le modèle physique plutôt que contre une droite a été construit, validé comme exact, rendu assez peu coûteux pour être livré — et n'a produit aucun gain mesurable** une fois le seuil déjà relevé. Cela a été laissé de côté. C'est le seul morceau d'infrastructure fonctionnelle délibérément non livré de cet outil, conservé dans le dépôt comme contexte pour une refonte future plutôt que comme poids mort dans le bundle.

### 12.8 Les deux barrières portant sur la piste entière

Toutes deux opèrent sur des résultats de piste déjà obtenus, et aucune ne réajuste quoi que ce soit — d'où leur réaction instantanée.

**La barrière de qualité du signal** compare le R² de chaque piste — le coefficient de détermination de la droite pondérée par le SNR passant par ses points *nettoyés* — à 0,95 (Normal) ou 0,90 (Bruit élevé), ou saute le test entièrement (Aucun).

Il y a ici une contradiction apparente qu'il vaut la peine de lever : le §12.6 vient d'établir qu'une droite est le mauvais modèle pour ajuster un BC. Elle est néanmoins la bonne référence pour un contrôle de *qualité*, pour deux raisons. L'écart d'une piste à la linéarité sur une fenêtre de 100 m est dominé par le bruit et non par la courbure réelle — la courbure vaut quelques pour cent, les mauvais points valent des dizaines de mètres par seconde. Et employer la même référence que le nettoyage lui-même rend le R² rapporté directement lisible comme « le nettoyage s'est-il bien passé », qui est précisément ce sur quoi on demande à l'utilisateur de juger.

**L'écrêtage des aberrantes** calcule la moyenne et l'écart-type de population sur ce qui reste valide après la barrière de qualité, puis rejette toute piste à plus de $k\sigma$ de cette moyenne, avec $k = 2,0$ (Conservateur) ou $k = 1,644854$ (Agressif). Cette seconde constante n'est pas arbitraire : c'est le 95e centile de la loi normale centrée réduite, de sorte qu'un écrêtage bilatéral de cette largeur conserve les 90 % centraux d'une population normale. C'est le seuil classique « rejeter les 10 % les pires », écrit exactement.

Les barrières s'exécutent dans cet ordre, et uniquement dans cet ordre : la qualité d'abord, puis l'écrêtage sur les survivantes. Une piste déjà rejetée pour qualité ne contribue pas à la moyenne ni à l'écart-type sur lesquels l'écrêtage est calculé — ce qui est juste, puisque le BC d'une mauvaise piste élargirait sinon l'étalon même qui sert à attraper les mauvaises pistes.

**Les décisions manuelles court-circuitent les deux**, et une inclusion forcée est de surcroît exemptée de la passe d'écrêtage elle-même. Une décision manuelle est faite pour tenir, pas pour être re-rejetée en silence par la statistique qu'elle contredisait.

### 12.9 L'agrégation

Une simple moyenne arithmétique non pondérée des BC survivants, et leur écart-type de population — divisé par $n$, non par $n-1$.

L'intervalle de confiance rapporté est un calcul distinct sur ce même ensemble de survivants, et lui utilise bel et bien $n-1$ : demi-largeur $= t_{0,975,\,n-1} \cdot s / \sqrt{n}$, avec $s$ l'écart-type d'échantillon, divisée par la moyenne pour donner le pourcentage affiché. Les deux dénominateurs sont délibérés. La forme population est celle contre laquelle l'ancien écrêtage a été calibré et elle reste intacte ; la forme échantillon est la bonne pour un intervalle sur une moyenne. Le multiplicateur est le quantile de Student bilatéral à 95 %, tabulé pour $n$ jusqu'à 31 et repris d'un développement de Cornish-Fisher au-delà, ce qui compte plus qu'il n'y paraît — à cinq pistes il vaut 2,776, et à quatre 3,182, contre le 1,96 qu'emploierait une approximation normale dans les deux cas : un intervalle plus large de 42 % et de 62 %, et considérablement plus honnête.

Ce n'est expressément *pas* la table `TDIST_QUANTILE` que porte la Calculette de précision de tir. Ce sont des quantiles à 0,9875, répartis à la Bonferroni pour donner un 95 % conjoint sur les deux coordonnées du point d'impact d'un groupe à la fois. Une moyenne de BC est un scalaire unique, et emprunter cette table donnerait un intervalle jusqu'à deux fois plus large que les 95 % qu'il prétend.

En dessous de deux pistes valides, aucun intervalle n'est rapporté, plutôt qu'un intervalle de largeur nulle.

La moyenne non pondérée est un choix délibéré, pas un oubli. Les points à l'intérieur d'une piste sont pondérés par le SNR, parce que le SNR est une véritable mesure de qualité point par point. Les pistes à l'intérieur d'un lot ne sont pas pondérées du tout, parce que chaque coup du lot est un tirage dans la même population de coups, et qu'il n'y a aucune raison défendable de laisser une piste plus propre parler plus fort qu'une piste plus bruitée sur ce que fait la *balle*. Pondérer par la qualité de piste surreprésenterait systématiquement les coups qui ont plu au radar, et ce n'est pas la même population que les coups que vous avez tirés.

### 12.10 Ce que l'ajustement ignore, et ce qu'il n'ignore pas

**Le vent est ignoré** — l'intégration tourne à vent nul. Sur 100 m de vol en 0,15 s, l'effet d'un vent de travers sur le *module* de la vitesse est négligeable, et le module est tout ce que cet ajustement regarde.

**La gravité n'est pas ignorée**, mais elle est quasiment sans effet, et il vaut la peine de voir pourquoi. La balle est déroulée vers l'avant comme si elle avait été lancée à l'horizontale, elle a donc pris environ 1,5 m/s de vitesse verticale au bout de 0,15 s. Contre 760 m/s à l'horizontale, la vitesse qui en résulte vaut $\sqrt{760^2 + 1,5^2} \approx 760,0015$ m/s. Quinze dix-millièmes de mètre par seconde. Inclure la gravité ne coûte rien et retire un sujet de discussion.

**L'altitude est déduite à rebours de votre pression station**, au lieu d'être supposée nulle. L'outil précédent supposait toujours le niveau de la mer, ce qui était une limite du moteur et non une décision. Déduire une altitude de la pression permet à l'intégrateur d'appliquer son propre modèle atmosphérique en vol de façon cohérente — même si, sur 100 m de vol et sans changement d'altitude notable, c'est là encore un petit effet. Cela ne coûte rien et cela rend le traitement de l'atmosphère par cet outil identique à celui de tous les autres outils de la suite, ce qui vaut plus que la correction elle-même.

**La densité de l'air est l'effet qui compte vraiment**, et elle sort des trois champs d'atmosphère via le modèle de densité d'air humide partagé de la suite. C'est pourquoi le §5.6 y insiste comme il le fait.

### 12.11 Notes numériques et d'ingénierie

- **Les entrées du zip sont filtrées par extension avant décompression**, non après. Tout ce qui n'est pas un `.csv` — le fichier projet `.lbr`, les entrées de dossier, tout le reste de l'archive — est ignoré sans jamais être décompressé. L'examen du contenu se fait une couche au-dessus et ne connaît rien aux fichiers zip, d'où la frontière de module exactement à cet endroit.
- **L'analyse est synchrone et immédiate ; l'ajustement, non.** Analyser un CSV de cent lignes prend des microsecondes, cela se fait donc à l'instant où le fichier est choisi et la liste s'affiche aussitôt. L'ajustement représente des centaines d'intégrations de trajectoire complètes par piste et part au pool de workers.
- **Les tâches sont distribuées une à une plutôt qu'en une promesse groupée**, précisément pour que chaque ligne se mette à jour dès que son propre ajustement aboutit. Attendre toutes les autres avant d'afficher quoi que ce soit serait plus simple et moins bon.
- **Le solveur signale la saturation en bord de plage comme un échec.** Les deux encadrements de recherche sont ceux que nomme le §12.5 : le BC confiné à [0,05, 1,5], et la vitesse de référence à 15 % près de la lecture d'ancrage propre à la piste. Une recherche par nombre d'or renvoie toujours *un* point intérieur, même quand le vrai minimum est hors de son encadrement — elle sature alors silencieusement contre le bord où ça continue de s'améliorer, ce qui a exactement l'air d'une convergence sans en être une. C'était un vrai bug, attrapé en pleine validation. Un résultat qui atterrit à moins de 0,1 % de l'un des deux bords est désormais traité comme un ajustement échoué, à l'image des autres solveurs de BC de la suite qui refusent déjà de renvoyer une valeur de bord pour une cible inatteignable. C'est tout ce que signifie une ligne en *erreur* au §10.4.
- **Le modèle de traînée et l'atmosphère sont rangés à côté du résultat de chaque piste**, au lieu d'être relus en direct au moment de tracer le graphique. La courbe ajustée superposée reflète donc toujours ce avec quoi cette piste-là a réellement été calculée, même si vous avez changé depuis les réglages du panneau sans relancer le calcul.
- **Une piste a besoin d'au moins quatre lignes analysables** pour être considérée comme une piste. Les lignes où manque le temps, la vitesse ou la distance sont écartées en silence ; de même toute ligne après la première où manque le SNR. Seule la première ligne a droit à un SNR non numérique, parce que seule la première ligne est le point synthétique de l'appareil.
- **Le plafond de 20 000 pas d'intégration** est une sécurité du pas de calcul partagé, et non une contrainte ici — une piste de 0,15 s demande quelques dizaines de pas.

### 12.12 Ce qui n'est délibérément pas ici

**Pas de budget d'erreur total.** L'intervalle de confiance couvre l'échantillonnage et uniquement lui (§10.3). Il n'intègre pas l'atmosphère que vous avez saisie, le modèle de traînée que vous avez choisi ni le décalage que vous avez estimé, lesquels dominent pourtant entièrement, dans la plupart des séances réelles, la dispersion d'un coup à l'autre. Les fondre en un chiffre unique en une-tête exigerait de faire comme si l'on savait de combien ses propres entrées sont fausses, et un nombre bâti sur ce faux-semblant serait pire que pas de nombre du tout.

**Pas de transfert automatique vers l'Arsenal.** Tous les autres outils de mesure de la suite transmettent leur résultat directement. Celui-ci non, et c'est une décision et non un oubli : remplacer un BC publié par un BC mesuré est un jugement sur le nombre auquel on se fie, et cela mérite d'être fait exprès.

**Pas d'incertitude par piste.** Chaque piste rapporte un BC et un R², non un BC assorti d'un intervalle. Le R² mesure la propreté de la piste, pas la précision avec laquelle le BC est déterminé ; les deux sont liés mais ne sont pas la même chose. Les confondre serait pire que de n'en rapporter aucun.

---

## 13. Origine

BC Labradar est le successeur de **Labrabaco**, un outil autonome du même auteur. La chaîne d'ingestion — la reconnaissance des pistes, les règles de tolérance ligne par ligne, l'algorithme de nettoyage des points et ses deux barrières de rejet portant sur la piste entière — en est portée fidèlement, tracée site d'appel par site d'appel et validée sur des pistes d'exemple réelles, y compris les plusieurs asymétries d'indice documentées au §12.3 qui ressemblent à des bugs et n'en sont pas.

Ce qui est nouveau, c'est l'ajustement. L'outil d'origine passait une droite par les points nettoyés et dichotomisait sur le BC correspondant à ses extrémités ; celui-ci ajuste la physique de traînée propre à l'application contre tous les points conservés à la fois, conjointement avec une vitesse de référence. Ce changement, et le changement associé du seuil de nettoyage de 0,97 à 0,99, ont été validés sur des pistes synthétiques à bruit réel avant que l'un ou l'autre ne soit livré, et les rapports de validation — y compris les résultats négatifs, les deux conceptions écartées et le seul mécanisme fonctionnel construit puis laissé de côté faute de mériter son coût — se trouvent dans le dépôt à côté du code.

Également nouveau : le graphique par piste avec son partage conservé/écarté et sa courbe ajustée superposée, dont l'outil d'origine n'avait aucun équivalent ; une carte de résultat structurée à la place d'un pavé de texte concaténé ; l'ajustement parallèle sur un pool de workers ; et une atmosphère pleinement consciente des unités avec une altitude réellement déduite, à la place d'un niveau de la mer supposé.

La suite est distribuée sous licence **AGPL-3.0-or-later**.

---

*Pacifique. Précis. Armé.*
