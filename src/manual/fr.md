# geladen.ch ballistics — Manuel utilisateur

*Pacifique. Précis. Armé.*

geladen.ch ballistics est une suite balistique extérieure fonctionnant
entièrement côté client. Tout — l'intégration de trajectoire, l'analyse de
probabilité d'impact, vos carabines et balles enregistrées — s'exécute dans
votre navigateur. **Aucune donnée n'est jamais collectée ni transmise à un
serveur.** L'application fonctionne hors ligne une fois chargée, et
s'installe comme une application sur ordinateur et mobile (PWA).

Ce logiciel est fourni sans aucune garantie d'adéquation à un usage
particulier, ou je ne sais quoi — bla bla bla. J'ai fait de mon mieux pour
le rendre utile (ça m'a occupé tout un week-end pluvieux), et je pense
qu'il est raisonnablement précis, mais si vous trouvez un moyen créatif
de détourner un calculateur balistique au point de vous blesser, ça vous
regarde — qui suis-je pour faire obstacle à la sélection naturelle ?

Ce manuel couvre les outils pleinement fonctionnels — **Trajectoire**, le
**Calculateur de terrain**, **Armes**, **Courbe Cd-Mach**, **Outils BC**, la
**Calculette de précision de tir** et **Paramètres** — ainsi que
**Probabilité d'impact**, utilisable pour ses scénarios actuels mais encore
en développement actif.

---

## Installer l'application

### Android (Chrome)

Chrome peut installer cette application pour qu'elle se comporte comme
n'importe quelle autre application sur votre téléphone — sa propre icône
sur l'écran d'accueil, sa propre fenêtre sans barre de navigateur, et elle
continue de fonctionner hors ligne.

- Ouvrez l'application dans Chrome.
- Appuyez sur le menu **⋮** (en haut à droite) et choisissez **Installer
   l'application** (les anciennes versions de Chrome l'appellent **Ajouter
   à l'écran d'accueil**).
- Confirmez. Une icône apparaît sur votre écran d'accueil ou dans le
   tiroir d'applications, comme n'importe quelle autre application
   installée.

**Une icône séparée pour le Calculateur de terrain.** Puisque le
Calculateur de terrain fait partie de la même application, vous pouvez lui
donner sa propre icône qui ouvre directement dessus, sans passer par
l'accueil :

- Dans Chrome, ouvrez l'application et allez dans le **Calculateur de
   terrain**.
- Ouvrez à nouveau le menu **⋮** — pendant que le Calculateur de terrain
   est ouvert — et choisissez **Ajouter à l'écran d'accueil**.
- Quand Chrome demande un nom, indiquez par exemple « Calculateur de
   terrain » pour distinguer facilement les deux icônes.

Appuyer sur cette seconde icône ouvre l'application directement sur le
Calculateur de terrain, en sautant l'accueil — pratique si c'est le seul
outil que vous utilisez sur le terrain. Les deux icônes affichent
actuellement la même image ; seuls les noms diffèrent.

### iPhone / iPad (Safari)

Cela ne fonctionne que dans **Safari** — les autres navigateurs sur iPhone
(y compris Chrome) ne sont pas autorisés à installer des applications sur
l'écran d'accueil.

- Ouvrez l'application dans Safari.
- Appuyez sur le bouton **Partager** (le carré avec une flèche vers le
   haut, dans la barre d'outils du bas — en haut sur iPad).
- Faites défiler la liste qui apparaît et appuyez sur **Sur l'écran
   d'accueil**.
- Confirmez le nom (ou modifiez-le) et appuyez sur **Ajouter**, en haut à
   droite.

Une icône apparaît sur votre écran d'accueil et ouvre l'application dans sa
propre fenêtre, sans barre d'adresse Safari — comme sur Android.

**Une icône séparée pour le Calculateur de terrain** fonctionne de la même
façon : ouvrez d'abord le **Calculateur de terrain** dans l'application,
puis répétez **Partager → Sur l'écran d'accueil** pendant que cette page
est ouverte, et donnez-lui un nom distinctif comme « Calculateur de
terrain ». Comme sur Android, les deux icônes affichent actuellement la
même image ; seuls les noms diffèrent.

## Trajectoire

Une balle ne vole jamais en ligne droite, même si vous le voudriez.
Trajectoire en suit tout le vol — chute, dérive, vitesse, temps de vol —
pour la carabine et la munition configurées dans **Armes**, ci-dessous, à
toutes les distances qui vous intéressent.

**Les paramètres** commencent par la carabine et la cartouche actives, affichées
sous forme d'un court résumé avec un bouton **Modifier** vers Armes, puis une
section Atmosphère, et quelques réglages propres à cette table et à ce
graphique :

- **Distance maximale** / **Pas de distance** — jusqu'où, et avec quel
  incrément, la table est calculée.
- **Angle de ligne de mire** — inclinaison du tir (montée/descente), en
  degrés, positif vers le haut. Laissez à 0 pour un tir à plat.

**Le tableau** affiche une ligne par pas de distance, avec des colonnes
activables (chute, dérive, corrections d'élévation/dérive en clics/mrad/MOA,
vitesse, temps de vol, Mach, énergie). La correction d'élévation est signée
pour correspondre à la façon dont vous réglez réellement une lunette : une
balle qui est tombée sous la ligne de mire s'affiche comme un nombre
*positif* de clics à tourner vers le **haut**.

Vous pouvez **télécharger le tableau en fichier CSV**, ou **le copier dans
le presse-papiers** au format CSV — les deux utilisent exactement les
colonnes actuellement activées, et le séparateur de champs/décimal défini
dans Paramètres → Export CSV (pour une ouverture correcte quelle que soit
la langue de votre tableur).

**Le graphique** trace n'importe quelle colonne en fonction de la distance,
avec son propre zoom/déplacement indépendant (faites glisser les deux
curseurs de distance en dessous — fenêtre minimale de 50 m). Il peut être
**téléchargé en SVG** (la petite icône au-dessus du graphique), un format
qui ne dépend pas de cette application pour être consulté ou modifié plus
tard.

## Probabilité de toucher

Estime la probabilité d'atteindre une cible pour un scénario de tir choisi,
en combinant votre carabine et votre charge avec votre propre précision de
tir et l'incertitude sur l'estimation de la distance, de la température, de
la pression et du vent. **Encore en développement actif** — d'autres
scénarios et cibles sont prévus ; considérez les résultats comme indicatifs,
non comme une prédiction certifiée.

**Carabine et balle** affiche le même résumé que Trajectoire — la
configuration active définie dans **Armes** ; utilisez **Modifier** pour la
choisir ou la modifier.

**Incertitude** définit l'ampleur de chaque source d'erreur :

- **Erreurs propres** — régularité de la vitesse initiale (écart-type), et
  soit en détail la précision de la carabine + l'habileté du tireur + la
  position de tir, soit une seule valeur de précision combinée simplifiée
  (une taille de groupement et sa convention : ES-5, ES-10, R50 ou R99).
- **Erreurs de conditions** — erreur d'estimation de la distance, de la
  température, de la pression et du vent ; si **Cible mobile** est coché,
  également la vitesse latérale de la cible et votre erreur d'estimation de
  celle-ci.

**Simulation** définit la distance, la cible, l'atmosphère (température,
pression, altitude, humidité), un réglage de combat optionnel (carabine
réglée pour une distance différente de la cible) et un décalage du point de
visée.

**Scénarios :**

- **Tir unique** — un seul coup ; chaque source d'erreur propre et de
  condition s'applique directement.
- **Tir corrigé par observateur** — un tir de réglage est tiré et son impact
  est annoncé par un observateur, ce qui annule le décalage systématique en
  espérance ; l'erreur résiduelle du tir corrigé est sa propre dispersion
  plus l'imprécision de la correction de l'observateur. Les erreurs de
  conditions ne réapparaissent pas dans le tir corrigé, puisque l'annonce de
  l'observateur tient déjà compte de leur effet sur le tir de réglage.

**Cibles** — une plaque de 40 × 60 cm (une seule zone touché/manqué) et la
cible ISSF 300 m (dix anneaux de score). D'autres cibles sont prévues.

**Les résultats** affichent la probabilité d'impact totale, la probabilité
par zone, le score en pourcentage du maximum, un tableau de la contribution
horizontale/verticale/totale de chaque source d'erreur, ainsi qu'une
illustration de la cible avec un nuage d'impacts d'exemple, le point d'impact
moyen et l'ellipse à 95 % — téléchargeable en SVG.

## Calculateur de terrain

Une solution rapide à une seule distance : les valeurs à régler pour un tir,
tout de suite, en assez grand pour se lire à bout de bras ou en plein
soleil — pas une table, pas une analyse. Tout son objectif de conception est
de n'afficher que ce dont vous avez besoin au moment de régler la lunette :
pas d'en-tête, pas d'habillage au-delà d'une petite navigation, aucun chiffre
que vous n'êtes pas sur le point d'utiliser.

L'ouvrir remplace la navigation habituelle de l'application par la sienne —
**Cible**, **Vent**, **Atmosphère**, **Armes** (mène à Personnalisé/Arsenal ;
Terminé vous ramène ici), et **Quitter le calculateur** (retourne toujours à
l'accueil). Sur un téléphone ou une tablette qui le permet, l'écran est
empêché de se mettre en veille tant que le Calculateur de terrain est
ouvert, pour qu'il ne s'assombrisse pas en pleine série de tirs.

- **Cible** — distance et angle de ligne de mire, saisis à la main, ou
  choisis dans la liste de cibles d'un emplacement enregistré — voir
  **Emplacements et cibles** ci-dessous.
- **Vent** — vitesse (grand bouton +/− ) et direction (le même cadran
  qu'ailleurs, agrandi ici).
- **Atmosphère** — température, pression, altitude, humidité et préréglages
  — les mêmes champs que dans Trajectoire, sans le vent, qui a son propre
  onglet ici.

**Le résultat** se recalcule en direct à chaque changement d'un champ — pas
de bouton Calculer. L'élévation et le vent s'affichent en clics entiers
(selon les réglages de clic propres à la carabine active, définis dans
Armes), chacun précédé d'un indicateur de direction : haut/bas pour
l'élévation, gauche/droite pour le vent. Choisissez entre une flèche ou un
signe **+ / −** (Paramètres → **Indicateurs de sortie du Calculateur de
terrain**) — **+** signifie toujours régler vers le haut ou vers la droite.
Une petite ligne en bas ajoute le temps de vol, la vitesse résiduelle et
l'énergie résiduelle. Une barre récapitulative des conditions au-dessus de
l'affichage montre la distance, le vent et l'atmosphère en un coup d'œil,
pour toujours savoir pour quoi une élévation/dérive donnée a été réglée. Si
un champ est en cours de modification (par exemple momentanément vide),
l'affichage montre un simple **—** plutôt qu'un résultat erroné.

Utilise la même carabine, cartouche et balle actives que Trajectoire et
Probabilité d'impact (définies dans **Armes**), avec le même zéro — pas de
réglage de zéro de combat séparé ici.

### Emplacements et cibles

Facultatif : enregistrez une fois les cibles d'un pas de tir — leur
distance et leur angle de ligne de mire, et, si vous ajoutez une photo
prise depuis le poste de tir, leur emplacement sur celle-ci — puis
retrouvez-les directement dans l'onglet Cible lors de vos prochaines
visites, au lieu de régler distance et angle à la main à chaque fois. Le
vent et l'atmosphère ne font jamais partie d'une cible enregistrée,
seulement la distance, l'angle et (avec une photo) la position.

La ligne **Emplacements et cibles** de l'onglet Cible affiche le nom de
l'emplacement actuel (rien, si vous n'en utilisez pas), un menu déroulant
de ses cibles, et jusqu'à trois icônes :

- Une icône en forme de cadre photo, **Choisir la cible sur la photo**
  (visible seulement une fois que l'emplacement actuel a une photo) —
  ouvre cette photo en plein écran ; touchez le repère d'une cible déjà
  placée pour la sélectionner immédiatement, ou une puce (empilées en haut
  à gauche) pour une cible pas encore placée sur la photo. Rien ne change
  tant que vous n'en touchez pas une.
- Une icône de synchronisation, **Mettre à jour cette cible avec la
  distance/l'angle actuels** — apparaît dès que la distance/l'angle
  actuellement réglés ne correspondent plus aux valeurs enregistrées de la
  cible sélectionnée (par exemple si vous avez ajusté la distance à la main
  après l'avoir choisie). Met à jour la cible enregistrée pour qu'elle
  corresponde à ce qui est actuellement réglé.
- **Gérer les emplacements** — ouvre la bibliothèque Emplacements et cibles
  elle-même (ci-dessous). Terminé, là-bas, vous ramène à cet onglet.

Choisir une cible (menu, photo ou puce) copie sa distance et son angle dans
l'onglet Cible comme une modification libre et ponctuelle, pas un lien
permanent — vous pouvez toujours ajuster ensuite les valeurs réglées à la
main sans toucher à la cible enregistrée (c'est à ça que sert l'icône de
synchronisation ci-dessus, si vous voulez la garder synchronisée).

**Gérer les emplacements.** L'écran de la bibliothèque répartit vos
emplacements entre **Emplacement actuel** (celui qui est actif, ou **Aucun
emplacement — cible unique, saisie manuelle** si aucun ne l'est) et
**Emplacements connus** (tous les autres). Toucher un emplacement connu
l'active — le déplace vers Emplacement actuel et fait défiler la page
jusque-là — sans quitter cet écran. Seul l'emplacement actuel affiche
**Modifier** et sa liste de cibles ; chaque emplacement, actuel ou connu,
affiche **Sauvegarder dans un fichier** et **Supprimer**. **Sauvegarder la
bibliothèque dans un fichier…** / **Charger une sauvegarde depuis un
fichier…**, en haut, sauvegardent ou restaurent toute la bibliothèque
d'un coup, de la même façon que l'Arsenal pour les carabines et les
balles.

Un emplacement a un nom, une altitude facultative (si elle est renseignée,
activer l'emplacement remplit l'onglet Atmosphère avec l'atmosphère
standard à cette altitude et 50 % d'humidité — mais seulement si vous
n'avez pas déjà modifié vous-même les valeurs d'atmosphère durant cette
session), et une photo facultative. Chacune de ses cibles a un nom
(facultatif — par défaut « Cible 1 », « Cible 2 », etc.), des notes, une
distance et un angle de ligne de mire.

**Placer une cible sur la photo.** Dès qu'un emplacement a une photo,
chacune de ses cibles reçoit un bouton **Placer** (dans sa ligne, et dans
son propre formulaire de modification) qui ouvre la photo en plein écran
pour cette cible : touchez ou faites glisser pour positionner son repère,
faites glisser une zone vide pour déplacer la vue, pincez (ou utilisez les
boutons **Zoom avant** / **Zoom arrière** de la barre de navigation) pour
zoomer. Chaque autre cible déjà placée sur la même photo apparaît comme un
petit point étiqueté avec son nom, sa distance et son angle, pour que vous
puissiez placer la nouvelle par rapport à elles. **Retirer le repère**
annule le placement ; Terminé l'enregistre et revient à la bibliothèque.
Une cible pas encore placée sur la photo (sur un emplacement qui en a une)
affiche un badge **Non placée** dans sa ligne, en rappel.

## Armes

La carabine, la cartouche et la balle utilisées par tout outil qui en a
besoin — actuellement **Trajectoire** et **Probabilité d'impact**. Partout
où un outil a besoin de cette configuration, il affiche un court résumé
(nom, source, vitesse initiale) avec un bouton **Modifier** qui mène ici ;
ce que vous choisissez ou modifiez s'applique partout et **persiste après un
redémarrage**.

**Modifier** vous dirige vers celui des deux onglets ci-dessous qui
correspond à la source de la carabine active — **Arsenal** s'il s'agit
d'une de vos propres carabines enregistrées, **Personnalisé** sinon. Sur
mobile, l'ouverture d'Armes remplace la barre inférieure par **Personnalisé**
/ **Arsenal** / **Terminé** ; sur ordinateur, le rail latéral se transforme
de la même façon. **Terminé** vous ramène vers l'outil d'où vous êtes venu.

### Personnalisé

Choisissez une carabine intégrée, l'une de vos propres carabines de
l'Arsenal, ou saisissez une carabine et une balle entièrement à la main —
les trois options vivent dans le même formulaire. Quelques champs méritent
une explication :

- **Distance de réglage** — la distance à laquelle la carabine est réglée
  (zérotée). Le moteur calcule l'angle de tir qui place la balle sur la
  ligne de mire à cette distance ; vous ne réglez pas l'angle vous-même.
- **Vitesse initiale en fonction de la température** — modélise en option la
  variation de la vitesse initiale d'une cartouche avec la température de la
  poudre, au lieu d'utiliser une valeur fixe.
- **Traînée de la balle** — soit un coefficient balistique (BC) avec un
  modèle de traînée standard (G1, G7 et d'autres — voir **Paramètres**),
  soit, pour les balles de la bibliothèque qui en possèdent une, une table
  Cd-Mach directement mesurée (plus précise,
  sans BC).

**Ajouter la carabine à l'arsenal** / **Ajouter la balle à l'arsenal**, à
côté des champs correspondants, enregistrent l'entrée actuelle dans votre
propre bibliothèque Arsenal (ci-dessous) pour réutilisation.

### Arsenal

Votre propre bibliothèque de carabines et de balles, stockée uniquement sur
cet appareil (stockage local du navigateur) — rien ici ne quitte jamais
votre navigateur.

**Bibliothèques intégrées.** L'application est fournie avec une bibliothèque
intégrée de carabines et trois bibliothèques intégrées de balles — **Geladen's
own** (« La collection de l'auteur »), **Lapua Cd** (courbes Cd-Mach mesurées
au radar par Lapua, telles que publiées par le fabricant) et **Hornady
Reverse Radar** (courbes Cd-Mach personnalisées, obtenues par
rétro-ingénierie à partir de la sortie du calculateur Hornady 4DOF) —
affichées à côté de tout ce que vous ajoutez vous-même (vos propres entrées
sont marquées d'un « * » en préfixe). Chacune peut être **désactivée
individuellement dans Paramètres** si vous ne voulez pas qu'elle encombre vos
listes de sélection ; vos propres entrées enregistrées ne sont affectées dans
aucun cas.

**Ajouter et gérer des entrées.** Ajoutez une balle soit entièrement à la
main (nom, calibre, masse, BC/modèle de traînée ou une table Cd-Mach
collée), soit en copiant une balle intégrée et en l'ajustant. Ajoutez une
carabine avec sa propre hauteur de lunette, distance de réglage et valeurs
de clic, puis attachez-lui une ou plusieurs cartouches (chacune avec sa
propre balle et vitesse initiale). Cliquez sur une carabine pour en faire la
« Carabine active » affichée en haut, avec ses propres cartouches et un
bouton Modifier ; la cartouche choisie là est celle que « Terminé » applique
comme configuration active partout, une fois que vous quittez Armes. Le
champ fabricant se complète automatiquement à partir de toutes les
bibliothèques activées et de votre propre Arsenal.

Les filtres par calibre et fabricant réduisent les longues listes. Une balle
ou une carabine modifiée mais pas encore exportée affiche un badge « Non
enregistré ».

**Enregistrer et charger votre bibliothèque.** Puisque rien n'est stocké sur
un serveur, votre bibliothèque n'est en sécurité que si le stockage local de
votre navigateur l'est. **Enregistrer dans un fichier** (par carabine/balle,
ou « Enregistrer la bibliothèque… » pour un export à sélection multiple)
écrit un fichier JSON que vous pouvez sauvegarder ou transférer vers un
autre appareil ; **Charger une bibliothèque…** en réimporte un, avec un
choix par élément pour résoudre les conflits de nom (écraser, écraser
seulement si plus récent, ou conserver les deux).

**Comparaison.** Marquez jusqu'à deux de vos propres configurations
carabine+cartouche enregistrées « pour comparaison » (depuis la ligne de
chaque carabine). Une fois deux configurations marquées, une section
Comparaison apparaît avec un graphique partagé traçant les trajectoires des
deux configurations pour la même colonne et la même fenêtre de distance —
utile pour juger deux charges, ou deux carabines, directement l'une par
rapport à l'autre. Comme le graphique de Trajectoire, il a son propre
zoom/déplacement et peut être **téléchargé en SVG**.

## Outils BC

Calcule un coefficient balistique à partir de données connues, ou convertit
un BC entre différents modèles — regroupés sous un seul outil avec les
onglets **Calcul BC**, **Conversion BC**, **BC multiples** et **BC
Labradar**, tous déjà pleinement utilisables.

Le **Calcul BC** déduit un coefficient balistique à partir d'une paire
vitesse/distance proche et soit une vitesse éloignée, soit un temps de vol
mesuré entre les deux distances, ainsi qu'un modèle de traînée (G1/G7) et
l'atmosphère. Basculez entre les modes de saisie **Vitesse** et **Temps de
vol** selon ce que vous avez mesuré (par exemple deux mesures au
chronographe, ou une seule mesure de temps de vol sur une distance connue)
— tout le reste (vitesse proche, les deux distances, modèle de traînée,
atmosphère) reste identique dans les deux cas. Utile lorsque vous avez
mesuré une perte de vitesse réelle, ou un temps de vol réel, sur une
distance connue et que vous voulez le BC qui l'explique, plutôt que de vous
fier à une valeur publiée.

La **Conversion BC** convertit un coefficient balistique d'un modèle de
traînée standard à un autre, à une seule vitesse de référence — indiquez le
modèle source et le BC, une vitesse représentative de la tranche de
distance qui vous intéresse, et le modèle de destination ; le résultat se
met à jour automatiquement à chaque modification, sans bouton à presser. La
conversion est exacte à cette vitesse et s'écarte d'autant plus que la
vitesse réelle de votre balle s'en éloigne, car les différents modèles de
traînée ont des courbes de forme différente selon la vitesse. Les deux
listes de modèles affichent toujours tous les modèles standard, quels que
soient ceux masqués ailleurs par les Paramètres.

**BC multiples** transforme 2 à 5 valeurs de BC publiées par le fabricant,
chacune valable sur sa propre plage de vitesse, en une courbe Cd-Mach propre
à cette balle — faites glisser les bornes de segment directement sur le
graphique, ou saisissez-les dans le tableau en dessous. Indiquez la masse et
le calibre (les deux influencent directement la courbe résultante et les
valeurs de BC optimales ci-dessous — saisissez-les avec précision), choisissez
un modèle de traînée et une unité de vitesse, et le graphique ainsi que le
tableau de résultats se mettent à jour en direct au fur et à mesure. Le
résultat peut
être enregistré directement dans l'Arsenal, téléchargé/copié en CSV, ou lu
comme un seul BC de « compromis optimal » par modèle sur la plage
supersonique propre à la balle.

**BC Labradar** ajuste un BC par coup à partir d'un export du chronographe
Labradar — un **.zip** de fichiers de trajectoire que l'appareil écrit sur
sa carte SD, un par coup, enregistrant la vitesse environ toutes les
millisecondes pendant le vol. Choisissez un modèle de traînée et
l'atmosphère (pas de préréglages ici — saisissez directement votre propre
pression station/température/humidité), puis sélectionnez le zip ; chaque
trajectoire est analysée, débarrassée des points bruités/erronés, et
ajustée pour un BC automatiquement. Les fichiers du zip qui ne sont pas de
vraies trajectoires (le rapport ou le fichier projet de l'appareil, ou tout
autre fichier parasite) sont ignorés. Deux filtres réglables écartent les
trajectoires peu fiables avant qu'elles ne soient moyennées : un **seuil de
qualité du signal** (à quel point les points nettoyés d'une trajectoire
suivent une droite) et un **rejet des valeurs aberrantes** (à quel point le
BC d'une trajectoire s'écarte des autres) — utile pour exclure par exemple
une trajectoire captée depuis un pas de tir voisin, ou une dont le radar a
simplement mal capté le signal. Cliquez sur la ligne d'une trajectoire pour
voir son propre graphique vitesse/temps, avec les points conservés et
écartés affichés séparément, et décochez la case d'une trajectoire pour
l'exclure manuellement du résultat moyenné (ou recochez-en une que les
filtres automatiques avaient rejetée).

**À retenir :** garbage in = garbage out (des données pourries donnent
des résultats pourris). L'atmosphère est *très* importante. Si vous ne
connaissez pas l'humidité, mettez 50 %. Un Kestrel suffit (même si
j'aurais préféré un thermomètre plus précis). « Des données récupérées
sur Internet depuis la "station météo la plus proche" » ne suffisent pas.
Assurez-vous *impérativement* d'utiliser la pression absolue (dite
pression station), et non une valeur ajustée à l'altitude (le Kestrel
utilise de façon trompeuse le terme « barometric pressure » pour désigner
la pression ramenée au niveau de la mer — ce n'est *pas* celle que l'on
veut). En général, si vous mesurez 1000+ hPa à une altitude de 500 m ou
plus (29,5 inHg et 1500 ft pour nos amis non métriques), cela signifie
probablement soit que vous lisez la mauvaise valeur de pression (ajustée
au lieu d'absolue/station), soit que la fin du monde est plus proche que
prévu.

**À retenir n° 2 :** le Labradar a un réglage appelé « proj. offset » ; il
définit la distance attendue entre la bouche du canon et le côté du
radar. Respectez-le (à -5 cm près) — c'est important ! Ce décalage se
mesure depuis le canon, *pas* depuis la bouche ; gardez cela en tête si
votre bouche n'est pas alignée avec le radar, mais légèrement devant ou
derrière.

**À retenir n° 3 :** un coup ne fait pas le printemps. Il vous en faut au
moins 20 (pour des munitions d'usine correctes) pour lisser les erreurs.
Des balles de surplus médiocres en demandent davantage (comptez au moins
30), tandis qu'avec des projectiles de haute qualité, 10 coups peuvent
suffire. En général, plus il y en a, mieux c'est.

## Courbe Cd-Mach

Déduit la courbe de traînée propre à une balle (Cd en fonction de Mach) à
partir d'un tableau distance/vitesse mesuré — p. ex. relevés radar Doppler
ou multi-chronographe —, en résolvant le coefficient de traînée segment par
segment plutôt qu'en supposant une forme standard G1/G7. Fonctionne mieux
avec un tableau peu dense (mesures au chronographe tous les ~100 m) ; les
tableaux denses (pas de 10 à 20 m) fonctionnent aussi, mais l'erreur
d'arrondi de chaque ligne pèse alors davantage sur le résultat de ce seul
segment.

**Tableau distance / vitesse** — collez une paire distance/vitesse par
ligne (séparées par une tabulation, une espace ou un point-virgule ; point
ou virgule décimale acceptés), au moins 3 lignes. **Unités du tableau**
indique si les valeurs collées sont en **Moderne (m, m/s)** ou en
**Archaïque (yd, fps)** — indépendamment de votre propre préférence
d'unités, puisque les unités des données sources n'ont pas à correspondre à
celles que vous préférez voir ailleurs dans l'application.

Sous le tableau : les mêmes champs de masse et de calibre que l'Arsenal, et
une section **Atmosphère** indépendante (par défaut, atmosphère standard au
niveau de la mer) — le solveur a besoin des deux pour simuler une
trajectoire synthétique sur chaque segment et en déduire le Cd qui
reproduit la perte de vitesse mesurée.

**Calculer** produit deux tableaux :

- **Interpolé** — la courbe déduite, relue à un ensemble fixe et dense de
  nombres de Mach de référence ; c'est celui à utiliser ensuite (p. ex.
  pour l'enregistrement dans l'Arsenal).
- **Calculé (brut, par segment)** — les valeurs par segment sous-jacentes,
  avant interpolation, masquées par défaut (**Afficher le tableau par
  segment (calculé)**).

Chaque tableau peut être **téléchargé en CSV** ou **copié dans le
presse-papiers** (le séparateur de champs/décimal de Paramètres → Export
CSV s'applique aussi ici). Un segment que le solveur n'a pas pu exploiter —
la vitesse n'a pas diminué, la distance n'a pas augmenté, ou la résolution
n'a pas convergé — est ignoré et listé, sans affecter le reste du tableau.

**Le graphique** trace les points Calculé et la courbe Interpolé, avec les
courbes de référence G1 et G7 mises à l'échelle pour correspondre à la
courbe propre de la balle à Mach 2.0 — un aperçu visuel rapide de si la
forme de traînée de cette balle est standard ou non. Téléchargeable en SVG,
comme le graphique de Trajectoire.

**Enregistrer dans l'Arsenal** vous envoie vers le formulaire « Ajouter une
balle » de l'Arsenal, avec la masse, le calibre et le tableau Cd-Mach
pré-remplis — choisissez **Calculé (brut, par segment)** ou **Interpolé
(lissé)** comme source à côté du bouton. Actif uniquement une fois un
résultat obtenu.

## Calculette de précision de tir

Mesure la précision réelle d'une carabine à partir de photos de cibles
papier — pas besoin de télémètre laser ni de matériel sophistiqué, juste une
photo au téléphone d'une règle et de vos trous de balle. Organise le travail
en **Projets** (une combinaison carabine/charge/distance) → **Cibles** (une
photo chacune) → **Séries** (un point de visée et les coups tirés dessus) —
puis regroupe chaque série utilisable de chaque cible utilisable d'un projet
en un seul rapport de précision combiné.

**Projets.** Un projet a un nom, la distance à la cible et le calibre —
chaque cible et chaque série qu'il contient est supposée tirée à cette même
distance avec ce même calibre. **Sauvegarder dans un fichier** /
**Sauvegarder la bibliothèque dans un fichier…** / **Charger une sauvegarde
depuis un fichier…**, en haut et par projet, sauvegardent ou restaurent les
projets de la même façon que l'Arsenal pour les carabines et les balles —
rien ici ne quitte jamais votre navigateur.

**Ajouter une cible.** Choisissez une photo de la cible papier (pivotez-la
si nécessaire, puis confirmez), ce qui ouvre directement le marquage :

- **Calibrer l'échelle** — touchez deux points séparés d'une distance
  connue (une règle posée sur la cible, ou tout élément de longueur connue),
  puis saisissez cette longueur réelle. **Terminer l'étalonnage** passe à la
  suite ; **Recalibrer** permet d'y revenir plus tard sans perdre les points
  déjà placés.
- **Indiquer le point de visée** — touchez l'endroit visé par cette série.
- **Marquer les impacts** — touchez chaque trou de balle ; continuez à
  toucher pour en ajouter d'autres. Chaque point placé (calibration, point
  de visée, impacts) peut ensuite être glissé pour l'ajuster. **Supprimer un
  impact** bascule vers un mode où toucher le numéro d'un coup le supprime.
- Une cible papier peut contenir plusieurs **séries** (par exemple plusieurs
  groupements de 5 coups imprimés sur la même feuille) — passez de l'une à
  l'autre ou commencez-en une nouvelle depuis le sélecteur de séries. La
  ligne de chaque série indique son nombre de coups et sa **Disp. max.**
  (dispersion maximale — la distance entre ses deux impacts les plus
  éloignés).
- **Enregistrer l'image d'ensemble de la série** télécharge un PNG de la
  série actuellement active telle que marquée, recadré selon le
  zoom/déplacement en cours.

Une cible doit être calibrée, avoir un point de visée et au moins un impact
pour être utilisable ; s'il en manque un, un badge et une indication
précisent exactement ce qu'il reste à faire.

**Le rapport** (« Voir le rapport », dès qu'au moins une cible est
utilisable) regroupe chaque coup de chaque série et cible utilisable —
chaque coup étant mesuré par rapport au point de visée de sa propre série,
si bien que des séries visées à des endroits différents de la feuille se
combinent quand même correctement — en un seul jeu de statistiques :

- Un sélecteur d'**Unités d'affichage des résultats** (votre propre unité
  configurée, mrad, ou MOA) régit toutes les valeurs de la légende et du
  tableau Chiffres ci-dessous.
- **Résultats agrégés** — le nuage de points combiné — et sa **Légende**
  sont côte à côte. Seuls les impacts eux-mêmes, le point de visée et le
  point d'impact moyen sont toujours dessinés ; tout le reste est optionnel.
- Le tableau **Chiffres** liste toutes les statistiques (intervalle de
  confiance, moyenne des impacts, écart type, R50/R95/R99 — le rayon d'un
  cercle dans lequel 50/95/99 % des impacts sont attendus — l'intervalle de
  confiance du R95, et ES5x/ES10x, l'écart maximal moyen attendu pour un
  groupement de 5 et de 10 coups) avec une case **Afficher sur l'image** par
  ligne qui l'ajoute à la fois au diagramme, à la légende et à l'image
  exportée.
- **Options de l'image** — grille (espacement en mrad ou en MOA),
  **Impacts à l'échelle** du calibre réel, un cercle de **Référence 1 MOA**,
  un cercle de **Rayon de probabilité d'impact** piloté par un curseur, une
  **Échelle**, et **Enregistrer la légende avec l'image des résultats**
  (activé par défaut) pour l'export SVG ci-dessous.
- L'**Indice de confiance** évalue à quel point une série de cette taille
  peut réellement être crue — peu de coups et un large intervalle de
  confiance vous placent bien en dessous du « seuil de foutaises » ; assez
  de coups et il grimpe vers « Excellent ». Il est aussi intégré à l'export
  SVG, où il remplace le simple texte de l'intervalle de confiance.
- **Exporter en CSV** télécharge les coordonnées brutes de chaque coup
  combiné ; la petite icône à côté de Résultats agrégés **exporte le
  diagramme en SVG** — avec la légende et l'indice de confiance inclus si
  cette case est cochée.

Chacun de ces réglages — unités d'affichage, chiffres affichés sur l'image,
grille, options de l'image, position du curseur — est mémorisé et restauré
la prochaine fois que vous ouvrez ce rapport, même après un redémarrage de
l'application.

## Paramètres

- **Langue** — English, Français, Русский, Deutsch, Italiano.
- **Unités** — une unité préférée par type de mesure (vitesse, vitesse du
  vent, distance, petites longueurs, altitude, température, pression,
  dispersion angulaire, énergie), mélangeant librement métrique et
  impérial ; s'applique partout où cette mesure apparaît.
- **Bibliothèques intégrées** — afficher/masquer la bibliothèque intégrée de
  carabines et chacune des trois bibliothèques intégrées de balles
  individuellement (voir **Armes** ci-dessus).
- **Modèles balistiques** — afficher/masquer chaque modèle de traînée
  standard (G1, G7, ...) dans tous les sélecteurs de modèle de l'application,
  pour n'y garder que ceux que vous utilisez réellement. Un modèle masqué
  reste disponible partout où il est déjà sélectionné (une balle saisie
  manuellement, le modèle propre d'une balle de bibliothèque) — le masquer
  n'affecte que les choix futurs, jamais un choix existant. Au moins un
  modèle doit toujours rester visible.
- **Thème** — à choisir parmi trois vignettes illustrées, appliqué partout
  immédiatement : **Sombre** (par défaut), **Contraste élevé clair** (fond
  blanc, texte noir, pour une visibilité maximale en plein soleil), et
  **Contraste élevé sombre** (fond noir avec un texte et des couleurs à
  contraste maximal, pour quand vous devez monter la luminosité de l'écran
  pour le voir en extérieur tout en économisant la batterie).
- **Indicateurs de sortie du Calculateur de terrain** — si l'affichage
  élévation/vent du Calculateur de terrain montre une flèche de direction ou
  un signe **+ / −** (voir **Calculateur de terrain** ci-dessus).
- **Export CSV** — le séparateur de champs (virgule/point-virgule/
  tabulation) et le séparateur décimal (point/virgule) utilisés par le
  téléchargement et la copie CSV de Trajectoire. Choisissez la paire
  attendue par votre tableur.
