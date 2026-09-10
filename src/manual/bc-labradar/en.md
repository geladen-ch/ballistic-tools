# geladen.ch ballistics User Manual — BC Labradar

*Part of the* [geladen.ch ballistics suite](https://bc.geladen.ch)*. One of the four tabs of the BC Tools page. Successor to the standalone Labrabaco tool.*

---

## 1. What this tool is for

A ballistic coefficient is the one number in the whole trajectory calculation that you are normally expected to take on faith. Muzzle velocity you can measure. Sight height you can measure with a caliper. Zero range you set yourself. The BC comes off the side of a box, or off a manufacturer's website, and it describes a bullet fired from somebody else's barrel, in somebody else's air, measured by a method nobody will show you.

It is also the number the trajectory is most sensitive to at distance, and the one most likely to be flattering. Published BCs are marketing numbers as often as they are measurements.

**BC Labradar measures yours.** It reads the track files a Labradar chronograph writes to its own SD card — a full velocity-versus-time record of every shot, sampled roughly every millisecond for the first hundred metres or so of flight — and fits a ballistic coefficient to each shot individually, against the same drag physics the rest of this suite uses to compute trajectories. It then cleans up the tracks the radar got wrong, throws out the shots that disagree with the rest, and averages what survives.

What comes out is a BC for **your** bullet, from **your** barrel, in **your** air. Feed it back into Arsenal and every other tool in the suite is working from a measurement instead of a claim.

None of that cleaning and fitting was designed from first principles and hoped for. It was calibrated against a corpus of **1,297 real Labradar tracks**, from which the radar's own noise — how it grows down the track, and how wildly it varies between sessions — was measured rather than assumed. §12 sets out what that measurement found, and what was built on it.

The remarkable thing about this method is that it needs no downrange equipment at all. No second chronograph at 300 m, no acoustic target, no Doppler radar the size of a car. The device is already recording the data — it just does not tell you what it is worth.

### What it is not

**It is not a chronograph readout.** It does not care about your muzzle velocity, your extreme spread, or your standard deviation in fps. The device's own report file tells you those, and this tool ignores it. What it wants is the *shape* of the velocity decay, which the summary report throws away.

**It only works with the Labradar v1** — the big orange box, the one that writes `Shot0001 Track.csv` files. Later devices, and every other chronograph brand, either do not record a track at all or do not write it in this format. There is no import path for them.

**It is not a Cd curve solver.** It fits one number against one standard drag model. If your bullet's real drag shape is not that model's shape, the fit tells you the best single BC for that model over the measured speed band, not the truth about the bullet. The **Cd–Mach Curve** tool is what backs out a bullet's own drag curve, and it wants a completely different kind of measurement.

**It tells you how sure it is about the shots, and only about the shots.** Alongside the mean it reports a 95 % confidence interval on that mean, as a percentage of it, computed from the scatter of the per-shot BCs it accepted. That interval is honest about the numbers you fed it and about sampling, and silent about everything else — an atmosphere you typed wrong shifts the mean and the interval together, and no statistic computed from the tracks can see it. §10.3.

---

## 2. Privacy, storage and requirements

**Nothing you put into this tool leaves your device.** The zip file you pick is never uploaded. It is decompressed in your browser, parsed in your browser, and fitted in your browser, by JavaScript running on your own machine. There is no account, no server, no telemetry.

**Nothing is stored, either.** Unlike Arsenal or the Rifle Precision Calculator, this tool keeps no library. Your loaded batch, your filter choices, your drag model and your atmosphere survive navigating to another tool and back — they live in memory for the session — but they do not survive a page reload. Reload the page and you pick the zip again. This is deliberate: a track batch is an intermediate, not a document. The thing worth keeping is the resulting BC, and that belongs in Arsenal (§11.1).

**Requirements.** Any reasonably current browser. The fitting is genuinely compute-heavy — a full drag integration is run some hundreds of times per track — so it is spread across a pool of background workers, one job per track, and rows fill in as they finish. A batch of thirty tracks resolves in a couple of seconds on a desktop and takes noticeably longer on a phone. The app installs as a PWA and this tool works fully offline once loaded, which matters, because the place you most want to run it is a range with no signal.

---

## 3. What a Labradar export actually is

Understanding the file layout saves a lot of confusion about why some rows in the track list say *not a track*.

When you copy a session off the device's SD card, you get a folder like this:

```
SR0013/
  SR0013.lbr            the device's own project file
  SR0013 Report.csv     the session summary — velocities, ES, SD
  TRK/
    Shot0001 Track.csv  one file per shot: the actual radar track
    Shot0002 Track.csv
    ...
```

Zip that folder — the whole thing, nested folders and all — and that zip is what this tool wants.

**The track file** is the interesting one. Past a short device header it carries one row per radar return:

```
Time (s);Vel (m/s);Dist (m);SNR
0.000000;767.75;0.00;-
0.007021;765.35;5.37;33.07
0.008021;765.05;6.14;40.15
0.009021;764.57;6.90;39.80
...
```

Four columns: elapsed time in seconds, velocity, distance from the device, and signal-to-noise ratio in decibels. Roughly one row per millisecond, running from the muzzle out to wherever the radar lost the bullet — a hundred-odd rows for a typical rifle shot.

Three things about that table are worth knowing, because the tool treats them all differently:

- **The first row is not a measurement.** Its time is exactly zero, its distance is exactly zero, and its SNR field is a literal dash. The device back-calculates it — it is the device's own extrapolated muzzle velocity, not a radar return. This tool excludes it from every fit and from every quality metric. It is drawn on the chart, and it is otherwise ignored.
- **SNR is a per-point quality figure**, and it varies enormously down the track. In the sample above it starts around 40 dB and, by the last rows, is down to 8. This tool weights every point by its SNR (§12.4), so the confident early returns dominate the fit and the doubtful late ones barely move it.
- **The velocity column is not monotonic.** Look at a real track's last few rows and you will often find the velocity *rising*. That is not the bullet accelerating; it is the radar reading a reflection off something else. Cleaning those out is most of what this tool does before it fits anything (§12.3).

**Units are read from the file's own header.** If your device is set to fps and yards, the header says so and the tool converts on the way in. You do not need to tell it, and you do not need to match its setting to your own display preference.

### 3.1 A note on units

This is the one tool in the suite where units barely arise, because a ballistic coefficient does not have any you would recognise. It is conventionally quoted in pounds per square inch of sectional density, which by long tradition is written as a bare number, and this tool writes it as a bare number to four decimal places.

Three places units do appear:

- **The atmosphere fields** — temperature, station pressure, humidity — follow your Settings preference like every other atmosphere block in the suite, with the unit shown as a live suffix on the field label.
- **The track files** carry their own units in their own headers, converted on import as described above. Your preference has no effect on them.
- **The track chart's axes** are the exception, and an honest one: the horizontal axis is milliseconds and the vertical axis is metres per second, always, regardless of what velocity unit you have configured elsewhere. This is a diagnostic plot of engine-internal values, not a report.

---

## 4. Quick start

For the impatient. Details follow in §5–§10.

1. Shoot a session with the Labradar, minding the aim, the projectile offset and the rest of §5.1–§5.5. Twenty rounds or more, all the same bullet.
2. Write down the temperature, the **station** pressure and the humidity **at the firing point** (§5.6). Not the forecast.
3. Copy the session folder off the device's SD card and zip it, nested folders and all.
4. **BC Tools** from the tool menu → the **BC Labradar** tab.
5. Set the **drag model** — G7 for a modern boat-tail, G1 for a flat-base or a round-nose (§6.1).
6. Fill in the **atmosphere** from your notes.
7. **Choose Labradar .zip…** and pick the file. The track list appears immediately.
8. **Compute**. Rows fill in as each shot's fit finishes.
9. Read the averaged BC off the **Result** card, with its 95 % confidence interval beside it and the standard deviation above.
10. Click any row to see that shot's own track, its kept and discarded points, and the curve that was fitted to it.

Do not trust a result from fewer than ten shots, and see §10.3 before trusting one from fewer than twenty.

---

## 5. Getting data worth analysing

The tool can only clean up noise. It cannot invent a measurement that was never made, and it cannot detect a systematic error in the conditions you typed. Everything in this section happens before you open the app, and every one of these mistakes is invisible afterward.

**Start with the device's own manual**, or at the very least its quick setup guide. It has pictures. Every recommendation in it is there for a reason, and the reasons below are mostly elaborations of those. What follows is the subset that matters disproportionately when the goal is a ballistic coefficient rather than a muzzle velocity — because a setup that produces perfectly good V0 readings can still produce tracks that are useless past thirty metres, and the device will not tell you which kind of session you just had.

### 5.1 Aiming the radar

**Point it at the target you are actually shooting at**, not at the rifle, not down the general direction of the range. The device tracks the bullet along its own beam axis, and the closer the trajectory runs to that axis, the stronger and cleaner every return is.

This is not a matter of a metre or two of track length. Beam alignment governs how far out the device holds the bullet at all, and track length is the single biggest lever you have on the quality of a BC fit: a longer track means more velocity decay to measure, more points to fit against, and proportionally less influence from the noise at the end.

### 5.2 The projectile offset

The device has a setting called *proj. offset*, which tells it how far the bullet's path runs from the radar. Getting it wrong makes every velocity in every track wrong, consistently, in a way that looks entirely plausible.

**Why it exists.** The radar can only measure *radial* velocity — the rate at which the bullet recedes from the device — which is not the same as the bullet's actual downrange velocity, because the beam axis and the trajectory are not the same line. Converting one to the other is straightforward trigonometry, and it is what the device does before displaying anything. But the trigonometry needs to know how far apart the two lines are, and that is the number you configure.

**Honour it.** If the setting says 30 cm, put the barrel 25 to 30 cm from the radar. Place it a metre away and the device will still record something, but every reading will carry a significant error.

**It is the distance to the barrel axis, measured to the side of the radar.** Not the distance from the muzzle to the device, which is a longer, slanted line. If your muzzle happens to sit a little in front of, or a little behind, the radar body, that is not a problem in itself — provided the sideways distance from the barrel is right, the error on the displayed muzzle velocity is negligible and the error on the BC computed here is nil.

**And it matters more here than it does on the device's own display.** An offset error perturbs the V0 figure modestly. It perturbs a BC computed from the track's *shape* considerably more. If you routinely tolerate an approximate offset because your chronograph numbers still look sensible, that tolerance does not carry over to this tool. See §12.1 for why.

### 5.3 Keeping the radar absolutely still

If the device moves during a measurement, the results are not degraded — they are random.

- **Use a genuinely solid tripod, well planted.** Do not hesitate to load the mounting platform with weight. This is one of the rare cases where the heavier and uglier solution is simply correct.
- **If you shoot anything with a serious muzzle brake, shield the device from the blast.** A wooden plank, a crate of ammunition, anything substantial between the muzzle and the radar. The casing is impact-resistant plastic and will survive; the point is not to protect the plastic but to stop the box from being shaken by the pressure wave. A device that twitches on every shot produces a session where the tracks get quietly worse as the string goes on, which is exactly the failure mode hardest to spot after the fact.

### 5.4 The range itself

Doppler radar is delighted by anything reflective, and every spurious reflection is a candidate for the rising-velocity tails described in §3.

- **Prefer an open field.** No high bumps in the ground within the radar's range, and the trajectory clear of obstacles for about five metres to the left, to the right and above.
- **Watch what is beside the firing point too**: a berm, a target frame, a bench, a vehicle, the shooter in the next lane. A cluttered lane produces tracks the cleaner has to work much harder on, and more tracks rejected outright.
- **Do not use steel targets within about 200 m.** Wood, cardboard or paper only. A small metal bullet against the background of a large metal plate is a genuinely hard detection problem, and the device will lose the bullet early or track the plate instead.

### 5.5 One device setting that is specifically about BC

**Set the maximum display distance to 200 m, or 200 yd.**

The track will most likely not reach that far — in practice, only very large calibers on a flat trajectory ever get close. What the setting does is tell the device to keep trying for as long as the signal holds up, rather than stopping at a shorter configured limit. Longer track, more decay, better fit. There is no downside, since the device shuts off the radar beam anyway as soon as it loses the bullet.

### 5.6 Atmosphere: the input that will actually bite you

Garbage in, garbage out, and the atmosphere is the most common garbage.

The drag force on the bullet is proportional to air density, and the BC that the tool solves for is whatever makes the modelled drag match the observed deceleration. Get the density wrong by 3 % and your BC is wrong by about 3 %, silently, with no indication anywhere that anything is amiss.

- **Measure it at the firing point.** A Kestrel or equivalent is good enough. "Whatever the weather app said for the nearest town" is not — that station may be forty kilometres away and three hundred metres lower.
- **Use station pressure — absolute pressure, at your actual elevation.** This is the single most common mistake, and it is worth being pedantic about, because Kestrel unhelpfully uses the term *barometric pressure* for the sea-level-adjusted figure, which is the one you do **not** want. This tool takes what you type at face value at your own elevation and back-derives an altitude from it (§12.10).

  The sanity check: if you are reading 1000 hPa or more at 500 m of elevation or above (29.5 inHg at 1500 ft, for the metrically disadvantaged), you are almost certainly reading a sea-level-adjusted value — or else something is happening in the atmosphere that will shortly be of more concern to you than your ballistic coefficient.
- **If you genuinely do not know the humidity, put 50 %.** It is the least influential of the three by a wide margin, and 50 % is never far wrong.

### 5.7 How many shots

One shot is one shot. It tells you almost nothing, and the tool will cheerfully compute a BC from it to four decimal places.

- **Decent factory ammunition: twenty rounds** is the working minimum. That is enough for the per-shot scatter to average down to something you can defend.
- **Cheap surplus, mixed lots, tired brass: thirty or more.** The scatter is larger and needs more shots to average out.
- **Genuinely good match projectiles: ten may do.** They are consistent enough that the tracks agree with each other closely, and the standard deviation on the Result card will tell you so.

More is always better, and the marginal cost is one more round.

Fire them all under the same conditions, from the same rifle, with the same bullet. This tool averages across the batch. Averaging two different bullets gives you the BC of neither. Note that muzzle velocities do not have to be the same, or even similar; it is perfectly fine to measure BC on a load-development series.

### 5.8 Getting the zip out of the device

Copy the whole session folder from the SD card and compress it. There is no need to dig out the `TRK` folder, no need to rename anything, and no harm in leaving the report and project files in place — they are ignored automatically (§7.2). Nested folders are fine.

The tool takes exactly one zip at a time. If you want to combine several sessions into one BC, either put them in one zip or run them separately and average by hand.

---

## 6. The Setup card

Everything on the left-hand card, top to bottom.

### 6.1 Drag model

Which standard drag model the BC is expressed against. It defaults to **G7**, and the picker lists every model the suite supports, filtered by whatever you have chosen to show in Settings.

The choice matters more here than in most places, because the fit is against the model's actual curve shape over your bullet's actual speed band, not a conversion:

- **G7** for modern boat-tail bullets — long ogive, tapered base. Essentially every match and hunting bullet designed in the last thirty years.
- **G1** for flat-base, round-nose, and most older or blunt designs. It is also what most manufacturers quote, which is a separate reason to use it.

The model you choose is baked into every per-track fit, so changing it after computing requires a fresh **Compute** (§6.7). It has no effect at all on the cleaning step.

There is nothing wrong with running the same batch twice, once against each model, and keeping both numbers. For trajectory calculations, use the model which best matches the shape of your bullet.

### 6.2 Atmosphere

Temperature, station pressure, relative humidity. See §5.6 for why these matter and how to get them.

Unlike the atmosphere blocks elsewhere in the suite, **this one has no presets** and no separate altitude field. There is no "standard atmosphere", no Swiss or Soviet reference condition. This tool is for reducing a real measurement made in real air, and a preset would only ever be a way of quietly pretending you know something you do not.

The defaults — 15 °C, 1013.25 hPa, 0 % humidity — are a neutral starting point, not a guess at your weather. They are ICAO sea-level standard conditions, and unless you shot at sea level on a standard day, they are wrong. Replace all three.

Altitude is not asked for and does not need to be: it is derived from the station pressure you typed (§12.10).

Like the drag model, the atmosphere is baked in at fit time. Changing it afterward requires a fresh **Compute**.

### 6.3 Signal quality threshold

The first of the two whole-track filters. This one decides which tracks are trustworthy enough to be averaged, based on how cleanly the shot's own cleaned points sit on a straight line.

Three settings:

- **Normal (R² > 0.95)** — the default, and right for most sessions.
- **High noise (R² > 0.90)** — for a genuinely cluttered lane, where too many perfectly good shots are being rejected. Use this when you can see, by clicking through the rows, that the rejected tracks look fine.
- **None** — no quality gate at all. Everything that produced a BC goes into the average.

The R² shown in the track list is the number this threshold is compared against. §12.8 explains what it actually measures, and why a straight line is the right reference for a *quality* check even though it is the wrong reference for a *fit*.

Changing this setting re-decides which tracks are included and updates the average **immediately**. No recomputation is needed, because no BC changes — only the verdict on each one.

### 6.4 Reject outliers

The second whole-track filter, and a completely different kind of test: this one does not care about signal quality at all, only about whether a track's BC agrees with the others'.

Three settings:

- **Conservative (2.0σ)** — the default. A track is dropped when its BC sits further from the batch average than all but a few per cent of honest shots ever should. That distance is measured in standard deviations, which is what the σ in the option's name stands for, and this setting draws the line at two of them.
- **Aggressive (1.64σ)** — drops more. Useful on a busy range with similar calibers nearby, or when you did not realign the radar between targets. It will also discard genuinely valid data, which costs you accuracy through a smaller sample. Use it when you have shots to spare.
- **None** — no outlier rejection. Reach for this when you are confident of your data and your sample is small. Under about ten shots the batch does not yet agree with itself well enough to judge which member disagrees, so the test throws away good shots more often than bad ones.

The classic thing this catches is a track that is not your bullet at all: the radar picked up a shot from the next lane, tracked it perfectly cleanly, and produced a beautiful fit for someone else's projectile. Its R² will be excellent. Only its disagreement with the rest of your batch gives it away.

Like the quality threshold, changing this re-decides and re-averages immediately.

### 6.5 De-noise threshold

This one is different from the two above in kind, not just in degree. The two filters throw away whole *tracks*. This slider controls how aggressively bad *points* are thrown out **within** each track, before that track is fitted at all.

It runs from **Loose** (0.970) to **Normal** (0.990) in steps of 0.005, and it defaults to 0.990, at the right-hand end. The numeric value is shown beside the label.

**Leave it at 0.990.** That value is not a guess or a taste; it is the outcome of a direct sweep against real tracks with known injected outliers, and it roughly halves the resulting BC error compared with the older, gentler 0.970 (§12.7). The only reason to move it is a genuinely extreme environment where you can see that real, good points are being discarded — click through a few rows and look at the chart before deciding that.

0.970 exists as an option because it is what the predecessor tool used for years. If you are reproducing an old result, that is the setting that will reproduce it.

Unlike the two filters above, this one changes the fit itself, so changing it requires a fresh **Compute**.

### 6.6 Choose Labradar .zip…

Opens your device's file picker. Once a file is chosen, the tool immediately decompresses it, finds the CSV entries, and works out which of them are real tracks — all of it in your browser, none of it uploaded. The filename appears beside the button and the track list fills in at once.

This step does **not** compute anything. Every track lands in the list with the status *not computed yet*, except for the entries that are not tracks at all, which are marked as such immediately (§7.2).

Two errors can appear here:

- ***Couldn't open that file***, with the underlying reason — the file was not a valid zip archive.
- ***No track files were found in that zip*** — it opened, but held nothing with a `.csv` name at all. Usually this means the wrong folder was zipped, or the archive contains a nested zip rather than the files themselves.

Picking a new zip clears any existing batch, including every manual include/exclude decision you had made.

### 6.7 Compute

Deliberately a separate button from picking the file, so you can set the drag model and the atmosphere *after* seeing what is in the zip and before spending any computation on it.

Clicking it launches a background fitting job for each parsed track. Rows update individually as their own jobs finish — you can watch the batch resolve — and the average is recomputed on each one. The button is disabled while the batch runs, and re-enabled when the last track settles.

**What recomputes what** is worth paying attention to, so you know when this tool might quietly show you a stale number:

| Change | Effect |
|---|---|
| Signal quality threshold | Verdicts and average update immediately |
| Reject outliers | Verdicts and average update immediately |
| An **Include** checkbox | Verdicts and average update immediately |
| Drag model | **Requires Compute** — nothing changes until you click it |
| Atmosphere | **Requires Compute** |
| De-noise threshold | **Requires Compute** |

Clicking **Compute** again discards every existing per-track result and refits the whole batch from scratch with the current settings. It also clears the chart and the summary while it runs. Your manual include/exclude decisions survive it.

---

## 7. The track list

One row per CSV entry found in the zip, in the zip's own order — which, for a normal export, is shot order.

### 7.1 The columns

- **File** — the entry's full path inside the zip, so `SR0013/TRK/Shot0007 Track.csv` rather than just the shot number. Verbose, but unambiguous when a zip holds more than one session.
- **Status** — the verdict, as a coloured chip. See §7.2.
- **BC** — this shot's own fitted ballistic coefficient, to four decimals, or a dash if it has not been computed.
- **R²** — how well this shot's cleaned points sit on a straight line, to four decimals. This is what the signal quality threshold (§6.3) tests. It is a data-quality figure, **not** a measure of how well the BC fit worked.
- **Include** — a checkbox that overrides the automatic verdict.

Clicking anywhere on a row except its checkbox selects that track and draws it in the chart above (§8).

### 7.2 The statuses

| Status | Meaning |
|---|---|
| **not computed yet** | Parsed successfully, waiting for **Compute** |
| **computing…** | Its job is queued or running |
| **not a track** | The file is not a Labradar track. Ignored entirely |
| **valid** | Fitted, passed both filters, included in the average |
| **low signal quality** | Fitted, but its R² is below the threshold (§6.3) |
| **outlier** | Fitted, good quality, but its BC disagrees with the batch (§6.4) |
| **excluded** | You unticked it by hand |
| **error** | The fit failed. See §10.4 |

***Not a track*** is the normal state of several entries in every real export, and it is not a problem. The device's own `Report.csv` gets it, because it is a summary rather than a track. So does anything else that happens to end in `.csv` — including the invisible `._` companion files macOS scatters through archives it has touched. The tool decides by looking at the content, not the name: a file is a track if it contains a Labradar track header with a declared velocity unit, and yields at least four usable rows of data.

### 7.3 The Include checkbox

The checkbox reflects the current verdict — ticked for *valid*, unticked for the three rejected states — and clicking it overrides that verdict by hand.

- **Ticking a rejected track** forces it into the average, past the quality gate. It is also made **exempt from the outlier clip** thereafter: a manual override is meant to stick, not to be quietly re-rejected by the very statistic it was overriding.
- **Unticking a valid track** forces it out, and it stays out regardless of either filter.

The checkbox is available only on rows that actually have a verdict to override. A row that has not been computed, is not a track, or errored has nothing to include, and its checkbox is disabled.

Overrides survive a **Compute**, and are cleared when you pick a new zip.

Use this sparingly and for reasons you can articulate. "I looked at the chart, the radar clearly latched onto something else halfway down, and the automatic filter did not catch it" is a reason. "Removing it moved the BC in the direction I was hoping for" is not a reason, and this is exactly the mechanism by which people talk themselves into a number.

---

## 8. The track chart

Click a row and its own velocity-versus-time curve is drawn above the list.

Three series:

- **Kept** — the points that survived cleaning and were fitted against.
- **Discarded** — the points the cleaner threw out, drawn in their own colour so you can see exactly what was rejected and judge whether you agree.
- **BC = *n*** — a solid line: the velocity curve that the fitted BC actually predicts, drawn through the same time span as the data. This is a model prediction, not measured data, which is why it is a line while everything else is a scatter.

The fitted curve starts at the first surviving real measurement rather than at the muzzle. That is where the fit is anchored, and it can only be walked forward from there (§12.5). The device's own made-up muzzle point is still drawn — it is part of the track — but nothing is fitted through it.

The curve is extended to the latest time of **any** plotted point, kept or discarded, so a late outlier stays visually comparable against the curve that correctly ignored it. That is the single most useful thing on this chart: a good track shows the discarded points peeling upward away from a curve that stays glued to the kept ones.

**Download chart as SVG** exports it, the same as the suite's other charts.

Selecting an errored track still draws something: since there is no fit and no kept/discarded split, every raw point except the device's own made-up muzzle point is drawn as rejected, so you can at least see what the radar recorded and form your own view about why nothing could be fitted to it.

The horizontal axis is milliseconds and the vertical axis is metres per second, always. See §3.1.

---

## 9. The Result card

Three lines, above the chart.

- **Valid tracks** — how many of the total are currently in the average. `24 / 31` means thirty-one shots produced a ballistic coefficient and twenty-four of them are being averaged. The denominator counts only tracks that were actually fitted, so entries that were never tracks, and any that errored, are absent from both halves of it. If that denominator is smaller than the number of shots you fired, look down the list for errors.
- **BC standard deviation** — the spread of the individual per-shot BCs that went into the average, to five decimals. This is the number that tells you whether to believe the one below it. See §10.3.
- **The BC itself** — large, in the accent colour, to four decimals. The plain unweighted arithmetic mean of every included track's BC. Beside it, quieter, the 95 % confidence interval on that mean, written as a percentage of it: `0.2812 (± 1.6%)`. A single valid track shows no interval at all, since one shot has no spread to compute one from. See §10.3.

All of them update the instant you change a filter or tick a checkbox.

---

## 10. Reading the result

### 10.1 What you have actually measured

The number is the best single BC, against your chosen drag model, that reproduces the deceleration your bullet actually showed over the first hundred-odd metres of its flight, in the air you told the tool about.

Three qualifications on that, all of them real:

**It is a measurement of the bullet, as fired from your barrel, through your air.** Not of the powder charge. Muzzle velocity is not part of what is being measured — the fit reads the *shape* of the decay, and a bullet that leaves at 780 m/s decelerates according to the same drag curve as one that leaves at 700 m/s. This is why §5.7 can say that a batch need not be velocity-consistent. What the barrel does contribute is real, though: fouling, throat wear and anything that disturbs the bullet on the way out can change how it actually flies, and that will show up here.

**It is fitted over a limited speed band.** The bullet is only in the radar's view for a fraction of its flight, and it is fast the whole time. A single BC against a standard model is a compromise across the band it was fitted over — the tighter your bullet's real drag curve matches the model's shape, the better that compromise extrapolates to the transonic region where it matters most. But the near-field segment the radar records cannot tell you which model extrapolates better at long range. This is a property of the bullet, not of the tool, and it is why the two drag models can both fit well and still disagree downrange.

**It is only as good as your atmosphere.** Again. See §5.6.

### 10.2 Comparing it against the published number

Expect a difference. It would be more surprising if there were not one.

A measured BC coming out **below** the published figure is the common case, and usually the honest one. Published numbers are frequently measured in ideal conditions, over the range band that flatters them most, on a lot that may not be your lot.

A measured BC coming out **far** below — thirty per cent, say — is not a bullet problem. It is an input problem. Check the pressure first (station versus sea-level-adjusted, §5.6), then the drag model, then the projectile offset.

A measured BC coming out **above** the published figure is worth a second look at your atmosphere before you celebrate.

### 10.3 Reading the confidence interval and the standard deviation

The two numbers answer different questions, and the difference is the whole point.

**The standard deviation** is the spread of the individual per-shot BCs. It is a property of your shooting, your ammunition and your radar's day, and shooting more rounds may not necessarily shrink it.

**The confidence interval** is how well those shots pinned down the average. Unlike the spread, this one *does* tighten as you shoot more — but slowly. Four times the shots buys you half the interval. It widens when your shots disagree with each other more, and it is deliberately generous on small batches, because a handful of shots genuinely cannot say much. §12.9 gives the formula.

So a batch of 25 valid tracks with a BC standard deviation of 0.010 gives an interval of roughly ±0.004 around the mean. Against a BC of 0.250 that reads as ±1.6 %, which is a genuinely useful measurement.

The same standard deviation over only 4 valid tracks gives about ±0.016, or ±6 %, which is not. Most of that difference is simply the smaller sample; the rest is the tool declining to flatter a four-shot batch.

**What the interval covers.** Shot-to-shot scatter, and nothing else. It does not include the error in your atmosphere, the mismatch between your bullet and the standard drag model, or the projectile offset you guessed. Those move the mean itself, and a wrong mean stays wrong no matter how tight the interval around it looks — see §5.6 and §10.2 before believing a small percentage.

Two rules of thumb follow directly, and they are the reason §5.7 says what it says:

- **The spread is a property of your data; the precision is a property of your sample size.** Noisy tracks are fixed by shooting more of them.
- **A wide spread is wide relative to what the round and the window make normal.** In the validation runs behind this tool (§12.6) — synthetic tracks carrying noise copied from real Labradar recordings, cleaned and fitted exactly the way the shipped tool does it — per-track scatter ran from about 1.5 % to 5 % of the coefficient, widest for heavy, slowly decelerating rounds over a short window and tightest for fast ones over a long one. A figure inside that band is saying nothing in particular. Well above it, click through the rows and look at the charts before averaging your way past it: the radar was struggling, the lane was cluttered, the offset was off, or your ammunition genuinely is that inconsistent. Note that those runs measured radar noise against a known truth, so a real batch carries genuine bullet-to-bullet variation on top of that band rather than inside it.

### 10.4 When a track errors

A row marked *error* means the fit itself failed rather than producing a bad answer. In practice it means that track's points implied a bullet unlike any real one — a coefficient far outside the range anything ever fired has, or a starting velocity nowhere near what the radar itself recorded — so the tool refused to name a number. The exact limits are in §12.11.

The tool treats that as a failure rather than reporting whichever edge of the range it drifted toward, which is the right behaviour but does mean the row tells you only that it failed, not why. Select it and look at the chart: an errored track almost always turns out to be visibly not a bullet track at all.

One or two errors in a large batch are unremarkable. A batch where most tracks error points at a setup problem — most often poor alignment between the radar and the bullet's path, then a drag model that cannot fit the data at all, or an atmosphere off by enough to put the required BC outside the search range.

---

## 11. Putting it to work

### 11.1 Feeding it into Arsenal

This is the point of the exercise. Open **Guns → Arsenal**, edit the bullet you just measured, and replace the published BC with yours, against the drag model you fitted it with.

There is no automatic hand-off — you type the number in. It is four digits, and it is worth the deliberateness: this is you deciding that your measurement supersedes the manufacturer's claim, and that decision should be a conscious one.

From that moment every tool in the suite — Trajectory, Hit Probability, Range Solver, the comparison chart — is working from a measured drag figure. The improvement is not visible at a hundred metres and is very visible past six.

### 11.2 Comparing lots and loads

Because the tool reports a per-shot standard deviation as well as a mean, it is a rather good instrument for questions that have nothing to do with drag:

- **Two lots of the same bullet.** Shoot twenty of each, run them as separate batches. A meaningfully different mean BC means the lots genuinely differ, most likely in ogive or base uniformity.
- **The effect of a tipping die, or of sorting by base-to-ogive.** Same treatment. The interesting number here is the *standard deviation*, not the mean: consistent bullets produce consistent BCs.
- **Coated versus uncoated, moly, whatever the current enthusiasm is.** The measurement is honest and the effect size is usually smaller than the marketing.

Keep the atmosphere honest between comparisons, or you will be measuring the weather.

One batch you get for free: **a load-development ladder is already a valid BC session.** Since the fit does not care about muzzle velocity (§5.7), a ladder of twenty or thirty rounds spanning a range of charge weights, all with the same bullet, averages into one perfectly good ballistic coefficient. You were going to shoot it anyway, and the Labradar was going to record every track anyway. Zip the session and run it.

---

## 12. Geek's delight: what actually happens to your tracks

Everything below is what the tool actually computes, with the reasoning and the evidence. It is not required reading for using the tool, and it is the most interesting part of the tool.

**Units throughout this section are the engine's.** Internally everything is metric — metres, seconds, metres per second, kelvin-referenced temperatures — and conversion happens only at the two boundaries: the track file's own declared units on the way in, and your display preference on the way out.

### 12.1 What the device measures, and what it does not

A Doppler chronograph does not measure position and differentiate it. It measures the frequency shift of its own transmission reflected off the bullet, which is directly proportional to the bullet's velocity component *along the beam*. Velocity is the primary measurement. Distance is integrated from it, which is why the distance column is smooth even when the velocity column is not.

Two consequences shape everything downstream:

**The projectile offset is a real geometric correction, not a nicety.** What the beam sees is the radial component of the velocity. Converting that to true downrange velocity needs the angle between the beam and the trajectory, which is derived from the offset you configured. An offset error is a cosine error, and cosine errors are the worst kind: small, systematic, and entirely invisible in the output.

It also explains the asymmetry claimed in §5.2 — why a sloppy offset costs a BC measurement more than it costs a muzzle velocity. The angle between the beam and the trajectory is not constant: it is widest right at the muzzle and closes toward zero as the bullet goes downrange. So the correction factor is a *function of distance*, and getting the offset wrong does not scale the whole track by one wrong constant. It bends it. The early points are corrected by more than the late ones, or by less, and what comes out is a velocity decay curve of the wrong shape.

A muzzle velocity is a single point on that curve and absorbs the error as a modest offset. A ballistic coefficient is fitted to the curve's shape and absorbs it as a bias. The same sloppiness that leaves your chronograph readings looking perfectly reasonable can move a BC by several per cent.

**SNR is a direct measure of how much of the return is real.** It is reported per point, in decibels, and it degrades steadily as the bullet recedes — the returned power falls off as the fourth power of range, so a bullet twice as far away returns a sixteenth of the signal. It is the right weight for a fit, and the tool uses it as one (§12.4).

### 12.2 What the noise actually looks like

Before any of this was designed, the noise was measured rather than assumed: 1,297 unique real tracks, deduplicated from a bulk export, with residuals taken against a reference line fitted to only the **first 30 %** of each track's own time window — deliberately clear of tail contamination.

Pooled velocity residual, in m/s, by decile of position along the track:

| Decile | mean | stdev | p5 | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| 0 (start) | -0.00 | 0.69 | -0.68 | 0.01 | 0.65 | 1.97 |
| 2 | -0.01 | 0.82 | -1.15 | -0.03 | 1.13 | 2.53 |
| 4 | 0.41 | 3.69 | -2.07 | 0.01 | 3.12 | 18.65 |
| 6 | 1.97 | 8.64 | -2.86 | 0.28 | 15.78 | 43.25 |
| 8 | 5.77 | 15.67 | -3.97 | 1.18 | 38.97 | 67.87 |
| 9 (end) | 10.41 | 19.46 | -3.62 | 3.44 | 52.06 | 81.03 |

Read the two tails against each other, because that is the whole story. Early in the track the noise is tight and genuinely symmetric — a well-behaved high-SNR Doppler return. Late in the track the **down** side barely moves: p5 stays around -3 to -4 m/s the entire way. The **up** side grows by nearly two orders of magnitude, to a 99th percentile of 81 m/s.

Bad Labradar points essentially only ever overestimate velocity. That is exactly what a spurious return looks like — a reflection off something nearer, or a multipath arrival, both of which read as less range-rate loss than the bullet actually suffered. It is not symmetric noise and it must not be treated as such.

Two more facts from the same corpus, both load-bearing for the design:

- **55 % of real tracks need no point trimming at all.** The cleaner is not a routine smoothing pass; it is an exception handler.
- **Severity varies enormously between sessions and is not predictable from within a track.** The discard count across the corpus ranges from 0 to 73. Caliber (how reflective the bullet's base is), clutter near the flight path, beam alignment and the box's own stability under muzzle blast all contribute independently.

That last point killed two separate designs for a per-track adaptive threshold, both of which tried to calibrate the cleaner's aggressiveness from the early part of each track. It cannot work: real severity lives almost entirely in the tail, and a signal calibrated from the head structurally cannot see it. One of the two was rejected on a *noiseless* synthetic track, where it discarded 18 to 26 perfectly good points; the other passed that check but then never once differed from a flat threshold on real tracks with genuine severity. Both are documented in the repository's cleaning-experiment report, and the flat threshold that replaced them outperformed both.

### 12.3 Cleaning: greedy worst-point removal with an R² restore gate

Each track is cleaned before anything is fitted to it. The algorithm is inherited from the predecessor tool, ported deliberately unchanged, and is neither sigma-clipping nor RANSAC:

1. Fit an SNR-weighted least-squares straight line through the points.
2. Find the point with the largest absolute residual from that line. Remove it. Record the R² of the fit *before* the removal.
3. Repeat, down to a floor of 10 remaining points.
4. Then walk the recorded R² history forward from the beginning. At the **first** step whose R² was already within a relative threshold of the best R² ever seen during trimming, restore that step's point **and everything discarded after it**.

Step 4 is the subtle part and the reason the algorithm works. The trim loop always runs all the way to the floor, discarding good points along with bad ones; the restore pass then asks "at what point did further trimming stop buying anything?" and rolls everything back to there. A track that needed no cleaning at all has a best-possible R² at step zero, so the very first restore check passes and every discarded point comes straight back. This is how 55 % of real tracks correctly emerge untouched from a loop that unconditionally removed dozens of their points.

Three index asymmetries in this routine look like bugs and are not:

- **The device's synthetic t = 0 point is excluded from the fit, from the R², and from the worst-point search.** It is not a measurement (§3), and its SNR field is literally a dash. It cannot be allowed to influence a fit and cannot meaningfully be "removed".
- **The last point is excluded from the fit and the R², but remains eligible for removal.** The device is noisiest exactly at the tail, so a bad last point must not be allowed to corrupt the quality metric — while still being a legitimate candidate for trimming. The consequence is a specific, testable behaviour: a track whose *only* problem is a bad last point already has its best-possible R² at step zero, so the first restore check passes and that point comes back. It only stays trimmed when it coincides with a genuine problem inside the fit range.
- **Two different fit ranges** are used for what is mathematically the same weighted linear regression: one excluding the last point (for the R² and the worst-point search) and one including it (for reading velocities off, in the older two-point estimator). Conflating them is an easy and genuinely damaging mistake — the two ranges produce velocities agreeing to only about three significant figures, which is invisible in R² and silently worth about half a per cent of BC.

There is one honest accident preserved from the original: the stopping condition is checked *after* the splice, so the loop can and typically does remove one point past the floor, bottoming out at nine rather than ten. No domain justification for it was found in the legacy source. It is kept because the port was validated against real tracks as a whole, and changing it would invalidate that validation for no known gain.

### 12.4 SNR weighting

The SNR column is in decibels. Every point's weight is that value converted back to a linear power ratio:

$$w_i = 10^{\,\text{SNR}_i/10}$$

which is not a cosmetic transformation. A 40 dB point weighs 10,000; a 10 dB point weighs 10. Across a real track that is a factor of a thousand between the confident early returns and the doubtful late ones, which is precisely the shape the noise table in §12.2 says it should be. The fit is dominated by the part of the track the radar was actually sure about, and the noisy tail contributes almost nothing — while still being *present*, so a tail that genuinely disagrees with the model still shows up in the residuals and still gets caught by the cleaner.

The synthetic t = 0 point has no SNR at all and is assigned a weight of zero — though in practice it never reaches a weight, since every fit in the tool excludes it structurally by index before weighting is applied.

### 12.5 The fit: physics over the whole window

This is the part that was rebuilt rather than ported, and it is where the accuracy comes from.

The obvious approach, and the one the predecessor used for years, is: fit a straight line through the cleaned points, read a velocity off it at each end, and bisect for the BC that makes the drag model take you from the first velocity to the second over the elapsed time. Two points, one assumed curve shape.

What this tool does instead is fit the **physics itself** against every kept point at once. Two parameters are solved jointly:

- $v_1$, the true velocity at the anchor point, and
- the ballistic coefficient.

For a candidate pair, the app's own trajectory integrator is walked forward from the anchor and its predicted velocity is evaluated at every kept sample's own time. The objective is the SNR-weighted sum of squared residuals:

$$\text{SSE}(v_1, \text{BC}) = \sum_i w_i \left(v_{\text{model}}(t_i;\, v_1, \text{BC}) - v_i\right)^2$$

and it is minimised by a **nested golden-section search** — inner search over BC for a candidate $v_1$, outer search over $v_1$ — rather than by bisection, because this is a minimisation of a sum of squares rather than a root-find on a monotonic scalar. Thirty iterations each, with BC bracketed to [0.05, 1.5] and $v_1$ to within 15 % of the raw anchor velocity.

Three design points are worth stating explicitly:

**The anchor is the first *retained interior* point**, not the device's t = 0 point and not the raw first sample. Its own recorded velocity is only the *starting guess*; the actual $v_1$ is fitted. That matters because that single reading is itself a noisy measurement, and holding it fixed would propagate its error straight into the BC.

**Fitting $v_1$ costs almost nothing in overfitting risk**, which is the argument for doing it. Two physically meaningful parameters is a far tighter model than a three-coefficient quadratic, and it cannot chase noise the way an extra polynomial term can — the shape is constrained by real drag physics, not by a free curvature term.

**The curve shape is never assumed.** It is whatever the drag model actually produces at those speeds in that air, which is the entire point.

The integration is the suite's shared RK4 stepper, at a fixed 20 ms step outside the transonic band and 3 ms inside it, with the atmosphere re-evaluated at each step from the bullet's own current altitude. Landing exactly on a target time uses the same three-point quadratic interpolation the rest of the engine uses for landing on a target range — reading off whichever raw step happens to overshoot would be a real error at these speeds, tens of metres' worth.

### 12.6 Why not a straight line, and why not a quadratic

Both alternatives were tested rather than dismissed, against synthetic tracks carrying **real** noise — bootstrapped from the 1,297-track corpus of §12.2 rather than drawn from a parametric model, specifically because the parametric model understated the severe tail. Four ground-truth configurations, three window lengths, 300 trials per cell.

The cleanest single result comes from the case with no noise at all — a perfectly clean synthetic track for a known BC of 0.202:

| Method | Recovered BC | Error |
|---|---|---|
| Linear | 0.1838 | -9.0 % |
| Quadratic | 0.2028 | +0.4 % |
| Physics fit | 0.2020 | **+0.01 %** |

That isolates something the noisy trials cannot: **a straight line is a genuinely poor model of the true, physically curved velocity decay** over a 150–200 m window. Nine per cent of error, with a perfect chronograph, before noise is even considered. It is a structural bias, not a robustness problem.

With real noise added, across every configuration and window length tested:

- **Quadratic overestimates BC in every single cell**, by +4 % to +9 %. It fits the noisy tail too well — and since §12.2 established that tail errors are one-sided upward, fitting them well means being dragged upward. This reproduces exactly the failure the predecessor tool's author had already found by hand.
- **Linear's bias is configuration-dependent, and grows with window length.** Nearly flat for a heavy, gently decelerating .338; a strong and worsening negative bias for a fast, low-BC 5.56 — from -3.4 % at 120 m to -8.4 % at 200 m. That is the curve-shape bias above, compounding with noise sensitivity.
- **The physics fit had the smallest error in every single cell**, typically three to nine times smaller than either alternative, with the tightest spread as well.

The improvement survives contact with the actual use case: using each method's fitted BC to predict velocity at 300 m — beyond the measured window, which is what a BC is *for* — produces the same ranking.

The honest caveat: all of this is synthetic. Real tracks were used to characterise the noise the synthetic tracks carry, not to independently re-derive a real bullet's BC end to end.

### 12.7 Why the de-noise threshold defaults to 0.990

The cleaning threshold was swept directly, on 40 real-noise tracks:

| Threshold | Avg points discarded | Avg abs BC error |
|---|---|---|
| 0.95 | 0.70 | 1.09 % |
| 0.97 (the old default) | 2.42 | 1.08 % |
| **0.99** | **3.10** | **0.96 %** |
| 0.999 | 11.40 | 0.56 % |

On the flat corpus the effect looks modest. On the tracks that actually needed cleaning — those with more than fifteen genuine discards — it is dramatic: mean BC error was **flat at about 21 % across the entire 0.80 to 0.97 range**, and dropped to 6–7 % only at 0.99. Recall against known injected outliers rose from 14–54 % to 74–98 %.

Error kept improving past 0.99, but the discard counts exploded doing it — sixty-plus points from tracks that started with 100 to 140, well past anything real tracks exhibit and into a near-floor regime where the fit is running out of data. **0.99 is the value the evidence supports; nothing beyond it was trusted on this evidence.**

Two findings from the same experiment are worth recording because they are negative results:

- **Cleaning and fitting are not independently swappable.** Paired with the *old* linear fit, the raised threshold did not reliably help and made one configuration measurably worse. It earns its keep only alongside the physics fit. Evaluate the pair, not the pieces.
- **Measuring the cleaner's residuals against the physics model instead of a straight line was built, validated as accurate, made cheap enough to ship — and produced no measurable benefit** once the threshold was already raised. It was left out. This is the tool's one deliberate piece of unshipped, working infrastructure, kept in the repository as context for a future rework rather than as dead weight in the bundle.

### 12.8 The two whole-track gates

Both operate on finished per-track results, and neither refits anything, which is why they respond instantly.

**The signal quality gate** compares each track's R² — the coefficient of determination of the SNR-weighted straight line through its *cleaned* points — against 0.95 (Normal) or 0.90 (High noise), or skips the test entirely (None).

There is an apparent contradiction here worth resolving: §12.6 just established that a straight line is the wrong model for fitting BC. It is nonetheless the right reference for a *quality* check, for two reasons. A track's deviation from linearity over a 100 m window is dominated by noise, not by the real curvature — the curvature is a few per cent, the bad points are tens of metres per second. And using the same reference the cleaner itself uses makes the reported R² directly interpretable as "how well did cleaning go", which is what the user is actually being asked to judge.

**The outlier clip** computes the mean and the population standard deviation over whatever is still valid after the quality gate, then rejects any track more than $k\sigma$ from that mean, with $k = 2.0$ (Conservative) or $k = 1.644854$ (Aggressive). That second constant is not arbitrary: it is the 95th percentile of the standard normal, so a two-sided clip at that width retains the central 90 % of a normal population. It is the standard "reject the worst 10 %" threshold, written exactly.

The gates run in that order, and only that order: quality first, then the clip over the survivors. A track already rejected for quality does not contribute to the mean and standard deviation the clip is computed from — which is right, since a bad track's BC would otherwise widen the very yardstick used to catch bad tracks.

**Manual overrides bypass both**, and a forced-include is additionally exempt from the clip pass itself. A manual override is meant to stick, not to be silently re-rejected by the statistic it was overriding.

### 12.9 Aggregation

A plain unweighted arithmetic mean of the surviving BCs, and their population standard deviation — divided by $n$, not $n-1$.

The reported confidence interval is a separate calculation over the same surviving set, and it does use $n-1$: half-width $= t_{0.975,\,n-1} \cdot s / \sqrt{n}$, with $s$ the sample standard deviation, divided by the mean to give the percentage shown. The two denominators are deliberate. The population form is what the legacy outlier clip was calibrated against and it stays untouched; the sample form is the correct one for an interval on a mean. The multiplier is the two-tailed 95 % Student-t quantile, tabulated for $n$ up to 31 and taken from a Cornish-Fisher expansion beyond, which matters more than it might seem — at five tracks it is 2.776, and at four it is 3.182, against the 1.96 a normal approximation would use in either case — a 42 % and 62 % wider, and considerably more honest, interval.

It is specifically *not* the `TDIST_QUANTILE` table the Rifle Precision tool carries. Those are 0.9875 quantiles, Bonferroni-split to give a joint 95 % across a shot group's two point-of-impact coordinates at once. A BC average is a single scalar, and borrowing that table would report an interval up to twice as wide as the 95 % it claimed.

Fewer than two valid tracks reports no interval rather than a zero-width one.

The unweighted mean is a deliberate choice, not an oversight. Points within a track are SNR-weighted, because SNR is a genuine per-point quality measure. Tracks within a batch are not weighted at all, because every shot in the batch is one draw from the same population of shots, and there is no defensible reason to let a cleaner track speak louder about what the *bullet* does than a noisier one. Weighting by track quality would systematically over-represent the shots the radar happened to like, which is not the same population as the shots you fired.

### 12.10 What the fit ignores, and what it does not

**Wind is ignored** — the integration is run with zero wind. Over 100 m of flight at 0.15 s, a crosswind's effect on the *speed magnitude* is negligible, and speed magnitude is all this fit ever looks at.

**Gravity is not ignored**, but it is nearly irrelevant, and it is worth seeing why. The bullet is walked forward as if launched horizontally, so after 0.15 s it has picked up about 1.5 m/s of vertical velocity. Against 760 m/s horizontal, the resulting speed is $\sqrt{760^2 + 1.5^2} \approx 760.0015$ m/s. Fifteen ten-thousandths of a metre per second. Including gravity costs nothing and removes one thing to argue about.

**Altitude is back-derived from your station pressure** rather than assumed to be zero. The predecessor tool always assumed sea level, which was an engine limitation rather than a decision. Deriving an altitude from the pressure lets the integrator apply its own in-flight atmosphere model consistently — although across 100 m of flight and essentially no altitude change, this too is a small effect. It costs nothing and it keeps this tool's atmosphere handling identical to every other tool in the suite, which is worth more than the correction itself.

**Air density is the effect that actually matters**, and it comes from all three atmosphere fields through the suite's shared humid-air density model. This is why §5.6 is as insistent as it is.

### 12.11 Numerical and engineering notes

- **Zip entries are filtered by extension before decompression**, not after. Everything that is not a `.csv` — the `.lbr` project file, folder entries, anything else in the archive — is skipped without ever being decompressed. Content sniffing happens a layer up and knows nothing about zip files, which is why the module boundary sits exactly there.
- **Parsing is synchronous and immediate; fitting is not.** Parsing a hundred-row CSV is microseconds, so it happens the moment the file is picked and the list appears at once. Fitting is hundreds of full trajectory integrations per track and goes to the worker pool.
- **Jobs are dispatched individually rather than as one batch promise**, specifically so each row updates as its own fit resolves. Waiting for all of them before showing any would be simpler and worse.
- **The solver flags boundary saturation as a failure.** The two search brackets are the ones §12.5 names: BC confined to [0.05, 1.5], and the reference velocity to within 15 % of the track's own anchor reading. A golden-section search always returns *some* interior point, even when the true minimum lies outside its bracket — it silently saturates against whichever edge keeps improving, which looks exactly like convergence and is not. That was a real bug, caught mid-validation. A result landing within 0.1 % of either bracket edge is now treated as a failed fit, matching how the suite's other BC solvers already refuse to return a boundary value for an unreachable target. This is the whole of what an *error* row in §10.4 means.
- **The drag model and atmosphere are stashed alongside each track's result** rather than read live when the chart draws. The fitted curve overlay therefore always reflects what that particular track was actually computed with, even if you have since changed the panel's settings without recomputing.
- **A track needs at least four parseable rows** to be considered a track at all. Rows missing any of time, velocity or distance are silently dropped; so is any row after the first that is missing its SNR. Only the first row is allowed a non-numeric SNR, because only the first row is the device's own synthetic point.
- **The 20,000-step integration ceiling** is a safety limit on the shared stepper, not a constraint here — a 0.15 s track needs a few dozen steps.

### 12.12 What is deliberately not here

**No total error budget.** The confidence interval covers sampling and only sampling (§10.3). It does not fold in the atmosphere you typed, the drag model you picked or the offset you guessed, which in most real sessions dominate the shot-to-shot scatter entirely. Rolling those into one headline figure would require pretending to know how wrong your inputs were, and a number built on that pretence would be worse than no number.

**No automatic hand-off to Arsenal.** Every other measurement tool in the suite hands its result onward directly. This one does not, and that is a decision rather than an omission: replacing a published BC with a measured one is a judgement about which number you trust, and it deserves to be made on purpose.

**No per-track uncertainty.** Each track reports a BC and an R², not a BC with an interval. The R² measures how clean the track was, not how well-determined the BC is, and the two are related but not the same thing. Conflating them would be worse than reporting neither.

---

## 13. Provenance

BC Labradar is the successor to **Labrabaco**, a standalone tool by the same author. The ingestion path — the track sniffing, the row tolerance rules, the point-cleaning algorithm and its two whole-track rejection gates — is ported from it faithfully, traced call site by call site and validated against real sample tracks, including the several index asymmetries documented in §12.3 that look like bugs and are not.

What is new is the fitting. The legacy tool fitted a straight line through the cleaned points and bisected for the BC that matched its endpoints; this one fits the app's own drag physics against every kept point at once, jointly with a reference velocity. That change, and the paired cleaning-threshold change from 0.97 to 0.99, were validated against real-noise synthetic tracks before either shipped, and the validation reports — including the negative results, the two rejected designs, and the one working mechanism that was built and then left out for failing to earn its cost — are in the repository alongside the code.

Also new: the per-track chart with its kept/discarded split and fitted-curve overlay, which the legacy tool had no equivalent of at all; a structured result card in place of a concatenated text dump; parallel fitting across a worker pool; and a full unit-aware atmosphere with a real derived altitude, in place of an assumed sea level.

The suite is licensed **AGPL-3.0-or-later**.

---

*Peaceful. Precise. Armed.*
