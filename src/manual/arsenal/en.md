# geladen.ch ballistics User Manual — Guns/Arsenal section

*Part of the* [geladen.ch ballistics suite](https://bc.geladen.ch)*. The rifle and bullet library shared by every other tool.*

---

## 1. What this tool is for

Every other tool in this suite eventually asks you the same three questions: what rifle, what bullet, what load. Trajectory asks it. Hit Probability asks it. Range Solver asks it. Answering it by hand each time — retyping a sight height, a ballistic coefficient, a muzzle velocity you have quoted from memory a hundred times — is tedious and a little insulting to your intelligence, and computers were invented specifically so nobody would have to do this shit by hand.

Arsenal is where you answer those questions **once**, for each rifle and each bullet you actually own, and then never again. A rifle you save carries its sight height, its zero range, its rifling twist, its scope's click values. A bullet you save carries its caliber, its mass, its drag data. A cartridge — a specific load fired from a specific rifle — ties one bullet to one muzzle velocity, and optionally to the two hardest-won numbers of all: how consistent that load's velocity actually is, and how precisely that rifle actually shoots it, both of which you would otherwise be tempted to guess.

Once saved, your rifles and bullets show up **everywhere** a rifle or bullet can be picked in this app, sitting alongside the built-in catalog and marked with a leading `*` so you always know which is yours. Pick your rifle once in Guns, and Trajectory, Hit Probability, and Range Solver all already know what you are shooting.

### What it is not

It is not a ballistics calculator itself. Arsenal stores the *inputs* — BC, twist rate, muzzle velocity, and so on — that the Trajectory engine and Hit Probability consume; it does not compute a drop chart on its own, beyond the small Comparison feature described in §7, which exists specifically to let you compare two saved configurations against each other.

It is not the **Rifle Precision Calculator**, which measures a rifle's actual mechanical dispersion from photographs of shot groups. Arsenal consumes that tool's output — see §5.6 — it does not produce it.

---

## 2. Privacy, storage and requirements

**Nothing you put into this tool leaves your device.** There is no account, no upload, no telemetry. Your rifles and bullets are stored in your browser's own `localStorage`, on your own machine, and are read back from there. All computation runs in JavaScript in your browser.

The corollary is the one you would expect: **if you clear your browser's site data, your Arsenal is gone.** There is no server-side copy to restore from. Use the backup functions (§8) if the data matters to you — and Arsenal tells you, item by item, when something has never been backed up (§9).

Unlike Rifle Precision, Arsenal stores no photographs and no large binary data, so its footprint in `localStorage` is small regardless of how many rifles and bullets you keep. There is no built-in cap on how many of either you may save.

**Requirements.** Any reasonably current browser. The app installs as a PWA and works fully offline once loaded.

---

## 3. The data model: Bullets, Rifles, Cartridges

Three kinds of record, and one relationship between them that is worth understanding before you start clicking:

```
Bullet        a specific projectile: caliber, mass, drag data
Rifle         a specific rifle: sight height, zero range, twist, scope clicks
  └─ Cartridge   one load fired from that rifle: a Bullet + a muzzle velocity
```

**A Bullet** stands alone. It describes a projectile — its caliber, its mass, and either a ballistic coefficient against a standard drag model or a custom-measured drag curve — and nothing about what it is fired from. The same bullet record can be referenced by cartridges on several different rifles.

**A Rifle** stands alone too, in the same sense: it describes the platform — sight height above bore, the range you normally zero it at, its rifling twist rate and direction, and the click value of its scope's turrets — and nothing about what it fires. A rifle has **no caliber of its own**; its caliber is whatever its cartridges' bullets say it is (§5.5).

**A Cartridge** is what actually connects the two. It lives nested inside a rifle, never on its own, and it names one bullet plus the muzzle velocity that rifle achieves with it. This is also where the two most consequential, and most commonly guessed-at, numbers in external ballistics optionally live: the load's muzzle-velocity consistency (§5.4) and the rifle's own measured precision (§5.6) — both feeding directly into Hit Probability.

**A rifle chambers one caliber.** The moment any cartridge on a rifle resolves to a real bullet, every other cartridge you add to that rifle has its bullet picker locked to bullets of that same caliber (§5.5). This is enforced, not just suggested — it reflects a fact about rifles, not a limitation of the tool. (And if you own a drilling or other combination gun that spans more than one caliber, don't get clever about it — just create a separate rifle entry per caliber.)

### 3.1 A note on units

**Every number this tool shows you, and every number it lets you type, is in the units you chose in Settings** — with two deliberate exceptions, both called out below.

The unit groups in play:

- **Velocity** (`m/s`, `ft/s`, `mph`, `km/h`) — muzzle velocity and its standard deviation.
- **Distance** (`m`, `yd`, `ft`) — a rifle's zero range, and the Comparison chart's maximum range.
- **Small length** (`mm`, `cm`, `in`) — sight height, caliber, and bullet length. Caliber and length are shown to a finer bullet-scale precision (2 decimals in mm, 3 in cm and inches), the same precision the Rifle Precision tool uses for the same reason.
- **Rifling twist** (`mm`, `in`) — its own unit group, deliberately **independent** of small length. A shooter who thinks in millimetres for sight height very often still quotes twist rate the traditional way, as inches per turn, and switching your general small-length preference will not silently convert a twist rate you typed as "1:8 in" into a number in millimetres you no longer recognise.
- **Temperature** (`°C`, `°F`) — a cartridge's reference temperature for velocity-vs-temperature sensitivity.
- **Mass** — bullet weight is the one field that is never behind a single unit preference. It is shown as a **live-linked pair of boxes**, grams and grains side by side; type into either one and the other updates immediately. This reflects how bullet weight is actually quoted in the wild — grains in load-development circles, grams almost everywhere metric — rather than forcing a choice.

**The two exceptions**, both by design:

- **Scope clicks** (a rifle's horizontal and vertical click value) carry their **own** unit choice, mrad or MOA, picked once per rifle and independent of your global angular-dispersion preference. The field says so directly: *"Always in the unit selected here, independent of the unit preferences in Settings."* A scope's turret is engraved in one unit for its whole service life — and owners of MOA-graduated scopes suffer enough already without this tool also forcing a manual conversion to sane units on them.
- **A cartridge's rifle-precision value** (§5.6) likewise carries its own unit choice, mrad or MOA, independent of the same global preference, for the identical reason: a rifle's own measured group size should not silently reinterpret itself the next time you flip a Settings toggle unrelated to that rifle.

Internally the engine works exclusively in metres, metres per second and kilograms; conversion happens only at the display boundary. Changing your unit preference never alters stored data — a sight height typed as 45 mm still reads as 1.772 in if you switch, and describes exactly the same rifle.

---

## 4. Quick start

For the impatient. Details follow in §5–§9.

1. **Guns** from the tool menu, or the **Change** link shown next to the current rifle/bullet summary in Trajectory, Hit Probability or Range Solver → **Arsenal** tab.
2. **+ Add Bullet** first if you have not saved one yet. Name it, give it a caliber and a mass, and either a ballistic coefficient with a drag model or a pasted Cd-Mach table. **Save bullet**.
3. **+ Add Rifle**. Name it, set its sight height and zero range at minimum; twist rate and scope clicks if you know them. **Save rifle**.
4. On the newly active rifle, **+ Add Cartridge**. Name the load, pick the bullet you just saved (or add one inline), and type the muzzle velocity. **Save cartridge**.
5. Your rifle is now ready to pick anywhere in the app. Press **Done** to make it the app's active rifle, or keep adding more rifles and cartridges first.

A rifle with zero cartridges is saved but flagged **Unusable** (§6.4) — it cannot become the app's active rifle until it has at least one.

---

## 5. Bullets and cartridges

### 5.1 Adding a bullet

**+ Add Bullet** opens a form:

- **Name** — required. A live warning appears if the name already exists in your library; saving overwrites the existing entry. It is a warning, not a block.
- **Manufacturer** — free text, with autocomplete drawn from both the built-in bullet libraries and your own saved bullets. Left blank, it is stored as *"Custom"*.
- **Caliber** — **required**. A dual control: a dropdown of standard caliber designations (*"Select caliber…"*) plus a free-typed number in your configured small-length unit. Pick a designation and the exact bore diameter is filled in; type a number instead and, if it lands within 0.03 mm of a known designation, that designation is selected automatically — otherwise the dropdown shows **Other** without discarding what you typed. This is the identical designation list and matching logic the Rifle Precision tool uses for its own caliber field.
- **Length** — optional, and left blank if unknown. It feeds two things and nothing else: bullet stability (Miller's formula) and spin drift, described in §5.5 and §9.3 — both of this suite's spin-drift methods, the simple Litz formula and the fuller McCoy 4-DOF model, need it equally.
- **Mass** — required, entered as the linked gram/grain pair described in §3.1.
- **Drag data** — required, and mutually exclusive:
  - **Ballistic coefficient + standard model** — a BC value (0.05–1.5) paired with a drag model (G1, G7, and the suite's other standard models).
  - **Custom Cd-Mach table** — for a bullet whose own measured drag curve you have (e.g. from published radar data), pasted as plain text: one Mach-and-Cd pair per line, at least two rows, Mach strictly increasing down the list, each Cd between 0.05 and 3.0. The form parses it live and reports how many rows it found, or exactly which line is wrong — "Line 3: Mach values must increase strictly from one row to the next," for instance, rather than a generic parse failure.
- **Source / notes** — free text, optional. Where the number came from, or what you actually measured and how.

### 5.2 The bullet list

**Your Bullets** lists every saved bullet: name, a **Not backed up** badge if it has never been exported to a file since it was last changed, then manufacturer, caliber and weight, and a last-modified date. Each row offers **Backup to file**, **Edit**, and **Delete**.

**Deleting a bullet cascades.** If any cartridge, on any rifle, currently references the bullet you are deleting, the confirmation names exactly how many cartridge configurations will be deleted along with it. There is no way to delete a bullet while leaving a dangling reference behind.

### 5.3 Adding a rifle

**+ Add Rifle** opens a form:

- **Name** — required, with the same overwrite warning as bullets.
- **Sight height** — required, height of the scope's optical axis above the bore, in your small-length unit (0–500 mm range). Feeds Trajectory's drop calculation for any configuration that uses this rifle.
- **Zero range** — required, the distance you normally zero this rifle at, in your distance unit (0–5000 m range).
- **Rifling twist (distance per turn)** and **Twist direction** (right or left) — optional, left blank if unknown, in the independent twist-rate unit described in §3.1 (1–1000 mm/in range). Needed for stability and spin-drift, nothing else.
- **Click unit**, **Horizontal click value**, **Vertical click value** — the scope's own turret values, in mrad or MOA as chosen here (0.01–5, independent of your global preference, per §3.1).
- **Source / notes** — free text, optional.

A brand-new rifle saves with an empty cartridge list; you add its cartridges next, from the rifle's own row (§5.4).

### 5.4 Adding a cartridge

Cartridges are managed from the **active rifle's** own card, never from a standalone form — a cartridge is meaningless without the rifle it belongs to. **+ Add Cartridge** opens a form:

- **Name** — required, e.g. *"175 SMK, 41.5 gr N550"*. A live warning appears if another cartridge on the *same* rifle already has this name; names may repeat freely across different rifles.
- **Bullet** — **required**. A dropdown offering every bullet in your Arsenal, `*`-prefixed, alongside the visible built-in libraries, each bracketed with its own library name. A new cartridge starts on **"+ Add new bullet…"** rather than an arbitrary first entry, so a careless save can't attach the wrong projectile.

  **Picking a built-in bullet copies it into your library.** Because a cartridge must point at *your own* bullet record (so that later edits to the built-in catalog cannot retroactively change a load you have already characterised), saving a cartridge against a built-in bullet silently makes a one-time copy of it into **Your Bullets**, and points the cartridge at that copy from then on. A notice says so before you save; if a same-named bullet already exists in your library, a second warning tells you the copy will overwrite it.

  If the rifle already has another cartridge with a resolved bullet, the picker is **locked to that bullet's caliber** — see §5.5.
- **Muzzle velocity** — required, in your velocity unit (50–1500 m/s).
- **Muzzle velocity varies with temperature** — an optional checkbox pair: **Reference temperature** (the temperature the muzzle velocity above was measured or chinographed at) and **Velocity change per degree** (0–20 m/s per °C range for the sensitivity value itself). Leaving the checkbox off omits both; the hint above the pair — *"Assumes the cartridge is at the same temperature as the air (the temperature entered above)"* — is worth reading if you shoot the same load across a wide seasonal temperature range.
- **Muzzle velocity consistency (SD)** — optional, marked *"used only by the Hit Probability tool"*. If you have a chronograph's own reported standard deviation for this load, enter it here (0–20 m/s) and Hit Probability will offer it as a ready-made *"This rig's"* option for its velocity-uncertainty input, instead of you having to remember or re-type it there.
- **Specify rifle precision for this cartridge** — optional, described fully in §5.6, also *"used only by the Hit Probability tool"*.

### 5.5 Caliber locking and stability

A rifle carries no caliber field of its own (§3). Instead, **the first cartridge you attach to a rifle sets that rifle's caliber**, implicitly, for every cartridge added afterward: the bullet picker on any *subsequent* cartridge on that rifle only offers bullets of the matching bore diameter. The lock releases only if you are editing the rifle's one remaining cartridge — at that point there is nothing left to be consistent with, and you may pick any caliber again.

Every cartridge row, and the cartridge form itself, additionally shows a live **stability chip** — `Stable`, `Marginal`, or `Unstable`, with the computed gyroscopic stability factor Sg beside it — the moment all five inputs it needs are known: bullet mass, caliber, length, this cartridge's muzzle velocity, and the rifle's twist rate. Missing any of the five shows **"Stability unknown"** instead, with a collapsible *"What's needed?"* hint listing exactly which of the five is absent. See §9.3 for the formula.

### 5.6 Rifle precision on a cartridge

This is the direct bridge between Arsenal and both the Rifle Precision tool and Hit Probability.

Checking **"Specify rifle precision for this cartridge"** reveals:

- **Precision is expressed as** — a choice between **"Own (bench) rifle precision"** and **"Simplified (combined) rifle + shooter precision"**. The first is what the rifle itself groups, mechanically, off a rest. The second is what you, this rifle, and your normal field position produce together — a rougher, more honest number for anyone who isn't a dedicated benchrester. Hit Probability treats the two completely differently: the first is combined *with* a separate shooter-skill estimate there; the second *replaces* that combination outright and switches Hit Probability's own "simplified" toggle on to match.
- **Precision value**, expressed under whichever of five conventions you actually have a number for — **R50**, **R95**, **R99**, **5-shot group ES**, or **10-shot group ES** — and in mrad or MOA, independent of your global angular preference (§3.1). Whichever you pick, the value is converted and stored as **R50 in mrad** internally, so entering the same physical group size under a different convention or unit always produces the same stored precision — there is exactly one internal representation, and the form exists purely so you can enter the number in whatever form you actually measured it in. Switching the unit selector converts the displayed number in place, so the physical group size you typed is preserved rather than reinterpreted.
- The accompanying hint does not mince words: *"Be honest. Use average, not best. Refer to the Rifle Precision tool for meaningful and trustworthy values."*
- **"Pick from a Rifle Precision project…"** — opens a picker listing every Rifle Precision project with enough pooled shots to compute a usable figure, each row showing its R50 in both mrad and MOA alongside its own confidence badge (the identical badge the Rifle Precision report uses, §8.6 of that tool's manual) — so you are choosing a number you can also see the trustworthiness of, not a bare figure. Picking a project fills in R50/mrad/"Own" automatically; you still need to press **Save cartridge** for it to stick. If no project yet qualifies, the picker says so plainly: *"You don't have any Arsenal cartridges yet — add a rifle and cartridge first"* is shown on the Rifle Precision side when the reverse is true (no eligible rifle/cartridge to receive a measurement); the equivalent message here is *"No Rifle Precision project has enough data yet for a usable precision figure."*

**The reverse path — from Rifle Precision into Arsenal — is documented in full in §10.1.**

---

## 6. The Arsenal page: lists, filters, activation

### 6.1 Page layout, top to bottom

1. A short intro reminding you that everything here lives on this device and shows up marked with `*` everywhere a rifle or bullet is picked.
2. The **Comparison** summary and section, only shown once 1–2 configurations are queued for it (§7).
3. **Backup library to file…** / **Load backup from file…** (§8).
4. **Active rifle** — the one rifle currently under your hand.
5. A **filter card** — caliber and manufacturer filters, hidden entirely when your library is empty.
6. **Other rifles**.
7. **Your Bullets**.

### 6.2 The active rifle and activation

Exactly one rifle+cartridge combination is "active" across the whole app at any moment — the same configuration Trajectory, Hit Probability and Range Solver all read from. On the Arsenal page, this is shown in its own **Active rifle** card, pre-seeded from whatever configuration was already running if it happens to be an Arsenal rifle; if the app's current configuration is a hand-typed one instead, the card says so: *"The currently selected rifle is manually defined and is not listed in your Arsenal."*

**Clicking any row under "Other rifles" activates it** — moves it into the Active rifle card — rather than opening it for editing directly; **Edit** is only offered on whichever rifle is currently active. This is deliberate: picking a rifle and editing a rifle are different intentions, and the more common one (I want to shoot with this one) gets the plain click.

Activation on the Arsenal page is provisional. **Nothing is committed to the app's shared configuration until you press Done.** You can freely browse between rifles, edit several in a row, and only the one showing in the Active rifle card when you leave takes effect. If that rifle currently has zero cartridges, Done leaves whatever configuration was already running untouched, rather than clearing it to nothing.

The active rifle's cartridge picker remembers which cartridge you last had selected for it, restored the next time you visit.

### 6.3 Cartridges under the active rifle

Each cartridge on the active rifle is its own row: name, an **Active** badge on whichever one is currently picked, its muzzle velocity, and the live stability chip from §5.5. Clicking a row makes it the active cartridge. **+ Add Cartridge** sits beneath the list.

A rifle with no cartridges shows a warning in place of the list: *"This rifle has no cartridges defined. This configuration is unusable and will not be set active."*

### 6.4 Badges

- **Not backed up** — this bullet or rifle has been created, edited or imported since it was last written to a backup file. Never shown on a built-in entry, since those need no backup.
- **Unusable** — a rifle with zero cartridges. Title text on hover: *"No cartridges defined — this rifle cannot be made active."* Such a rifle is still clickable, so you can reach it to add its first cartridge.
- **Active** — the cartridge currently picked on the active rifle.

### 6.5 Filters

Two dropdowns, **Filter by caliber** and **Filter by manufacturer**, defaulting to **All calibers** / **All manufacturers**. They narrow each other: picking a manufacturer shrinks the caliber list to calibers that manufacturer's bullets actually come in, and vice versa. Caliber options are ordered by actual bore diameter rather than alphabetically, so `.223`, `6.5mm` and `.308` sort the way a rack of ammunition does, not the way a dictionary does. A rifle matches a filter only through its cartridges' bullets — rifles carry no caliber of their own, as noted in §3.

**Reset filters** clears both. The whole card disappears when your library — bullets and rifles together — is empty, since there is nothing yet to filter.

There is no free-text search; filtering is by caliber and manufacturer only.

---

## 7. Comparing two configurations

Any rifle+cartridge row carries an **Add to comparison** toggle, capped at **two** slots — once two are queued, every other row's toggle disables with *"Remove a configuration from comparison first"*. A **For comparison** summary card lists whatever is currently queued, each with its own Remove.

Once exactly two configurations are queued, a full **Comparison** section appears: a shared atmosphere-and-wind control, a shared maximum-range field, and a trajectory chart — the same column choices, zoom and pan controls, and SVG export as the Trajectory tool's own chart — drawing both configurations as two series with a shared legend.

The comparison is **re-resolved live** against your Arsenal on every render, keyed by rifle and cartridge identity rather than a frozen snapshot: edit one of the two rifles while it is queued and the chart updates immediately.

This selection is **session-only** — it is not saved data, and resets the next time you reload the app. Its purpose is a quick side-by-side ("is the heavier bullet's flatter trajectory worth its slower start, at the ranges I actually shoot") rather than a permanent record.

---

## 8. Backup, restore and data management

Arsenal's storage lives in your browser. Back it up — see §2 for what happens if you do not.

### 8.1 Exporting

- **Backup to file**, on any single bullet or rifle row, exports just that one item. For a rifle, the file bundles it together with every bullet its cartridges actually reference, so a single rifle's backup is always self-sufficient and re-importable on its own.
- **Backup library to file…** opens the **Save Library** dialog: a checkbox against every bullet and every rifle you own, all checked by default. Checking a rifle automatically checks the bullets its cartridges need; unchecking a bullet automatically unchecks any rifle that needs it — the dialog will not let you export a rifle with a dangling bullet reference. **Export** writes one JSON file containing everything checked.

Every successful export clears the **Not backed up** badge on everything it included.

### 8.2 Importing

**Load backup from file…** opens a file picker (JSON only). A file that is not valid JSON, or valid JSON that is not an Arsenal export, is rejected with a specific message rather than a silent no-op. A well-formed file opens the **Load Library** dialog:

- Anything whose name matches an existing item in your library — compared case- and whitespace-insensitively — carries a **conflict badge** stating whether the incoming copy is newer, older, the same age, or of unknown age relative to your existing one, based on each item's last-modified timestamp.
- **If a name already exists in your library** — a select offering three strategies, applied to every conflicting item in this import:
  - **Overwrite existing** — the imported version replaces yours outright.
  - **Overwrite only if newer** — replaces only when the incoming item's timestamp is strictly later than your existing one's; otherwise that item is skipped. The safe default when merging backups from two devices.
  - **Keep both (rename the imported copy)** — imports as a new item named *"\<name\> - copy (1)"*, incrementing until the name is free, so nothing already in your library is ever touched.
- **Import** applies your choices and reports the outcome: *"{{n}} item(s) imported, {{n}} skipped."*

Rifles import after bullets, and each cartridge's bullet reference is re-mapped to whatever id its bullet actually ended up with in *your* library — so an imported bullet that got renamed to avoid a collision does not leave its imported rifle's cartridges pointing at nothing.

---

## 9. Ballistic data and what consumes it

This section is the geek's-delight companion to §5 — what each field is actually for, mathematically, once it leaves Arsenal.

### 9.1 Drag data → Trajectory and Comparison

A bullet's drag data — BC-and-model or a custom Cd-Mach table — together with its mass, is exactly the input the trajectory engine needs to integrate a drag-retarded flight path. Arsenal's own Comparison chart (§7) runs the identical trajectory engine Trajectory itself uses, fed from each queued configuration's rifle (sight height, zero range) and cartridge (muzzle velocity, and its optional temperature sensitivity, evaluated against whatever reference temperature you gave it).

### 9.2 Muzzle velocity consistency → Hit Probability

A cartridge's **muzzle velocity consistency (SD)**, if you provide it, does nothing inside Arsenal itself. It exists purely so that when this rifle+cartridge combination is the active one, Hit Probability's own velocity-uncertainty input can offer a ready-made **"This rig's"** option instead of asking you to recall or re-measure your chronograph's own figure — with an explicit hint that this cartridge has one available.

### 9.3 Stability and spin drift

The live stability chip (§5.5) computes the gyroscopic stability factor Sg via **Miller's Twist Rule**, re-derived directly in this app's own metric engine units rather than converting through the formula's traditional imperial inputs on every call. Miller's own published formula is a standard-atmosphere estimate with no altitude or air-density term; this engine applies the standard density-scaling refinement on top of it, so a bullet computed as marginal at sea level can show stable at altitude or on a hot day, and the reverse. The three published bands are:

| Sg | Rating |
|---|---|
| < 1.0 | Unstable |
| 1.0 – 1.3 | Marginal |
| ≥ 1.3 | Stable |

The same five inputs — mass, caliber, length, muzzle velocity, twist rate — also drive **spin drift** inside the Trajectory engine for any configuration built from an Arsenal rifle and bullet. This suite offers two spin-drift methods, chosen in Settings: the simple, empirical Litz formula, and a fuller physical model, McCoy 4-DOF. Despite the difference in sophistication, both methods currently need exactly the same five inputs — which is why bullet length and rifle twist, though marked optional throughout this manual, are worth filling in whenever you know them: leaving either blank costs you spin drift and a stability estimate, silently, everywhere this rifle is used, regardless of which method you've selected.

### 9.4 Rifle precision → Hit Probability

Covered in depth in §5.6 and, from the other direction, in §10.1. In short: a cartridge's stored `precision` — mode (`own` or `combined`) plus an R50 in mrad — is read by Hit Probability the moment this rifle+cartridge becomes the active configuration there. An **"own"** value pre-fills Hit Probability's bench-precision input and leaves shooter skill as a separate, independent input to be combined with it. A **"combined"** value instead pre-fills the simplified, already-combined input and switches that tool's simplified mode on, since a combined figure has shooter skill baked in already and should not be combined with it a second time.

---

## 10. Putting it to work

### 10.1 Feeding a measured rifle precision back into Arsenal

The Rifle Precision Calculator measures your rifle's actual, confidence-bounded dispersion from real shot groups (see that tool's own manual). Once a project there has enough pooled shots to compute a usable figure, its row grows a **Set as cartridge precision…** button.

Pressing it opens a picker listing every Arsenal rifle that has at least one cartridge, each with a cartridge dropdown. Pick the rifle and load you actually shot that project with, and you are taken straight to Arsenal, with that exact rifle and cartridge already made active and its **Edit cartridge** form already open — pre-filled with **"Own (bench) rifle precision"** checked and the project's aggregate R50, converted to mrad, sat in the value field. Nothing is written until you press **Save cartridge** — this is a hand-off into a form you review, not a silent background write.

This is the single most important workflow this tool supports, because it is the one that makes the rest of the suite honest: a Hit Probability figure computed from a bench-precision value you actually measured, with its own known confidence interval, is worth categorically more than one computed from a number you remembered off a five-shot group. Do this every time you finish a load-development project in Rifle Precision, not just once when you first set a rifle up — your precision estimate only gets better as that project accumulates more shots, and the cartridge record does not update itself.

### 10.2 Setting up a new rifle from scratch

1. **Add the bullet(s) first.** If you shoot more than one load through a rifle, save every bullet before you start on cartridges — the inline "+ Add new bullet…" option in the cartridge form is convenient for a single load, but pre-loading your bullet library makes a multi-load rifle faster to set up and keeps your bullet list a genuine catalog rather than a byproduct of whichever cartridge you happened to add first.
2. **Measure sight height and zero range accurately.** These two feed Trajectory's drop calculation directly and are the two numbers most likely to already be sitting in your rifle's data book if you keep one — copy them in rather than estimating.
3. **Fill in twist rate even if you think it will not matter.** It is free information already printed on your barrel or in its spec sheet, and it is the one field standing between "Stability unknown" and a live, useful chip on every cartridge that rifle carries — with no per-cartridge cost, since it lives once on the rifle.
4. **Add one cartridge per load, not per range session.** A cartridge record describes a load, not an outing; naming it something like *"175 ELD-M, 2650 fps, N550"* keeps it identifiable months later, when you have several similar entries across several rifles.
5. **Leave rifle precision blank until you have actually measured it.** A confident-sounding number you typed from memory is worse than no number at all, because Hit Probability cannot tell the difference — it will treat a guess with exactly the same weight as a hundred-shot, confidence-bounded measurement. Use §10.1's hand-off once you have real data instead.

### 10.3 Comparing two loads before you commit to one

Suppose you are deciding between two bullets for the same rifle, or the same bullet at two different seating depths with correspondingly different velocities. Save both as separate cartridges on the rifle (or on two rifle entries, if the seating-depth change means two different named configurations to you), queue both for comparison (§7), and set the shared maximum range to whatever distance you actually care about. The chart answers the practical question — which one is flatter, which one retains more velocity, where do the two trajectories cross — without you needing to run Trajectory twice and hold two sets of numbers in your head at once.

### 10.4 Keeping a multi-rifle collection sane

Once you own more than two or three rifles in the same general caliber family, the filter card (§6.5) is what keeps the page navigable — filter by caliber to see only the rifles chambered for what you are working on right now, or by manufacturer if you are comparing several rifles' worth of the same maker's bullets. The **Not backed up** badge (§6.4) doubles as a running to-do list: at the end of a session where you added or edited several entries, glance down the page for that badge rather than trying to remember what you touched, and run **Backup library to file…** to clear them all at once.

---

## 11. Provenance

Arsenal has been part of the suite from its first commit, growing incrementally: multiple built-in bullet libraries and manufacturer autocomplete; unit-preference fixes across the cartridge list and bullet length; the current 4-DOF trajectory engine and the spin-drift/twist-direction fields it uses; and, most recently, muzzle velocity consistency and rifle precision on cartridges, together with the direct hand-off from the Rifle Precision Calculator described in §10.1 — the integration that turns two previously separate tools into one measured pipeline.

The suite is licensed **AGPL-3.0-or-later**.

---

*Peaceful. Precise. Armed.*
