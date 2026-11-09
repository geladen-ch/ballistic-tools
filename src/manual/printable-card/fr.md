# geladen.ch ballistics Manuel de l'utilisateur — Fiche de tir imprimable

*Fait partie de la* [suite balistique geladen.ch](https://bc.geladen.ch)*.*

---

## 1. À quoi sert cet outil

Une fiche de tir est une feuille de papier qu'on garde avec l'arme : ce qu'il faut régler à chaque distance, de combien le vent déporte le projectile, et ce qui change quand il fait plus froid ou plus chaud, ou quand on tire en montée ou en descente. Le papier n'a besoin ni de batterie ni de réseau, et se lit d'un coup d'œil au milieu d'une série.

L'onglet **Carte imprimable** de Trajectoire produit une telle fiche en PDF, prête à imprimer. Il reprend l'arme, la cartouche et l'atmosphère réglées dans l'onglet **Données**, et les unités choisies dans les Paramètres : la fiche se lit donc comme le reste de l'application.

Une fiche couvre une arme avec une seule cartouche, dans un seul jeu de conditions. Elle ne peut pas remplacer le calculateur dans toutes les situations : quand l'air, la distance ou le vent s'écartent beaucoup de ceux pour lesquels elle a été faite, ses chiffres ne sont qu'un point de départ. La section 7 dit jusqu'où on peut s'y fier.

---

## 2. Démarrage rapide

1. Ouvrez **Trajectoire**. Dans l'onglet **Données**, choisissez l'arme et la cartouche, et saisissez l'atmosphère que vous attendez là où vous allez tirer.
2. Passez à l'onglet **Carte imprimable**. Le bloc **Sur la carte**, en haut, montre l'arme, la cartouche et les conditions de référence telles que la fiche les imprimera. Si quelque chose y est faux, corrigez-le dans l'onglet Données ou dans Armes.
3. Sous **Réglages de la carte**, choisissez le papier, la distance la plus lointaine et le pas de distance.
4. Cliquez sur **Télécharger le PDF** et imprimez le fichier en taille réelle.

Tout ce que vous réglez dans cet onglet est mémorisé, même après un redémarrage. Les réglages sont les mêmes pour toutes les armes : ils ne sont pas enregistrés arme par arme.

---

## 3. Pour quoi la fiche est calculée

- **Arme, cartouche et projectile** — ceux choisis dans l'onglet Données, depuis Armes.
- **Zéro** — la distance de réglage propre à l'arme, définie dans Armes. La **Distance de réglage (remplacement)** de l'onglet Données ne s'applique pas à la fiche. Si la cartouche a été réglée dans un autre air (une atmosphère de réglage dans Armes), le zéro reste dans cet air.
- **Conditions de référence** — l'atmosphère de l'onglet Données : altitude, pression, température et humidité. La fiche les imprime sur la ligne au-dessus du tableau.
- **Tir** — à plat. La pente est traitée par ses propres colonnes (section 5.6), pas par l'angle de ligne de mire de l'onglet Données.
- **Vent** — le vent latéral de référence propre à la fiche (section 4.4). Le vent de l'onglet Données n'est pas utilisé.
- **Corrections** — dans l'unité du Calculateur de terrain : clics, mrad ou MOA (Paramètres → **Sortie du Calculateur de terrain**), avec les mêmes indicateurs de direction, flèches ou **+ / −** (Paramètres → **Indicateurs de sortie du Calculateur de terrain**). Les clics suivent les valeurs de clic de l'arme définies dans Armes.

---

## 4. Réglages de la carte

### 4.1 Carte

- **Papier** — **A4** ou **Letter** impriment toute la fiche sur une page. **A5** et **Demi-lettre (Half-letter)** la répartissent sur deux pages en paysage : le tableau sur la première, le réticule et la photo du lieu sur la seconde. Imprimez-les recto verso sur une même feuille. Le papier fixe aussi le nombre de lignes que peut contenir le tableau (section 5.1).
- **Titre** — jusqu'à 44 caractères, imprimé en haut de la fiche. Laissé vide, la fiche s'intitule « arme · cartouche ».
- **Date** — imprimée en pied de page et reprise dans le nom du fichier. C'est la date du jour tant que vous n'en choisissez pas une autre.

### 4.2 Distances

- **Distance maximale** — là où s'arrête le tableau. Choisissez **Distance** et saisissez-la (1000 m ou 1000 yards par défaut), ou **Mach 1,1** ou **Mach 1,0** pour arrêter le tableau là où le projectile ralentit à cette vitesse. La précision se dégrade quand un projectile approche de la vitesse du son : la fiche reste ainsi dans le domaine où ses chiffres tiennent. En mode Mach, une note sous le champ indique à quelle distance le projectile atteint cette vitesse. La fiche s'arrête à la dernière ligne avant elle.
- **Pas de distance** — 200, 100, 50 ou 25, dans votre unité de distance. La première ligne est à un pas de la bouche.
- **Affiner le pas au-delà de** — affine le tableau là où la trajectoire devient plongeante. Quand la correction de hausse jusqu'à la distance suivante changerait de plus que cette valeur, le pas passe au suivant, plus fin (200 → 100 → 50 → 25). Une fois affiné, il ne redevient plus grossier. La valeur est dans l'unité de correction (clics, mrad ou MOA). 0 désactive l'affinage.

Un réglage typique : pas de 100 m, affiner au-delà d'environ 16 clics (toute valeur de 10 à 20 convient). La partie proche du tableau reste courte, et la partie lointaine, là où une petite erreur de distance coûte le plus, reçoit des lignes tous les 50 ou 25 m.

### 4.3 Ligne d'état

Sous les réglages, une ligne compte les lignes du tableau : « 24 lignes sur 37 ». Si les distances et les cibles demandent plus de lignes que le papier n'en contient, un avertissement donne la distance la plus lointaine qui tient encore et le nombre de lignes laissées de côté. Pour les récupérer, prenez un pas plus grossier, un seuil d'affinage plus élevé, une distance maximale plus courte ou un papier plus grand.

### 4.4 Vent

Le **Vent latéral de référence** est le vent pour lequel la colonne **Vent** est calculée : plein travers, venant de la droite. La fiche imprime la dérive sans son sens : corrigez ou prenez la contre-visée face au vent.

Choisissez un vent facile à recalculer de tête. La section 6.3 montre comment.

### 4.5 Température

**Corrections de température** (activé par défaut) ajoute cinq colonnes. Chacune donne la variation de hausse par rapport aux conditions de référence quand l'air **et la poudre** sont à cette température.

- La vitesse initiale varie selon la variation de vitesse par degré de la cartouche, définie dans Armes. Sans elle, seul l'air change.
- Le zéro reste là où il a été réglé. La colonne montre de combien le point d'impact se déplace quand il fait plus froid ou plus chaud que la référence de la fiche. Elle ne suppose pas que vous ayez refait votre zéro ce jour-là.
- Par défaut, les colonnes sont centrées sur la température de référence, espacées de 5 °C (10 °F). La colonne du milieu est la température de référence elle-même et ne contient que des zéros. Modifiez la **Première température** ou le **Pas de température** pour choisir une autre échelle. Une ligne sous les champs énumère les colonnes. **Valeurs par défaut** revient à l'échelle centrée.

### 4.6 Contenu

- **Colonne dérive gyroscopique** — la dérive due à la rotation du projectile à chaque distance, sans vent, avec son sens. Elle n'est proposée que si la dérive gyroscopique est activée dans les Paramètres et que l'application a de quoi la calculer : le pas de rayure de l'arme, la longueur et le diamètre du projectile. La colonne Vent n'inclut jamais la dérive gyroscopique.
- **Corrections de pente (10° à 30°)** — cinq colonnes, pour le tir à 10, 15, 20, 25 et 30° en montée ou en descente. Voir la section 5.6.

**Lieu.** La fiche peut utiliser l'emplacement actif du Calculateur de terrain (voir Emplacements et cibles dans le manuel principal). Le nom de l'emplacement est affiché ici. S'il n'y a pas d'emplacement actif, **Ouvrir Lieux** vous y mène.

- **Lignes des cibles** — une ligne du tableau pour chaque cible de l'emplacement, calculée à sa propre distance et à son propre angle de ligne de mire (section 5.5).
- **Photo du lieu avec les cibles** — la photo de l'emplacement, chaque cible y étant marquée. Si l'emplacement n'a pas de photo, une note le signale et la fiche s'en passe.

**Réticule.** Si l'arme a une lunette avec réticule dans l'Arsenal, **Réticule et BDC** imprime ce réticule sur la fiche, avec ses repères BDC (de l'anglais « Bullet Drop Compensation », c'est-à-dire « compensation de la chute de la balle » ; en clair, des repères de contre-visée) s'il en a. Une vue lunette apparaît sous la case à cocher. Elle fonctionne comme celle du Calculateur de terrain, et ce qu'elle montre est ce que la fiche imprime :

- La **bague de grossissement** règle le grossissement, et **Zoomer sur le réticule** agrandit la vue d'une lunette à grossissement fixe.
- Les **Distances BDC** inscrivent sur chaque repère BDC la distance à laquelle il correspond, dans les conditions de référence de la fiche, sans vent et à plat.
- Les **Corrections de vent** marquent une contre-visée pour chaque quart du vent latéral de la fiche, jusqu'à une fois et demie celui-ci, des deux côtés. Le vent latéral complet a le plus gros repère.

La fiche n'a pas de point de visée. Le grossissement et les deux boutons de superposition sont propres à la fiche : les changer ici ne change pas la vue lunette du Calculateur de terrain, et inversement. Le réticule s'imprime en noir, les superpositions en gris.

Le réticule sur le papier est une image du réticule, pas un dessin à l'échelle. Ne mesurez pas une contre-visée dessus avec une règle.

---

## 5. Lire la fiche

### 5.1 Mise en page

- **En-tête** — le nom de l'application et le titre de la fiche.
- **Arme** — le nom de l'arme, la distance de réglage, la hauteur de la lunette et la valeur de clic de la lunette, verticale · horizontale.
- **Cartouche** — le nom de la cartouche, le projectile avec sa masse, la vitesse initiale avec sa variation par degré, et le coefficient balistique avec son modèle de traînée (ou « courbe Cd personnalisée »).
- **Corrections** — le titre nomme l'unité de correction. Les conditions de référence sont sur la même ligne, à droite : altitude, pression, température, humidité.
- **Le tableau** — sections 5.2 à 5.6.
- **Réticule** et **Cibles** — le réticule et la photo de l'emplacement. Quand vous en laissez un de côté, la fiche met à sa place un cadre ligné **Notes**.
- **Pied de page** — l'adresse de l'application, sa version et la date de la fiche. Si deux fiches ne concordent pas, ils disent laquelle est la plus récente et quelle version de l'application l'a produite.

A4 et Letter contiennent jusqu'à 37 lignes, A5 et Demi-lettre jusqu'à 26. Avec peu de lignes, chaque ligne est haute : la distance au-dessus, la hausse en dessous, en gros caractères. Avec beaucoup de lignes, chacune tient sur une seule ligne. Si une valeur est trop large pour sa colonne, tout le texte du tableau rapetisse un peu, pour que les colonnes restent alignées.

### 5.2 Distance et hausse

La colonne **Distance**, en gras, énumère les distances de référence, d'un pas jusqu'à la distance maximale. Sous chaque distance, ou à côté sur une fiche dense, figure la hausse à régler depuis le zéro, avec son sens.

### 5.3 Plus près et plus loin

Deux colonnes de chaque côté de la distance de référence donnent la hausse pour des distances voisines. Elles servent pour une cible située entre deux lignes. Leur écart dépend du pas en vigueur sur cette ligne :

| Pas | Plus près | Plus loin |
| --- | --- | --- |
| 200 | −100, −50 | +50, +100 |
| 100 | −50, −25 | +25, +50 |
| 50 | −20, −10 | +10, +20 |
| 25 | −10, −5 | +5, +10 |

Une distance voisine à la bouche ou en deçà reste vide. Chaque case montre sa distance en petits chiffres gris, et la hausse en dessous ou à côté.

Exemple, avec un pas de 100 m : la cible est à 640 m. Trouvez la ligne 600 m et lisez la case **+50**, soit 650 m. C'est plus proche que 600 ou 700 m, et plus juste qu'une interpolation à l'œil entre deux lignes.

### 5.4 Vent et dérive gyroscopique

**Vent** est la dérive pour le vent latéral de la fiche (imprimé dans le titre de la colonne), en valeur sans sens : corrigez face au vent. **Gyro** est la dérive gyroscopique sans vent, avec son sens. Elle ne dépend pas du vent : ajoutez-la par-dessus.

### 5.5 Lignes des cibles

Chaque cible de l'emplacement actif est une ligne grise, rangée par distance parmi les distances de référence. Une pastille noire porte son repère (T1, T2 … depuis la plus proche), et son angle de ligne de mire est imprimé à côté, + en montée. La hausse tient déjà compte de cet angle : réglez-la telle quelle et n'ajoutez pas de correction de pente. Vent et dérive gyroscopique sont comme pour les autres lignes. Une ligne de cible n'a pas de cases plus près et plus loin. Une cible au-delà de la distance maximale est laissée de côté. La photo de l'emplacement, si vous l'avez incluse, montre où se trouve chaque repère.

### 5.6 Corrections de pente

En tir en montée ou en descente, le projectile chute moins, perpendiculairement à la ligne de mire, qu'à plat, et le tir demande moins de hausse. Chaque colonne de pente donne la variation à ajouter à la hausse à plat à cette distance, pour cet angle. La valeur est la même, à un cheveu près, en montée et en descente, si bien qu'une seule colonne couvre les deux cas : la fiche imprime la moyenne des deux.

Exemple : 500 m, 20° en descente. Prenez la hausse de la ligne 500 m et ajoutez la valeur de la colonne **20** (en général une petite correction vers le bas).

Prenez la colonne la plus proche de l'angle mesuré, ou la ligne de la cible si elle fait partie de l'emplacement.

### 5.7 Corrections de température

Chaque colonne porte sa température en titre. Ajoutez à la hausse de la ligne la valeur de la colonne la plus proche de la température du jour. La colonne à la température de référence de la fiche ne contient que des zéros. Un air plus froid et une poudre plus froide donnent un projectile plus lent et plus freiné : les corrections du côté froid vont vers le haut, celles du côté chaud vers le bas.

---

## 6. La fiche au stand

### 6.1 Avant d'imprimer

- Saisissez l'atmosphère que vous attendez à l'endroit et à la saison où vous allez tirer. Une fiche faite pour 400 m d'altitude est nettement fausse à 1800 m. Si vous tirez dans des lieux très différents, imprimez une fiche pour chacun.
- Vérifiez le bloc **Sur la carte** : nom, zéro, hauteur de la lunette, valeur de clic, vitesse initiale et BC. La fiche ne vaut pas mieux que ces données.
- Utilisez la vitesse initiale que vous avez mesurée, avec sa température, et la variation de vitesse par degré si vous la connaissez. Les colonnes de température en dépendent.

### 6.2 Impression

Imprimez en taille réelle, pas « ajusté à la page ». Prenez un papier qui résiste au terrain, ou glissez la fiche dans une pochette transparente ou plastifiez-la. Pour A5 et Demi-lettre, imprimez les deux pages recto verso sur une même feuille : le tableau d'un côté, le réticule et la photo de l'autre.

### 6.3 Recalculer le vent

La dérive croît presque proportionnellement au vent latéral. Si la fiche est faite pour 4 m/s et que le vent souffle à 2 m/s, prenez la moitié de la valeur. À 6 m/s, prenez-en une fois et demie. Pour un vent qui n'est pas plein travers, ne gardez que sa composante latérale : la moitié de la vitesse à 30° de la ligne de tir, environ 0,7 à 45°, et environ 0,9 à 60°. Un vent latéral de référence rond facilite ce calcul. Avec les **Corrections de vent** activées, le réticule de la fiche montre les mêmes quarts du vent latéral sous forme de contre-visées.

### 6.4 Tout mettre ensemble

Pour un tir : la hausse de la ligne (ou d'une case plus près/plus loin), plus la correction de température, plus la correction de pente si la cible est plus haute ou plus basse que vous. Ensuite la dérive, recalculée pour le vent, plus la dérive gyroscopique.

---

## 7. Jusqu'où se fier à la fiche

- **Pression et altitude** — les colonnes de température ne changent que la température. Si la pression du jour s'écarte beaucoup de la référence de la fiche, les hausses aux grandes distances sont fausses. Utilisez un calculateur, ou imprimez une fiche pour ces conditions.
- **Les corrections ne s'additionnent qu'approximativement** — chaque colonne est calculée séparément, par rapport aux conditions de référence. Additionner une correction de pente et une correction de température est une très bonne approximation aux distances et angles courants, mais pas exacte.
- **Près de la vitesse du son** — les chiffres de la fiche deviennent moins sûrs à mesure que le projectile ralentit vers Mach 1. Arrêter le tableau à **Mach 1,1** garde une marge de sécurité.
- **Les données d'entrée** — la fiche reprend votre configuration. Une vitesse initiale, un BC, une hauteur de lunette ou une valeur de clic faux donnent une fiche soignée aux chiffres faux. Vérifiez la fiche au stand à quelques distances avant de vous y fier, et imprimez-en une nouvelle après un changement de cartouche, de zéro ou de lunette.

---

## 8. Fichier et confidentialité

Le PDF est créé dans votre navigateur et enregistré sur votre appareil. Rien n'est envoyé. Le fichier porte le nom de la fiche et sa date, par exemple « Fiche de tir - Tikka T3x - 6.5 Creedmoor 140 ELD-M - 2026-11-09.pdf ».
