# geladen.ch ballistics User Manual — Truing Session

*Part of the* [geladen.ch ballistics suite](https://bc.geladen.ch)*. Experimental.*

---

## 1. Before you start: do you need this tool?

The rifle and the app disagree: you dial what the app predicts, and the bullet lands somewhere else. The miss alone does not say why. A wrong muzzle velocity, a wrong BC, a shifted zero, a scope that gives less than its stated click value, and a bad wind call can all produce the same miss. This tool plans a short session that tells those causes apart, guides you through shooting it, and reports what it found. When two causes cannot be separated, it says so.

It is the last step of setting up a rifle, not the first. It cannot work out a rifle you know nothing about, and it will not take you to extreme long range on its own. Each unknown you bring to the session costs it precision on all the others.

### 1.1 Do the basics first

1. **Muzzle velocity and its temperature drift.** Chronograph at least 10 rounds of the same lot and enter the average in Arsenal, with the temperature you measured it at. For the drift, repeat on a day at least 15 °C (27 °F) warmer or colder and enter the change per degree. Let the ammunition reach the air temperature first, keep it out of the sun, and do not leave a round sitting in a hot chamber before you fire it. Typical drifts are 0.5–2 m/s per °C. A wrong drift is a wrong velocity on any day that is not the day you measured: 10 m/s off, which is only 10 °C at 1 m/s per °C, looks like a 4.6 % BC error at 800 m.
2. **Sight height to 2–3 mm (0.1").** Measure it from the bore axis to the scope axis. Do not use a typical value for the mount. An error here is largest near the rifle and is easily mistaken for a zero error.
3. **Your zero.** Check it with a real group on the day, shot level in calm air. The Rifle Precision tool shows how well a group locates the point of impact. A single three-shot group often places it less precisely than you would expect.
4. **Scope tracking (click value).** Do a tall-target test, or the shorter version: at a known distance, dial a known number of clicks between two shots and measure how far the impact moves (1 mm per metre of distance is 1 mrad). A scope that is 2 % off looks like a wrong BC at distance.
5. **A reliable BC or drag curve.** Use a Doppler-measured G7 BC or a custom Cd-Mach curve rather than a figure from a box. A G1 BC for a long boat-tail bullet is a compromise that holds only over part of the flight. If the maker publishes several BCs for speed bands, the Multiple BC tab of BC Tools combines them into a drag curve.

The Prepare page of this tool has the same checklist, plus your rifle's dispersion and velocity spread. Ticking an item tells the planner that the cause is already settled, so it spends fewer rounds on that cause and more on the ones still open. Done properly, the homework fixes most disagreements between rifle and app before any truing. After it, the BC should be the only real unknown left.

### 1.2 If you can, measure the BC directly

There are two direct ways to measure a BC, and either is usually at least as precise as a truing session:

- **An original Labradar** that writes per-shot track files to its SD card. [Labrabaco NG](#/manual/bc-labradar) (in BC Tools) fits a BC to each recorded track.
- **Two chronographs**, one at the muzzle and one downrange, entered in the BC Calculation tab of BC Tools. Place the downrange unit so that a low shot cannot hit it, and protect it with something solid.

### 1.3 When to go truing

Use this tool when the basics are done and you cannot measure the BC directly. It is also a good way to check a BC you have already measured.

---

## 2. What a session can tell you

### 2.1 Why a planned session and not your DOPE log

A few DOPE entries at a few distances look as if they should be enough to fit everything. They are not. Muzzle velocity, drag and scope tracking change the trajectory in almost the same way over normal shooting distances. Adding more groups of the same kind does not separate them. The fit can only tell them apart if something else fixes one of them: a chronograph, a tall-target test, or a second target placed at a distance chosen to separate them. The tool picks those distances for you.

### 2.2 With a chronograph, and without

A chronograph is the most valuable thing you can bring. A velocity error and a drag error bend the trajectory in nearly the same way, so the shots alone cannot tell them apart. The chronograph measures the velocity directly, in the day's air and at the day's powder temperature, and this leaves the drag as the only large unknown.

- **With a chronograph** that reports every shot as you fire (a Doppler radar or a muzzle-mounted unit), a session on a range reaching about 800 m measures a .308's drag to ±1.5–2 % with 20–30 rounds. That is grade A, and the tool offers to save the result to your cartridge. A BC correction needs at least five chronograph readings recorded during the session.
- **Without a chronograph** the tool never offers a BC correction. The drag figure would then depend entirely on the velocity average you measured on another day, and nothing in the session can check that average. At 800 m, a 1 m/s error in it shifts the drag result by about 0.5 %. The Prepare page may still grade such a plan A; §8.8 explains why that grade is not enough for a BC. If you haven't checked the average either, the session ends at grade C whatever the round count, which is barely better than the published BC. In both cases you still get corrected come-ups for the distances you shot and a zero check. They hold only for those distances and similar air.

Without a chronograph, a session is **much** less useful. If you can borrow one, do. The range matters almost as much: on a range that ends at 600 m, even a chronograph and full homework do not get a .308 past grade B (see §8.8).

### 2.3 The grades

The Prepare page grades the plan before you fire a shot, and the Conclude page grades the result. The grade comes from the uncertainty of the drag scale (one standard deviation):

| Grade | Drag uncertainty | What you get |
|---|---|---|
| **A** | up to 2 % | A real BC correction, valid at other distances and in other weather. |
| **B** | 2–3 % | A BC correction with a wide band. The tool lets you save it, but rely on it only near the distances and conditions you shot in. |
| **C** | 3–4 % | Little more than the published BC. No BC correction. |
| **D** | over 4 % | Corrected come-ups for the distances you shot, and no conclusion about the BC. |

Before any shots, the tool assumes the BC is off by about 4 %. A grade D session therefore learned almost nothing about the drag that was not assumed already.

**Only grade A gives a result you can carry to other distances and other weather.** At B and below, the session has measured the combined effect of all causes, at those distances and in that air. That is useful for those distances, but it does not tell you how much of the effect came from the BC.

### 2.4 Limits

- **Supersonic only.** Every planned target is close enough that the bullet is still above Mach 1.1. This version does not handle transonic and subsonic flight.
- **The tool does not true the muzzle velocity.** The velocity is an input you measured. A chronograph reading during the session corrects it, but the tool never derives a velocity from the come-ups alone. That would only move the error into another cause.
- **Experimental.** The statistics have been checked against simulated sessions with known errors put in on purpose, but the tool has had little real-world use so far. Treat a BC correction as a strong hint to verify, not as a final value.

---

## 3. Prepare

### 3.1 Rifle, location and weather

The tool uses the active rifle and cartridge from Arsenal and the active shooting location. It has no rifle picker of its own.

It keeps its own weather inputs, and nothing you enter in another tool changes them. Enter the **station pressure**, which is what a barometer reads at the range. A phone or weather app usually gives the pressure corrected to sea level (QNH), and that value is wrong here. If the location has an altitude, the tool warns you when the pressure looks like QNH. Read the temperature at the range to about 3 °C. Humidity matters little.

You confirm the conditions before you start. They then stay fixed as the session's starting air, so a weather change made elsewhere later cannot alter shots already fired. A BC correction assumes these conditions were right, because a wrong temperature or pressure ends up in the drag term. The Conclude page reminds you of this.

The zero is taken to have been set level, in calm air, and in the cartridge's zero atmosphere if Arsenal gives one. If it does not, the session's starting air is used. If you zeroed on another day or at another altitude, set the zero atmosphere in Arsenal. This matters mainly for zeros at 200 m or more and hardly at all for zeros at 100 m or less.

### 3.2 Homework

The checklist covers the items in §1.1: zero re-verified on the day, click value tested, sight height measured, muzzle velocity average checked. It also shows the rifle's dispersion and velocity spread from Arsenal, or a preset if Arsenal has none. None of the items is required, but each unticked item is a cause the session has to measure with its own rounds.

Tick an item only if you really did it. The uncertainty bands and the grade treat every ticked item as done. For the zero and the velocity average, the fit also checks your ticks against the shots, and the Conclude page says when the shots contradict one. The click value cannot be checked from the shots. A wrong tick there usually leaves the real error outside the stated band.

### 3.3 Targets and the plan

The tool checks whether your registered targets are far enough out to say anything about drag, and finds the best near/far pair for this cartridge. If they don't reach far enough, or nothing is near the zero range, it asks once whether you have a natural mark you can range, such as a rock or the edge of a berm.

You also say how windy you expect it to be: low to moderate, or strong (the boundary is about 5 m/s, 11 mph, 18 km/h). This affects only the plan and the round count. On the range you set the actual wind for each group.

The "this range is flat" box is never ticked for you. A location cannot tell a range that is flat from one whose slope nobody measured. Tick it only if you know. It switches off the slope checks for this session and never writes an angle anywhere. If the range is not actually flat, a slope you ruled out can be mistaken for a wrong distance or a wrong drag.

If you correct a target's distance or angle here, the correction applies to this session only and the location is not changed. What the session needs is the distance to the backdrop where you see the impacts, which may differ from the distance to the target. To change the location itself, use the Locations manager.

### 3.4 Rounds

You set the total number of rounds, including the ladder's safety steps. Bring 20–25 % more for shots the spotter does not see and for obvious flyers. The plan puts one round at the nearest distance and divides the rest between a middle distance and the far target. The split is chosen to separate the causes as far as they matter at your farthest distance and to reach grade A for the drag. The plan shows how each distance's rounds are divided into strings of at most three.

Below the field the tool suggests four round counts for this range and your homework, each with the grade it gives:

- **minimal**: the fewest rounds that get within 10 % of the optimal drag uncertainty;
- **optimal**: the point where further rounds start to help much less;
- **enhanced**: ten more than optimal, for a noticeably tighter result;
- **deluxe**: twenty more than optimal, for the tightest result.

Pressing one makes the plan for that count. These are minimums that count only rounds whose impact you see, so bring more. Each improvement the tool suggests (a chronograph, more rounds, a zero check, a farther target) is shown with the result it would give next to the current one.

### 3.5 Re-range the far target

Before you start, the tool asks you to measure the far target again. Range it with the rangefinder several times, and check that the beam is not catching something in front of the target. Unless the range is declared flat, also measure its angle with a clinometer.

This is the most important minute of the session. The result depends on the far distance more than on anything else, and the shots can hardly check it, because a target that is farther than you think looks exactly like a bullet with a lower BC. A far distance off by 20 m typically leaves the result about 0.3 mrad off at that target, which is about 30 cm at 1,000 m, and the tool cannot flag it.

Use a backdrop at least 2 m tall (1 m above and below the aim point). With a 1 m backdrop, about a third of sessions lose an impact off it. With 2 m, only a few in a hundred do.

---

## 4. Shoot

### 4.1 The ladder

The tool starts near and moves out one step at a time, only after the previous step has landed on the backdrop. A wrong assumption in the app could put a first long shot well off a distant backdrop, and the ladder avoids that risk. A step is at most four times the farthest distance that has landed. A longer step is allowed only when nothing nearer is left and the prediction says the shot will still land on the backdrop. Before the very first shot, the tool warns you if that shot might miss the backdrop and offers the zero range instead. You can still go on.

If you cannot see where a string hit, press the button for that. This is a normal outcome and it is useful information. The tool drops back to about halfway, and once a group has landed there it tries the missed distance again with the corrected elevation. While untried distances remain below it, a distance that misses again stays in play (up to five misses there). If nothing nearer can be shot, an extra group at a distance that has already landed unlocks the retry. A miss so far out that only a badly wrong BC could explain it lets the ladder allow for an error of that size on its way to the far target. At 800 m on a 2 m backdrop, a .308's BC would have to be about 20 % off. Nearer misses are put down to other causes. If misses repeat, check first that the cartridge's BC and drag model match their published source, then the zero, the muzzle velocity and the pressure you entered.

If the next planned distance is more than four times the farthest that has landed, or the backdrop is too small for it, the tool says which. Only then does it ask for an intermediate distance; a natural mark counts, and you can answer "none available". On a location with no intermediate ground the ladder can stop short of the far target, and the Prepare page warns you about that in advance.

### 4.2 Each string

You shoot strings of at most three rounds and record after each one, because nobody can reliably read the centre of a dozen impacts at 800 m. The first pass visits each planned distance once, nearest first. After that, each string goes to the distance with the most rounds left (the farther one on a tie), and each is dialed from the latest fit. You cannot choose the order.

Before each string the tool shows what to dial, elevation and windage, in the unit and with the direction signs set for Range Solver, with a 95 % band. Before anything is recorded this is the app's own prediction; after that it comes from the fit. Dial it in full. Then record the **come-up that would put the impacts on the point of aim**: what you dialed, corrected by where the impacts landed in the reticle. Enter the whole come-up, not just the correction to the tool's number. Come-ups are entered in scope clicks (positive is up). All other distances, speeds and angles follow your Settings units, and the dial readout also shows clicks when Range Solver is set to mrad or MOA.

You can record a string as its centre (one come-up) or round by round (a come-up for each round and, with a chronograph, its velocity). If the chronograph gave fewer velocities than there were rounds, the tool asks whether to complete them or carry on. The tool does not reject flyers: if a round is an obvious flyer (a clear pull, a gust, a bad release), don't record it, and fire a replacement instead. That is what the extra 20–25 % is for. A value that cannot reasonably be right gets a warning next to the field: mrad typed where clicks are expected, the difference instead of the full come-up, a wrong sign, a missing digit, a speed in the wrong unit. The warning is advice only, and the value is recorded as typed.

For each string you also say how well you could read the impacts in the reticle:

- **Good** (±0.1 mrad, the default): clear impacts, read against the reticle.
- **Fair** (±0.2 mrad): mirage, a busy backdrop, or impacts only half seen.
- **Poor** (±0.3 mrad): a rough idea of where they landed.

Be honest about this. An honest "poor" helps the fit more than a confident guess.

### 4.3 Wind and air

Each group has its own wind, set on the wind dial. It starts from the previous group's wind (calm for the first). The dial readout for the next shot follows the dial as you turn it. **Before recording a group, set the wind (speed and direction) that matches the windage you actually saw.** The tool predicts windage from the wind you set but learns nothing from where impacts land sideways.

With the wind, you say how well you read it: Excellent (±0.5 m/s), Good (±1), Fair (±2) or Poor (±3). The tool always treats the direction as uncertain by 7.5°. Wind and confidence carry over to the next group until you change them.

If the air changes during the session, tick that it has changed and enter what your pocket weather meter reads. Later groups keep the new values until you change them again. Each group's chronograph readings are compared with the velocity the cartridge has in that group's air.

### 4.4 Re-ranging during the session

If the tool suspects that a target's distance or angle is off, it asks you to range it again and, unless the range is flat, to measure its angle. A wrong distance and an unmeasured slope look the same in the shots; only the angle tells them apart. The tool asks once there is about a one-in-five chance that something is wrong, because re-ranging takes seconds and a mis-ranged target is the error the shots can least separate from a wrong drag.

Before your first string at the planned far target, it always asks for this check. You can also do it yourself at any time with "Re-measure" next to the current target's distance and angle. "Confirm" corrects every string already shot there and the dial for the next one. "Cancel" leaves everything unchanged.

### 4.5 The live readout

After each group the tool shows what it has learned so far. It is provisional, and a later group can change it, so it is displayed differently from the final report. Until a chronograph reading or a well-placed shot separates them, it shows "muzzle velocity or drag, not yet separable" rather than guessing.

---

## 5. Conclude

The result is a ranked list of findings, not a single verdict. Each finding shows how likely it is to matter at your longest working distance and how large it is, with its margin. When two causes cannot be separated, they are reported together.

- **Drag (BC).** At grade A or B, with at least five chronograph readings from the session, the tool offers to save the correction to your cartridge (§2.3 says how far to trust a B). You see the numbers before and after the change before you confirm. A result more than about 12 % from the BC in use, or a gain factor outside 0.8–1.2, is never offered. The tool then asks you to check the BC and the drag model and shows the fitted BC for reference.
- **Zero.** A zero correction is reported only when it very likely matters. When it only might, you see "possible, not yet clear"; don't change your zero on that alone.
- **Come-ups for the distances you shot.** When no BC correction is offered, you get the change to dial at each distance you shot, but only when the change is larger than its own uncertainty. A smaller correction is just noise from a few groups, and applying it can leave you worse off than before.
- **Muzzle velocity.** Once the chronograph has given its first reading, the session's readings take priority over the average you checked beforehand. That average was measured on another day, possibly in other weather or with another lot. If the measured velocity differs from the cartridge's, the list says how many rounds to chronograph to settle the average to about ±2 m/s.
- **Not determined.** A cause the session could not measure is listed as "not determined by this session", never as checking out. The click value is the usual example: only a tall-target or ruler test settles it.

The list also repeats the homework you ticked, as a reminder that the bands assume each item was really done.

"Start a new session" clears the session and keeps your preset choices.

### 5.1 An implausible result

A drag correction of tens of per cent, or a velocity hundreds of metres per second off, is not a subtle finding. It means something more basic is wrong, usually an implausible BC on the bullet or the wrong drag model (G1 entered for a BC measured against G7, or the other way round). Check the cartridge's BC and model against the published source before trusting anything else from the session. A session that kept missing the backdrop at several distances points to the same problem.

---

## 6. The BC gain factor

A trued drag correction is saved on the **cartridge** as a "BC gain factor", which is 1.00 by default. A factor of 1.05 means the bullet behaves as if its published BC were 5 % higher (less drag, a flatter trajectory); 0.95 means the opposite. It belongs to the cartridge and not the bullet, because the same bullet fired from another rifle at another velocity has slightly different drag. The bullet's published data is not changed.

Once saved, every tool in the app (Trajectory, Range Solver, Hit Probability and this one) uses the corrected value. Truing a cartridge a second time multiplies the new correction onto the first rather than replacing it, and the second session starts from the same 4 % assumption as the first.

---

## 7. Privacy

Everything runs and stays on your device, like the rest of the app: no account, no upload, no telemetry. The session is kept in your browser's local storage. The tool writes elsewhere only when you choose to: a BC gain factor or a new velocity SD to your own cartridge. A distance or angle corrected during a session is never written to the location.

---

## 8. Geek's delight: the model, the statistics and the guardrails

This section describes what the tool computes, why it computes it that way, and where the numbers come from. You don't need it to use the tool. Units are the engine's: metres, metres per second, milliradians. Worked numbers are for a reference .308: G7 BC 0.2623, 792 m/s, 50 mm sight height, 100 m zero, ICAO sea-level air. For this load the bullet slows to Mach 1.1 at about 870 m.

### 8.1 The observable and the model

The only thing the tool measures on the target is the **come-up**: the elevation, in mrad, that puts the centre of a string on the point of aim. Windage is predicted from the wind you set and shown to you, but it is not used in the fit. A sideways miss carries the whole wind-reading error, which is far larger than anything it could reveal about the four causes below.

A come-up at believed distance $R$ on target $t$ is modelled as

$$c(R) = c_\text{app}\big(R + \Delta R_t;\; v_0 + \delta v,\; G\,/\,(1 + \delta d/100),\; \alpha_t\big) \;+\; z \;+\; \tfrac{\tau}{100}\,c_\text{app}(R) \;+\; \varepsilon$$

where $c_\text{app}$ is the app's own trajectory solution (the same integrator every other tool uses) in that group's air and wind. The terms are:

| Symbol | Name in the engine | What it is | Enters as |
|---|---|---|---|
| $z$ | `zeroMrad` | zero offset | a constant added at every distance |
| $\delta v$ | `v0Ms` | muzzle velocity error, m/s | added to $v_0$ inside the physics |
| $\delta d$ | `dragPct` | drag scale, % | divides the BC gain factor $G$ inside the physics |
| $\tau$ | `trackPct` | click value error, % | proportional to the come-up |
| $\Delta R_t$ | `rangeErrM_t` | target $t$'s range error, m | per target, only in the blunder check (§8.10) |
| $u_t$ | `losU_t` | target $t$'s unrecorded slope, $u = 1-\cos\alpha$ | per target, only in the blunder check |
| $\varepsilon$ | | the string's noise | Gaussian, $\sigma$ from §8.5 |

$\delta d > 0$ means more drag than the BC in use predicts. Saving the result multiplies the cartridge's gain factor by $1/(1+\delta d/100)$, so a second truing compounds onto the first. The drag scale goes through the gain factor and not through `bc` itself, because 247 of the 385 bullets in the library are Cd-Mach tables and have no `bc` to scale.

$\delta v$ and $\delta d$ are nonlinear and are applied inside the trajectory. $z$ and $\tau$ are added afterwards. Sight height, air density and wind are not fitted. They are inputs, and an error in any of them ends up in the four causes, as §8.2 shows.

The zero is a single bore angle for the whole session. It is solved once, level and in calm air, in the cartridge's zero atmosphere, with the fitted $\delta v$ and $\delta d$, so a change in either moves the zero exactly as it would on the rifle. A group's wind, slope and air then show up in its come-up, and do not shift the zero.

### 8.2 Why the causes are so hard to tell apart

The fit is linearised around the current estimate. Each cause's influence on a come-up is a column of the Jacobian, the come-up's change per unit of that cause at each distance. For the reference .308:

| Distance | come-up | per m/s of $v_0$ | per % of drag | per % of click | per m of range | per m/s of wind (any direction) |
|---|---|---|---|---|---|---|
| 200 m | 0.66 | −0.0024 | 0.0014 | 0.0066 | 0.0084 | 0.0003 |
| 300 m | 1.58 | −0.0050 | 0.0041 | 0.0158 | 0.0101 | 0.0007 |
| 400 m | 2.66 | −0.0081 | 0.0084 | 0.0266 | 0.0116 | 0.0015 |
| 500 m | 3.89 | −0.0116 | 0.0150 | 0.0389 | 0.0132 | 0.0028 |
| 600 m | 5.29 | −0.0157 | 0.0244 | 0.0529 | 0.0150 | 0.0048 |
| 700 m | 6.88 | −0.0205 | 0.0377 | 0.0687 | 0.0171 | 0.0076 |
| 800 m | 8.69 | −0.0262 | 0.0562 | 0.0869 | 0.0196 | 0.0116 |
| 900 m | 10.78 | −0.0331 | 0.0816 | 0.1078 | 0.0226 | 0.0174 |

(all in mrad; the zero's column is 1 everywhere)

Two columns can be told apart only to the extent that their **shapes** over the distances you shoot differ. Their size is irrelevant, since a parameter can always scale to match. The cosine between two columns measures this: ±1 means they are identical up to scale. Over 300, 600 and 800 m:

- velocity against drag: **−0.987**;
- click value against drag: **0.987**;
- click value against velocity: **−0.99993**;
- zero against drag: 0.80.

The click value and the velocity are almost perfectly collinear. A 1 % click error and a velocity error of the same come-up are practically the same curve. This is why the session reports the click value as "not determined" and leaves it to a tall-target test. The 0.15 % prior after such a test is what keeps it from soaking up whatever the velocity and the drag do not explain.

Velocity and drag differ only slightly, and in a known way: the drag column grows faster with distance than the velocity column, because drag acts for the whole time of flight while a velocity error acts mainly through the start. The velocity error that mimics 1 % of drag is 0.6 m/s at 200 m, 1.0 m/s at 400 m, 1.6 m/s at 600 m and 2.1 m/s at 800 m. Only this changing ratio separates the two, and it is small. That is why a plan needs a target far out, why more rounds at one distance do not help, and why a chronograph, which pins $\delta v$ outright, is the strongest single lever.

The zero is a constant, so a near target at the zero range, where every other column is zero, measures it almost alone. That is why the plan always includes one round near the zero range.

Every input you supply also lands on these four causes. Expressed as the drag change that would produce the same come-up at that distance:

| Input error | at 300 m | at 600 m | at 800 m |
|---|---|---|---|
| velocity +10 m/s | −12.2 % | −6.3 % | −4.6 % |
| click value 2 % | 7.7 % | 4.3 % | 3.1 % |
| zero 0.1 mrad | 24.5 % | 4.1 % | 1.8 % |
| sight height +3 mm | −4.9 % | −1.0 % | −0.5 % |
| range +20 m | 49.9 % | 12.4 % | 7.0 % |
| 10° slope not entered | −9.8 % | −3.7 % | −2.4 % |
| temperature +3 °C | −0.9 % | −0.9 % | −0.9 % |
| pressure +10 hPa | 1.0 % | 1.0 % | 1.0 % |

The last two rows are flat for a reason. Drag force is proportional to air density, so an error of 1 % in the density is *exactly* an error of 1 % in the drag at every distance (apart from a small effect through the speed of sound). The session cannot detect a wrong temperature or pressure at all, and passes it straight into the BC. This is why the tool insists on station pressure and warns about QNH (§8.13), and why the Conclude page reminds you that the BC correction assumes the air you entered.

The range row explains §3.5. At 800 m, 20 m of range error is 7 % of drag, more than the whole prior. Only a second target close by could notice it, and even then not reliably.

### 8.3 Two goals: prediction and attribution

A session serves two goals, and the engine treats them differently.

**Prediction**: the come-up at a given distance in given air. Its uncertainty is the predictive variance $J(R)^\top\Sigma J(R)$, which depends only on the combination of causes that column $J(R)$ sees.

**Attribution**: how large each cause is. Its uncertainty is the marginal variance $\Sigma_{ii}$, and its separation from the others is the posterior correlation.

When two causes are nearly collinear (§8.2), the posterior is a long, thin ellipse. The combination the shots see is tight; the combination they cannot see is about as wide as the prior. Inside the distances shot, $J(R)$ lies almost across the long axis, so prediction is good even when attribution is poor. Outside them, $J(R)$ turns towards the long axis and the prediction degrades. A plan to 600 m with 20 rounds on the reference .308:

| | drag SD | velocity SD | come-up SD at 300 m | 600 m | 800 m | 1000 m |
|---|---|---|---|---|---|---|
| before the session (prior only) | 4.1 % | 20 m/s | 0.27 | 0.42 | 0.63 | 0.99 |
| no homework, no chronograph | 3.85 % | 10.0 m/s | 0.06 | 0.07 | 0.16 | 0.33 |
| no homework, chronograph | 3.20 % | 1.3 m/s | 0.06 | 0.06 | 0.15 | 0.32 |
| full homework, chronograph | 2.91 % | 1.3 m/s | 0.05 | 0.06 | 0.14 | 0.31 |

(come-up SDs in mrad)

Without a chronograph, the session improves the come-up at 600 m six-fold and the drag scale hardly at all. The chronograph barely changes the predicted come-ups at the distances shot, but it cuts the velocity uncertainty almost eight-fold. Prediction is what the shots give almost for free; attribution is what the session has to be designed for.

The two goals can also give contradictory answers that look identical in the data. A velocity 10 m/s below the recorded one, absorbed into a 6.4 % BC change, matches 600 m exactly. It is then 0.11 mrad off at 800 m, 0.16 mrad at 800 m on a −10 °C day, and 0.35 mrad at 1000 m. The fit residuals do not show it, because at 600 m the wrong attribution and the right one predict the same come-up.

**What the engine does for prediction.** The dial value before every string and the come-up table at Conclude are predictions, each with its predictive SD (§8.14). The ladder's safety gate is a prediction at the next distance (§8.12). None of them needs the causes separated.

**What the engine does for attribution.** Most of the machinery in this section exists for this goal:

- *The plan scores attribution, not prediction.* The objective (§8.9) sums marginal variances $\Sigma_{ii}$, each measured after the other causes are accounted for, so a design that leaves two causes confused scores badly on both. A planner aiming at prediction would minimise $J(R)^\top\Sigma J(R)$ at the distances you shoot and would put its rounds there.
- *Geometry chosen to separate.* One round near the zero range, where only the zero's column is non-zero. The far target as close to Mach 1.1 as the location allows, where the drag column differs most from the velocity column. A plan must reach beyond 300 m when the location allows it, so that it cannot score well by shooting only where everything is easy.
- *Direct measurements for the collinear causes.* The chronograph observes $\delta v$ directly (§8.6), so the velocity–drag pair no longer has to be told apart by shape. A tall-target test does the same for the click value, which is almost exactly collinear with velocity (cosine −0.99993).
- *Causes are fitted even when they are not reported.* A tested click value stays in the fit at its 0.15 % prior. Leaving it out would let any leftover tracking error be attributed to the drag (§8.4).
- *Field mistakes get their own explanations.* A mis-ranged or sloped target is a competing hypothesis per target (§8.10), so that it cannot be attributed to the drag. Targets are decided jointly, so a shared cause is not attributed to one target. The angle measurement breaks the exact range–slope degeneracy.
- *Doubtful homework widens the result.* A ticked zero or velocity average that the shots contradict widens the result (§8.11) instead of pushing the discrepancy into another cause.
- *Inseparable causes are reported together.* Causes with posterior correlation above 0.8 are reported as one combined contribution, never as separate single-cause findings (§8.14).
- *Prior shrinkage is not a measurement.* A cause whose resolution is below 0.2 is "not determined", never "checks out" (§8.14). A small fitted value means little when the prior put it there.
- *A velocity finding needs readings.* Without chronograph readings, a fitted velocity is only another cause's error moved into the velocity, and it is reported as not determined.
- *The BC is written only when attribution succeeded.* That means at least five chronograph readings, grade A or B, a result within 3σ of the prior, and a gain factor within 0.8–1.2 (§8.13). Prepare and Conclude share this rule, so a plan never promises a BC the conclusion would refuse.
- *What no shot can attribute is guarded at the input.* Air density is exactly collinear with the drag (§8.2), so a wrong pressure or temperature cannot be separated afterwards. The QNH check and the "conditions assumed" note exist for that reason.

**Where the two goals pull apart inside the engine.**

- *The rounds go where the columns differ, not where you will shoot.* The come-ups at intermediate distances end up good anyway, because prediction inside the envelope is cheap.
- *The miss-widened drag prior serves the ladder and the dial values, not Conclude* (§8.12). A prior widened after a miss predicts the retry better, but used for attribution it would let a single unseen impact lower the grade.
- *The come-up table is offered only when no BC correction is.* When attribution succeeds, the corrected cartridge predicts every distance and the table adds nothing. When it fails, the table is the part of the result that still holds, and only at the distances shot.
- *Findings are judged at $R_\text{max}$.* Attribution is reported in terms of its consequence for prediction at your longest working distance (§8.14), so a real but irrelevant cause is listed as not material rather than as a finding.

### 8.4 Priors

The fit is Bayesian: each cause starts from a zero-mean normal prior, and the shots narrow it.

| Cause | Unchecked | After homework |
|---|---|---|
| zero | 0.25 mrad | 0.08 mrad (zero re-verified) |
| velocity | 20 m/s | $t_{N-1}\cdot \text{SD}/\sqrt{10}$ (average checked) |
| drag | 4.1 % | 4.1 % |
| click value | 1 % | 0.15 % (tall-target test) |

**Drag.** Two independent parts are added in quadrature. Published G7 BCs differ from the BC that best reproduces each bullet's reference drag curve by 3.6 % RMS (56 bullets from three makers). The same bullet measured the same way varies by about 1.9 % from barrel to barrel. $\sqrt{3.6^2+1.9^2}\approx 4.1\,\%$. The RMS is used rather than the SD, so each maker's average offset counts as spread instead of being claimed as a known bias. The sample is too small to say anything about the shape of the distribution. A mixture of "typical" and "outlier" BCs fitted to it gave over-confident bands whenever the true errors were normal, so the prior is a single normal sized from the data. With the variance right and a nearly linear model, a normal prior keeps the stated bands honest whatever the true shape. A cartridge trued before starts from the same prior, because a gain factor is a correction and not a measurement more reliable than the published figure.

**Velocity.** A checked average is taken as ten rounds at the cartridge's recorded spread. The recorded SD is itself an estimate, so the standard error is widened by the Student-t factor $t_{0.975,N-1}/z_{0.975}$, where $N$ is the number of shots behind the SD: you type it, or 10 is assumed for an SD stored in Arsenal. The factor is 1.15 at $N=10$ and 1.42 at $N=5$. A preset SD is not inflated, since its uncertainty is about whether it applies to your rifle at all, which small-sample statistics do not cover. For SD 6 m/s and $N=10$ the prior is 2.2 m/s.

**Click value.** A tested click value is still fitted at its 0.15 % prior, but it is not reported. Leaving it out of the fit would put any residual tracking error into the drag: in a whole-session Monte Carlo, the drag's 95 % band then missed about a third of a percentage point more often. With it fitted, the band missed 5.0 % of the time.

### 8.5 Noise

One round's vertical $\sigma$ has three independent parts:

$$\sigma_\text{round}^2 = \left(\frac{R_{50}}{1.1774}\right)^2 + \left(\frac{\partial c}{\partial v_0}\,\text{SD}_v\right)^2 + \sigma_\text{read}^2$$

the rifle's dispersion (R50 converted to a per-axis $\sigma$), the shot-to-shot velocity spread times the come-up's sensitivity to velocity at that distance, and the reading. The velocity part is zero at the zero range and 0.16 mrad at 800 m with a 6 m/s spread, close to the per-axis σ of a rifle that shoots R50 = 0.25 mrad (0.21 mrad). The certainty picker's levels are 95 % half-widths, so $\sigma_\text{read}$ is 0.05, 0.1 or 0.15 mrad.

A string of $n$ rounds reads their mean. Its wind error is added on top:

$$\sigma_\text{string}^2 = \frac{\sigma_\text{round}^2}{n} + \sigma_\text{wind}^2, \qquad \sigma_\text{wind}^2 = \left(\frac{\partial c}{\partial w}\,\sigma_w\right)^2 + \left(\frac{\partial c}{\partial \phi}\,\sigma_\phi\right)^2$$

with $\sigma_w$ the stated wind confidence (0.5, 1, 2 or 3 m/s), $\sigma_\phi = 7.5°$, and both derivatives taken by finite differences around the wind you set. Below 0.5 m/s a direction means nothing, so the sensitivity is the RMS of the head-wind and cross-wind sensitivities, applied to the whole speed error. The wind error belongs to the string: it does not shrink with the rounds in it, and the strings' errors are independent. There is no shared wind unknown in the fit. Wind is a nuisance, not a cause.

Strings are capped at three rounds, because a spotter reading the centre of more impacts at distance does much worse than $1/\sqrt n$ suggests. A distance's strings together read like one string of all its rounds, except that the wind term falls with the number of strings. The planner therefore allocates rounds per distance, and the strings only decide how they are fired.

Before any wind has been read, the plan uses the expected strength: moderate is 3 ± 1 m/s, strong is 7 ± 2 m/s, direction unknown. Then $\sigma_\text{wind} = W_\text{rms}\sqrt{\sigma_w^2 + (w\,\sigma_\phi)^2}$ with $W_\text{rms}$ the any-direction column from §8.2.

**The velocity spread itself.** The SD in these weights is not simply the recorded one. From the second chronograph reading on, it is pooled with today's spread by degrees of freedom:

$$\hat\sigma_v^2 = \frac{(N_0-1)\,\text{SD}_0^2 + (n-1)\,s^2}{N_0+n-2}$$

$N_0$ is the stated shot count, or 5 when none is given. The pooled figure counts as $N_0+n-1$ shots. Each reading is first compared with the cartridge's velocity in its own group's air, and the mean offset is removed, so a weather change or a wrong average does not count as spread. Strings already recorded are re-weighted with every new figure. With more than ten readings, a two-sided F-test at 5 % ($s^2/\text{SD}_0^2$ against $F_{n-1,\,N_0-1}$) decides whether today's spread really differs. If it does, the tool says so and offers to update the cartridge. The F-test only drives that notice. The pooling runs regardless and changes nothing when the recorded SD is right.

### 8.6 The chronograph

Each group's readings form one observation of $\delta v$ directly. The residual is (mean reading − the cartridge's velocity in that group's air), and its $\sigma$ is $t_{0.975,N-1}/z\cdot\hat\sigma_v/\sqrt n$, the same form as the velocity prior. A reading the unit missed is simply one fewer reading.

From the first reading on, the session's own readings replace the checked average as the velocity's information. The average was measured on another occasion and may be wrong for a temperature-sensitive powder or another lot. The readings carry their own uncertainty, which is wide for one or two readings. Thresholds of one to five readings were compared, with the chronograph missing most shots. One reading left the least error whenever the checked average was wrong, and cost at most a thousandth of a mrad when it was right. The same evidence is never counted twice, as a tighter prior and as an observation at once.

### 8.7 The fit

The estimate is the maximum a posteriori (MAP) point of

$$-\log p(\theta\mid y) = \tfrac12\sum_k \frac{r_k(\theta)^2}{\sigma_k^2} + \tfrac12\sum_i\frac{\theta_i^2}{\sigma_{0,i}^2} + \text{const}$$

found by Gauss–Newton. Every iteration re-linearises the physics at the current $\theta$, builds $A = P_0 + J^\top W J$ and $b = J^\top W r - P_0\theta$, and steps by $A^{-1}b$. It stops when every step is below 1 % of that cause's prior SD, or after five iterations. The covariance $\Sigma = A^{-1}$ is taken from one final linearisation at the solution, which also gives one more Newton step at no extra cost. Applying it makes the answer accurate well below the stopping tolerance, whether the iteration started cold or warm.

After each group, the previous analysis's solution is the starting point (a warm start). It gets two iterations. If it hasn't converged by then, the fit restarts from zero, so the answer never depends on the guess.

The residual of a chronograph or range re-check row is re-linearised like any other: $r = (\bar v - v_\text{expected}) - \delta v_\text{current}$. Using the raw residual on every iteration instead would add the same correction on each pass. When the chronograph disagrees strongly with the record, as for two sessions of the same rifle about 20 °C apart, that diverges to several times the right value.

The drag column is a centred difference over ±1 %. The come-up curves in the drag scale, so a one-sided +5 % step would read a slope 2.7 % steeper than the local one at 800 m, and the fit would claim the drag more tightly than it knows it: in a whole-session Monte Carlo its 95 % band missed 5.7 % of the time with the one-sided step, against 5.2 % with the centred one.

### 8.8 What a session can resolve

Planner results for the reference .308 (R50 0.25 mrad, velocity SD 6 m/s, moderate wind). The numbers are the drag scale's posterior SD, with the grade:

| Range | Homework | Chronograph | 12 rounds | 20 rounds | 30 rounds | 40 rounds |
|---|---|---|---|---|---|---|
| 100/300/600 m | none | no | 3.88 C | 3.85 C | 3.83 C | 3.82 C |
| 100/300/600 m | none | yes | 3.43 C | 3.22 C | 3.01 C | 2.85 B |
| 100/300/600 m | all | yes | 3.01 C | 2.81 B | 2.62 B | 2.46 B |
| 100/300/500/800 m | none | no | 3.68 C | 3.66 C | 3.64 C | 3.63 C |
| 100/300/500/800 m | zero + clicks | no | 3.65 C | 3.48 C | 3.37 C | 3.29 C |
| 100/300/500/800 m | none | yes | 2.49 B | 2.18 B | 1.98 A | 1.86 A |
| 100/300/500/800 m | all, average checked | no | 1.95 A | 1.77 A | 1.60 A | 1.49 A |
| 100/300/500/800 m | all | yes | 1.93 A | 1.70 A | 1.49 A | 1.35 A |

What the table shows:

- **Without a chronograph or a checked average, nothing works.** With a 20 m/s velocity prior, the velocity–drag correlation stays at 0.7–0.9, and 40 rounds do no better than 12. The drag barely moves from its 4.1 % prior.
- **Distance beats rounds.** With full homework and a chronograph, 40 rounds to 600 m give 2.5 %. Twelve rounds to 800 m give 1.93 %. For this .308 at 600 m, the drag column is still too similar to the velocity column.
- **The "average checked, no chronograph" row is grade A on paper**, and the tool still offers no BC correction for it. The plan takes the average at its stated uncertainty, but that average comes from another day. A wrong temperature drift, another lot or a tired chronograph shifts it, and at 800 m every 1 m/s goes straight into the drag as 0.5 %. Nothing in the session can see such a shift. The chronograph's five readings are the only evidence measured in the same air and at the same powder temperature as the shots, and so the only evidence that attributes the come-up to velocity rather than drag in today's conditions.

Two more Prepare-screen figures come from the same posterior. The **required far distance** is the nearest far target at which a near and a far group reach a given drag SD. The **invalidity floor** is the far distance below which even a reading as good as one click (σ = 0.1/√12 mrad), with any number of rounds, cannot get the drag under 4 %. Below that floor no plan escapes grade D, and the screen says so.

### 8.9 The planner

The plan is designed for attribution (§8.3): it scores each cause's own variance, not the predicted come-up. For a design (a set of distances and the rounds at each), the posterior is that of the linearised model at the BC in use:

$$\Sigma^{-1} = P_0 + \sum_g \frac{J_g J_g^\top}{\sigma_g^2}$$

The planner minimises

$$\sum_i \min\!\left(\frac{\Sigma_{ii}}{s_i^2},\; 4.5\right)$$

where $s_i$ is the size at which cause $i$ matters. For the zero, velocity and click value, that is the size that moves the come-up at the farthest usable distance by 0.1 mrad. For the drag it is 2 %, the grade-A limit. Each term is a cause's posterior variance after the others are accounted for, so a design that leaves two causes confused scores badly on both. The cap at 4.5 (about twice the material size) means a cause that stays undetermined earns nothing for small improvements, so rounds go where they can change a verdict. A cause pinned by homework has a tight prior and little left to gain, which frees rounds for the others. Doing homework can never make a plan worse.

For up to three groups, each cause's variance has a closed form. With $q_i$ the prior variances, $u_i$ cause $i$'s column over the design's distances, $G_{gh}=\sum_i q_i u_{g,i}u_{h,i}$ and $M = G + \operatorname{diag}(\sigma_g^2)$:

$$\Sigma_{ii} = q_i - q_i^2\, u_i^\top M^{-1} u_i$$

This needs only a 3×3 inverse, so every allocation of rounds is enumerated. Designs with more groups (ladder steps) are allocated greedily, then improved by pairwise swaps. Only the winner gets the exact posterior. The ladder steps a design needs are found by walking the ladder itself, with the posterior after each step. Candidates are capped at twelve: the nearest, the farthest, and the ten closest to the Mach 1.1 point. When the location has anything beyond 300 m, the plan must reach it. Without that rule, with no chronograph and no verified zero, a plan that fires every round at the zero range can score as well as one that learns little at the far target, and it would true nothing.

Ladder steps get one round each: they are safety checks, not measurements, and three rounds per step bought nothing in simulation. The four suggested round counts come from the drag SD planned for a grid of budgets from 6 to 60 rounds. The curve is first made non-increasing, since a larger budget can always be spent like a smaller one, and a dip is a planner artifact. With both axes scaled to 0–1, the optimal count is the point farthest below the straight line from the first budget to the last: the knee, typically 16–32 rounds (18–24 with a chronograph on a range with many targets). The minimal count is the smallest whose drag SD is within 10 % of the optimal's. Enhanced and deluxe add 10 and 20 rounds. When going from 6 to 60 rounds improves the drag SD by less than 10 %, the screen says that the homework and the distances are the limit, not the rounds.

The planning wind and the planned chronograph readings enter exactly as they will in the fit, so a Prepare forecast and the final result agree on what each item is worth.

### 8.10 Mis-ranged and sloped targets

A range error and a missed slope are the two field mistakes the shots can least tell from a wrong drag. Each target therefore gets one three-way choice, compared by evidence:

| Choice | Extra terms | Prior weight |
|---|---|---|
| fine | $\Delta R_t \sim N(0,\;0.002R)$ | 0.9 |
| mis-ranged | $\Delta R_t \sim N(0,\;20\text{ m})$ | 0.05 |
| inclined | $\Delta R_t \sim N(0,\;0.002R)$, $u_t \sim N(0,\;u(20°))$ | 0.05 |

When the "inclined" choice is not on offer (see below), "mis-ranged" takes the whole 0.1.

The 0.2 % "fine" σ is what one laser reading is good to after the display rounds to whole metres. After the target has been re-checked, the weights become 0.98 / 0.01 / 0.01 (or 0.98 / 0.02). A wrong target is then much less likely, but not ruled out: several readings on the same wrongly identified object still agree with each other. The second reading enters as an observation of $\Delta R_t$ with the "fine" σ. The even split between the two failure modes is a convention, not a measurement. There is no basis for ranking a laser blunder above an unrecorded slope.

**The slope is parameterised as u, not in degrees:** $u = 1-\cos\alpha$. A slope always makes you dial less than on the flat, uphill and downhill alike, and the effect grows as $1-\cos\alpha$, quadratically near zero. A column in degrees is exactly zero at $\alpha=0$, and a linearised fit cannot get started from it. Measured on the .308 at 600 m, the numerical slope near zero came out as $+4.1\times10^{-4}$, $-2.8\times10^{-5}$ and $-9.0\times10^{-4}$ mrad/° for steps of 0.5, 1 and 2°: not even of consistent sign, because it is solver noise at a stationary point. In $u$ the effect is nearly linear: effect/$u$ varies by a factor of 1.08 between 10° and 30°, where effect/degree varies by a factor of 28. The prior σ is $u(20°) = 0.060$, chosen in $u$ directly. Converting a "σ = 8°" into $u$ would make a 20° slope a 6σ event, because $u$ is convex in the angle. With $u(20°)$, a 15° slope sits at 0.56σ and a 30° slope at 2.2σ.

Two rules remove impossible hypotheses outright. A fitted $u<0$ would mean a slope that makes you dial more, so it gets zero weight. And the "inclined" choice is offered only when the target's residual is negative (you dialed less than predicted) and its angle has not been measured. A measured angle, flat included, turns the slope into a known value. A range card cannot tell "confirmed flat" from "never measured", since both are stored as 0°. So only a clinometer reading taken during the session, or the "this range is flat" declaration, withdraws the term.

For a single group, range error and slope are **exactly** degenerate: at 700 m a 20° slope and a −25.1 m range error both move the come-up by −0.418 mrad. A third "both at once" choice would split weight arbitrarily between two explanations the data cannot separate, so there isn't one. Only an angle measurement separates the two, which is why every re-check asks for the clinometer as well. A target is flagged on the sum of "mis-ranged" and "inclined", never on either alone.

**Model comparison.** Each combination of choices is fitted, and its evidence is approximated by Laplace's method at its own MAP point:

$$\log p(y) \approx \log p(y\mid\theta^*) + \log p(\theta^*) + \tfrac p2\log 2\pi - \tfrac12\log|A|$$

The posterior weight of a combination is proportional to (prior weight) × (evidence). The combinations are merged into one Gaussian by the law of total variance:

$$\bar\theta = \sum_k w_k\theta_k,\qquad \Sigma = \sum_k w_k\big(\Sigma_k + (\theta_k-\bar\theta)(\theta_k-\bar\theta)^\top\big)$$

A combination whose fit ran away to a non-finite value is dropped. This happens with a wide drag prior, several targets allowed to be wrong at once, and too few groups to pin them. The reported numbers always come from this merged fit, never from a plain fit with a flag added afterwards: flagging a target does not by itself fix the numbers.

The closed-form evidence of a linear model, linearised once at $\theta = 0$, does not apply here, because the model is re-linearised at every iteration. Tested on clean sessions with no blunder in them, that shortcut favoured "blunder" at about 90 % every time. The Laplace form above is written in exactly one place and shared by every comparison in the tool.

**Joint, not one at a time.** Two targets close in distance share almost the same sensitivity to a large shared cause, such as an uncorrected temperature drift. Checked one at a time, each makes the other look wrong. In a case built to trigger this, one-at-a-time checking gave 99.5 % and 98.6 % "blunder" to the real culprit and its innocent neighbour 5 m away. Deciding both jointly gave 99.5 % and 13.7 %, with the same final estimate.

Exact joint enumeration grows exponentially with the number of targets $k$ (up to $3^k$ combinations). Measured with two choices per target, the cost grew about 2.2× per target: 0.24 s for 4 targets, 9.4 s for 8, and a 12-target range had to be stopped after two minutes. So every target is first screened one at a time (about 7 ms each). The four most suspicious are then enumerated jointly, and combinations with more than two wrong targets at once are dropped. With re-checked weights, three wrong out of four has a prior mass of about $3\times10^{-5}$. On 585 real analyses, the Conclude list, the grade and the "not material" set were identical with and without that cap, at 1.5× the speed. Screening can only err by including an innocent neighbour, never by missing the culprit, because the shared residual has to land on some target and the real one keeps its share. On a seven-target ladder and on an adversarial layout with targets at 600/610, 750/760 and 860/870 m, the culprit always made the shortlist, and the shortlist's numbers matched full enumeration to a tenth of a point at about an eighth of the time.

A target is flagged, and a re-check requested, once its "something is wrong" weight passes 20 %. In simulation, a 50 % threshold almost never fired. At 20 % it fires about once in ten sessions and improves both the dial values and the drag estimate. A re-range takes seconds.

### 8.11 Checking the homework ticks

A ticked zero or velocity average is not taken purely on trust. Each becomes a two-way choice in the same enumeration: the verified prior at weight 0.9, the unverified prior (0.25 mrad, 20 m/s) at 0.1. If the shots contradict a tick, the merged result widens instead of forcing the discrepancy into another cause. The Conclude page names a tick once its "did not hold" weight passes 50 %. The velocity tick drops out as soon as the session's own chronograph takes over (§8.6). The click value is not checked this way. The shots say almost nothing about it (§8.2), and every extra axis doubles the computation.

### 8.12 The ladder and missed impacts

Each step must pass two gates.

1. **The forecast.** The predicted miss at the next distance, $z\,\sigma_c\,R/1000$ metres with $\sigma_c=\sqrt{J^\top\Sigma J}$ the come-up's predictive SD in mrad, must stay within the backdrop's half-height (1 m on a 2 m backdrop). $z$ is 2, and 3 after any missed impact.
2. **The cap.** A step may be at most 4× the farthest distance where a group has actually landed. Before the first group lands, no forecast step is taken: the ladder starts at the nearest distance available.

The forecast alone is not enough because it is built from the assumed model: it measures uncertainty *within* that model and cannot see that the model has the wrong shape. With only the priors and no shots, it approved an 800 m first shot for a bullet assumed G1 but truly G7, predicting a miss of at most 1.59 m at 2σ. The real miss on a 2 m backdrop was 3.70 m. The cap owes nothing to the model. A cap of 2× stalled every session on 100/300/600 m and 100/300/600/900 m layouts after the first group. 3× removed those stalls, and 4× allows a gap of four times. When nothing within the cap is left, the nearest distance beyond it is allowed if it passes the forecast at 3σ. Measured on the simulation's steps, the 99th percentile of the actual miss was about 3σ even with a deliberately wrong drag model.

The very first shot is checked separately: the predicted miss under the priors alone, at 3σ. If it may leave the backdrop, the tool offers the zero range and lets you go on knowingly.

**A missed impact** is hard evidence that the model is wrong out there, which neither gate can see. The tool:

1. retreats to the available distance nearest the midpoint between the last one that landed and the one that missed;
2. raises $z$ to 3 for the rest of the session;
3. bans the missed distance and everything beyond it until a group lands somewhere nearer, then releases it for a retry dialed from the corrected fit. Dialing the app's own prediction again repeats the miss: in simulation no session that missed recovered without the fit's elevation, and 82 % did with it;
4. keeps a distance that misses again in play while untried ground remains below it, up to five misses. With a BC 25 % too high on a 2 m backdrop, giving the far target up after its second miss lost it in 92 of 100 sessions, and the result, shrunk to two-thirds of the truth, was then offered for saving. Keeping it in play reached it in every session with at most three misses;
5. when nothing nearer can be shot, asks for an extra group of three rounds at a distance that has already landed, to move the fit enough to unlock the retry.

A miss also says how large the drag error must at least be. The round left the backdrop, so the dial was off by more than half its height $h$. A drag error alone does that only if

$$|\delta d| \ge \frac{h/2}{R}\Big/\frac{\partial c}{\partial d}$$

On a 2 m backdrop for the .308 that is 22 % at 800 m, 38 % at 700 m, 68 % at 600 m and 815 % at 300 m. The drag prior used by the ladder and the dial values is widened until that size is two standard deviations away. A gross BC error is then followed instead of being pulled back to the published figure, which would make the retry miss again by nearly as much. If the required error exceeds 50 %, no BC is that wrong: the miss was something else (a gust, a dialing error, an impact simply not seen), and widening would only cost precision. The linear estimate is enough here; solving the trajectory exactly changed no simulated outcome. The Conclude fit uses the normal prior. Otherwise a miss that was only an unseen impact would cost a session without a chronograph a grade, and §8.13's 3σ rule catches a gross BC error anyway.

### 8.13 Input guardrails

None of these blocks you. Each one warns, explains, or holds back a result.

- **Come-up plausibility.** A typed come-up is compared with an envelope of the app's own prediction ± 4σ. The σ combines the prediction's spread for a shooter who checked nothing (unchecked priors, whatever you ticked), the string's noise, and the wind error at "Poor". The envelope ignores the fit and earlier entries on purpose: an earlier typo that bent the fit must not make a correct entry look wrong. Outside it, the tool tests whether the number would fit as the difference to the recommended come-up, as mrad or MOA typed in place of clicks, with the sign flipped, or out by a factor of ten, and names the likely slip.
- **Velocity plausibility.** The cartridge's velocity in that group's air ± $4\sqrt{20^2 + \text{SD}^2}$ m/s, limited to 150–1500 m/s. The 20 m/s applies even when the average is ticked as checked, because the tick may be wrong. Outside it, the tool tests the other speed units and a factor of ten.
- **Station pressure.** Above the standard-atmosphere pressure for the location's altitude by more than 40 hPa, the reading looks like QNH. Below it by more than 60 hPa, it looks too low. Real station pressure moves about 35 hPa either way with the weather. At 1,500 m, using QNH costs 0.39 mrad, and the fit would turn that into a BC correction (§8.2).
- **Air drift.** When a group's air differs from the starting air by 8 °C or 15 hPa, the tool tells you the plan is getting old (on a load that drifts 0.8 m/s per degree, 8 °C is over 6 m/s). The plan is not recomputed after Start, but the fit follows each group's own air either way.
- **BC correction.** Offered only with at least five chronograph readings captured during the session, at grade A or B, when the drag result is within 3σ of the prior (3 × 4.1 ≈ 12 %) and the new gain factor is within 0.8–1.2. A result further out is treated as an input error: the prior holds such a fit back towards the published BC, so its number is too small and its band too narrow. Simulated with a BC 25 % off, such a result would have been offered for saving at two-thirds of the true correction. It is shown, with the fitted BC, for information only.
- **Velocity finding.** Reported as a measured correction only with chronograph readings behind it. Without them, a velocity derived from come-ups is just another cause's error moved into the velocity, and is listed as not determined.
- **Planned far target not reached.** The Conclude page says so and grades only what was shot.

### 8.14 What gets reported

$R_\text{max}$ is your longest working distance: the farthest supersonic distance at the location, or the farthest distance shot if that is greater. Every finding is judged at $R_\text{max}$.

**Materiality.** A cause matters if its effect at $R_\text{max}$ exceeds 0.1 mrad. For a cause with fitted value $\theta_i$, SD $\sigma_i$ and column $J_i$ at $R_\text{max}$, so mean $m = J_i\theta_i$ and SD $s=|J_i|\sigma_i$:

$$P(\text{material}) = \Phi\!\left(\frac{-0.1-m}{s}\right) + 1 - \Phi\!\left(\frac{0.1-m}{s}\right)$$

Findings are ranked by this probability.

**Resolution.** $\tilde R = I - \Sigma P_0$, scaled by the prior SDs. Its diagonal is $1 - \Sigma_{ii}/\sigma_{0,i}^2$, the share of the prior variance the shots removed. Below 0.2 the session did not measure that cause. It is then "not determined", or listed as unresolved if its fitted effect is still likely material, but never "checks out", because a value pulled back to its prior is not a measurement. This is the attribution counterpart of the dial table's predictive SD: a cause can be unresolved while the come-up it contributes to is tightly known.

**Degeneracy.** Causes linked by a posterior correlation above 0.8 are grouped as connected components, so links can chain. Each group is reported as one combined contribution $m=\sum_{k} J_k\theta_k$ with variance $J^\top\Sigma J$ over its members. When the group is velocity and drag, the advice is to bring a chronograph. Correlations between 0.5 and 0.8 between reported causes get a note.

**Zero.** Reported as a correction at $P \ge 0.8$, and as "possible, not yet clear" between 0.5 and 0.8.

**Dial table.** When no BC correction is offered, the come-up change at each distance shot is $\Delta c(R) = c_\text{fit}(R) - c_\text{app}(R)$ in the latest group's air, with SD $\sqrt{J(R)^\top\Sigma J(R)}$. An entry counts if $|\Delta c| \ge 0.05$ mrad and $|\Delta c| \ge$ its own SD. The table is shown when at least one entry counts. One group's reading is only good to about 0.07–0.15 mrad, so a 0.05 mrad floor alone would let noise through.

The zero and dial-table thresholds were chosen by sweeping candidate rules over thousands of simulated sessions. Together they roughly halve the sessions in which acting on the result leaves the come-ups worse than doing nothing, at a small cost when the zero really is slightly off.

### 8.15 What the model leaves out

- **The drag curve's shape.** $\delta d$ scales the assumed drag curve and never reshapes it. A G1 BC used for a bullet whose drag follows G7 is a shape error. Above Mach 1.1 a single scale absorbs most of it over the distances shot, but not all, and it does not extrapolate into the transonic. This is the main reason the tool stays supersonic, and why the ladder's cap exists.
- **Sight height** is not fitted. Past a few hundred metres its effect is almost constant (−0.020, −0.025 and −0.026 mrad at 300, 600 and 800 m for 3 mm), so it looks like a small zero offset, and the shots cannot tell the two apart. Measure it.
- **Air density** is not fitted and cannot be (§8.2).
- **Wind** is noise, not a cause, and windage is never used.
- **Spin drift** only affects windage, which is not fitted. Earth rotation is not modelled.
- **Validation.** Every threshold above was set by simulation: sessions with known errors injected (BC, velocity, zero, clicks, range, slope, wind) and shot through the same ladder, fit and reporting code. The drag's 95 % band covers the truth about 95 % of the time in those runs. Real-world sessions are still few, which is why the tool is marked Experimental.
