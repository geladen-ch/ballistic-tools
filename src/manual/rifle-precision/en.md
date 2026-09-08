# geladen.ch ballistics User Manual — Rifle Precision Calculator

*Part of the* [geladen.ch ballistics suite](https://bc.geladen.ch)*. Successor to the standalone TARAN tool.*

---

## 1. What this tool is for

Every shooter has a number they quote for their rifle. It is almost always wrong, and it is almost always wrong in the same direction: too optimistic.

The reason is not dishonesty, it is arithmetic. The traditional way of measuring rifle precision is to shoot a five-shot group, measure the distance between the two holes furthest apart, and call that number "my rifle's accuracy". That measurement is a single draw from a very wide random distribution. Shoot ten such groups with the same rifle, the same ammunition, from the same bench on the same day, and the best of them will routinely be half the size of the worst. If you then quote the best one — and everybody quotes the best one — you are not describing your rifle. You are describing your luck.

The Rifle Precision Calculator does the opposite. Instead of asking *how big was that group*, it asks *what is the underlying dispersion of this rifle/load combination, and how sure am I of that answer*. It does this by pooling **every shot you have ever fired into the project** — across as many targets and as many groups as you care to shoot — into one estimate, and by reporting a confidence interval alongside every number, so you can see immediately whether you have measured something real or merely collected another tall tale — or a nice photo to post on a forum.

The workflow is deliberately low-tech. You do not need a chronograph, an acoustic target, a laser rangefinder or an app-connected anything. You need paper targets, a ruler, and a phone camera.

### What it is not

It is not a scoring program. It does not care about rings, X-counts, or match value. It measures dispersion and point of impact, nothing else.

It is not a substitute for the **Hit Probability** tool, which combines rifle precision with wind, range-estimation error and shooter skill to predict the probability of a first-round hit at distance. This tool measures *one* of the inputs that tool consumes — the rifle's own mechanical precision — and can hand it over directly (see §10.3).

---

## 2. Privacy, storage and requirements

**Nothing you put into this tool leaves your device.** There is no account, no upload, no telemetry, no "anonymous usage statistics". Your target photographs — which are, after all, photographs of your property, taken at a place you shoot — are stored in your browser's own IndexedDB database on your own machine, and are read back from there. The entire computation, from pixel coordinates to confidence intervals, runs in JavaScript in your browser.

The corollary is the one you would expect: **if you clear your browser's site data, your projects are gone.** There is no server-side copy to restore from. Use the backup functions (§9) if the data matters to you.

**Requirements.** Any reasonably current browser. The tool is usable on a phone — indeed marking impacts by tapping a photo on a phone screen is arguably the most natural way to use it — but the precision report, with its diagram, legend and numbers table side by side, is more comfortable on a tablet or a desktop screen. The app installs as a PWA and works fully offline once loaded.

---

## 3. The data model: Projects, Targets, Groups, Shots

Four levels of nesting, and it is worth understanding them before you start clicking, because getting this wrong is the single most common way to produce a meaningless report.

```
Project        one rifle + one load + one distance
  └─ Target    one photograph of one sheet of paper
       └─ Group   one point of aim, and the shots fired at it
            └─ Shot   one bullet hole
```

**A Project** is the unit of analysis. Everything inside a project is pooled into one statistical estimate, which means everything inside a project must be comparable: the same rifle, the same ammunition, the same distance. A project carries a **name**, the **distance to target**, and the **caliber**. Distance is needed because every angular result (mrad, MOA) depends on it; caliber is needed so the diagram can draw bullet holes at their true size.

If you change *anything* about the rifle or load — a different powder charge, a different bullet, a barrel cleaning regime you actually believe matters — start a new project. Pooling two different loads gives you the dispersion of neither.

**A Target** is one photograph. Each target carries its own scale calibration, because each photograph is taken from a slightly different distance and angle. This is why calibration is per-target and not per-project: the tool never assumes two photos have the same pixels-per-millimetre.

**A Group** is a point of aim plus the shots fired at it. One target sheet can, and usually should, carry several groups — a sheet with four diamonds printed on it, shot five rounds each, is one target with four groups.

**A Shot** is one bullet hole, stored as a position on the photograph.

### Why groups matter statistically

Each shot is measured **relative to its own group's point of aim**, not to some absolute origin on the sheet. That is the whole reason groups exist as a level in the hierarchy.

Consider four groups on one sheet, aimed at four different diamonds. If the tool simply pooled the raw hole positions, it would compute a dispersion upward of 200 mm — the spread of the *diamonds*, not the spread of the *rifle*. By re-centring each shot on the point of aim it was fired at, all four groups collapse onto one common origin, and what is left is genuine shot-to-shot dispersion.

This also means your point-of-aim marks must be honest. If you mark the POA at the visual centre of the group rather than at the spot you actually aimed at, you gut the tool's ability to measure your zero offset (§8.3) — and, frankly, anything else.

### 3.1 A note on units

**Every number this tool shows you, and every number it lets you type, is in the units you chose in Settings.** There are no hidden exceptions and no field that quietly expects something else. If you work in inches and yards, you never see or type a millimetre anywhere in this tool.

Two of the suite's unit groups are in play:

- **Distance** (`m`, `yd`, `ft`) — the project's range.
- **Small length** (`mm`, `cm`, `in`) — everything measured on the paper: the calibration ruler you type in, caliber, extreme spread, and every result in the report when the results selector is set to absolute rather than angular. Because these are bullet-scale measurements, they are shown to finer precision than the suite's general small-length default: **2 decimals in mm, 3 in cm and inches**.

Internally the engine works exclusively in millimetres and metres, and conversion happens only at the display boundary. This has a practical consequence worth knowing: **changing your unit preference never alters stored data or any computed result.** Switch from mm to inches and every existing project re-displays correctly — the calibration you typed as 100 mm last year now reads 3.937 in, describes the same ruler, and yields exactly the same dispersion statistics.

**Where units are shown.** Fields that take a value carry the unit as a live suffix on their label — *"Real-world distance (in)"* — which updates when you change your preference rather than being baked into the translation. Displayed values carry the unit inline: *"ES 1.78 in"*. The CSV export names the unit in each column header (§8.7).

**The one override.** The report's **Results display units** selector (§8.1) can re-express the statistics in **mrad** or **MOA** instead of a length. It governs the legend and Numbers table only; the page header and the diagram's scale bar keep following your global preference, and the CSV export ignores it entirely, since raw coordinates are always a length.

Throughout this manual, worked examples are written in millimetres and metres for concreteness. Read them as "whatever your configured unit is".

---

## 4. Quick start

For the impatient. Details follow in §5–§9.

1. **Rifle Precision** from the tool menu → **Add project**. Give it a name, the distance, the caliber. Save.
2. **Add target** → **Choose photo…** → pick a photograph of your target sheet → rotate if needed, drag the crop corners in if you want → **Use this photo**.
3. You land straight in the marking workspace, on the **calibration** step. Tap one end of the ruler in your photo, tap the other end, type the real distance between the two taps — in your own units, as the field's label says — and tap **Done calibrating**.
4. Tap where you aimed. That places the **point of aim**.
5. Tap every bullet hole. Keep tapping. When done, **Done adding shots**.
6. **Add group** and repeat from step 4 for each further group on the sheet.
7. Back out to the project. **Add target** for the next sheet, or, when you have enough shots, **View report**.

Do not expect the report to say anything trustworthy until you are past about twenty shots. See §8.6.

---

## 5. Projects

### 5.1 Creating a project

**Add project** opens a short form:

- **Project name** — required. If you type a name that already exists in your library, a warning appears telling you that saving will overwrite the existing entry. It is a warning, not a block.
- **Range** — the distance from muzzle to target. Entered and displayed in whatever distance unit you have configured in **Settings** (m, yd or ft); stored internally in metres regardless, so changing your preference later re-displays existing projects correctly rather than corrupting them.

  This value drives every angular conversion in the report, so make sure the number matches the unit shown beside it. If your preference is set to metres and you type `100` for a target you actually shot at 100 *yards*, every mrad and MOA figure in the report comes out about 9 % small — and nothing anywhere will warn you, because 100 m is a perfectly plausible thing to have meant.
- **Caliber** — chosen either from the standard caliber-designation dropdown (the same one the Arsenal uses) or typed in directly, in your configured small-length unit. This is used to draw impacts at true bore diameter on the report diagram, and nowhere else — it does not affect any statistic.

### 5.2 The project list

Each saved project shows its name and its target count. Once a project has enough marked shots to compute aggregate statistics, its row additionally shows the headline result — the aggregate **R50** in both mrad and MOA — and a coloured **confidence badge** giving the confidence rating at a glance (see §8.6). This lets you scan a list of a dozen load-development projects and see immediately which ones you have actually shot enough to believe.

Two hints can appear on a project row:

- **Unusable targets present** — at least one target in this project is missing something and is being excluded from the analysis.
- **No usable targets found** — nothing in this project can be analysed yet.

### 5.3 Per-project actions

- **Edit** / **Delete** — deleting a project deletes all its targets, groups, shots and photographs. You are asked to confirm.
- **Backup to file** — writes this one project, photographs and all, to a JSON file.
- **Set as cartridge precision…** — hands this project's measured precision to an Arsenal cartridge. See §10.3.

---

## 6. Adding a target

### 6.1 Photographing the target

The quality of your photograph sets a hard ceiling on the quality of every number the tool will later produce. It is worth thirty seconds of care.

- **Shoot square to the paper.** The tool applies a single uniform scale factor derived from your two calibration points. It does not correct perspective. A photograph taken at an angle compresses one axis relative to the other, and that error goes straight into your dispersion numbers, differently in the horizontal and the vertical. Stand in front of the target, hold the camera perpendicular to the paper, and fill the frame with the sheet.
- **Include a ruler, in the plane of the paper.** Tape a steel rule or a printed scale to the target face before you shoot it, or lay one on it before photographing. A ruler held in front of the target, closer to the camera, will read larger than the paper and will make your groups look smaller than they are.
- **Use a long calibration baseline.** Calibration error is a percentage error on every single result. If you calibrate against a 20 mm feature and your taps are 1 pixel off, that is a much larger relative error than the same 1-pixel slop across a 200 mm baseline. Use the longest known-length feature available.
- **Flat, even light.** Bullet holes in paper are shadows. Harsh side lighting turns each hole into a comet with a bright rim and a dark tail, and you will end up marking the shadow rather than the hole.
- **Do not over-resize.** The app downsizes very large images for storage, but you want enough resolution that a bullet hole is comfortably several pixels across when zoomed in.

### 6.2 Importing the photo

**Add target** → **Choose photo…** opens your device's file/camera picker. Once a file is picked you get a preview screen with three operations:

- **Rotate left** / **Rotate right** — 90° at a time. Note that rotating resets the crop selection back to full-frame, because a crop rectangle drawn before a rotation no longer refers to the same part of the image.
- **Crop** — drag the corner handles inward. Leave them at the edges to keep the whole photo. Cropping away the empty parts of the frame is worthwhile: it means more of your screen is target when you zoom in to mark.
- **Use this photo** — commits. Rotation and crop are applied together, in one pass, against the original full-resolution image, not against the downscaled preview you have been looking at. Picking a file alone never creates a target; only this button does.

Confirming takes you straight into the marking workspace.

If the file cannot be decoded you get *"Could not process that photo"* — try a different format (PNG and JPEG are the safe choices).

---

## 7. Marking a target

The marking workspace is a full-screen pannable, zoomable view of the photograph with a step indicator and controls beneath it. It walks you through three steps in order — calibration, point of aim, impacts — and then parks in an idle state from which you can add further groups.

**Everything autosaves.** Every point you place, every point you drag, every impact you delete is written to storage immediately. There is no save button and no way to lose work by navigating away.

**Everything is draggable.** There is no separate "confirm this point" action anywhere: tapping *is* placing. If a point lands slightly off, zoom in and drag it. Both calibration points, the active group's point of aim, and every one of the active group's impacts can be nudged at any time.

Only the **active** group's points are draggable. Other groups' points of aim remain visible as static reference dots, so you can see the whole sheet's layout without being able to disturb work you have already finished.

### 7.1 Step 1 — Calibrate the scale

*"Tap the photo at the first calibration point — one end of a ruler or a known-length feature on the target."*

Tap once for the first point, once more for the second, then type the **real-world distance** between the two taps.

**Type it in your own units.** The field's label carries a live unit suffix — *"Real-world distance (mm)"*, *"(cm)"* or *"(in)"* according to your small-length preference — so lay a 6-inch rule on the target with inches selected and you simply type **6**. No conversion, no arithmetic, nothing to get backwards. The value is converted to the engine's internal millimetres on the way to storage, which is why changing your preference later re-displays the same ruler correctly instead of corrupting it.

The input's step and its smallest accepted value are that unit's own display precision — 0.01 mm, or 0.001 cm/in — so anything you can be shown you can also type.

The calibration line drawn on the photograph is labelled with the same value in the same unit, and it drops pointless trailing zeros: a 100 mm ruler reads *"100 mm"*, not *"100.00 mm"*. Check that label before moving on; it is the one number in the project that everything else is scaled by, and a slip here scales an entire target's results without producing anything that looks like an error.

The calibration line is drawn in green with its length labelled. Zoom in and drag the endpoints until they sit exactly on the marks you measured between.

**Done calibrating** advances. This is a deliberate explicit step rather than an auto-advance, so that fiddling with the endpoints or re-typing the length while double-checking your work never kicks you out of the step unexpectedly.

**Recalibrate**, available later from the idle state, returns you here without discarding the points you already placed. Recalibrating rescales every measurement on that target retroactively — impacts are stored as positions on the photograph, not as millimetres, so fixing a bad calibration months later fixes all its results too.

### 7.2 Step 2 — Point of aim

*"Tap the photo to place this group's point of aim."*

One tap. Mark where you *aimed*, not where the group landed. Drawn as a red crosshair ring.

Placing the POA immediately advances to the impact step.

### 7.3 Step 3 — Mark impacts

*"Tap the photo to record each bullet hole — keep tapping to add more."*

Tap each hole. Each impact is drawn as a numbered dot in your configured **impact color** (Settings → Impact color, shared with the Hit Probability tool), ringed with a white-and-dark double edge so it stays visible against any part of a real photograph — black bull, white paper or printed artwork. There is no limit per group.

As soon as a group has two or more shots, the live overlay draws the **extreme spread** line between the two furthest-apart holes, labelled with its length, and marks the group's **average point of impact** — its centroid. The ES line follows the impact color too, so the whole group reads as one unit.

Both labels on screen — the ES length and the green calibration length — are in your configured small-length unit.

Tap consistently. Whether you mark the centre of each hole or its top-left edge matters less than doing the same thing every time; a systematic offset applied to every shot cancels out of the dispersion, a random one does not.

**Delete impact** switches into a deletion mode: *"Tap the impact you want to remove, or Cancel to keep it."* Tap a shot's own marker to remove it, Cancel to leave the mode. This is a separate mode rather than a long-press or a swipe precisely because deleting a shot from a dataset you are trying to keep honest should require intent.

The **Done adding shots** button does what it says on the tin — it returns this whole mechanism to the so-called "idle" state.

### 7.4 Multiple groups per target

From the idle state — *"Pick a group below to keep adding shots to it, or add a new group"* — you get a tab strip with one tab per group, each labelled with its number and shot count.

- Tapping a group's tab makes it active and re-enters the impact step, so you can append more shots to a group you thought you had finished.
- **Add group** starts a fresh group: you are taken back to the point-of-aim step, and the new group's shots begin from there.

Each group's own line shows its shot count and its **ES** — extreme spread, the distance between its two furthest-apart impacts, in your configured small-length unit. This number is shown because everyone wants to see it and because it is useful for spotting a mismarked shot, but bear in mind it is exactly the statistic this entire tool exists to stop you from relying on.

### 7.5 Save group overview image

Downloads a PNG of the **currently active group** exactly as marked — point of aim, numbered impacts, the extreme-spread line and its label, the average point of impact, and the calibration line with its length — cropped to whatever you currently have zoomed and panned to on screen. Impacts are drawn at the project's true caliber.

The exported image is a faithful copy of what is on screen: same impact color, same double edge, and both labels — extreme spread and calibration length — in the same units you are looking at. Worth remembering if you are posting the image somewhere, since the recipient has no way to know which unit preference was active when you saved it. If the image is going to an imperial audience, switch your preference before exporting.

The calibration line is included here even though the live marking view only shows it during the calibration step itself — an exported image should carry the evidence of its own scale.

Useful for a load-development notebook, a forum post, or handing a gunsmith evidence of a problem, without exporting the whole project.

### 7.6 When is a target usable?

A target must have **all three** of the following before it can contribute to a report:

1. a completed **calibration** (both points placed *and* a non-zero real length entered),
2. at least one group with a **point of aim**,
3. at least one **impact**.

A target missing any of these carries an **Unusable** badge and a hint spelling out exactly what is still needed — *"Requires: calibration, at least 1 impact"*. Unusable targets are silently excluded from the pooled report; they are not an error, just not yet finished.

---

## 8. The precision report

**View report** appears on a project once at least one of its targets is usable. The report pools every shot from every usable group on every usable target into a single analysis.

The heading line under the title restates the project's parameters and the sample size: *range, caliber, N shot(s)*. Check it. If the shot count is not what you expect, you have an unusable target somewhere.

### 8.1 Results display units

A selector at the top governs the units of every value in the legend and the Numbers table below. It offers three choices:

- **your configured small-length unit** — the option is labelled with the actual unit (`mm`, `cm` or `in`, whichever you set in Settings), not with a generic word, so you can see at a glance what you are about to read. This is the absolute, linear size on the paper, shown to 2 decimals in mm and 3 in cm or inches.
- **mrad** — milliradians, to 3 decimals.
- **MOA** — minutes of angle, to 2 decimals.

Angular units are converted using the project's own distance. Linear units are what was actually measured; angular units are what your scope turret is calibrated in. For comparing rifles shot at different distances, use angular — a 20 mm group at 100 m and a 40 mm group at 200 m differ by a factor of two in absolute numbers, but reflect the same (angular) precision. For thinking about whether a bullet will fit through a hole, use linear.

### 8.2 The aggregate diagram

**Aggregate results** is the pooled scatterplot: every shot in the project, each drawn relative to its own group's point of aim, all on one common origin. The **Legend** sits beside it and lists every element currently drawn, with its colour, its name, and its value.

Three elements are always drawn and cannot be switched off:

- **All impacts** — the pooled shots, drawn in your configured **impact color** (Settings → Impact color; the default is a dark berry) with the same white-and-dark double edge used in the marking view, so dots stay legible where they overlap each other or the grid. The legend swatch reads from the same source, so it can never disagree with what was drawn.
- **Point of aim** (red crosshair) — at the origin, by construction,
- **Point of impact** (orange) — the pooled centroid.

The impact color is read at draw time, so changing it in Settings shows up the next time the diagram renders — including in an exported SVG.

Everything else is optional, and every optional element is toggled from the **Show on image** column of the Numbers table (§8.4) or from **Image options** (§8.5). Toggling anything updates the diagram, the legend and the exported image together — what you see is exactly what you export.

### 8.3 What the numbers mean

Every value below is displayed in whatever the **Results display units** selector is set to (§8.1). The worked examples here are written in millimetres for concreteness; read them in your own unit.

**Shot count** — how many shots were pooled. This is the number that matters most, and the one everybody wants to be smaller than it needs to be.

**Confidence interval** — expressed as a pair of percentages, e.g. `-15%/+22%`. This is the 95 % confidence interval on the dispersion estimate itself. Read it as: *the true dispersion of this rifle is, with 95 % confidence, somewhere between 15 % smaller and 22 % larger than the number I am showing you*. This single line is the honesty check on everything else on the page.

**Average POI / zero** — where the group centre sits relative to the point of aim, as a horizontal and vertical pair, always shown with an explicit sign. This is your zero error.

The convention is the shooter's: **positive H is right, positive V is up**, the same directions your turrets are marked in. So a reading of `H +6 mm, V -14 mm` means your rifle is shooting **6 mm right and 14 mm low**, and correcting it means coming left and up.

**POI confidence interval** — how well you actually know that zero error, as `H ±…, V ±…`. This is the number that tells you whether it is worth touching your turrets. If your POI offset is 8 mm low and the confidence interval on it is ±11 mm, you have not measured a zero error; you have measured noise. Keep shooting.

**Standard deviation (sigma, σ)** — the dispersion parameter of the fitted model. Not directly useful at the bench, but it is the quantity from which every radius below is derived, and it is the quantity the confidence interval applies to.

**R50** — the radius of the circle, centred on the point of impact, containing 50 % of shots. Classically called the **circular error probable** (CEP). This is the single best headline number for a rifle's precision: it is a median, so it is robust, and it is the form the rest of this application consumes (§10.3).

**R95** — the radius containing 95 % of shots.

**R99** — the radius containing 99 % of shots. Beware of reading too much into this one: you are extrapolating the tail of a fitted model well beyond where you have data, and the model assumes no fliers exist.

**The R95 confidence interval** — the R95 radius with its own uncertainty band, shown on the diagram as a pale ring of finite thickness rather than a line. This is a good element to leave switched on: it makes the uncertainty visible geometrically instead of hiding it in a table.

**ES5x** — the average extreme spread you should *expect* from a five-shot group fired by this rifle. **ES10x** — likewise for ten shots.

These two deserve a paragraph, because they are the bridge between this tool and the way everyone else talks about precision. If your project says ES5x = 22 mm, that means: if you go out and shoot five-shot groups with this rifle, they will *average* 22 mm. Not "will be" — *average*. Some will be 14 mm and some will be 32 mm, and the 14 mm one is the one that ends up on the internet. ES5x is the honest version of the number you were about to brag about, and it also lets you sanity-check this tool against your own past records.

**1 MOA reference** — a dashed circle exactly one MOA in diameter at the project's distance, with its real-world size captioned. A ruler for the eye: it makes "is this a sub-MOA rifle" a question you answer by looking rather than by arithmetic.

### 8.4 The Numbers table

Every statistic above, in one table: **Description**, **Designation**, **Value**, and **Show on image**. The checkbox in the last column adds that element to the diagram, to the legend, and to the exported image simultaneously. Shot count, confidence interval and average POI have no checkbox — the first two are not geometric, and the POI is always drawn.

### 8.5 Image options

- **Save legend with results image** (on by default) — whether the SVG export includes the legend panel and confidence gauge, or is just the bare diagram. See §8.7.
- **Grid** — an optional reference grid at **0.1 mrad**, **0.05 mrad**, **1/4 MOA** or **1/8 MOA** spacing, or none. The spacing is angular, so its real-world size is computed from the project's distance. Set it to your scope's click value and the diagram becomes directly readable in turret clicks.
- **Impacts to scale** (on by default) — draws each impact at the project's true bore diameter instead of a fixed marker size. This is the honest rendering, and it is also the one that makes a good rifle at short range look like an unreadable blob of overlapping circles. Switch it off when overlap gets in the way.
- **1 MOA** — the dashed reference circle described above.
- **Hit probability radius** — a slider from 0 % to 99 %. Drag it and a dark-red circle appears on the diagram at the radius containing that fraction of shots. The readout gives that radius three ways at once — in your configured length unit, in mrad, and in MOA — so you can read it against a target size, a reticle subtension or a turret scale without converting anything by hand.

  This is the practical form of *"how big does the target have to be for me to hit it nine times out of ten?"* — and, run backwards, *"what fraction of my shots land in a target this size?"*

  **It is a radius, not a diameter.** A 100 mm gong has a 50 mm radius, so drag the slider until the readout says 50 mm and read the percentage off the slider. Halving this is the single easiest mistake to make here, and it flatters you by a lot.
- **Scale** — a scale bar on the diagram, so the exported image can be read without the legend.

Every one of these settings — the units selector, every Show-on-image checkbox, the grid, the image options, the slider position — is remembered and restored the next time you open any report, including after restarting the app. They are view preferences, not project data: they follow you from project to project.

### 8.6 The Confidence-o-meter

A vertical gauge with a pointer, and the single most important widget on the page.

It answers one question: **have I shot enough to be saying anything at all?** The pointer's position is driven by the width of the confidence interval on the dispersion estimate — narrow interval, high pointer. The bar is banded, bottom to top: **MEANINGLESS**, **POOR**, **FAIR**, **GOOD**, **EXCELLENT**, with a dashed line at the top of the MEANINGLESS band captioned, with characteristic restraint, *"(bullshit threshold)"*.

Below that line, your data does not support any claim about your rifle.

The panel beside the gauge gives a verbal quality, a **confidence rating** on a 0-to-4 scale with plus grades, and the confidence margin as a total percentage plus its two bounds.

Here is what that costs in ammunition. These figures are exact, and they are a property of the mathematics, not of your rifle — a good rifle does not reach confidence any faster than a bad one:

| Shots | Confidence margin | σ known to | Rating | Quality |
|---:|---:|:---|:---:|:---|
| 3 | 227 % | −40 % … +187 % | 0 | Useless |
| 5 | 124 % | −32 % … +92 % | 0 | Useless |
| 10 | 72 % | −24 % … +48 % | 0 | Useless |
| 15 | 56 % | −21 % … +35 % | 0 | Useless |
| **19** | 49 % | −19 % … +30 % | 1 | Barely significant |
| 22 | 45 % | −18 % … +27 % | 1+ | Poor |
| 27 | 40 % | −16 % … +24 % | 2 | Fair |
| 35 | 35 % | −14 % … +20 % | 2+ | Above average |
| 46 | 30 % | −13 % … +17 % | 3 | Good |
| 65 | 25 % | −11 % … +14 % | 3+ | Very good |
| 99 | 20 % | −9 % … +11 % | 4 | Awesome |

Read the top of that table and read it again. **A five-shot group tells you your rifle's dispersion to within roughly minus a third, plus a factor of two.** Ten shots — two "groups", a respectable session by most people's standards — still leaves you unable to distinguish a rifle from another rifle 40 % worse. You do not cross out of *Useless* until nineteen shots, and you do not get a genuinely tight answer until you are near a hundred.

It follows that the only thing a single 3-shot group posted online actually tells you is something about the poster's own statistical illiteracy — or their intellectual dishonesty.

This is not a defect of the tool. It is what measuring a two-dimensional random variable actually costs, and every precision claim you have ever read that was based on a five-shot group was subject to exactly the same arithmetic — it simply did not tell you.

The good news is that those shots do not have to be fired in one string, or on one day, or onto one sheet of paper. That is the entire point of the project/target/group structure: shoot five rounds a week for five months and let the tool accumulate them.

### 8.7 Exports

**Save image** (next to the Aggregate results heading) writes the diagram as an **SVG** — vector, so it scales to any size without pixelation. With *Save legend with results image* enabled, the exported file carries a header line with the project name, distance, caliber and shot count; the full legend panel; and a rendering of the confidence gauge, so the image is self-contained and cannot be quoted stripped of its uncertainty. The export is generated fresh with a white background, so it prints and pastes into documents cleanly regardless of which app theme you are using.

**Export CSV** writes every pooled shot's raw coordinates, one row per shot:

| Column | Meaning |
|---|---|
| `ShotRight (mm)` | horizontal offset from its group's POA, positive **right** |
| `ShotUp (mm)` | vertical offset from its group's POA, positive **up** |
| `Target` | the target's name |
| `Group` | the group's number within its target |
| `Distance (m)` | the project's distance |
| `Description` | the project's name |

**Every column names both its direction and its unit.** Set inches and yards and the headers read `ShotRight (in)`, `ShotUp (in)`, `Distance (yd)`, with the values converted to match — coordinates to your small-length precision (2 decimals in mm, 3 in cm or inches), the distance to the distance group's own. The file therefore says what it means on its face: nothing about it has to be remembered, looked up, or inferred from the settings that happened to be active when it was written. Column *names* stay in English regardless of app language, since they are identifiers for whatever tool the file is headed for.

The **Results display units** selector does not reach the CSV. It can express statistics angularly, in mrad or MOA, but these are raw coordinates, which are always a length.

> **Format change.** These columns were previously `ShotX` and `ShotY`, and `ShotY` was positive *downward* — the opposite of `ShotUp`. The rename is deliberate: a spreadsheet that referenced `ShotY` by name now fails visibly instead of quietly reading inverted numbers. If you have stored exports, they are in the old convention; negate their `ShotY` to compare them against a new file.

Field and decimal separators follow your **Settings → CSV export** preferences, so the file opens cleanly in whichever spreadsheet locale you use — that governs the *formatting* of the numbers, independently of the units above. This is the escape hatch: if you want to run your own analysis, fit your own model, or check the tool's arithmetic, this is your raw data.

---

## 9. Backup, restore and data management

The tool's storage lives in your browser. Back it up.

- **Backup to file** (per project) — one project, self-contained.
- **Backup library to file…** — a dialog letting you select which projects to include, then a single JSON file containing all of them.
- **Load backup from file…** — imports a previously saved file.

Photographs travel inside the backup file, which makes these files large but makes them genuinely complete: a restored project is fully re-markable and fully re-analysable.

### Import conflict handling

Imported projects are matched against your existing library **by name**, case- and whitespace-insensitively. Where a name collides you choose how to resolve it:

- **Overwrite** — the imported version replaces the existing one.
- **Overwrite if newer** — replaces only if the imported project's modification timestamp is later than the existing one's; otherwise it is skipped. The safe choice when merging two devices.
- **Rename** — imports as a copy, named *"<name> - copy (1)"*, and so on.

The import reports how many items were saved and how many skipped. If the file is not valid JSON, or is valid JSON but not a Rifle Precision export, you get a specific error rather than a silent no-op.

---

## 10. Putting it to work

### 10.1 Load development

The temptation is to shoot one three-shot group per charge weight, pick the smallest, and declare a node. The table in §8.6 tells you exactly what that procedure is worth: at three shots the dispersion estimate spans roughly a factor of five. You are selecting noise.

The correct procedure with this tool is:

1. One **project per load**. Identical names except for the varying parameter, so the project list sorts sensibly.
2. Shoot each load repeatedly, over multiple sessions, adding targets to its project as you go.
3. Watch the confidence badge on the project list. Keep shooting until each candidate is at least out of the *Useless* band, and preferably at *Fair*.
4. Compare loads by **R50 with its confidence interval**, not by R50 alone.

The decision rule is simple and it is strict: **if the confidence intervals of two loads overlap, you have not shown them to be different.** They may well be different — but not on your evidence. Either shoot more, or accept that you cannot tell them apart and choose on some other basis (velocity consistency, component availability, what you already have a case of).

This rule will, if you apply it honestly, disqualify most load-development conclusions in the shooting literature. That is by design — that "majority of conclusions" is illiterate bullshit.

### 10.2 Zeroing

The **average POI** and its **confidence interval** are the zeroing tools, and the CI is the one people skip.

The rule: **do not dial until the POI confidence interval is smaller than the correction you are about to make** — and ideally smaller than one turret click at your distance. If your POI reads 12 mm low ±15 mm, dialling is a coin flip that will move your zero somewhere you did not measure. Shoot more, watch the interval shrink, then dial once.

Set the results units to **mrad** or **MOA** to match your turrets, and the correction becomes a number you can dial directly instead of one you have to convert from a linear measurement at a remembered distance.

The signs are the ones on your turret caps — positive V is up, positive H is right — so the correction is the reading with its sign reversed: a POI of `V -14 mm` needs 14 mm of up.

Set the **Grid** to your scope's click value and read the correction directly off the diagram in clicks.

### 10.3 Feeding the rest of the suite

**Set as cartridge precision…** on a project row hands its measured precision to an Arsenal cartridge. The dialog lists every project with computable statistics, showing each one's aggregate R50 in mrad and MOA along with its confidence badge, so you can see what you are about to commit to. Picking one writes that R50 into the chosen cartridge.

From there it flows into **Hit Probability**, which combines it with wind uncertainty, range-estimation error and shooter skill to produce first-round hit probabilities at range. This is the payoff of the whole exercise: the difference between a hit probability calculated from a measured, confidence-bounded R50 and one calculated from a number you remembered off a five-shot group is the difference between a scientific calculation and a rose-tinted illusion.

Arsenal stores rifle precision internally as R50 in mrad, but accepts input in whichever convention you find easiest to quote — R50, R95, R99, ES5 or ES10 — converting to R50 automatically (§11.7). If you are typing a number in by hand rather than picking a project, use the convention you actually measured.

### 10.4 Sanity-checking your equipment

Two quick uses that fall out of the numbers:

**Is my scope's magnification matched to my rifle?** *A scope helps you see better, not shoot better.*

If your rifle's R95 is within roughly 1–1.5 MOA, a 12x or 15x scope is entirely sufficient to comfortably aim at the smallest target you can reliably hit — and that's before wind, range, muzzle-velocity spread, and the other sources of error that stack on top. Higher magnification can be useful for other things — identifying the target, observing, reading wind, and so on — but for aiming itself it is dead weight: you are overscoped, and the money spent on that extra magnification would do more good spent on something else.

**Is a "flier" a flier?** Switch on **R99** and look at where the shot in question falls. A shot inside R99 is not a flier; it is the tail of your normal distribution behaving exactly as predicted. Genuine fliers sit conspicuously outside it. This will, in most cases, deprive you of your favourite excuse.

---

## 11. Geek's delight: the model and the mathematics

Everything below is what the tool actually computes, with the derivations. It is not required reading for using the tool, and it is the most interesting part of the tool.

**Units throughout this section are the engine's, not yours.** Internally the tool works exclusively in **millimetres** for lengths on the paper and **metres** for range, and every user-facing unit — mm, cm, inches, yards, feet, mrad, MOA — is a conversion applied at the display boundary and nowhere else. No statistic below is affected by your preferences; changing your units changes how a number is printed, never what was computed.

### 11.1 The underlying model

The tool assumes that the horizontal and vertical miss distances of a shot, measured from the group's true centre, are **independent, zero-mean, normal random variables of equal variance σ²**:

$$x \sim \mathcal{N}(0, \sigma^2), \qquad y \sim \mathcal{N}(0, \sigma^2), \qquad x \perp y$$

This is the standard circular-normal (isotropic bivariate normal) model of shot dispersion. Its consequence is that the **radial** miss distance $r = \sqrt{x^2 + y^2}$ follows a **Rayleigh distribution** with parameter σ:

$$f(r) = \frac{r}{\sigma^2} \exp\left(-\frac{r^2}{2\sigma^2}\right), \qquad F(r) = 1 - \exp\left(-\frac{r^2}{2\sigma^2}\right)$$

One parameter, σ, describes the entire dispersion. Every radius the tool reports is a quantile of this one distribution, and the confidence interval on every one of them is the confidence interval on this one parameter.

**The assumptions, stated honestly.** The model is isotropic: it assumes vertical and horizontal dispersion are equal. Real rifles frequently violate this — vertical stringing from velocity variation is the classic case, and horizontal stringing from wind another. The model has no provision for fliers, for a heteroscedastic mixture, or for a group centre that wanders between sessions (barrel heating, fouling, a bipod that walks). It is nonetheless the right default: it is one-parameter, so it converges about as fast as anything can, and its failure modes are visible by eye on the scatterplot. If your pooled cloud is visibly an ellipse rather than a circle, the σ you are being shown is a compromise between two different numbers, and this is worth keeping in mind.

Note also that the tool measures the dispersion of the *whole system as you fired it* — rifle, ammunition, optic, rest, and shooter. It cannot separate those. A project shot off a bipod in wind measures you and the weather as much as the rifle.

### 11.2 Pooling

For each shot $i$ in group $g$ on target $T$:

1. The shot and its group's point of aim are stored as fractions of the photograph's natural pixel dimensions, in $[0,1]^2$. They are converted to native pixels by multiplying by the photo's width and height.
2. The target's scale $s_T$ (px/mm) comes from its calibration ruler:

   $$s_T = \frac{\sqrt{(\Delta x_{\text{px}})^2 + (\Delta y_{\text{px}})^2}}{L_{\text{real}}}$$

   where the numerator is the pixel distance between the two calibration points and $L_{\text{real}}$ is the length you typed, in mm.
3. Pixel coordinates are divided by $s_T$ to give millimetres.
4. The shot is re-centred on its own group's point of aim:

   $$(x_i, y_i) = (x_i^{\text{mm}} - x_{g,\text{POA}}^{\text{mm}},\; y_i^{\text{mm}} - y_{g,\text{POA}}^{\text{mm}})$$

Storing positions as photo fractions rather than as millimetres is what makes retroactive recalibration work: fixing the ruler months later rescales every impact on that target automatically. It is also what makes the tool unit-agnostic by construction — a stored shot has no unit at all, only a position on an image. Millimetres enter for the first time at step 2, via $L_{\text{real}}$, which is itself converted from whatever unit you typed it in; from there the whole pipeline is metric, and your preferred units reappear only when a finished number is printed.

**Coordinate frame.** The photo fraction's origin is the image's top-left corner and its vertical axis increases **downward**, so the pooled $y_i$ are positive *below* the point of aim. The engine keeps that frame all the way through, deliberately: it is also SVG's frame, which is what lets the diagram draw pooled shots, radius circles, the grid and the POI box straight from these millimetres with no transform at all.

It has no effect on any dispersion statistic. Every quantity from §11.3 onward depends on $y$ only through squared deviations from the mean, and those are invariant under a sign flip. It matters only for the one signed quantity the tool reports — the vertical zero offset — which is read by a human against a turret and must therefore be positive *upward*.

That conversion happens at exactly one place, a `toShooterFrame()` helper mapping $(x, y) \mapsto (x, -y)$, through which all three human-readable paths pass: the Numbers table's average POI, the legend's point-of-impact row (and with it the SVG export's legend), and the CSV's `ShotUp` column. The renderer bypasses it, because the picture was always right.

The two frames are a genuine hazard when they are implicit, which is the argument for naming the boundary rather than scattering negations: earlier versions of this tool carried a second, contradictory up-positive convention in an unused per-group offset pair, and its accompanying comment asserted the opposite of what the report actually displayed. Those fields have been removed.

The pooled sample is the union of these re-centred shots across all groups and all targets. Each target contributes through its own scale factor, which is why photographs taken at different distances combine correctly.

**Bounds.** Fewer than 3 pooled shots returns `tooFewShots`; more than 1000 returns `tooManyShots`. The raw pooled list is returned regardless, so CSV export works even when the statistics do not.

### 11.3 Estimating σ

Let $n$ be the pooled shot count and $(\bar{x}, \bar{y})$ the sample centroid. The per-axis sample variances use the Bessel-corrected denominator $n-1$:

$$v_x = \frac{1}{n-1}\sum_i (x_i - \bar{x})^2, \qquad v_y = \frac{1}{n-1}\sum_i (y_i - \bar{y})^2$$

and are averaged, since the model asserts they estimate the same quantity:

$$v = \frac{v_x + v_y}{2}$$

Now, $\sqrt{v}$ is **not** an unbiased estimator of σ, even though $v$ is unbiased for σ². The square root is concave, so by Jensen's inequality $E[\sqrt{v}] < \sqrt{E[v]} = \sigma$: the naive estimator is biased *low*, and increasingly so for small samples. The tool corrects for this exactly.

Under the model, $\dfrac{k \, v}{\sigma^2} \sim \chi^2_k$ with

$$k = 2(n-1)$$

degrees of freedom — two per shot, less two for the estimated centroid. The expectation of the square root of a chi-square variable is known in closed form,

$$E\left[\sqrt{\chi^2_k}\right] = \sqrt{2}\,\frac{\Gamma\!\left(\frac{k+1}{2}\right)}{\Gamma\!\left(\frac{k}{2}\right)}$$

which gives the unbiasing factor

$$c_n = \sqrt{\frac{k}{2}} \cdot \frac{\Gamma\!\left(\frac{k}{2}\right)}{\Gamma\!\left(\frac{k+1}{2}\right)}, \qquad k = 2(n-1)$$

and the estimator the tool actually uses:

$$\boxed{\hat{\sigma} = c_n \sqrt{v}}$$

This is the exact analogue of the $c_4$ correction factor from statistical process control, generalised to $2(n-1)$ degrees of freedom. The factor is shipped as a precomputed lookup table indexed by $n$ from 2 to 1000, and it agrees with the closed form above to all ten stored decimal places at every entry:

| n | 2 | 3 | 5 | 10 | 20 | 50 | 100 | 1000 |
|---|---|---|---|---|---|---|---|---|
| $c_n$ | 1.1284 | 1.0638 | 1.0317 | 1.0140 | 1.0066 | 1.0026 | 1.0013 | 1.0001 |

At $n=2$ the correction is 12.8 %, which is not a rounding detail — an uncorrected two-shot estimate understates dispersion by an eighth. By $n=20$ it is below 1 % and by $n=100$ it is cosmetic, but it costs a table lookup, so there is no reason not to be exact.

### 11.4 The confidence interval on σ

Same chi-square pivot, used the other way round. With $k = 2(n-1)$,

$$\Pr\left(\chi^2_{0.025,k} \le \frac{k\,v}{\sigma^2} \le \chi^2_{0.975,k}\right) = 0.95$$

Rearranging for σ² and taking square roots gives the two-sided 95 % interval, expressed as multipliers on the point estimate:

$$\boxed{\;\lambda_{\text{lo}} = \sqrt{\frac{k}{\chi^2_{0.975,k}}}, \qquad \lambda_{\text{hi}} = \sqrt{\frac{k}{\chi^2_{0.025,k}}}\;}$$

so that the interval is $[\lambda_{\text{lo}}\hat\sigma,\ \lambda_{\text{hi}}\hat\sigma]$. The tool stores the *variance*-ratio bounds $k/\chi^2$ in its lookup tables and takes the square root at use; the unbiasing factor and $\sqrt{v}$ cancel algebraically out of the ratio, so the multipliers depend on $n$ alone and not on your data at all. Verified against the exact chi-square quantiles, every table entry matches to seven decimal places.

The **confidence margin** displayed in the UI is simply $\lambda_{\text{hi}} - \lambda_{\text{lo}}$, and the displayed percentages are $(\lambda_{\text{lo}} - 1)$ and $(\lambda_{\text{hi}} - 1)$.

The asymmetry is severe at small $n$ and is the mathematical heart of §8.6. At $n=5$: $\lambda_{\text{lo}} = 0.676$, $\lambda_{\text{hi}} = 1.916$. Your five-shot estimate is compatible with a true dispersion two thirds of what you measured, and equally compatible with nearly double it. At $n=2$ the upper multiplier is $\sqrt{39.5} = 6.28$.

The interval narrows as $O(1/\sqrt{n})$ — the usual, brutal rate. Halving the width costs four times the ammunition.

### 11.5 The precision radii

Every radius is the inverse Rayleigh CDF at the corresponding probability. Setting $F(r) = p$ and solving:

$$r_p = \sigma\sqrt{-2\ln(1-p)}$$

which yields the reported constants directly:

| Statistic | Derivation | Multiplier on σ | Used |
|---|---|---|---|
| **R50** (CEP) | $\sqrt{2\ln 2}$ | 1.17741 | 1.18 |
| **R95** | $\sqrt{-2\ln 0.05}$ | 2.44775 | 2.45 |
| **R99** | $\sqrt{-2\ln 0.01}$ | 3.03485 | 3.03 |

R50 is the Rayleigh **median**, which is why it is the preferred headline figure: it is the most robust quantile of the distribution and the least sensitive to the model's tail assumptions.

The interactive **hit-probability slider** is the same formula evaluated continuously. Given a percentage $p$, it computes

$$r = \sigma\sqrt{-\ln\left((1 - p/100)^2\right)} \;=\; \sigma\sqrt{-2\ln(1 - p/100)}$$

— the two forms are algebraically identical. The slider is capped at 99 % because $p = 100$ sends the logarithm to infinity.

The **R95 confidence interval** drawn on the diagram is $[\lambda_{\text{lo}} R_{95},\ \lambda_{\text{hi}} R_{95}]$ — the σ interval propagated through a linear scaling, which is exact, since $R_{95}$ is proportional to σ.

### 11.6 Expected extreme spread — ES5x and ES10x

Extreme spread is the maximum pairwise distance among $n$ shots:

$$\text{ES}_n = \max_{i<j} \lVert p_i - p_j \rVert$$

This is the **diameter of the convex hull** of the sample, and it has no tractable closed form for the bivariate normal beyond $n=2$. Its expectation is obtained numerically (large-sample Monte Carlo integration over the circular-normal), and is linear in σ by scale invariance:

$$E[\text{ES}_5] = 3.06\,\sigma, \qquad E[\text{ES}_{10}] = 3.79\,\sigma$$

These are the ES5x and ES10x figures. Note their most important property: **they are expectations, not bounds.** The extreme spread of a single group is itself a random variable with substantial spread of its own — which is precisely why it is a terrible estimator and why this tool goes to the trouble of not using it.

Notice also the shape of the relationship. Going from 5 shots to 10 shots per group increases the *expected* group size by 24 %, purely because you have given the sample more chances to produce an extreme pair, with no change whatsoever in the underlying rifle. This is the mechanism by which "my rifle shoots half-MOA groups" and "my rifle shoots MOA groups" can both be true statements about the same rifle, differing only in how many shots the speaker fires before measuring. Extreme spread is not a property of the rifle; it is a property of the rifle *and the sample size*, and quoting it without the latter is meaningless.

Because ES grows with $n$ while σ, R50 and R95 do not, only the latter are comparable across shooters. This is the argument for R50 in one sentence.

### 11.7 Convention conversions

For interoperability with the rest of the suite — Arsenal stores rifle precision as R50 in mrad — any convention converts to σ by dividing by its multiplier from §11.5, and σ converts to R50 by multiplying by 1.1774. ES5 and ES10 divide by 3.06 and 3.79 respectively. So, for example, a rifle quoted as a 1 MOA ten-shot rifle has

$$\sigma = \frac{1.0}{3.79} = 0.264\ \text{MOA} \quad\Rightarrow\quad R_{50} = 1.1774 \times 0.264 = 0.311\ \text{MOA}$$

which is a useful thing to be able to do in your head at a gun shop.

### 11.8 The confidence interval on the point of impact

A different problem from the dispersion interval, and a different pivot. The pooled centroid $(\bar{x}, \bar{y})$ estimates the true group centre; its uncertainty is the standard error of a mean, which for a normal population with unknown variance is a Student's *t* problem:

$$\text{CI}_x = t_{q,\,n-1} \cdot \frac{\sqrt{v_x}}{\sqrt{n}}, \qquad \text{CI}_y = t_{q,\,n-1} \cdot \frac{\sqrt{v_y}}{\sqrt{n}}$$

Note that the per-axis variances $v_x$ and $v_y$ are used **separately** here, not the pooled average $v$ — so the POI confidence interval is genuinely elliptical and will honestly report a rifle that strings vertically as being better-known horizontally than vertically. (The dispersion estimate of §11.3 pools them; the POI estimate does not. This is deliberate: the isotropy assumption is a modelling choice for the radial quantiles, but there is no reason to impose it on a simple mean.)

The quantile is taken at

$$q = 1 - \frac{0.05}{4} = 0.9875$$

rather than the naive 0.975. This is a **Bonferroni correction across the two axes**: the displayed interval is a *joint* 95 % region over horizontal and vertical simultaneously, so each axis is allocated α/2 = 0.025 of total error, split two-tailed into 0.0125 per tail. Taking 0.975 per axis would give two marginal 95 % intervals whose joint coverage is only about 90 %. Verified against exact *t* quantiles at $q = 0.9875$ with $n-1$ degrees of freedom, the shipped table matches to five decimal places throughout.

The interval is drawn on the diagram as a dashed box around the POI marker.

### 11.9 The Confidence-o-meter's scale

The gauge maps the confidence margin $c = \lambda_{\text{hi}} - \lambda_{\text{lo}}$ to a pointer position, and separately to one of eight discrete rating levels.

The **discrete rating** is a threshold scan over

$$[0.5,\ 0.45,\ 0.4,\ 0.35,\ 0.3,\ 0.25,\ 0.2,\ 0]$$

returning the index of the first threshold that $c$ exceeds — level 0 ("Useless") for $c > 0.5$, level 7 ("Awesome") for $c \le 0.2$. Levels are labelled on a 0–4 scale with plus grades: `0, 1, 1+, 2, 2+, 3, 3+, 4`.

The **continuous pointer position** $\phi \in [0,1]$ is a two-piece linear map, clamped at both ends and meeting exactly at $c = 0.5$:

$$\phi = \begin{cases} (1.5 - c) \cdot 0.2 & c > 0.5 \\[4pt] 1 - (c - 0.2)\cdot\frac{8}{3} & c \le 0.5 \end{cases}$$

Check the junction: at $c = 0.5$ the upper branch gives $(1.5-0.5)\times 0.2 = 0.2$ and the lower gives $1 - 0.3 \times 8/3 = 0.2$. Continuous.

The design consequence is that the bottom 20 % of the gauge — the "MEANINGLESS" band, everything below the **bullshit threshold** at $c = 0.5$ — absorbs the entire range $c \in (0.5, 1.5]$, while the upper 80 % expands the range $c \in (0.2, 0.5]$ across the six meaningful grade boundaries. In other words, the gauge deliberately compresses the region where your data is worthless into a single visual band and spends its resolution where the distinctions matter. A 3-shot group ($c = 2.27$) and a 10-shot group ($c = 0.72$) both sit near the bottom, and correctly so: neither tells you anything, and the gauge declines to flatter the difference between them.

The threshold at $c = 0.5$ corresponds to $n = 19$. That is the tool's considered opinion on the minimum sample size for a defensible precision claim, and it is derived, not asserted.

### 11.10 Angular conversion

Angular results use the suite's shared exact conversions rather than the usual field approximations. Both units are converted through their exact radian measure: one milliradian subtends exactly $1/1000$ of the range, and one minute of angle subtends

$$1' = \frac{\pi}{10800} = 2.908882 \times 10^{-4}\ \text{rad}$$

which is 0.29089 mm per metre of range, or **1.0472 inches at 100 yards** — not the "1 inch" of shooter's shorthand. That shorthand carries a 4.7 % error, which is larger than the difference between many of the loads people try to distinguish.

$$\theta_{\text{mrad}} = \frac{d_{\text{mm}}}{\text{range}_{\text{m}}}, \qquad \theta_{\text{MOA}} = \frac{d_{\text{mm}}}{0.29089 \cdot \text{range}_{\text{m}}}$$

The grid spacings offered in Image options (0.1 mrad, 0.05 mrad, 1/4 MOA, 1/8 MOA) have their real-world millimetre spacing computed from the project's own distance at the moment you select them, which is why the grid remains a true angular reference regardless of the range you shot at.

### 11.11 Numerical notes

- The **extreme spread** search is brute-force $O(n^2)$ over pairs within a group. Groups are small; a rotating-calipers hull diameter would be asymptotically better and practically irrelevant.
- The lookup tables ($c_n$, both chi-square multipliers, the *t* quantiles) are shipped precomputed for $n = 2 \ldots 1000$ rather than evaluated at runtime. They are exact statistical constants, verified analytically as documented above, and shipping them avoids carrying a special-function library for gamma and incomplete-beta into a browser bundle.
- The 1000-shot ceiling is the table bound, not an algorithmic limit. If you have fired more than a thousand rounds into one project, you have earned the right to split it.

---

## 12. Provenance and licence

The Rifle Precision Calculator is the successor to **TARAN**, a standalone tool by the same author. The statistical core — the model, the correction factors, the confidence tables, the Confidence-o-meter and its irreverence — is carried across deliberately unchanged, so that results from the two tools are directly comparable. The mrad conversion is the one deliberate departure: the legacy constant carried a factor-of-ten error and has been corrected against the suite's own exact angular conversions.

What is new is the structure around it: a project/target/group hierarchy with per-target calibration in place of a single flat pixel-coordinate model, retroactive recalibration, drag-to-adjust marking, persistent storage with backup and merge, SVG and CSV export, and integration with the rest of the ballistics suite.

The suite is licensed **AGPL-3.0-or-later**. The legacy TARAN code it derives from is GPLv3, © 2015 the same author.

---

*Peaceful. Precise. Armed.*
