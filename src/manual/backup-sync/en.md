# Backup & Sync — what it is, how to set it up, and why it kind of hates iPhones

## Why there's no "Cloud" button

I've said since day one that this app is privacy-fundamentalist: everything runs in your browser, nothing is ever collected or sent to any server of mine, and I intend to keep it that way. So no, I'm not going to bolt on a "create an account, log in, sync to Geladen Cloud™" feature. That would mean running a server, which means storing your data somewhere I control, which is exactly the thing I built this app to *not* do.

But "no cloud feature in the app" doesn't have to mean "no way to keep two devices in sync." You almost certainly already have a cloud sync service running somewhere — OneDrive, Google Drive, iCloud, Dropbox, NextCloud, whatever your work or family already pays for. Those services are very good at one specific job: making a folder on your computer/phone look identical to the same folder on another computer/phone. So instead of reinventing that wheel badly (and insecurely), Backup & Sync just writes its own little backup file into a folder *you* pick — and lets your existing cloud service carry that file around for you. The app never talks to OneDrive or Google or anyone else directly. It doesn't even know which one you're using. It just reads and writes files in a folder, the same way it already lets you save/load your libraries manually today.

Each of your devices does the same thing: writes its own file into the shared folder, and reads whatever files the *other* devices have dropped there, merging in anything newer. Point two or three devices at the same synced folder and they end up seeing the same Arsenal, the same Locations, the same Rifle Precision projects — without me ever seeing any of it.

This is genuinely new and experimental. Back up your libraries with the normal export buttons before you turn it on. I mean it — the toggle in Settings says so too.

## Setting it up

In **Settings → Backup & Sync**:

1. Tick **Enable backup & sync**. It'll nag you to export your libraries first — do that, it takes ten seconds.
2. Give the device a **name** you'll actually recognize later — "Guns' Laptop", not whatever generic default it guessed. This matters more than it sounds like it should, especially once you have two similar devices (see below, in the section where I complain about iPhones).
3. Hit **Choose Folder…** and pick a folder that your cloud service already syncs. Not "create a new folder and hope for a miracle" — pick one that's *already* inside your OneDrive/Drive/Dropbox/NextCloud/iCloud folder structure, so it actually gets carried to your other devices.
4. Do the same on your other device(s), pointing at the same synced folder.
5. Hit **Sync Now**, or turn on **Automatically** if you want it to happen on its own every few minutes and whenever you switch back to the tab.

That's it. No accounts, no passwords, no API keys, nothing to configure on the cloud provider's side beyond "make sure this folder syncs."

## Pointers for the actual cloud providers

I'm not going to write a full manual for software I didn't build, but here's the gist for each:

- **Microsoft OneDrive** — install the OneDrive desktop app (it usually comes bundled with Windows already) and sign in. It creates a "OneDrive" folder on your machine that mirrors what's online. Make a subfolder in there — e.g. `OneDrive/BallisticsSync` — and point the app at that.
- **Google Drive** — install "Google Drive for desktop." It gives you a "Google Drive" folder (or lets you pick "Mirror files," which behaves the most like a normal folder). Make a subfolder inside it and use that.
- **NextCloud** — install the NextCloud desktop sync client, point it at your NextCloud server, and it gives you a local folder that mirrors your account. Same deal: make a subfolder, sync to it.
- **Dropbox** — install the Dropbox desktop app; it creates a "Dropbox" folder that syncs automatically. Same pattern, make a subfolder for this.
- **Yandex Disk** — for those of you living beyond the political consensus wall: install the Yandex.Disk desktop app and sign in; it creates a "YandexDisk" folder that mirrors your account the same way the others do. Make a subfolder in there and point the app at that.
- **iCloud Drive** — on a Mac, it's built in (Finder → iCloud Drive); on Windows, install "iCloud for Windows" from Microsoft's own store, which gives you an iCloud Drive folder. Fine to use, with one asterisk: iCloud Drive on an actual iPhone/iPad is where things get annoying — see the next section.

Any of these works. The app genuinely does not care which one you pick, or even if you mix them — e.g. a laptop syncing via OneDrive and a desktop syncing the exact same physical folder via a NAS-based tool would still work, as long as both ends see the same files eventually. All that matters is that the same file that lands in the folder on Device A eventually shows up, byte-for-byte, in that folder on Device B.

## The part where I have to be honest about Chrome

Here's the limitation I can't engineer my way around, and I want to be upfront about it instead of letting you discover it the hard way.

The only reasonably automatic way for a website to remember "yes, keep using *that* folder the user picked, without asking again every single time" exists, today, only in **Chromium-based browsers** — Google Chrome, Microsoft Edge, Ungoogled Chromium, Brave, and friends. That's it. Firefox doesn't have it (and for what it's worth, I genuinely wish it did — this isn't a dig at Firefox, I'd love for this to be universal). Safari on a Mac doesn't have it either.

And Safari on an iPhone or iPad isn't even really "Safari" in the sense that matters here — on iOS, **every browser is Safari underneath**, Chrome included, because Apple's App Store rules forbid any browser from shipping its own engine on iOS. So "I'll just use Chrome on my iPhone" doesn't save you: Apple has decided, on your behalf, that you don't get to use the actual Chrome engine on your own phone, only a Safari-flavored reskin wearing a Chrome icon. This is not a technical limitation of phones, or an oversight — it's a deliberate corporate policy to keep you inside the platform they control, dressed up as a "security" and "consistency" argument that conveniently also locks out anyone else's competing tech. Genuinely one of the more annoying examples of a big company treating "industry standard" as something to route around rather than support.

Practical consequence: automatic, invisible, "it just works in the background" syncing belongs only to **Chrome-family browsers** — on Windows, Mac, or Linux desktop, or on Android. It's the browser that matters, not the operating system: Chrome or Edge running on a Mac gets it, Safari running on that exact same Mac doesn't. Everywhere else — Firefox anywhere, Safari on a Mac, and anything at all on an iPhone or iPad — sync is **manual**: you press a button, it hands you a file to save (or a document-picker/share-sheet dance on iOS), and you do that on every device, every time you want to sync. It works. It's just a few extra taps instead of invisible.

## Why mixing in non-Chrome devices actually costs you something

This isn't just "less convenient," it has real weight to it, and it's worth understanding before you build a five-device mesh with an iPad, a work laptop on Firefox, and two Chrome desktops.

**Every device publishes its full library, every time.** The backup file each device writes isn't a diff — it's a complete copy of everything: every bullet, every rifle, every location, every rifle-precision project. Add a device to the mesh, and you add one more complete copy of your whole library sitting in that shared folder. With two or three devices that's a rounding error. It's still worth knowing it doesn't magically shrink as you add more devices — it grows with every one you add.

**Photos are the expensive part, and non-Chrome devices can't take the shortcut.** Chrome-family devices with real folder access are smart about photos (targets, location shots): they write the actual photo bytes once and every other Chrome-family device just points at that same file instead of re-copying it every sync. A device that only has manual, folder-less access — meaning any iPhone/iPad, and possibly a desktop Firefox/Safari setup too — **cannot** do that trick. It doesn't have the kind of folder access needed to split photos out into their own files (or, on an iPhone, even read them that way), so it writes everything — photos included — into one big bundle instead. Unpacking a bundle like that takes real work compared to the quick summary Chrome writes, and the device — especially a phone — can visibly hang for a second or two while that happens. So the moment even one such device is in the mix, there's a setting — **iPhone manual sync support**, off by default, and its own description tells you exactly what it costs: *"makes it compatible with iPhones, but makes it heavy and inefficient for everybody else."* Turn it on, and suddenly **every** device in the mesh — including your nice fast all-Chrome desktops — starts embedding full photo data in every single backup file, every single sync, instead of the efficient shared-file trick. One iPhone in the mesh taxes every other device in it, permanently, until you take the iPhone back out.

**Bottom line:** the more non-Chrome devices you add, the bigger every sync gets, the slower merging gets, and the more data churns through your cloud provider's upload/download quota. None of this is a bug — it's the honest cost of "no folder access" workarounds, and I'd rather tell you the actual trade-off than pretend it's free.

## My recommendation

- **Use a Chrome-family browser on every device you possibly can** — Chrome, Edge, whatever (if you get to pick, Ungoogled Chromium won't let you down). Desktop and Android both get the real, efficient, fully automatic experience. This is genuinely the good path and most people should just take it.
- **If you have an iPhone or iPad in the mix, it has to go manual, and there's no way around that** — that one's on Apple, not on me. Keep expectations low: a button press, a share sheet, done. It works, it's just not invisible.
- **Turn on "Automatically" sync mode only if every device in your mesh is Chrome-family.** The moment even one device is Firefox, Safari, or iOS, switch everyone to **manual** sync. Automatic mode was built for the all-Chrome case.
- If a mixed mesh is genuinely your situation — a laptop, a phone, an iPad — that's fine, the feature is built to handle it, just go in with eyes open: manual mode everywhere, and turn on "iPhone manual sync support" only if you actually need the iPad/iPhone to see photos too, since otherwise it'll pay a tax for a feature you're not using.

## A couple of safety nets, briefly

- **Review.** If two devices genuinely edit the same thing at the same moment in a way the app can't confidently resolve on its own, it doesn't guess — it flags it under **Review…** in the same Settings section, shows you both versions, and lets you pick.
- **Change History / Recently deleted.** Every edit and deletion — yours or merged in from another device — is kept around locally so you can revert it, whether or not you ever turn Backup & Sync on at all. If a sync ever does something you didn't want, this is your undo button.

And one last time: this is experimental. Keep making the odd manual export of your libraries as a plain old backup, sync feature or not. Trust, but verify — same as you should with any calculator telling you where your bullet is going to land.
