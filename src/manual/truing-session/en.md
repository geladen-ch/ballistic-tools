# geladen.ch ballistics User Manual — Truing Session

*Part of the* [geladen.ch ballistics suite](https://bc.geladen.ch)*. Experimental.*

---

## 1. What this tool is for

Your rifle and your app don't agree. You dial what the app predicts, and the bullet lands somewhere else. Something is wrong — but the come-up error you see at the target doesn't tell you *what*: a wrong muzzle velocity, a wrong ballistic coefficient, a zero that shifted, a scope that under-delivers on its clicks, or simply a bad wind call, can all produce the same miss. This tool plans a short shooting session that actually separates those causes, walks you through shooting it safely, and reports what it learned — including when it *can't* tell two causes apart, which is itself useful information.

**Scope:** supersonic only. Every target this tool plans against sits where the bullet is still comfortably faster than the speed of sound (down to Mach 1.1). Transonic and subsonic behaviour are a different, harder problem this version doesn't attempt.

**This tool is marked Experimental.** The statistics behind it have been validated against synthetic data with known injected errors, but it hasn't yet had the kind of real-world mileage the rest of this app has. Treat its BC correction as a strong hint worth checking, not gospel — and if a result looks implausible, it probably is (see §6).

### What this tool is not

It is not a substitute for careful handloading records or a chronograph session on its own. It is specifically about **separating causes from each other**, which a plain DOPE log usually can't do — see §2.

It doesn't true muzzle velocity. Muzzle velocity is an input with a provenance (you measured it, or the box told you); this tool trues the **drag scale**, the one thing a supersonic session can actually see clearly once a chronograph has pinned the muzzle velocity down.

---

## 2. Why a planned session, not just your existing log

A handful of DOPE entries at a few ranges looks like it should tell you everything — five numbers to fit five unknowns. In practice it doesn't, for a simple geometric reason: muzzle velocity, drag scale and scope tracking all bend the trajectory in almost exactly the same shape across a normal shooting envelope. Your data can't tell them apart, no matter how many groups you add, unless something *else* — a chronograph, a tall-target test, a second target chosen specifically to break the tie — gives the fit an independent handle on one of them.

The single biggest lever in this whole tool is one you supply, not one you shoot: **a chronograph reading**. Without one, no supersonic session at any distance or round count reliably measures the drag scale to better than about ±3%. With one, the same session routinely gets to ±1.5%. If you don't have a chronograph, this session is still worth shooting — it will true your come-ups and catch a real zero problem — but it will not, and should not, hand you a BC correction.

---

## 3. The three phases

### Prepare

The tool reads your active rifle and cartridge (from Arsenal — this tool has no rifle picker of its own) and your active shooting location. It tells you plainly whether your registered targets are far enough out to say anything useful about drag, computes the best near/far target pair for *this* cartridge, and walks you through a short, entirely optional homework checklist — verifying your zero, your scope's click value, your rifle's own dispersion, and (most importantly) today's actual muzzle velocity average. None of it is mandatory, but skipping it means the session has to spend its own precision finding out what you could have told it for free.

The tool has its own weather inputs — temperature, station pressure, humidity and wind at the rifle — and keeps them itself; nothing you enter in another tool changes them. Enter the station pressure, what a barometer at the rifle reads, never a sea-level-reduced (QNH) value from a phone or a weather app; when the location card has an altitude, the tool warns you if the pressure you entered looks like QNH. Read the temperature to about 3 °C at the rifle; humidity matters little. You confirm the conditions before you can start, and at that moment they are frozen into the session: the plan and every later fit run in that air, so weather changed elsewhere afterwards cannot alter shots already fired. The zero is taken to have been made once, on the level and in calm air, in the cartridge's zero atmosphere when Arsenal gives one for it (set it there if you zeroed on another day or at another altitude; it matters mostly for a zero of 200 m or more), otherwise in this starting air. A BC correction assumes the conditions you entered were right — a wrong temperature or pressure is absorbed by the drag term — and the Conclude screen says so.

If your registered targets don't quite reach far enough, or don't have anything near the zero range, the tool asks once whether you have a natural mark — a rock, a berm edge, anything you can range — to fill the gap. It only asks when there's an actual gap to fill.

Every planning number here assumes your rifle's own dispersion (from Arsenal, or the preset you pick) and a near target read as a rough glance rather than shot by shot — the conservative case — so the grade you see is one a real session can actually deliver. You set the total number of rounds you'll bring, the safety steps included; the plan takes one shot at the near group (a glance that more shots don't sharpen) and spends the rest on a middle distance and the far target, in the split that best tells the causes apart; each suggestion (a chronograph, more rounds, a zero check, a farther target) shows the result it would give next to the current one. If you correct a target's distance or angle, you choose whether that goes onto the location card for good or is used for this session only. The "this range is flat" box is never ticked for you — a location card can't tell a range that is flat from one nobody has measured — so tick it only if you know the range is flat. Ticking it only switches off the slope checks for this session; it never writes an angle anywhere, and a slope you have declared away can then be mistaken for a wrong distance or a wrong drag. Under the budget field the tool shows where extra rounds start to pay much less, and what ten and twenty more than that would buy; those numbers are minimums, counting only rounds whose impact you can see, so bring more than they say.

Below the grading the tool always asks you to measure your far target again before you start — its distance with your rangefinder (several reads, watching for a beam that catches something in front of the target), and its angle with a clinometer unless you have declared the range flat. That one distance is what the result leans on hardest and what the shots can least check: with nothing else nearby, a distance that is wrong by a few tens of metres looks exactly like a wrong drag scale, and even with a neighbouring target such an error often slips through. A minute at the far target is worth more than extra rounds. Skipping it is the costliest mistake in a session: a far distance 20 m out typically leaves the result about 0.3 mrad off at that target (about 30 cm at 1,000 m), and the tool will not flag it, because a target that is too far away looks exactly like a bullet with a lower BC. Give the tool a backdrop at least 2 m tall (1 m each way): with 1 m about a third of sessions lose an impact off it, with 2 m a few in a hundred.

### Shoot

The tool sequences your shots as a ladder: near ground first, one safe step further only once the previous step has actually landed on the backdrop. This is deliberate — a wrong assumption in the app can, in principle, put a shot well off a distant backdrop, and there is no reason to risk that on the very first shot of the day. "I couldn't see where that one hit" is a normal, useful outcome here, not a mistake — it tells the tool something real, and it steps back to safer ground automatically.

After every recorded group the tool shows a live, clearly provisional readout of what it has learned so far. This is not the final answer — a later group can and does revise it — so it's deliberately shown differently from the final report, and it will say "muzzle velocity or drag, not yet separable" rather than guess at which one, right up until a chronograph or a well-placed shot actually breaks the tie.

The ladder steps at most four times a distance that has actually landed, and further only when nothing nearer is left and its prediction says the shot will still land on the backdrop, so a location without intermediate ground can still stall before the far target — the Prepare screen warns you, and you can add a distance on the spot. If the tool thinks a target's distance or angle is off, it asks you to re-range it and, unless the range is flat, put a clinometer on it: from the shots alone a wrong distance and an unrecorded slope look exactly the same, and the angle is what tells them apart.

Before every group the tool shows what to dial for that shot — elevation and windage, in the unit and with the direction signs you chose for Range Solver — from the fit so far (the app's own dope before anything is recorded), in the air and wind of that shot, with a 95% band. Dial it in full and record what you dialed: the come-up you enter is the whole dial, not a correction on top of the tool's number. You enter it in scope clicks (positive is up); every other distance, speed and angle in this tool, typed or shown, follows the units you chose in Settings, and the next-shot readout also gives clicks when Range Solver is set to mrad or MOA. Windage is only predicted from the wind you called; the tool learns nothing from sideways impacts. Each group also has its own weather: tick that the weather has changed and enter what your pocket meter reads at that target; later groups keep it until you change it again, and each group's chronograph readings are compared with the velocity the cartridge has in that group's air. When the next planned distance is more than four times the farthest that has landed, or the backdrop is too small for it, the tool says which, and only then asks for an intermediate distance (a natural target counts; you may answer "none available"). Before the very first shot it warns if that shot may leave the backdrop and offers the zero range instead; going on anyway is allowed. A distance where you could not see the impact gets one more try once another group has been recorded, with the elevation the tool shows for it; if nothing nearer can be shot, an extra group at a distance that has already landed unlocks that retry. If misses repeat, check the cartridge's BC and drag model against their published source first, then the zero, the muzzle velocity and the pressure you entered.

### Conclude

A ranked list, never a single verdict. Each item gets three things: how likely it is to actually matter at your own longest working range, its size with an honest margin, and — where two causes can't be told apart — both of them together, never one alone. Where the session found a real, well-measured drag correction (only ever offered with a chronograph behind it), you can save it to your cartridge; you'll see the before-and-after numbers before you commit to anything.

A BC correction is only offered with at least five chronograph readings actually captured this session — a ticked "chronograph available" box with no readings behind it proves nothing — and you can keep it for this session only instead of saving it. Without one, you still get the come-up correction for exactly the distances you shot. When you're done, "Start a new session" clears the session (your preset choices stay). The tool is careful about what it calls a correction. A zero correction is reported only when it is very likely to matter; when it is only possible, you'll see "possible, not yet clear" and are asked not to change anything on that alone. The come-up table for the distances you shot appears only when its corrections are larger than the doubt about them — a correction smaller than its own uncertainty is just the noise of a few groups, and applying it can leave you worse off than doing nothing. A cause the session could not determine is never listed as checking out: the Conclude list says "not determined by this session" instead (the click value, for one, can only be settled by a tall-target or ruler test, not by shooting), and "checks out" is kept for causes the shots did determine and found small. The muzzle velocity your chronograph reads during the session (from the first reading on) is trusted over the average you checked beforehand: the fit weighs it by its own uncertainty, the shot-to-shot spread over the square root of the number of readings, and no longer holds your checked average against it, because that average was measured on another occasion and a warmer or colder day, or another lot, can make it wrong. The Conclude list also reminds you which homework you ticked: the stated bands and the grade take every ticked item as really done, and if one was optimistic (a zero ticked but not re-checked, say) the true uncertainty is larger than shown — in tests the truth then fell outside the stated band about half the time. When the muzzle velocity you measured differs from the cartridge's, the list says how many rounds to chronograph to settle it (the average to about 2 m/s, at your own spread).

For geeks: a zero finding is reported as a correction at P(material) ≥ 0.8 and as "possible" between 0.5 and 0.8. A dial-table entry counts only if it reaches 0.05 mrad and one standard deviation of its own predictive uncertainty (the fit's covariance propagated through the sensitivity columns at that distance); the table is shown when at least one entry counts. Both thresholds were chosen by sweeping candidate rules over thousands of simulated sessions: together they roughly halve the sessions in which acting on the result leaves the come-up worse than doing nothing, at a small cost where the zero really is a little off.

---

## 4. The certainty picker — plain version

Sometimes you're recording an old memory, a single called shot, or a group on a target you couldn't walk down to inspect closely (this is completely normal for a near target on a busy range). For those, instead of a precise measurement, you'll see three options:

- **Very certain** — you'd bet your zero on this reading.
- **Fairly certain** — probably right, but you wouldn't stake much on the exact number.
- **Less certain** — a rough sense of where it landed, nothing more.

Pick honestly. The tool uses this to weigh your reading appropriately — an honest "less certain" is more useful to it than a confident guess dressed up as a precise one.

### For geeks

Each level maps to a standard deviation, scaled to your own scope's click value: Very certain = ±1 click (σ = half a click), Fairly certain = ±2 clicks (σ = one click), Less certain = ±3 clicks (σ = 1.5 clicks), all read as a 95% interval. This scale is self-calibrating — the noise floor of a single, entirely unmeasured shot works out to almost exactly the "Less certain" row at a standard 0.1 mrad click, which is why that's also the honest default for a near-target group you couldn't resolve shot-by-shot.

---

## 5. What "BC gain factor" means, and where it lives

A trued drag correction is saved on your **cartridge**, as a "BC gain factor" — a multiplier, 1.00 by default. 1.05 means the bullet behaves as if its published BC were 5% higher (less drag, flatter); 0.95 means the opposite. It lives on the cartridge, not the bullet, because the same bullet out of a different rifle at a different velocity genuinely drags a little differently — the published data itself is untouched.

Once saved, every tool in this app — Trajectory, Range Solver, Hit Probability, this one — uses the corrected value automatically. Truing a cartridge twice compounds the two corrections; it never simply overwrites the first one with the second.

---

## 6. Reading an implausible result

If a session reports a drag correction of tens of percent, or a muzzle velocity hundreds of metres per second off, that is not a subtle finding — it is a sign that something further upstream is wrong: an implausible BC entered on the bullet, or the wrong drag model picked (G1 specified for a bullet whose BC was actually measured for G7, or vice versa). Double-check the cartridge's own BC and drag model against its published source before trusting anything else the session reports. A session that also had to retreat from several ranges because it "couldn't see the impact" is telling you the same thing a different way — take that as seriously as the numbers.

---

## 7. Privacy

Everything in this tool runs and stays on your own device, exactly like the rest of this app — no account, no upload, no telemetry. The session itself is kept in your browser's local storage. The tool only ever writes elsewhere when you explicitly choose to: a BC gain factor or a new muzzle-velocity SD to your own cartridge record, or a corrected distance or angle to your own location card.
