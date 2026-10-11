# geladen.ch ballistics Manuel utilisateur — Session de calibrage

*Fait partie de la* [suite geladen.ch ballistics](https://bc.geladen.ch)*. Expérimental.*

---

## 1. Avant de commencer : avez-vous besoin de cet outil ?

La carabine et l'application ne sont pas d'accord : vous affichez ce que l'application prédit, et la balle arrive ailleurs. L'écart seul ne dit pas pourquoi. Une vitesse initiale erronée, un BC erroné, un zéro qui a bougé, une lunette qui donne moins que sa valeur de clic annoncée et une mauvaise lecture du vent peuvent tous produire le même écart. Cet outil planifie une courte séance qui distingue ces causes, vous guide pendant le tir et rapporte ce qu'il a trouvé. Quand deux causes ne peuvent pas être séparées, il le dit.

C'est la dernière étape de la mise au point d'une carabine, pas la première. Il ne peut pas déchiffrer une carabine dont vous ne savez rien, et il ne vous amènera pas seul au tir à très longue distance. Chaque inconnue que vous apportez à la séance lui coûte de la précision sur toutes les autres.

### 1.1 D'abord les bases

1. **La vitesse initiale et sa dérive en température.** Mesurez au chronographe au moins 10 cartouches du même lot et entrez la moyenne dans Arsenal, avec la température à laquelle vous l'avez mesurée. Pour la dérive, recommencez un jour plus chaud ou plus froid d'au moins 15 °C (27 °F) et entrez la variation par degré. Laissez d'abord les munitions prendre la température de l'air, gardez-les à l'abri du soleil et ne laissez pas une cartouche séjourner dans une chambre chaude avant de tirer. Les dérives habituelles vont de 0,5 à 2 m/s par °C. Une dérive fausse donne une vitesse fausse tous les jours sauf celui de la mesure : 10 m/s d'écart, soit seulement 10 °C à 1 m/s par °C, ressemblent à 800 m à une erreur de BC de 4,6 %.
2. **La hauteur de visée à 2–3 mm (0,1") près.** Mesurez-la de l'axe du canon à l'axe de la lunette. N'utilisez pas une valeur typique pour le montage. Une erreur ici pèse le plus près de l'arme et se confond facilement avec une erreur de zéro.
3. **Votre zéro.** Vérifiez-le le jour même avec un vrai groupement, tiré à plat et sans vent. Le Calculateur de précision de carabine montre avec quelle précision un groupement situe le point d'impact. Un seul groupement de trois coups le situe souvent moins précisément qu'on ne le croit.
4. **Le suivi de la lunette (valeur de clic).** Faites un test « tall-target », ou sa version courte : à une distance connue, affichez un nombre connu de clics entre deux tirs et mesurez de combien l'impact se déplace (1 mm par mètre de distance vaut 1 mrad). Une lunette fausse de 2 % ressemble à longue distance à un BC erroné.
5. **Un BC ou une courbe de traînée fiable.** Utilisez un BC G7 mesuré au radar Doppler ou une courbe Cd-Mach propre plutôt qu'un chiffre de boîte. Un BC G1 pour une balle boat-tail longue est un compromis qui ne vaut que sur une partie du vol. Si le fabricant publie plusieurs BC par plage de vitesse, l'onglet « BC multiples » des Outils BC les combine en une courbe de traînée.

La page « Préparer » de cet outil reprend la même liste, avec en plus la dispersion de votre carabine et l'écart-type de vitesse. Cocher un point indique au planificateur que cette cause est déjà réglée : il lui consacre moins de tirs et davantage à celles qui restent ouvertes. Bien faits, ces préparatifs règlent la plupart des désaccords entre la carabine et l'application avant tout calibrage. Ensuite, le BC devrait être la seule vraie inconnue.

### 1.2 Si possible, mesurez le BC directement

Il existe deux façons directes de mesurer un BC, et chacune est en général au moins aussi précise qu'une séance de calibrage :

- **Un Labradar d'origine** qui enregistre une piste par tir sur sa carte SD. [Labrabaco NG](#/manual/bc-labradar) (dans les Outils BC) ajuste un BC à chaque piste enregistrée.
- **Deux chronographes**, l'un à la bouche et l'autre plus loin, saisis dans l'onglet « Calcul BC » des Outils BC. Placez l'appareil éloigné de sorte qu'un tir bas ne puisse pas le toucher, et protégez-le avec quelque chose de solide.

### 1.3 Quand passer au calibrage

Utilisez cet outil quand les bases sont faites et que vous ne pouvez pas mesurer le BC directement. C'est aussi un bon moyen de vérifier un BC déjà mesuré.

---

## 2. Ce qu'une séance peut vous dire

### 2.1 Pourquoi une séance planifiée et pas votre carnet de tir

Quelques relevés à quelques distances semblent suffire pour tout ajuster. Ce n'est pas le cas. Vitesse initiale, traînée et suivi de la lunette modifient la trajectoire de façon presque identique aux distances de tir habituelles. Ajouter des groupements du même genre ne les sépare pas. L'ajustement ne peut les distinguer que si autre chose fixe l'une d'elles : un chronographe, un test tall-target, ou une seconde cible placée à une distance choisie pour les séparer. L'outil choisit ces distances pour vous.

### 2.2 Avec un chronographe, et sans

Un chronographe est ce que vous pouvez apporter de plus précieux. Une erreur de vitesse et une erreur de traînée courbent la trajectoire presque de la même façon, si bien que les tirs seuls ne peuvent pas les distinguer. Le chronographe mesure la vitesse directement, dans l'air du jour et à la température de poudre du jour, et il ne reste alors que la traînée comme grande inconnue.

- **Avec un chronographe** qui donne chaque tir au fur et à mesure (un radar Doppler ou un appareil monté à la bouche), une séance sur un terrain allant jusqu'à environ 800 m mesure la traînée d'une .308 à ±1,5–2 % avec 20–30 cartouches. C'est la note A, et l'outil propose d'enregistrer le résultat dans votre cartouche. Une correction de BC exige au moins cinq mesures de chronographe relevées pendant la séance.
- **Sans chronographe**, l'outil ne propose jamais de correction de BC. La traînée dépendrait alors entièrement de la vitesse moyenne mesurée un autre jour, et rien dans la séance ne peut vérifier cette moyenne. À 800 m, une erreur de 1 m/s sur elle déplace le résultat de traînée d'environ 0,5 %. La page « Préparer » peut quand même attribuer la note A à un tel plan ; le §8.7 explique pourquoi cette note ne suffit pas pour un BC. Si vous n'avez pas non plus vérifié la moyenne, la séance s'arrête à la note C quel que soit le nombre de cartouches, à peine mieux que le BC publié. Dans les deux cas, vous obtenez quand même des hausses corrigées pour les distances tirées et un contrôle du zéro. Elles ne valent que pour ces distances et un air semblable.

Sans chronographe, une séance est **beaucoup** moins utile. Si vous pouvez en emprunter un, faites-le. Le terrain compte presque autant : sur un terrain qui s'arrête à 600 m, même avec un chronographe et tous les préparatifs, une .308 ne dépasse pas la note B (voir §8.7).

### 2.3 Les notes

La page « Préparer » note le plan avant le premier tir, et la page « Conclure » note le résultat. La note découle de l'incertitude sur le facteur de traînée (un écart-type) :

| Note | Incertitude sur la traînée | Ce que vous obtenez |
|---|---|---|
| **A** | jusqu'à 2 % | Une vraie correction de BC, valable à d'autres distances et par d'autres conditions météo. |
| **B** | 2–3 % | Une correction de BC avec une marge large. L'outil vous laisse l'enregistrer, mais ne vous y fiez qu'à proximité des distances et conditions tirées. |
| **C** | 3–4 % | À peine plus que le BC publié. Pas de correction de BC. |
| **D** | plus de 4 % | Des hausses corrigées pour les distances tirées, et aucune conclusion sur le BC. |

Avant tout tir, l'outil suppose que le BC est faux d'environ 4 %. Une séance notée D n'a donc presque rien appris sur la traînée qui n'était pas déjà supposé.

**Seule la note A donne un résultat transposable à d'autres distances et à d'autres conditions météo.** À B et en dessous, la séance a mesuré l'effet combiné de toutes les causes, à ces distances et dans cet air. C'est utile pour ces distances, mais cela ne dit pas quelle part de l'effet vient du BC.

### 2.4 Limites

- **Supersonique uniquement.** Chaque cible planifiée est assez proche pour que la balle soit encore au-dessus de Mach 1,1. Cette version ne traite pas le vol transsonique ni subsonique.
- **L'outil ne calibre pas la vitesse initiale à partir des impacts.** La vitesse est une donnée que vous avez mesurée. Une mesure de chronographe pendant la séance la corrige, mais l'outil ne déduit jamais une vitesse des seules hausses. Cela ne ferait que déplacer l'erreur vers une autre cause.
- **Expérimental.** Les statistiques ont été vérifiées sur des séances simulées avec des erreurs connues introduites volontairement, mais l'outil a encore peu servi en conditions réelles. Considérez une correction de BC comme une forte indication à vérifier, pas comme une valeur définitive.

---

## 3. Préparer

### 3.1 Carabine, lieu et météo

L'outil utilise la carabine et la cartouche actives d'Arsenal ainsi que le lieu de tir actif. Il n'a pas de sélecteur de carabine propre.

Il garde ses propres données météo, et rien de ce que vous saisissez dans un autre outil ne les modifie. Entrez la **pression station**, c'est-à-dire ce qu'indique un baromètre sur le pas de tir. Un téléphone ou une application météo donne en général la pression ramenée au niveau de la mer (QNH), et cette valeur est fausse ici. Si le lieu a une altitude, l'outil vous avertit quand la pression ressemble à un QNH. Relevez la température sur le pas de tir à environ 3 °C près. L'humidité compte peu.

Vous confirmez les conditions avant de commencer. Elles restent ensuite fixées comme air de départ de la séance, de sorte qu'un changement de météo fait ailleurs plus tard ne peut pas modifier des tirs déjà effectués. Une correction de BC suppose que ces conditions étaient justes, car une température ou une pression fausse finit dans le terme de traînée. La page « Conclure » vous le rappelle.

Le zéro est supposé avoir été réglé à plat, sans vent et dans l'atmosphère de zéro de la cartouche si Arsenal en indique une. Sinon, c'est l'air de départ de la séance qui est utilisé. Si vous avez réglé le zéro un autre jour ou à une autre altitude, renseignez l'atmosphère de zéro dans Arsenal. Cela compte surtout pour les zéros à 200 m ou plus, et presque pas pour les zéros à 100 m ou moins.

### 3.2 Préparatifs

La liste reprend les points du §1.1 : zéro revérifié le jour même, valeur de clic testée, hauteur de visée mesurée, vitesse moyenne vérifiée. Elle montre aussi la dispersion de la carabine et l'écart-type de vitesse issus d'Arsenal, ou une valeur prédéfinie si Arsenal n'en a pas. Aucun point n'est obligatoire, mais chaque point non coché est une cause que la séance doit mesurer avec ses propres tirs.

Ne cochez un point que si vous l'avez vraiment fait. Les marges d'incertitude et la note considèrent chaque point coché comme fait. Pour le zéro et la vitesse moyenne, l'ajustement confronte en plus vos coches aux tirs, et la page « Conclure » signale quand les tirs en contredisent une. La valeur de clic ne peut pas être vérifiée par les tirs. Une coche fausse à cet endroit laisse en général l'erreur réelle hors de la marge annoncée.

### 3.3 Cibles et plan

L'outil vérifie si vos cibles enregistrées sont assez lointaines pour dire quelque chose de la traînée et trouve la meilleure paire cible proche / cible lointaine pour cette cartouche. Si elles ne vont pas assez loin, ou si rien n'est proche de la distance de zéro, il demande une fois si vous disposez d'un repère naturel que vous pouvez télémétrer, comme un rocher ou le bord d'une butte.

Vous indiquez aussi le vent attendu : faible à modéré, ou fort (la limite est d'environ 5 m/s, 11 mph, 18 km/h). Cela n'agit que sur le plan et le nombre de cartouches. Sur le pas de tir, vous réglez le vent réel pour chaque groupement.

La case « Ce terrain est plat » n'est jamais cochée à votre place. Un lieu ne peut pas distinguer un terrain plat d'un terrain dont personne n'a mesuré la pente. Ne la cochez que si vous le savez. Elle désactive les contrôles de pente pour cette séance et n'écrit d'angle nulle part. Si le terrain n'est en réalité pas plat, une pente ainsi écartée peut être prise pour une mauvaise distance ou une mauvaise traînée.

Si vous corrigez ici la distance ou l'angle d'une cible, la correction ne vaut que pour cette séance et le lieu n'est pas modifié. La séance a besoin de la distance jusqu'au pare-balles où vous voyez les impacts, qui peut différer de la distance jusqu'à la cible. Pour modifier le lieu lui-même, utilisez le gestionnaire de lieux.

### 3.4 Cartouches

Vous fixez le nombre total de cartouches, paliers de sécurité de l'échelle compris. Prévoyez 20–25 % de plus pour les tirs que l'observateur ne voit pas et pour les coups manifestement partis. Le plan met une cartouche à la distance la plus proche et répartit le reste entre une distance intermédiaire et la cible lointaine. La répartition est choisie pour séparer les causes autant qu'elles comptent à votre plus grande distance et pour atteindre la note A sur la traînée. Le plan montre comment les cartouches de chaque distance se répartissent en séries de trois au plus.

Sous le champ, l'outil propose quatre nombres de cartouches pour ce terrain et vos préparatifs, chacun avec la note qu'il donne :

- **Minimal** : le moins de cartouches possible pour rester à 10 % de l'incertitude optimale sur la traînée ;
- **Optimal** : le point où des cartouches supplémentaires commencent à apporter beaucoup moins ;
- **Renforcé** : dix de plus que l'optimal, pour un résultat nettement plus serré ;
- **Deluxe** : vingt de plus que l'optimal, pour le résultat le plus serré.

Appuyer sur l'un établit le plan pour ce nombre. Ce sont des minimums qui ne comptent que les tirs dont vous voyez l'impact ; prévoyez donc davantage. Chaque amélioration proposée par l'outil (un chronographe, plus de cartouches, un contrôle du zéro, une cible plus lointaine) est montrée avec le résultat qu'elle donnerait, à côté du résultat actuel.

### 3.5 Retélémétrer la cible lointaine

Avant de commencer, l'outil vous demande de mesurer à nouveau la cible lointaine. Télémétrez-la plusieurs fois et vérifiez que le faisceau n'accroche pas quelque chose devant la cible. Si le terrain n'est pas déclaré plat, mesurez aussi son angle à l'inclinomètre.

C'est la minute la plus importante de la séance. Le résultat dépend de la distance lointaine plus que de tout le reste, et les tirs ne peuvent guère la vérifier, car une cible plus éloignée que vous ne le pensez ressemble exactement à une balle au BC plus faible. Une distance lointaine fausse de 20 m laisse typiquement le résultat faux d'environ 0,3 mrad sur cette cible, soit environ 30 cm à 1 000 m, et l'outil ne peut pas le signaler.

Utilisez un pare-balles d'au moins 2 m de haut (1 m au-dessus et au-dessous du point visé). Avec 1 m, environ une séance sur trois perd un impact hors du pare-balles ; avec 2 m, seulement quelques-unes sur cent.

---

## 4. Tirer

### 4.1 L'échelle

L'outil commence près et s'éloigne d'un pas à la fois, seulement après que le pas précédent a atteint le pare-balles. Une hypothèse erronée dans l'application pourrait envoyer un premier tir lointain bien à côté d'un pare-balles éloigné, et l'échelle évite ce risque. Un pas va au plus jusqu'à quatre fois la plus grande distance où un groupement a déjà atteint le pare-balles. Un pas plus long n'est permis que s'il ne reste rien de plus proche et que la prédiction dit que le tir arrivera encore dans le pare-balles. Avant le tout premier tir, l'outil vous avertit si ce tir risque de manquer le pare-balles et propose la distance de zéro à la place. Vous pouvez quand même continuer.

Si vous ne voyez pas où une série est arrivée, appuyez sur le bouton prévu (« Je ne vois pas où c'est arrivé »). C'est un résultat normal, et une information utile. L'outil recule à mi-chemin environ et, dès qu'un groupement y a atteint le pare-balles, retente la distance manquée avec l'élévation corrigée. Tant qu'il reste des distances non essayées en deçà, une distance de nouveau manquée reste en jeu (jusqu'à cinq tirs manqués à cet endroit). Si rien de plus proche ne peut être tiré, un groupement supplémentaire à une distance déjà atteinte débloque la nouvelle tentative. Un tir manqué si loin que seul un BC grossièrement faux peut l'expliquer amène l'échelle à admettre une erreur de cette taille en chemin vers la cible lointaine. À 800 m sur un pare-balles de 2 m, le BC d'une .308 devrait être faux d'environ 20 %. Les tirs manqués plus proches sont attribués à d'autres causes. Si les tirs manqués se répètent, vérifiez d'abord que le BC et le modèle de traînée de la cartouche correspondent à leur source publiée, puis le zéro, la vitesse initiale et la pression saisie.

Si la prochaine distance prévue est plus de quatre fois plus loin que la plus lointaine déjà atteinte, ou si le pare-balles est trop petit pour elle, l'outil dit lequel des deux. C'est seulement alors qu'il demande une distance intermédiaire ; un repère naturel convient, et vous pouvez répondre « Aucune disponible ». Sur un lieu sans terrain intermédiaire, l'échelle peut s'arrêter avant la cible lointaine, et la page « Préparer » vous en avertit à l'avance.

### 4.2 Chaque série

Vous tirez des séries de trois cartouches au plus et enregistrez après chacune, car personne ne lit de façon fiable le centre d'une douzaine d'impacts à 800 m. Le premier passage visite chaque distance prévue une fois, la plus proche d'abord. Ensuite, chaque série va à la distance où il reste le plus de cartouches (la plus lointaine en cas d'égalité), et chacune est réglée d'après l'ajustement le plus récent. Vous ne pouvez pas choisir l'ordre.

Avant chaque série, l'outil montre ce qu'il faut afficher, en hausse et en dérive, dans l'unité et avec les signes de direction choisis pour le Calculateur de terrain, avec une marge à 95 %. Tant que rien n'est enregistré, c'est la prédiction de l'application elle-même ; ensuite, elle vient de l'ajustement. Affichez-la en entier. Puis enregistrez la **hausse qui mettrait les impacts sur le point visé** : ce que vous avez affiché, corrigé de la position des impacts dans le réticule. Saisissez la hausse complète, pas seulement l'écart par rapport au chiffre de l'outil. Les hausses se saisissent en clics de lunette (positif vers le haut). Toutes les autres distances, vitesses et angles suivent vos unités des Réglages, et l'affichage indique aussi les clics quand le Calculateur de terrain est en mrad ou en MOA.

Vous pouvez enregistrer une série par son centre (une seule hausse) ou coup par coup (une hausse par coup et, avec un chronographe, sa vitesse). Si le chronographe a donné moins de vitesses qu'il y a eu de coups, l'outil demande s'il faut les compléter ou continuer. L'outil n'écarte pas les coups partis : si un coup est manifestement parti (une mauvaise lâchée, une rafale, un départ raté), ne l'enregistrez pas et tirez-en un autre à la place. C'est à cela que servent les 20–25 % supplémentaires. Une valeur qui ne peut raisonnablement pas être juste reçoit un avertissement à côté du champ : des mrad saisis à la place des clics, l'écart au lieu de la hausse complète, un signe inversé, un chiffre manquant, une vitesse dans la mauvaise unité. L'avertissement n'est qu'un conseil, et la valeur est enregistrée telle que saisie.

Pour chaque série, vous indiquez aussi avec quelle certitude vous avez pu lire les impacts dans le réticule :

- **Bonne** (±0,1 mrad, par défaut) : impacts nets, lus contre le réticule.
- **Moyenne** (±0,2 mrad) : mirage, pare-balles chargé, ou impacts à moitié vus.
- **Médiocre** (±0,3 mrad) : une idée approximative de l'endroit où ils sont arrivés.

Soyez honnête. Un « Médiocre » honnête aide plus l'ajustement qu'une estimation trop assurée.

### 4.3 Vent et air

Chaque groupement a son propre vent, réglé sur le cadran de vent. Il part du vent du groupement précédent (calme pour le premier). L'affichage pour le tir suivant suit le cadran pendant que vous le tournez. **Avant d'enregistrer un groupement, réglez le vent (force et direction) qui correspond à la dérive réellement observée.** L'outil prédit la dérive à partir du vent réglé, mais n'apprend rien de la position latérale des impacts.

Avec le vent, vous indiquez la qualité de votre lecture : Excellente (±0,5 m/s), Bonne (±1), Moyenne (±2) ou Faible (±3). L'outil considère toujours la direction comme incertaine de 7,5°. Le vent et sa certitude passent au groupement suivant tant que vous ne les changez pas.

Si l'air change pendant la séance, cochez qu'il a changé et entrez ce qu'indique votre station météo de poche. Les groupements suivants gardent les nouvelles valeurs jusqu'au prochain changement. Les mesures de chronographe de chaque groupement sont comparées à la vitesse qu'a la cartouche dans l'air de ce groupement.

### 4.4 Retélémétrer pendant la séance

Si l'outil soupçonne que la distance ou l'angle d'une cible est faux, il vous demande de la retélémétrer et, sauf si le terrain est plat, de mesurer son angle. Une distance fausse et une pente non mesurée se ressemblent dans les tirs ; seul l'angle les départage. L'outil le demande dès qu'il y a environ une chance sur cinq que quelque chose cloche, car retélémétrer prend quelques secondes, et une cible mal télémétrée est l'erreur que les tirs distinguent le moins bien d'une traînée fausse.

Avant votre première série sur la cible lointaine prévue, il demande toujours ce contrôle. Vous pouvez aussi le faire vous-même à tout moment avec « Remesurer », à côté de la distance et de l'angle de la cible actuelle. « Confirmer » corrige chaque série déjà tirée sur cette cible ainsi que le réglage pour la suivante. « Annuler » laisse tout en l'état.

### 4.5 L'aperçu en direct

Après chaque groupement, l'outil montre ce qu'il a appris jusqu'ici. C'est provisoire, et un groupement ultérieur peut le modifier ; c'est pourquoi l'aperçu est présenté autrement que le rapport final. Tant qu'aucune mesure de chronographe ni aucun tir bien placé ne les sépare, il affiche « vitesse initiale, traînée — pas encore séparables, jusqu'ici » plutôt que de deviner.

---

## 5. Conclure

Le résultat est une liste classée de constats, pas un verdict unique. Chaque constat indique avec quelle probabilité il compte à votre plus grande distance d'utilisation et quelle est sa taille, avec sa marge. Quand deux causes ne peuvent pas être séparées, elles sont rapportées ensemble.

- **Traînée (BC).** À la note A ou B, avec au moins cinq mesures de chronographe de la séance, l'outil propose d'enregistrer la correction dans votre cartouche (le §2.3 dit jusqu'où se fier à un B). Vous voyez les valeurs avant et après la modification avant de confirmer. Un résultat à plus d'environ 12 % du BC utilisé, ou un facteur de gain hors de 0,8–1,2, n'est jamais proposé. L'outil vous demande alors de vérifier le BC et le modèle de traînée et affiche le BC ajusté pour information.
- **Zéro.** Une correction de zéro n'est rapportée que si elle compte très probablement. Si elle ne compte que peut-être, vous voyez « possible, mais pas encore net » ; ne changez pas votre zéro sur cette seule base.
- **Hausses pour les distances tirées.** Quand aucune correction de BC n'est proposée, vous obtenez la modification à afficher à chaque distance tirée, mais seulement quand elle dépasse sa propre incertitude. Une correction plus petite n'est que le bruit de quelques groupements, et l'appliquer peut vous laisser en plus mauvaise posture qu'avant.
- **Vitesse initiale.** Dès que le chronographe a donné sa première mesure, les mesures de la séance priment sur la moyenne vérifiée auparavant. Cette moyenne a été mesurée un autre jour, peut-être par un autre temps ou avec un autre lot. Si la vitesse mesurée diffère de celle de la cartouche, la liste indique combien de cartouches passer au chronographe pour fixer la moyenne à environ ±2 m/s.
- **Non déterminé.** Une cause que la séance n'a pas pu mesurer est listée comme « non déterminé par cette séance », jamais comme conforme. La valeur de clic en est l'exemple habituel : seul un test tall-target ou à la règle la tranche.

La liste rappelle aussi les préparatifs que vous avez cochés, pour rappeler que les marges supposent que chacun a vraiment été fait.

« Commencer une nouvelle séance » efface la séance et conserve vos choix de valeurs prédéfinies.

### 5.1 Un résultat invraisemblable

Une correction de traînée de plusieurs dizaines de pour cent, ou une vitesse fausse de centaines de mètres par seconde, n'est pas un constat subtil. Elle signifie que quelque chose de plus fondamental cloche, le plus souvent un BC invraisemblable sur la balle ou le mauvais modèle de traînée (G1 saisi pour un BC mesuré en G7, ou l'inverse). Vérifiez le BC et le modèle de la cartouche contre la source publiée avant de vous fier à quoi que ce soit d'autre dans la séance. Une séance qui a manqué le pare-balles à plusieurs distances pointe vers le même problème.

---

## 6. Le facteur de gain BC

Une correction de traînée calibrée est enregistrée dans la **cartouche** comme « facteur de gain BC », 1,00 par défaut. Un facteur de 1,05 signifie que la balle se comporte comme si son BC publié était 5 % plus élevé (moins de traînée, trajectoire plus tendue) ; 0,95 signifie l'inverse. Il appartient à la cartouche et non à la balle, parce que la même balle tirée par une autre carabine à une autre vitesse a une traînée légèrement différente. Les données publiées de la balle ne sont pas modifiées.

Une fois enregistré, chaque outil de l'application (Trajectoire, Calculateur de terrain, Probabilité de toucher et celui-ci) utilise la valeur corrigée. Calibrer une cartouche une seconde fois multiplie la nouvelle correction par la première au lieu de la remplacer, et la seconde séance part de la même hypothèse de 4 % que la première.

---

## 7. Confidentialité

Tout fonctionne et reste sur votre appareil, comme le reste de l'application : pas de compte, pas d'envoi, pas de télémétrie. La séance est conservée dans le stockage local de votre navigateur. L'outil n'écrit ailleurs que si vous le choisissez : un facteur de gain BC ou un nouvel écart-type de vitesse dans votre propre cartouche. Une distance ou un angle corrigé pendant une séance n'est jamais écrit dans le lieu.

---

## 8. Le régal du geek : le modèle, les statistiques et les garde-fous

Cette section décrit ce que l'outil calcule, pourquoi il le calcule ainsi et d'où viennent les chiffres. Vous n'en avez pas besoin pour utiliser l'outil. Les unités sont celles du moteur : mètres, mètres par seconde, milliradians. Les exemples chiffrés portent sur une .308 de référence : BC G7 0,2623, 792 m/s, hauteur de visée 50 mm, zéro à 100 m, air OACI au niveau de la mer. Avec ce chargement, la balle passe sous Mach 1,1 vers 870 m.

### 8.1 La grandeur observée et le modèle

La seule chose que l'outil mesure sur la cible est la **hausse** : l'élévation, en mrad, qui place le centre d'une série sur le point visé. La dérive est prédite à partir du vent réglé et vous est affichée, mais elle n'entre pas dans l'ajustement. Un écart latéral porte toute l'erreur de lecture du vent, bien plus grande que tout ce qu'il pourrait révéler sur les quatre causes ci-dessous.

Une hausse à la distance supposée $R$ sur la cible $t$ est modélisée par

$$c(R) = c_\text{app}\big(R + \Delta R_t;\; v_0 + \delta v,\; G\,/\,(1 + \delta d/100),\; \alpha_t\big) \;+\; z \;+\; \tfrac{\tau}{100}\,c_\text{app}(R) \;+\; \varepsilon$$

où $c_\text{app}$ est la solution de trajectoire de l'application elle-même (le même intégrateur que tous les autres outils) dans l'air et le vent de ce groupement. Les termes sont :

| Symbole | Nom dans le moteur | Ce que c'est | Intervient comme |
|---|---|---|---|
| $z$ | `zeroMrad` | décalage du zéro | constante ajoutée à toute distance |
| $\delta v$ | `v0Ms` | erreur de vitesse initiale, m/s | ajoutée à $v_0$ dans la physique |
| $\delta d$ | `dragPct` | facteur de traînée, % | divise le facteur de gain BC $G$ dans la physique |
| $\tau$ | `trackPct` | erreur de valeur de clic, % | proportionnelle à la hausse |
| $\Delta R_t$ | `rangeErrM_t` | erreur de distance de la cible $t$, m | par cible, seulement dans le contrôle des bévues (§8.9) |
| $u_t$ | `losU_t` | pente non saisie de la cible $t$, $u = 1-\cos\alpha$ | par cible, seulement dans le contrôle des bévues |
| $\varepsilon$ | | bruit de la série | gaussien, $\sigma$ selon le §8.4 |

$\delta d > 0$ signifie plus de traînée que ne le prédit le BC utilisé. L'enregistrement multiplie le facteur de gain de la cartouche par $1/(1+\delta d/100)$, de sorte qu'un second calibrage se cumule au premier. Le facteur de traînée passe par le facteur de gain et non par `bc` lui-même, car 247 des 385 balles de la bibliothèque sont des tables Cd-Mach et n'ont pas de `bc` à mettre à l'échelle.

$\delta v$ et $\delta d$ sont non linéaires et appliqués à l'intérieur de la trajectoire. $z$ et $\tau$ sont ajoutés ensuite. La hauteur de visée, la densité de l'air et le vent ne sont pas ajustés. Ce sont des données d'entrée, et une erreur sur l'une d'elles se retrouve dans les quatre causes, comme le montre le §8.2.

Le zéro est un angle de canon unique pour toute la séance. Il est résolu une fois, à plat et sans vent, dans l'atmosphère de zéro de la cartouche, avec les $\delta v$ et $\delta d$ ajustés, de sorte qu'un changement de l'un ou l'autre déplace le zéro exactement comme sur l'arme. Le vent, la pente et l'air d'un groupement apparaissent alors dans sa hausse, sans déplacer le zéro.

### 8.2 Pourquoi les causes sont si difficiles à distinguer

L'ajustement est linéarisé autour de l'estimation courante. L'influence de chaque cause sur une hausse est une colonne de la jacobienne : la variation de la hausse par unité de cette cause à chaque distance. Pour la .308 de référence :

| Distance | hausse | par m/s de $v_0$ | par % de traînée | par % de clic | par m de distance | par m/s de vent (toute direction) |
|---|---|---|---|---|---|---|
| 200 m | 0,66 | −0,0024 | 0,0014 | 0,0066 | 0,0084 | 0,0003 |
| 300 m | 1,58 | −0,0050 | 0,0041 | 0,0158 | 0,0101 | 0,0007 |
| 400 m | 2,66 | −0,0081 | 0,0084 | 0,0266 | 0,0116 | 0,0015 |
| 500 m | 3,89 | −0,0116 | 0,0150 | 0,0389 | 0,0132 | 0,0028 |
| 600 m | 5,29 | −0,0157 | 0,0244 | 0,0529 | 0,0150 | 0,0048 |
| 700 m | 6,88 | −0,0205 | 0,0377 | 0,0687 | 0,0171 | 0,0076 |
| 800 m | 8,69 | −0,0262 | 0,0562 | 0,0869 | 0,0196 | 0,0116 |
| 900 m | 10,78 | −0,0331 | 0,0816 | 0,1078 | 0,0226 | 0,0174 |

(tout en mrad ; la colonne du zéro vaut 1 partout)

Deux colonnes ne se distinguent que dans la mesure où leurs **formes** diffèrent sur les distances tirées. Leur taille n'a pas d'importance, puisqu'un paramètre peut toujours se mettre à l'échelle. Le cosinus entre deux colonnes mesure cela : ±1 signifie qu'elles sont identiques à un facteur près. Sur 300, 600 et 800 m :

- vitesse contre traînée : **−0,987** ;
- valeur de clic contre traînée : **0,987** ;
- valeur de clic contre vitesse : **−0,99993** ;
- zéro contre traînée : 0,80.

La valeur de clic et la vitesse sont presque parfaitement colinéaires. Une erreur de clic de 1 % et une erreur de vitesse donnant la même hausse sont pratiquement la même courbe. C'est pourquoi la séance rapporte la valeur de clic comme « non déterminée » et la laisse à un test tall-target. L'a priori de 0,15 % après un tel test l'empêche d'absorber ce que la vitesse et la traînée n'expliquent pas.

Vitesse et traînée diffèrent peu, et d'une façon connue : la colonne de la traînée croît plus vite avec la distance que celle de la vitesse, car la traînée agit pendant tout le temps de vol alors qu'une erreur de vitesse agit surtout par le départ. L'erreur de vitesse qui imite 1 % de traînée vaut 0,6 m/s à 200 m, 1,0 m/s à 400 m, 1,6 m/s à 600 m et 2,1 m/s à 800 m. Seul ce rapport changeant sépare les deux, et il est faible. C'est pourquoi un plan a besoin d'une cible lointaine, pourquoi plus de cartouches à une seule distance n'aident pas, et pourquoi un chronographe, qui fixe $\delta v$ directement, est le levier le plus fort.

Le zéro est une constante ; une cible proche à la distance de zéro, où toutes les autres colonnes sont nulles, le mesure donc presque seule. C'est pourquoi le plan comprend toujours une cartouche près de la distance de zéro.

Chaque donnée que vous fournissez se retrouve aussi dans ces quatre causes. Exprimée comme la variation de traînée qui produirait la même hausse à cette distance :

| Erreur de saisie | à 300 m | à 600 m | à 800 m |
|---|---|---|---|
| vitesse +10 m/s | −12,2 % | −6,3 % | −4,6 % |
| valeur de clic 2 % | 7,7 % | 4,3 % | 3,1 % |
| zéro 0,1 mrad | 24,5 % | 4,1 % | 1,8 % |
| hauteur de visée +3 mm | −4,9 % | −1,0 % | −0,5 % |
| distance +20 m | 49,9 % | 12,4 % | 7,0 % |
| pente de 10° non saisie | −9,8 % | −3,7 % | −2,4 % |
| température +3 °C | −0,9 % | −0,9 % | −0,9 % |
| pression +10 hPa | 1,0 % | 1,0 % | 1,0 % |

Les deux dernières lignes sont constantes pour une raison précise. La force de traînée est proportionnelle à la densité de l'air ; une erreur de 1 % sur la densité est donc *exactement* une erreur de 1 % sur la traînée à toute distance (à un petit effet près via la vitesse du son). La séance ne peut pas du tout détecter une température ou une pression fausse, et la transmet directement au BC. C'est pourquoi l'outil insiste sur la pression station et met en garde contre le QNH (§8.12), et pourquoi la page « Conclure » rappelle que la correction de BC suppose l'air que vous avez saisi.

La ligne de distance explique le §3.5. À 800 m, 20 m d'erreur de distance valent 7 % de traînée, plus que tout l'a priori. Seule une seconde cible proche pourrait le remarquer, et même alors pas de façon fiable.

### 8.3 Les a priori

L'ajustement est bayésien : chaque cause part d'un a priori normal de moyenne nulle, et les tirs le resserrent.

| Cause | Non vérifiée | Après préparatifs |
|---|---|---|
| zéro | 0,25 mrad | 0,08 mrad (zéro revérifié) |
| vitesse | 20 m/s | $t_{N-1}\cdot \text{SD}/\sqrt{10}$ (moyenne vérifiée) |
| traînée | 4,1 % | 4,1 % |
| valeur de clic | 1 % | 0,15 % (test tall-target) |

**Traînée.** Deux parts indépendantes s'ajoutent quadratiquement. Les BC G7 publiés s'écartent du BC qui reproduit le mieux la courbe de traînée de référence de chaque balle de 3,6 % RMS (56 balles de trois fabricants). La même balle, mesurée de la même façon, varie d'environ 1,9 % d'un canon à l'autre. $\sqrt{3.6^2+1.9^2}\approx 4.1\,\%$. On utilise le RMS et non l'écart-type, afin que le décalage moyen de chaque fabricant compte comme dispersion au lieu d'être présenté comme un biais connu. L'échantillon est trop petit pour dire quoi que ce soit de la forme de la distribution. Un mélange de BC « typiques » et « aberrants » ajusté dessus donnait des marges trop confiantes dès que les vraies erreurs étaient normales ; l'a priori est donc une seule loi normale dont la largeur vient des données. Avec la bonne variance et un modèle presque linéaire, un a priori normal garde les marges annoncées honnêtes quelle que soit la vraie forme. Une cartouche déjà calibrée part du même a priori, car un facteur de gain est une correction et non une mesure plus fiable que le chiffre publié.

**Vitesse.** Une moyenne vérifiée est prise comme dix cartouches à l'écart-type enregistré de la cartouche. L'écart-type enregistré est lui-même une estimation ; l'erreur type est donc élargie par le facteur de Student $t_{0.975,N-1}/z_{0.975}$, où $N$ est le nombre de tirs derrière l'écart-type : vous le saisissez, ou 10 est supposé pour un écart-type stocké dans Arsenal. Le facteur vaut 1,15 pour $N=10$ et 1,42 pour $N=5$. Un écart-type prédéfini n'est pas élargi, car son incertitude porte sur la question de savoir s'il s'applique seulement à votre carabine, ce que les statistiques de petits échantillons ne couvrent pas. Pour un écart-type de 6 m/s et $N=10$, l'a priori vaut 2,2 m/s.

**Valeur de clic.** Une valeur de clic testée est quand même ajustée avec son a priori de 0,15 %, mais elle n'est pas rapportée. La laisser hors de l'ajustement ferait passer toute erreur de suivi résiduelle dans la traînée : dans une simulation Monte-Carlo de séances complètes, la marge à 95 % de la traînée manquait alors la vérité environ un tiers de point de pourcentage plus souvent. Avec la valeur de clic ajustée, la marge la manquait dans 5,0 % des cas.

### 8.4 Le bruit

Le $\sigma$ vertical d'un coup a trois parts indépendantes :

$$\sigma_\text{round}^2 = \left(\frac{R_{50}}{1.1774}\right)^2 + \left(\frac{\partial c}{\partial v_0}\,\text{SD}_v\right)^2 + \sigma_\text{read}^2$$

la dispersion de la carabine (R50 converti en $\sigma$ par axe), l'écart-type de vitesse d'un coup à l'autre multiplié par la sensibilité de la hausse à la vitesse à cette distance, et la lecture. La part de vitesse est nulle à la distance de zéro et vaut 0,16 mrad à 800 m avec un écart-type de 6 m/s, proche du σ par axe d'une carabine qui tire R50 = 0,25 mrad (0,21 mrad). Les niveaux de certitude de lecture sont des demi-largeurs à 95 %, donc $\sigma_\text{read}$ vaut 0,05, 0,1 ou 0,15 mrad.

Une série de $n$ coups lit leur moyenne. Son erreur de vent s'ajoute :

$$\sigma_\text{string}^2 = \frac{\sigma_\text{round}^2}{n} + \sigma_\text{wind}^2, \qquad \sigma_\text{wind}^2 = \left(\frac{\partial c}{\partial w}\,\sigma_w\right)^2 + \left(\frac{\partial c}{\partial \phi}\,\sigma_\phi\right)^2$$

avec $\sigma_w$ la certitude de vent indiquée (0,5, 1, 2 ou 3 m/s), $\sigma_\phi = 7.5°$, et les deux dérivées prises par différences finies autour du vent réglé. Sous 0,5 m/s, une direction ne veut rien dire ; la sensibilité est alors le RMS des sensibilités au vent de face et au vent de travers, appliqué à toute l'erreur de force. L'erreur de vent appartient à la série : elle ne diminue pas avec ses coups, et les erreurs des séries sont indépendantes. Il n'y a pas d'inconnue de vent commune dans l'ajustement. Le vent est une nuisance, pas une cause.

Les séries sont limitées à trois coups, car un observateur lit le centre d'un plus grand nombre d'impacts à distance bien moins bien que ne le promet $1/\sqrt n$. Les séries d'une distance se lisent ensemble comme une seule série de tous ses coups, sauf que le terme de vent diminue avec le nombre de séries. Le planificateur répartit donc les cartouches par distance, et les séries ne décident que de la façon de les tirer.

Avant toute lecture de vent, le plan utilise la force attendue : modéré vaut 3 ± 1 m/s, fort vaut 7 ± 2 m/s, direction inconnue. Alors $\sigma_\text{wind} = W_\text{rms}\sqrt{\sigma_w^2 + (w\,\sigma_\phi)^2}$, avec $W_\text{rms}$ la colonne toutes directions du §8.2.

**L'écart-type de vitesse lui-même.** L'écart-type utilisé dans ces poids n'est pas simplement celui enregistré. À partir de la deuxième mesure de chronographe, il est combiné à l'écart-type du jour selon les degrés de liberté :

$$\hat\sigma_v^2 = \frac{(N_0-1)\,\text{SD}_0^2 + (n-1)\,s^2}{N_0+n-2}$$

$N_0$ est le nombre de tirs indiqué, ou 5 s'il n'est pas indiqué. La valeur combinée compte pour $N_0+n-1$ tirs. Chaque mesure est d'abord comparée à la vitesse de la cartouche dans l'air de son groupement, et le décalage moyen est retiré, de sorte qu'un changement de météo ou une moyenne fausse ne compte pas comme dispersion. Les séries déjà enregistrées sont repondérées à chaque nouvelle valeur. Au-delà de dix mesures, un test F bilatéral à 5 % ($s^2/\text{SD}_0^2$ contre $F_{n-1,\,N_0-1}$) décide si l'écart-type du jour diffère vraiment. Si c'est le cas, l'outil le signale et propose de mettre à jour la cartouche. Le test F ne pilote que ce signalement. La combinaison s'applique de toute façon et ne change rien quand l'écart-type enregistré est juste.

### 8.5 Le chronographe

Les mesures de chaque groupement forment une observation directe de $\delta v$. Le résidu est (mesure moyenne − vitesse de la cartouche dans l'air de ce groupement), et son $\sigma$ vaut $t_{0.975,N-1}/z\cdot\hat\sigma_v/\sqrt n$, la même forme que l'a priori de vitesse. Un tir que l'appareil a manqué est simplement une mesure de moins.

Dès la première mesure, les mesures de la séance remplacent la moyenne vérifiée comme information sur la vitesse. La moyenne a été mesurée à une autre occasion et peut être fausse pour une poudre sensible à la température ou un autre lot. Les mesures portent leur propre incertitude, large pour une ou deux mesures. Des seuils d'une à cinq mesures ont été comparés, avec un chronographe manquant la plupart des tirs. Une seule mesure laissait l'erreur la plus faible chaque fois que la moyenne vérifiée était fausse, et coûtait au plus un millième de mrad quand elle était juste. La même information n'est jamais comptée deux fois, comme a priori resserré et comme observation à la fois.

### 8.6 L'ajustement

L'estimation est le point du maximum a posteriori (MAP) de

$$-\log p(\theta\mid y) = \tfrac12\sum_k \frac{r_k(\theta)^2}{\sigma_k^2} + \tfrac12\sum_i\frac{\theta_i^2}{\sigma_{0,i}^2} + \text{const}$$

trouvé par Gauss-Newton. Chaque itération relinéarise la physique au $\theta$ courant, construit $A = P_0 + J^\top W J$ et $b = J^\top W r - P_0\theta$, et avance de $A^{-1}b$. Elle s'arrête quand chaque pas est inférieur à 1 % de l'écart-type a priori de la cause, ou après cinq itérations. La covariance $\Sigma = A^{-1}$ provient d'une dernière linéarisation à la solution, qui fournit aussi sans coût supplémentaire un pas de Newton de plus. L'appliquer rend la réponse précise bien au-delà de la tolérance d'arrêt, que l'itération ait démarré à froid ou à chaud.

Après chaque groupement, la solution de l'analyse précédente sert de point de départ (démarrage à chaud). Elle dispose de deux itérations. Si elle n'a pas convergé d'ici là, l'ajustement repart de zéro, de sorte que la réponse ne dépend jamais du point de départ.

Le résidu d'une ligne de chronographe ou de retélémétrage est relinéarisé comme les autres : $r = (\bar v - v_\text{expected}) - \delta v_\text{current}$. Utiliser le résidu brut à chaque itération ajouterait la même correction à chaque passage. Quand le chronographe s'écarte fortement de la valeur enregistrée, comme pour deux séances de la même carabine à environ 20 °C d'écart, cela diverge jusqu'à plusieurs fois la bonne valeur.

La colonne de traînée est une différence centrée sur ±1 %. La hausse est courbe en fonction du facteur de traînée ; un pas unilatéral de +5 % lirait donc à 800 m une pente 2,7 % plus raide que la pente locale, et l'ajustement annoncerait la traînée plus serrée qu'il ne la connaît : dans une simulation Monte-Carlo de séances complètes, sa marge à 95 % manquait la vérité dans 5,7 % des cas avec le pas unilatéral, contre 5,2 % avec le pas centré.

### 8.7 Ce qu'une séance peut résoudre

Résultats du planificateur pour la .308 de référence (R50 0,25 mrad, écart-type de vitesse 6 m/s, vent modéré). Les chiffres sont l'écart-type a posteriori du facteur de traînée, avec la note :

| Terrain | Préparatifs | Chronographe | 12 cartouches | 20 cartouches | 30 cartouches | 40 cartouches |
|---|---|---|---|---|---|---|
| 100/300/600 m | aucun | non | 3,88 C | 3,85 C | 3,83 C | 3,82 C |
| 100/300/600 m | aucun | oui | 3,43 C | 3,22 C | 3,01 C | 2,85 B |
| 100/300/600 m | tous | oui | 3,01 C | 2,81 B | 2,62 B | 2,46 B |
| 100/300/500/800 m | aucun | non | 3,68 C | 3,66 C | 3,64 C | 3,63 C |
| 100/300/500/800 m | zéro + clics | non | 3,65 C | 3,48 C | 3,37 C | 3,29 C |
| 100/300/500/800 m | aucun | oui | 2,49 B | 2,18 B | 1,98 A | 1,86 A |
| 100/300/500/800 m | tous, moyenne vérifiée | non | 1,95 A | 1,77 A | 1,60 A | 1,49 A |
| 100/300/500/800 m | tous | oui | 1,93 A | 1,70 A | 1,49 A | 1,35 A |

Ce que montre le tableau :

- **Sans chronographe ni moyenne vérifiée, rien ne fonctionne.** Avec un a priori de vitesse de 20 m/s, la corrélation vitesse–traînée reste à 0,7–0,9, et 40 cartouches ne font pas mieux que 12. La traînée bouge à peine de son a priori de 4,1 %.
- **La distance l'emporte sur le nombre de cartouches.** Avec tous les préparatifs et un chronographe, 40 cartouches jusqu'à 600 m donnent 2,5 %. Douze cartouches jusqu'à 800 m donnent 1,93 %. Pour cette .308 à 600 m, la colonne de traînée ressemble encore trop à celle de la vitesse.
- **La ligne « moyenne vérifiée, sans chronographe » est notée A sur le papier**, et l'outil ne propose pourtant pas de correction de BC. Le plan prend la moyenne avec son incertitude annoncée, mais cette moyenne vient d'un autre jour. Une dérive en température fausse, un autre lot ou un chronographe fatigué la déplacent, et à 800 m chaque m/s passe directement dans la traînée à raison de 0,5 %. Rien dans la séance ne peut voir un tel déplacement. Les cinq mesures du chronographe sont la seule information mesurée dans le même air et à la même température de poudre que les tirs.

Deux autres chiffres de la page « Préparer » viennent du même a posteriori. La **distance lointaine requise** est la cible lointaine la plus proche à laquelle un groupement proche et un groupement lointain atteignent un écart-type de traînée donné. Le **seuil d'invalidité** est la distance lointaine en deçà de laquelle même une lecture aussi bonne qu'un clic (σ = 0,1/√12 mrad), avec un nombre quelconque de cartouches, ne peut pas amener la traînée sous 4 %. Sous ce seuil, aucun plan n'échappe à la note D, et la page le dit.

### 8.8 Le planificateur

Pour un dispositif (un ensemble de distances et les cartouches à chacune), l'a posteriori est celui du modèle linéarisé au BC utilisé :

$$\Sigma^{-1} = P_0 + \sum_g \frac{J_g J_g^\top}{\sigma_g^2}$$

Le planificateur minimise

$$\sum_i \min\!\left(\frac{\Sigma_{ii}}{s_i^2},\; 4.5\right)$$

où $s_i$ est la taille à partir de laquelle la cause $i$ compte. Pour le zéro, la vitesse et la valeur de clic, c'est la taille qui déplace la hausse de 0,1 mrad à la plus grande distance utilisable. Pour la traînée, c'est 2 %, la limite de la note A. Chaque terme est la variance a posteriori d'une cause une fois les autres prises en compte ; un dispositif qui laisse deux causes confondues obtient donc un mauvais score sur les deux. Le plafond de 4,5 (environ deux fois la taille significative) signifie qu'une cause qui reste indéterminée ne gagne rien à de petites améliorations : les cartouches vont là où elles peuvent changer un verdict. Une cause fixée par les préparatifs a un a priori serré et peu à gagner, ce qui libère des cartouches pour les autres. Faire ses préparatifs ne peut jamais dégrader un plan.

Jusqu'à trois groupements, la variance de chaque cause a une forme fermée. Avec $q_i$ les variances a priori, $u_i$ la colonne de la cause $i$ sur les distances du dispositif, $G_{gh}=\sum_i q_i u_{g,i}u_{h,i}$ et $M = G + \operatorname{diag}(\sigma_g^2)$ :

$$\Sigma_{ii} = q_i - q_i^2\, u_i^\top M^{-1} u_i$$

Il suffit d'une inverse 3×3 ; chaque répartition des cartouches est donc énumérée. Les dispositifs à plus de groupements (paliers de l'échelle) sont répartis de façon gloutonne, puis améliorés par échanges deux à deux. Seul le gagnant reçoit l'a posteriori exact. Les paliers dont un dispositif a besoin sont trouvés en parcourant l'échelle elle-même, avec l'a posteriori après chaque pas. Les candidats sont limités à douze : la plus proche, la plus lointaine et les dix plus proches du point de Mach 1,1. Quand le lieu offre quelque chose au-delà de 300 m, le plan doit l'atteindre. Sans cette règle, sans chronographe et sans zéro vérifié, un plan qui tire toutes les cartouches à la distance de zéro pourrait obtenir un aussi bon score qu'un plan qui apprend peu à la cible lointaine, et il ne calibrerait rien.

Les paliers de l'échelle reçoivent une cartouche chacun : ce sont des contrôles de sécurité, pas des mesures, et trois cartouches par palier n'apportaient rien en simulation. Les quatre nombres de cartouches proposés viennent de l'écart-type de traînée planifié sur une grille de budgets de 6 à 60 cartouches. La courbe est d'abord rendue non croissante, puisqu'un budget plus grand peut toujours être dépensé comme un plus petit et qu'un creux est un artefact du planificateur. Avec les deux axes ramenés à 0–1, le nombre optimal est le point le plus éloigné sous la droite allant du premier budget au dernier : le coude, typiquement 16–32 cartouches (18–24 avec un chronographe sur un terrain riche en cibles). Le nombre minimal est le plus petit dont l'écart-type de traînée reste à 10 % de celui de l'optimal. Renforcé et Deluxe ajoutent 10 et 20 cartouches. Quand passer de 6 à 60 cartouches améliore l'écart-type de traînée de moins de 10 %, la page dit que ce sont les préparatifs et les distances qui limitent, pas le nombre de cartouches.

Le vent de planification et les mesures de chronographe prévues entrent exactement comme elles entreront dans l'ajustement ; la prévision de la page « Préparer » et le résultat final s'accordent donc sur ce que vaut chaque élément.

### 8.9 Cibles mal télémétrées et en pente

Une erreur de distance et une pente oubliée sont les deux erreurs de terrain que les tirs distinguent le moins bien d'une traînée fausse. Chaque cible reçoit donc un choix à trois issues, comparées par leur évidence :

| Issue | Termes supplémentaires | Poids a priori |
|---|---|---|
| correcte | $\Delta R_t \sim N(0,\;0.002R)$ | 0,9 |
| mal télémétrée | $\Delta R_t \sim N(0,\;20\text{ m})$ | 0,05 |
| en pente | $\Delta R_t \sim N(0,\;0.002R)$, $u_t \sim N(0,\;u(20°))$ | 0,05 |

Quand l'issue « en pente » n'est pas proposée (voir plus bas), « mal télémétrée » prend la totalité des 0,1.

Le σ de 0,2 % de « correcte » est la précision d'une lecture laser une fois l'affichage arrondi au mètre. Après retélémétrage de la cible, les poids deviennent 0,98 / 0,01 / 0,01 (ou 0,98 / 0,02). Une cible erronée est alors bien moins probable, mais pas exclue : plusieurs lectures sur le même objet mal identifié concordent quand même. La seconde lecture entre comme observation de $\Delta R_t$ avec le σ de « correcte ». Le partage égal entre les deux modes d'erreur est une convention, pas une mesure. Rien ne permet de classer une bévue de télémètre au-dessus d'une pente non saisie.

**La pente est paramétrée par u, pas en degrés :** $u = 1-\cos\alpha$. Une pente vous fait toujours afficher moins qu'à plat, en montée comme en descente, et l'effet croît comme $1-\cos\alpha$, quadratiquement près de zéro. Une colonne en degrés est exactement nulle en $\alpha=0$, et un ajustement linéarisé ne peut pas démarrer à partir d'elle. Mesurée sur la .308 à 600 m, la pente numérique près de zéro valait $+4.1\times10^{-4}$, $-2.8\times10^{-5}$ et $-9.0\times10^{-4}$ mrad/° pour des pas de 0,5, 1 et 2° : même pas de signe constant, car c'est du bruit du solveur en un point stationnaire. En $u$, l'effet est presque linéaire : effet/$u$ varie d'un facteur 1,08 entre 10° et 30°, alors qu'effet/degré varie d'un facteur 28. Le σ a priori vaut $u(20°) = 0.060$, choisi directement en $u$. Convertir un « σ = 8° » en $u$ ferait d'une pente de 20° un événement à 6σ, car $u$ est convexe en l'angle. Avec $u(20°)$, une pente de 15° se situe à 0,56σ et une de 30° à 2,2σ.

Deux règles écartent d'emblée les hypothèses impossibles. Un $u<0$ ajusté signifierait une pente qui fait afficher plus ; il reçoit donc un poids nul. Et l'issue « en pente » n'est proposée que si le résidu de la cible est négatif (vous avez affiché moins que prévu) et que son angle n'a pas été mesuré. Un angle mesuré, plat compris, fait de la pente une valeur connue. Une fiche de lieu ne distingue pas « confirmé plat » de « jamais mesuré », tous deux enregistrés comme 0°. Seule une mesure à l'inclinomètre faite pendant la séance, ou la déclaration « Ce terrain est plat », retire donc le terme.

Pour un seul groupement, erreur de distance et pente sont **exactement** dégénérées : à 700 m, une pente de 20° et une erreur de distance de −25,1 m déplacent toutes deux la hausse de −0,418 mrad. Une troisième issue « les deux à la fois » répartirait arbitrairement le poids entre deux explications que les données ne peuvent pas séparer ; elle n'existe donc pas. Seule une mesure d'angle sépare les deux, c'est pourquoi chaque retélémétrage demande aussi l'inclinomètre. Une cible est signalée sur la somme de « mal télémétrée » et « en pente », jamais sur l'une seule.

**Comparaison de modèles.** Chaque combinaison d'issues est ajustée, et son évidence est approchée par la méthode de Laplace en son propre point MAP :

$$\log p(y) \approx \log p(y\mid\theta^*) + \log p(\theta^*) + \tfrac p2\log 2\pi - \tfrac12\log|A|$$

Le poids a posteriori d'une combinaison est proportionnel à (poids a priori) × (évidence). Les combinaisons sont fusionnées en une seule gaussienne par la loi de la variance totale :

$$\bar\theta = \sum_k w_k\theta_k,\qquad \Sigma = \sum_k w_k\big(\Sigma_k + (\theta_k-\bar\theta)(\theta_k-\bar\theta)^\top\big)$$

Une combinaison dont l'ajustement s'est emballé vers une valeur non finie est écartée. Cela arrive avec un a priori de traînée large, plusieurs cibles autorisées à être fausses à la fois et trop peu de groupements pour les fixer. Les chiffres rapportés viennent toujours de cet ajustement fusionné, jamais d'un ajustement simple auquel on ajouterait un signalement après coup : signaler une cible ne corrige pas les chiffres à lui seul.

L'évidence en forme fermée d'un modèle linéaire, linéarisé une seule fois en $\theta = 0$, ne s'applique pas ici, car le modèle est relinéarisé à chaque itération. Testé sur des séances propres sans aucune bévue, ce raccourci favorisait « bévue » à environ 90 % à chaque fois. La forme de Laplace ci-dessus est écrite à un seul endroit et partagée par toutes les comparaisons de l'outil.

**Conjointement, pas une à une.** Deux cibles proches en distance ont presque la même sensibilité à une grande cause commune, comme une dérive en température non corrigée. Contrôlées une à une, chacune fait paraître l'autre fausse. Dans un cas construit pour provoquer cela, le contrôle une à une donnait 99,5 % et 98,6 % de « bévue » au vrai coupable et à son voisin innocent à 5 m. La décision conjointe donnait 99,5 % et 13,7 %, avec la même estimation finale.

L'énumération conjointe exacte croît exponentiellement avec le nombre de cibles $k$ (jusqu'à $3^k$ combinaisons). Mesuré avec deux issues par cible, le coût croissait d'environ 2,2× par cible : 0,24 s pour 4 cibles, 9,4 s pour 8, et un terrain de 12 cibles a dû être interrompu au bout de deux minutes. Chaque cible est donc d'abord présélectionnée une à une (environ 7 ms chacune). Les quatre plus suspectes sont ensuite énumérées conjointement, et les combinaisons avec plus de deux cibles fausses à la fois sont écartées. Avec les poids après retélémétrage, trois fausses sur quatre ont une masse a priori d'environ $3\times10^{-5}$. Sur 585 analyses réelles, la liste de conclusion, la note et l'ensemble « rien de significatif » étaient identiques avec et sans ce plafond, pour une vitesse 1,5 fois plus grande. La présélection ne peut se tromper qu'en incluant un voisin innocent, jamais en manquant le coupable, car le résidu commun doit bien atterrir sur une cible et la vraie garde sa part. Sur une échelle de sept cibles et sur une disposition défavorable avec des cibles à 600/610, 750/760 et 860/870 m, le coupable a toujours fait partie de la présélection, et les chiffres de la présélection concordaient avec l'énumération complète à un dixième de point près, en environ un huitième du temps.

Une cible est signalée, et un retélémétrage demandé, dès que son poids « quelque chose cloche » dépasse 20 %. En simulation, un seuil de 50 % ne se déclenchait presque jamais. À 20 %, il se déclenche environ une séance sur dix et améliore à la fois les valeurs à afficher et l'estimation de la traînée. Retélémétrer prend quelques secondes.

### 8.10 Vérification des coches de préparatifs

Un zéro ou une vitesse moyenne cochés ne sont pas crus sur parole. Chacun devient un choix à deux issues dans la même énumération : l'a priori vérifié avec un poids de 0,9, l'a priori non vérifié (0,25 mrad, 20 m/s) avec 0,1. Si les tirs contredisent une coche, le résultat fusionné s'élargit au lieu de pousser l'écart vers une autre cause. La page « Conclure » cite une coche dès que son poids « n'a pas tenu » dépasse 50 %. La coche de vitesse disparaît dès que le chronographe de la séance prend le relais (§8.5). La valeur de clic n'est pas vérifiée ainsi. Les tirs n'en disent presque rien (§8.2), et chaque axe supplémentaire double le calcul.

### 8.11 L'échelle et les tirs non vus

Chaque pas doit passer deux contrôles.

1. **La prévision.** L'écart prédit à la distance suivante, $z\,\sigma_c\,R/1000$ mètres avec $\sigma_c=\sqrt{J^\top\Sigma J}$ l'écart-type prédictif de la hausse en mrad, doit rester dans la demi-hauteur du pare-balles (1 m pour un pare-balles de 2 m). $z$ vaut 2, et 3 après tout tir non vu.
2. **Le plafond.** Un pas peut aller au plus à 4 fois la plus grande distance où un groupement a réellement atteint le pare-balles. Avant que le premier groupement l'atteigne, aucun pas n'est fait sur la seule prévision : l'échelle commence à la distance disponible la plus proche.

La prévision seule ne suffit pas, car elle repose sur le modèle supposé : elle mesure l'incertitude *à l'intérieur* de ce modèle et ne peut pas voir que le modèle a la mauvaise forme. Avec les seuls a priori et aucun tir, elle a autorisé un premier tir à 800 m pour une balle supposée G1 mais en réalité G7, en prédisant un écart d'au plus 1,59 m à 2σ. L'écart réel sur un pare-balles de 2 m était de 3,70 m. Le plafond ne doit rien au modèle. Un plafond de 2× bloquait chaque séance sur les dispositions 100/300/600 m et 100/300/600/900 m après le premier groupement. 3× supprimait ces blocages, et 4× permet un écart d'un facteur quatre. Quand il ne reste rien sous le plafond, la distance la plus proche au-delà est permise si elle passe la prévision à 3σ. Mesuré sur les pas de la simulation, le 99e centile de l'écart réel était d'environ 3σ, même avec un modèle de traînée volontairement faux.

Le tout premier tir est contrôlé à part : l'écart prédit sous les seuls a priori, à 3σ. S'il risque de sortir du pare-balles, l'outil propose la distance de zéro et vous laisse continuer en connaissance de cause.

**Un tir non vu** est une preuve solide que le modèle est faux à cette distance, ce qu'aucun des deux contrôles ne peut voir. L'outil :

1. recule à la distance disponible la plus proche du milieu entre la dernière atteinte et celle qui a été manquée ;
2. porte $z$ à 3 pour le reste de la séance ;
3. bloque la distance manquée et tout ce qui est au-delà jusqu'à ce qu'un groupement atteigne le pare-balles plus près, puis la libère pour une nouvelle tentative affichée d'après l'ajustement corrigé. Réafficher la prédiction de l'application répète l'échec : en simulation, aucune séance avec un tir non vu ne s'en est remise sans l'élévation de l'ajustement, et 82 % s'en sont remises avec elle ;
4. garde en jeu une distance de nouveau manquée tant qu'il reste du terrain non essayé en deçà, jusqu'à cinq tirs non vus. Avec un BC trop élevé de 25 % et un pare-balles de 2 m, abandonner la cible lointaine après son deuxième tir non vu la faisait perdre dans 92 séances sur 100, et le résultat, réduit aux deux tiers de la vérité, était alors proposé à l'enregistrement. La garder en jeu permettait de l'atteindre dans chaque séance, avec au plus trois tirs non vus ;
5. quand rien de plus proche ne peut être tiré, demande un groupement supplémentaire de trois cartouches à une distance déjà atteinte, pour faire assez bouger l'ajustement et débloquer la nouvelle tentative.

Un tir non vu dit aussi quelle taille l'erreur de traînée doit au moins avoir. La balle est sortie du pare-balles, donc le réglage était faux de plus de la moitié de sa hauteur $h$. Une erreur de traînée seule ne le fait que si

$$|\delta d| \ge \frac{h/2}{R}\Big/\frac{\partial c}{\partial d}$$

Pour un pare-balles de 2 m et la .308, cela fait 22 % à 800 m, 38 % à 700 m, 68 % à 600 m et 815 % à 300 m. L'a priori de traînée utilisé par l'échelle et les valeurs à afficher est élargi jusqu'à ce que cette taille soit à deux écarts-types. Une erreur de BC grossière est alors suivie au lieu d'être ramenée vers le chiffre publié, ce qui ferait manquer la nouvelle tentative presque d'autant. Si l'erreur requise dépasse 50 %, aucun BC n'est aussi faux : le tir non vu avait une autre cause (une rafale, une erreur de réglage, un impact simplement pas vu), et élargir ne ferait que coûter de la précision. L'estimation linéaire suffit ici ; résoudre exactement la trajectoire n'a changé aucun résultat simulé. L'ajustement de conclusion utilise l'a priori normal. Sinon, un tir qui n'était qu'un impact non vu coûterait une note à une séance sans chronographe, et la règle des 3σ du §8.12 rattrape de toute façon une erreur de BC grossière.

### 8.12 Garde-fous sur les saisies

Aucun ne vous bloque. Chacun avertit, explique ou retient un résultat.

- **Vraisemblance de la hausse.** Une hausse saisie est comparée à une enveloppe formée par la prédiction de l'application ± 4σ. Ce σ combine la dispersion de la prédiction pour un tireur qui n'a rien vérifié (a priori non vérifiés, quoi que vous ayez coché), le bruit de la série et l'erreur de vent à « Faible ». L'enveloppe ignore volontairement l'ajustement et les saisies précédentes : une faute de frappe antérieure qui a faussé l'ajustement ne doit pas faire paraître fausse une saisie correcte. En dehors, l'outil teste si le nombre conviendrait comme écart par rapport à la hausse recommandée, comme mrad ou MOA saisis à la place des clics, avec le signe inversé, ou décalé d'un facteur dix, et nomme l'erreur probable.
- **Vraisemblance de la vitesse.** La vitesse de la cartouche dans l'air de ce groupement ± $4\sqrt{20^2 + \text{SD}^2}$ m/s, limitée à 150–1500 m/s. Les 20 m/s s'appliquent même quand la moyenne est cochée comme vérifiée, car la coche peut être fausse. En dehors, l'outil teste les autres unités de vitesse et un facteur dix.
- **Pression station.** Au-dessus de la pression de l'atmosphère standard à l'altitude du lieu de plus de 40 hPa, la lecture ressemble à un QNH. En dessous de plus de 60 hPa, elle semble trop basse. La vraie pression station varie d'environ 35 hPa dans chaque sens avec la météo. À 1 500 m, utiliser le QNH coûte 0,39 mrad, et l'ajustement en ferait une correction de BC (§8.2).
- **Évolution de l'air.** Quand l'air d'un groupement diffère de l'air de départ de 8 °C ou de 15 hPa, l'outil vous signale que le plan vieillit (pour un chargement qui dérive de 0,8 m/s par degré, 8 °C font plus de 6 m/s). Le plan n'est pas recalculé après le départ, mais l'ajustement suit de toute façon l'air de chaque groupement.
- **Correction de BC.** Proposée seulement avec au moins cinq mesures de chronographe relevées pendant la séance, à la note A ou B, quand le résultat de traînée est à moins de 3σ de l'a priori (3 × 4,1 ≈ 12 %) et que le nouveau facteur de gain est compris entre 0,8 et 1,2. Un résultat au-delà est traité comme une erreur de saisie : l'a priori retient un tel ajustement vers le BC publié, si bien que son chiffre est trop petit et sa marge trop étroite. Simulé avec un BC faux de 25 %, un tel résultat aurait été proposé à l'enregistrement aux deux tiers de la vraie correction. Il est affiché, avec le BC ajusté, pour information seulement.
- **Constat de vitesse.** Rapporté comme correction mesurée seulement s'il repose sur des mesures de chronographe. Sans elles, une vitesse déduite des hausses n'est que l'erreur d'une autre cause déplacée vers la vitesse, et elle est listée comme non déterminée.
- **Cible lointaine prévue non atteinte.** La page « Conclure » le signale et ne note que ce qui a été tiré.

### 8.13 Ce qui est rapporté

$R_\text{max}$ est votre plus grande distance d'utilisation : la distance supersonique la plus lointaine du lieu, ou la plus grande distance tirée si elle est supérieure. Chaque constat est jugé à $R_\text{max}$.

**Significativité.** Une cause compte si son effet à $R_\text{max}$ dépasse 0,1 mrad. Pour une cause de valeur ajustée $\theta_i$, d'écart-type $\sigma_i$ et de colonne $J_i$ à $R_\text{max}$, donc de moyenne $m = J_i\theta_i$ et d'écart-type $s=|J_i|\sigma_i$ :

$$P(\text{material}) = \Phi\!\left(\frac{-0.1-m}{s}\right) + 1 - \Phi\!\left(\frac{0.1-m}{s}\right)$$

Les constats sont classés selon cette probabilité.

**Résolution.** $\tilde R = I - \Sigma P_0$, mis à l'échelle par les écarts-types a priori. Sa diagonale vaut $1 - \Sigma_{ii}/\sigma_{0,i}^2$, la part de la variance a priori que les tirs ont supprimée. Sous 0,2, la séance n'a pas mesuré cette cause. Elle est alors « non déterminée », ou listée comme non résolue si son effet ajusté compte probablement quand même, mais jamais « conforme », car une valeur ramenée vers son a priori n'est pas une mesure.

**Dégénérescence.** Les causes liées par une corrélation a posteriori supérieure à 0,8 sont regroupées en composantes connexes, de sorte que les liens peuvent s'enchaîner. Chaque groupe est rapporté comme une seule contribution combinée $m=\sum_{k} J_k\theta_k$, de variance $J^\top\Sigma J$ sur ses membres. Quand le groupe réunit vitesse et traînée, le conseil est d'apporter un chronographe. Les corrélations entre 0,5 et 0,8 entre causes rapportées font l'objet d'une note.

**Zéro.** Rapporté comme correction pour $P \ge 0.8$, et comme « possible, mais pas encore net » entre 0,5 et 0,8.

**Table de réglage.** Quand aucune correction de BC n'est proposée, la variation de hausse à chaque distance tirée est $\Delta c(R) = c_\text{fit}(R) - c_\text{app}(R)$ dans l'air du dernier groupement, d'écart-type $\sqrt{J(R)^\top\Sigma J(R)}$. Une entrée compte si $|\Delta c| \ge 0.05$ mrad et si $|\Delta c| \ge$ son propre écart-type. La table est affichée quand au moins une entrée compte. La lecture d'un groupement n'est précise qu'à environ 0,07–0,15 mrad ; un plancher de 0,05 mrad seul laisserait donc passer du bruit.

Les seuils du zéro et de la table de réglage ont été choisis en faisant varier des règles candidates sur des milliers de séances simulées. Ensemble, ils divisent environ par deux les séances où appliquer le résultat rend les hausses pires que ne rien faire, pour un faible coût quand le zéro est réellement un peu décalé.

### 8.14 Ce que le modèle laisse de côté

- **La forme de la courbe de traînée.** $\delta d$ met à l'échelle la courbe de traînée supposée et ne la remodèle jamais. Un BC G1 utilisé pour une balle dont la traînée suit G7 est une erreur de forme. Au-dessus de Mach 1,1, un seul facteur en absorbe l'essentiel sur les distances tirées, mais pas tout, et il ne s'extrapole pas au transsonique. C'est la raison principale pour laquelle l'outil reste supersonique, et la raison d'être du plafond de l'échelle.
- **La hauteur de visée** n'est pas ajustée. Au-delà de quelques centaines de mètres, son effet est presque constant (−0,020, −0,025 et −0,026 mrad à 300, 600 et 800 m pour 3 mm) ; elle ressemble donc à un petit décalage de zéro, et les tirs ne peuvent pas distinguer les deux. Mesurez-la.
- **La densité de l'air** n'est pas ajustée et ne peut pas l'être (§8.2).
- **Le vent** est un bruit, pas une cause, et la dérive n'est jamais utilisée.
- **La dérive gyroscopique** n'agit que sur la dérive latérale, qui n'est pas ajustée. La rotation de la Terre n'est pas modélisée.
- **Validation.** Chaque seuil ci-dessus a été fixé par simulation : des séances avec des erreurs connues introduites (BC, vitesse, zéro, clics, distance, pente, vent), tirées à travers la même échelle, le même ajustement et le même rapport. La marge à 95 % de la traînée contient la vérité dans environ 95 % des cas de ces simulations. Les séances réelles sont encore peu nombreuses, c'est pourquoi l'outil est marqué expérimental.
