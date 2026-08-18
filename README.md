# Weir High Soccer — Program Ad Order Form

A self-contained website where parents, friends, and supporters design and order
congratulations ads for the Weir High Soccer program book (Boys' and Girls' teams).
Payment is collected off the site; an admin flags each ad as paid.

Everything runs from one Next.js process with a SQLite file and a folder of
uploads. No external services, no accounts to sign up for.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then edit SESSION_SECRET
npm run dev                    # http://localhost:3000
```

**The first account you create becomes the admin.** Sign up at `/signup`, and
you'll land in `/admin`. To promote or demote anyone later:

```bash
npm run seed:admin -- parent@example.com
npm run seed:admin -- parent@example.com --revoke
```

For production:

```bash
npm run build
npm start
```

### Environment

| Variable          | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `SESSION_SECRET`  | Signs the login cookie. **Required in production**, 32+ chars.             |
| `DATA_DIR`        | Where `program.sqlite` and `uploads/` live. Defaults to `./data`.          |
| `PRINT_BASE_URL`  | URL headless Chrome uses to reach this app. Defaults to `http://127.0.0.1:3000`. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Deploying: the two things that lose data

Both failure modes look identical from the outside — "all the accounts are
gone" — but only one of them actually loses anything.

**1. `DATA_DIR` must be an absolute path on storage that survives a redeploy.**
A relative path resolves against the *working directory*. If a systemd unit,
Docker `WORKDIR`, or Windows service starts the process somewhere else, the app
creates a brand-new empty database rather than finding the real one. It now says
so on startup:

```
[db] /srv/soccer/data/program.sqlite (37 accounts)          ← found it
[db] Created a NEW EMPTY database at /opt/app/data/...      ← wrong path
```

Check that line first whenever accounts appear to be missing.

**2. `SESSION_SECRET` must stay the same across restarts.** Login cookies are
JWTs signed with it, so a new secret rejects every existing cookie and signs
everyone out. Nothing is lost — accounts and ads live in the database — but
parents have to sign in again. Never generate it at boot.

Locally, `.env.local` holds both, and `npm run dev` and the VS Code debugger read
the same file. Don't set `SESSION_SECRET` in `launch.json`: env vars there win
over `.env.local`, so the two ways of starting the app would sign each other out.

### Backing up

Everything that matters is in `DATA_DIR` — the SQLite database and every uploaded
photo. Copy that **whole folder**.

Copying `program.sqlite` on its own is not enough. The database runs in WAL mode,
so recent writes live in the `program.sqlite-wal` file beside it until they are
checkpointed — a freshly-used database can be a 4 KB `.sqlite` and a 200 KB
`-wal`. Take the directory, or stop the app first, and the point is moot.

On the Azure VM, that folder is `/srv/soccer/data`, and a backup is one line:

```bash
ssh azureuser@<host> 'sudo tar czf - /srv/soccer/data' > soccer-$(date +%F).tar.gz
```

### Deploying to Azure

One Ubuntu VM running two containers — the app, and Caddy in front of it for
TLS. Push to `main` and `.github/workflows/deploy.yml` builds an image, pushes it
to GHCR, and tells the VM to pull and restart.

About **$12.91/month** at list price, all of it fixed:

| | |
| --- | --- |
| `Standard_B2ats_v2` (2 vCPU, 1 GiB) | $6.86 |
| 30 GB Standard SSD OS disk | $2.40 |
| Standard static public IPv4 | $3.65 |
| Egress | first 100 GB/month free — this site will never approach it |

**Sizing is not a free choice, and the pricing pages will mislead you.** A
subscription created recently cannot use the v1 B-series at all — `B1s`, the one
the Azure free tier advertises, reports `NotAvailableForSubscription` in every US
region. The v2 burstable families *are* available, but ship with a quota of
**zero**, so a deployment fails preflight with `SkuNotAvailable` until you ask for
some. The request is free, takes a minute, and `provision.sh` documents the exact
call. Check both before assuming a size will work:

```bash
az vm list-skus --location <region> --size Standard_B2ats_v2 --all   # available?
az vm list-usage --location <region> -o table | grep Basv2           # quota?
```

Two other defaults are worth overriding, and the script already does: Azure gives
a VM a **Premium** OS disk ($5.28/month) unless told otherwise, and East US had
no B-series capacity for this subscription at all — hence North Central US, the
nearest region that would take one.

**Why a VM and not App Service or Container Apps.** Both of those give you
persistent storage as an Azure Files (SMB) mount, and SQLite in WAL mode on a
network share is how databases get corrupted. This app also drives headless
Chrome for the 300 DPI render, which wants a real container and ~1 GB of memory.
A plain VM with an ext4 disk is the only shape where every assumption the code
already makes is true. Moving to a managed host means moving the database to
Postgres and the photos to Blob storage first — a bigger change than it sounds.

**Set it up once:**

```bash
az login                       # whichever subscription should be billed
az account set -s "<name or id>"
gh auth login                  # optional; lets the script set the secrets itself
./deploy/provision.sh
```

The script prints the subscription it is about to spend money in and waits for a
yes — `az login` remembers whichever one you used last, which is not always the
one you meant. It then checks the DNS label is free and that the region has
Standard BS Family quota before creating anything, so a wrong answer costs a
second rather than five minutes.

After that it creates the resource group, an Ubuntu 24.04 VM, opens 80 and 443,
generates a deploy key, writes `/srv/soccer/.env` with a fresh `SESSION_SECRET`, and sets
`AZURE_VM_HOST` / `AZURE_VM_USER` / `AZURE_VM_SSH_KEY` on the GitHub repo. Every
step is safe to re-run; the one thing it will not touch a second time is that
`.env`, because rewriting `SESSION_SECRET` signs every parent out.

Overrides, if the defaults do not suit:

```bash
DNS_LABEL=weir-high-soccer LOCATION=eastus2 VM_SIZE=Standard_B1ms ./deploy/provision.sh
```

Nothing deploys until the workflow file is on `main` — that push is what triggers
the first build.

**What the workflow does, and why in that order:**

- Builds the image on GitHub, never on the VM. `next build` typechecks, so a
  type error fails before anything is pushed, and the tag is pinned to the
  commit — rolling back is re-running an older green deploy.
- Copies `deploy/docker-compose.yml` and `deploy/Caddyfile` up each time, so the
  server's configuration is whatever is in this repo rather than whatever
  someone once edited over SSH.
- Signs the VM in to GHCR with the workflow's own short-lived token, over stdin,
  and signs it out afterwards. No registry password lives on the box.
- Waits for `/api/health` — which opens the database, not just the port — before
  reporting success, and prints the container's logs if it never answers.
- Runs one deploy at a time (`concurrency`), because the app container is
  stopped and replaced, and two of those overlapping would mean two writers on
  one SQLite file.

**Things worth knowing about the server:**

| | |
| --- | --- |
| Address | `https://<label>.<region>.cloudapp.azure.com` — Azure's free DNS name, which is enough for Caddy to get a real Let's Encrypt certificate without owning a domain |
| `DATA_DIR` | `/srv/soccer/data` on the host, `/data` in the container, owned by uid 1000 |
| Secrets | `/srv/soccer/.env` — `SESSION_SECRET`, `SITE_ADDRESS`, `APP_IMAGE` |
| Memory | 1 GB plus a 2 GB swapfile. Chrome is the only thing here that spikes. If the whole-program PDF ever dies mid-render, that is the ceiling: `az vm resize … --size Standard_B1ms` |
| Patching | Unattended security upgrades, rebooting at 4am when one needs it |
| Logs | `ssh azureuser@<host> 'cd /srv/soccer && docker compose logs -f app'` |

To point a real domain at it later, change `SITE_ADDRESS` in `/srv/soccer/.env`
to the new name, add the DNS record, and restart Caddy. It will fetch the new
certificate itself.

---

## What parents see

1. **Upload photos** to the library (`/photos`) — up to 100 per account.
2. **Pick a size** — Full, Half, or Quarter page (`/ads/new`).
3. **Design it** (`/ads/[id]/edit`) — five steps, in the order the decisions
   depend on each other:
   1. **Background** — 30-odd backgrounds in the Red Riders' red / black / white,
      including the photographic set. This sets the palette and the default type
      everything after it is previewed against.
   2. **Layout** — 8 full-page, 8 half-page, 4 quarter-page arrangements. The
      layout decides how many photos there are to place — including one-photo
      layouts at every size, for the family with a single good picture.
   3. **Photos** — choose from the library per slot, with a resolution check and a
      drag-to-nudge / zoom crop control.
   4. **Copy** — player name, message, and attribution, each with bold / italic /
      underline, plus the fonts and the name effect and its colour. The type sits
      with the words on purpose: a font is only worth judging against the name you
      actually typed, and by this step it is typed.
   5. **Preview** — the finished page, the blocking checklist, and **Submit**.

   Every chip in the stepper is clickable and every step saves on the way out, so
   the order is a path rather than a gate — a parent who came back to swap one
   photo is two taps from it.

   New ads start pre-filled with the sample text in `DEFAULT_AD_TEXT`
   (`src/lib/config.ts`) so the preview is a real, laid-out ad from the first
   second rather than an empty frame. Focusing a field that still holds its
   sample selects the whole thing, so typing replaces it.

   **`validateForSubmit` refuses to submit while the name or message is still the
   sample.** Pre-filled text passes an "is it empty?" check, so without that guard
   a distracted parent could pay for a printed page of Lorem ipsum. The default
   *from* line is deliberately not blocked — "- All of us at work" is a phrase a
   business or a group of coworkers might genuinely mean.

   The rules live in `src/lib/adChecks.ts` rather than `src/lib/ads.ts` because
   the Preview step runs them in the browser and the submit route runs them on
   the server. `ads.ts` is `server-only` and re-exports them; a second
   hand-written copy in the editor would drift the day either one changed.
4. **Submit** — from the Preview step, or from `/ads/[id]`. The ad becomes
   **Payment Due**.
5. **Pay the boosters** off-site. When an admin records it, the status flips to **Paid**
   and the ad locks.

An account can hold as many ads as they like; `/dashboard` lists them all with status
and an amount-due total.

**A parent can delete their own ad only while it is a draft** — from the dashboard
card or the bottom of `/ads/[id]`, behind an inline confirm. A draft is private,
unfinished work that nobody else is counting on. From **Payment Due** onwards it is
not: the boosters are owed the money and `printableAds` is already laying it into
the book, and a **Cancelled** ad is the record that an order existed. So past that
line the parent asks and the boosters act — an admin can delete any ad from the
admin screen, which also offers *cancel* as the reversible alternative. Deleting an
ad leaves the photos in the parent's library; only the ad and its layout go.

### The photo library

Photos live on the account, not on an ad (`/photos`, capped by
`MAX_LIBRARY_PHOTOS` in `src/lib/config.ts`). A parent uploads once — drag a whole
folder in if they like — and then places the same picture into as many ads as
they want. Ordering three ads for three siblings no longer means uploading the
same team photo three times.

**Every library starts with one photo: the media-day placeholder.** Media day is
usually after the ad deadline, so a parent often wants to build the page before
the picture they actually want exists. A grey portrait with a silhouette and the
words "Media Day Photo [Placeholder]" gives them something to lay out with that
is unmistakably a stand-in — to them while building, and to the boosters if one
ever reaches the printer.

The artwork is committed at `public/placeholder/media-day-photo.png` and redrawn
by `scripts/make-placeholder.mjs`; nothing renders it at runtime. It is 2400×3200
so it grades "sharp" in every slot, and the figure and words sit tight and
central because a landscape slot crops a 3:4 portrait to its middle 40% — the
first version lost the word "[Placeholder]" off the bottom edge.

It is a real library photo, copied per account rather than shared: deleting a
photo unlinks its file, and one parent tidying up must not blank out everybody
else's. New accounts get it at signup; existing ones on the first boot after it
shipped. `users.placeholder_seeded` records that it was given, so a parent who
deletes it does not find it back after the next deploy.

Two rules worth knowing:

- **A photo in use cannot be deleted.** `ad_photos.file_id` cascades on delete, so
  removing an in-use photo would tear it out of finished ads with no warning. The
  API refuses and names the ads to clear first.
- **Uploads past the cap are skipped, not fatal.** Dropping in 40 photos when 5
  slots remain adds 5 and reports the rest — losing 35 good uploads because the
  batch crossed a line would be a miserable way to discover the limit.

Uploading straight into a slot from inside the editor still works; the photo just
lands in the library on its way through.

### The photo resolution warning

Every photo slot has a known physical size, so the required pixel count is exact:

```
required px = (slot % of the page) x (page inches) x 300 DPI
```

Because photos are scaled to *cover* their slot, the check uses whichever axis has
to stretch further. Parents see one of three verdicts per photo — sharp (≥300 DPI),
a little small (200–299 DPI), or too small for print (<200 DPI) — with the exact
pixel size the slot wants. Low-resolution photos are flagged again on the review
page and in the admin list, but they never block an order.

The same check runs inside the library picker, so each photo is graded for the
slot being filled rather than in the abstract — an image that is plenty for a
quarter-page inset can be far too small for a full-bleed hero, and a single
library-wide verdict would mislead.

**Zoom is part of that sum.** At 2x, half as many source pixels cover the same
printed inch, so `photoQuality` divides the effective DPI by the zoom. A photo
that reads "Sharp — 448 DPI" untouched will say "Too small — 187 DPI at this
zoom" once cropped to 2.4x. Without that, a heavily cropped photo would keep
claiming to be fine right up until it came back blurry from the printer.

### Text size, and orphaned words

The **Text size** control in the Copy step nudges the message and the "from"
line between `MIN_TEXT_SCALE` and `MAX_TEXT_SCALE`.

It is a *request*, not an override. The fitter still refuses to overflow the
box, so asking for more than fits simply returns the largest size that does —
which is what keeps it inside the frame. The buttons run the real fitter at the
next step up and down, so a step the box would refuse is **disabled with an
explanation** rather than being a control that silently does nothing.

Ads also never end a paragraph on a lone word. `preventOrphans` ties the last
two words together with a non-breaking space at render time, so the stored text
keeps ordinary spaces and the editor's textarea behaves normally. This does not
change the line count — it pulls the previous word down rather than pushing
anything onto a new line — so the type size is unaffected.

The glue limit is a share of the line, not a fixed character count: 22
characters is comfortable on a full-page line and wider than a quarter-page one,
and an over-long unbreakable run would rather overflow its box than wrap.

`node scripts/text-fit.mjs` renders 135 combinations of size, font, message
length and text scale, then measures the rendered text against its box and
counts the words on the last line. It found a pre-existing overflow bug at
scale 1 that the estimate had been hiding.

### Positioning a photo in its slot

Drag the crop preview to nudge, or use the arrow keys; a slider zooms from 1x to
`MAX_PHOTO_ZOOM`. The preview is drawn at the slot's true aspect ratio using the
same `placePhoto` maths as the print renderer, so it is not an approximation of
the crop — it *is* the crop.

**The picture cannot be pushed out of frame.** That is a property of the model
rather than a rule enforced on top of it:

- Pan is stored as 0..1 of the *available overhang*, not as pixels. 0 pins one
  edge flush, 1 pins the opposite edge, and everything between redistributes the
  same overhang. There is no value that means "past the edge".
- Zoom is floored at 1, which is exactly the cover fit — so the drawn image is
  never smaller than its slot on either axis, and the overhang is never negative.

Both are clamped in the UI and again in `setPhotoTransform`, the last stop before
the print renderer. `scripts/smoke.mjs` renders eight extremes of pan and zoom at
300 DPI and counts background-coloured pixels inside the slot; the expected
answer is zero.

### Fonts

Two lists, because the jobs differ: `NAME_FONT_IDS` (23 faces, room for display
and stencil types a name can carry) and `MESSAGE_FONT_IDS` (6, all of which stay
readable at four-point type on a quarter page). A parent picks one for the
player's name and one for the message, or leaves either on *Match the
background* to use that background's pairing.

Every background defaults the name to a heavy sans face, since that is what a
name wants to be. Serif and script are still one click away for anyone who wants
them.

**The picker is one big sample over a row of name buttons**, not a grid of live
samples. Twenty-three faces of the same three words is accurate and unreadable;
the only sample that matters is the one being considered, and it is one tap
away. A dot marks the face the current background pairs with, which is how
*Match the background* stays reachable without being its own button — listing it
separately would render the same typeface twice, and read as a bug.

Weights come from real variable-font instances, not browser-synthesised fake
bold: the fonts are fetched as weight *ranges* (`wght@400..900`), so a Montserrat
name renders at a genuine 900. `AdFont.headingWeight` records the heaviest real
weight per family.

### The player's name

The name is the thing people scan the program for, so it is set much larger than
the body — a full-page name starts at 66px, which prints at roughly 50pt at
300 DPI — in the family's heaviest weight.

Long names wrap to a second line rather than being forced onto one and shrunk
past legibility. `fitHeading` takes the largest size that fits within two lines
and the box height; the name boxes in `src/lib/layouts.ts` are sized to give
those a home, so shrinking one silently caps the name.

### Name effects

Seven options, applied to the name only — messages stay clean and readable:
none, soft shadow, hard shadow, glow, outline, thick outline (twice the
radius), and outline + glow. Each carries a colour, which defaults to Automatic
(see below).

The picker has the same shape as the font one — a single sample of the name as
it will print, on the real background, over plain effect and colour buttons. The
sample has to sit on the background because that is where the effect takes its
colours from; on a neutral card it would be a lie.

Each is expressed as a multiple of the font size, so it looks the same on a
quarter page as on a full page and survives the preview → 300 DPI scale-up.
Outlines are built from stacked `text-shadow`s rather than
`-webkit-text-stroke`, which is painted centred over the glyph and eats into the
letterforms.

Effect colours contrast with the *lettering* rather than with the page. Picking
by background is the obvious-looking mistake and produces a dark ring on a dark
page and a white ring on a white one — both invisible.

On the dark backgrounds, where the lettering is white, that splits in two:

- **Outlines are red.** Ink is the safe contrast against white, but it is also
  the page's own colour, so the ring vanishes into it. Red reads against both.
  A pale accent — the pinks two of the photographic backgrounds carry — falls
  back to the same red, for the same reason white would not do.
- **Shadows and glows are black.** A shadow should read as depth, not as a
  second colour, and on the photographic backgrounds it is what stops white type
  from dissolving into a bright patch of turf.

Dark lettering on a light page is the mirror image and needs neither rule: the
accent reads against it, and ink covers the backgrounds whose accent *is* their
lettering colour.

All of that is the **Automatic** setting, and it is the default. A parent who
wants something else picks from `NAME_EFFECT_COLORS` — red, deep red, black,
white, cream — stored on the ad as `name_effect_color` (`''` is Automatic). It is
the program's own palette rather than a free colour wheel on purpose: these ads
print side by side in one book, so a hand-mixed lime green would be somebody
else's page as much as their own.

The picked colour replaces the one colour the effect would have derived — the
shadow, the halo, or the ring. Outline + Glow is the exception worth knowing:
the colour goes on the ring and the glow beyond it stays dark either way,
because that glow is depth around the ring rather than a second colour competing
with it. The colour follows you from one effect to the next; Automatic is always
one tap away.

**The font files are self-hosted in `public/fonts/`, and that is not incidental.**
The preview runs in the parent's browser; the 300 DPI render runs in headless
Chrome on the server. A family that happens to be installed on one machine and
not the other would produce a print file that silently differs from the ad the
parent approved. Serving the same woff2 files to both closes that gap — and means
the app needs no network at runtime.

To change the font list, edit `FAMILIES` in `scripts/fetch-fonts.mjs` and `FONTS`
in `src/lib/fonts.ts`, then:

```bash
node scripts/fetch-fonts.mjs     # downloads woff2 + regenerates src/app/fonts.css
node scripts/measure-fonts.mjs   # prints the avgGlyph / boldRatio constants
```

Paste the measured numbers into `src/lib/fonts.ts`. They matter: see *type
fitting* below. Both generated outputs are committed, so a normal build never
touches the network.

### Bold, italic, and underline

Selecting text and pressing **B** / *I* / <u>U</u> (or Ctrl+B / Ctrl+I / Ctrl+U)
wraps it in a small inline markup stored in the same plain TEXT column:

```
**bold**      *italic*      __underline__
```

Parents never type this — the toolbar does it, and the live preview shows the
result immediately. Keeping it as markup in a plain string rather than HTML means
there is nothing to sanitise: `src/lib/richtext.ts` parses it into runs and
`RichText.tsx` renders styled spans, so a message can never inject markup into
the page or the print file. Unmatched markers stay literal, so plain-text ads are
unaffected.

Character limits count *visible* characters (`TEXT_LIMITS` in `src/lib/config.ts`);
the markers are stored on top of that budget (`STORAGE_LIMITS`), so formatting
never costs a parent part of their message.

---

## What the admin sees

Three sections behind the one password, with the section nav in
`src/app/(site)/admin/layout.tsx`:

| Section | What it is for |
| --- | --- |
| **Dashboard** (`/admin`) | Every ad: thumbnail, who ordered it, contact details, low-resolution flags, a note field for tracking payments, and totals for money due, money collected, and how long the book runs |
| **Users** (`/admin/users`) | Every account, when they joined, when they last got in, how many ads and photos they have — and a password reset |
| **Audit** (`/admin/audit`) | Who signed in, who tried and failed, and from where |

The gate lives in the layout, but **each page checks `is_admin` again for
itself**. A layout that declines to render its children does not stop those
children being *executed*, and these pages read the whole database.

### Resetting a parent's password

There is no email on this site to send a reset link through, so the admin issues
a new password and reads it down the phone: `RTFM-7K2P-WXQ9`, from an alphabet
with no I, O, 0 or 1 in it. It is shown once, in the row, and never stored in
readable form — lose it and issue another.

Two things worth knowing:

- **A reset does not sign the parent out** of a browser they are already signed
  in on. Sessions are signed JWTs and this app keeps no revocation list, so the
  old cookie works until it expires. It does stop anyone who only knew the old
  password.
- **The `admin` row cannot be reset here**, and it is the only one that cannot.
  That row is a stub whose stored password is deliberately unusable; the screen
  is reached with `ADMIN_PASSWORD` from the environment, and giving the stub a
  working password would quietly open a second way in through the parents' login
  form. Note this is narrower than `is_admin` — the first parent to sign up is
  made an admin too, and that is a real person with a real password.

### The audit log

`login_events` records sign-ins, failed attempts, new accounts, admin sign-ins
(successful and not), and password resets — with the address from
`X-Forwarded-For`, since everything arrives through Caddy and the socket address
is always the proxy.

Rows survive the account they are about: `user_id` goes null on delete and the
email stays, because an audit trail that disappears along with the account is
not an audit trail. Writing an event can never fail a sign-in — `record()`
swallows its own errors, since a parent locked out by an unhappy audit table
would be a far worse outage than a gap in the log.

Signing out is not recorded. The question that actually comes up is "did they
ever get in", and that is what this answers.

### Print files

| Download                   | What you get                                                     |
| -------------------------- | ---------------------------------------------------------------- |
| **Print PNG** (per ad)     | The ad alone at 300 DPI — 2550×3300 full, 2550×1650 half, 1275×1650 quarter. |
| **Program PDF**            | The assembled book, 8.5×11 pages, backgrounds printed.           |
| **Program page PNG**       | Any single assembled sheet at 300 DPI (2550×3300).               |

Each is available for everything in the book, or for paid ads only.

### Imposition

A sheet holds two half-page bands; each band takes one half-page ad or two
quarters side by side. Full pages get a sheet to themselves. Beyond fitting,
`src/lib/impose.ts` tries to make the book look composed rather than sorted:

- **Halves are paired with quarters first.** Draining the halves before touching
  the quarters — the obvious order — leaves every remaining quarter to be tiled
  four to a sheet, which reads as a grid of small boxes. Mixing them keeps
  four-up sheets down to whatever the ad mix genuinely forces, and the admin
  page says how many are left and why.
- **Lookalikes are kept apart.** Each slot takes the least-similar ad still
  waiting, scoring a shared background hardest, then a shared layout, then a
  shared colour family (`tone` on each background). A greedy pass alone is
  short-sighted — the first ad on a sheet is chosen before anything is known
  about what will join it — so a second pass swaps same-size ads between sheets
  wherever that strictly improves things.

Some repeats are unavoidable: five quarters sharing a layout cannot be spread
across four quarter-bearing sheets however they are arranged. The smoke test
asserts against that pigeonhole floor rather than against zero, so it fails on
a real regression instead of on arithmetic.

**The result is deterministic** — same ads in, same sheets out. That matters
more than it looks: the assembled PDF and the per-sheet PNG downloads impose
independently, so anything order-dependent would make "page 3" mean two
different things.

---

## How the print pipeline works

The thing that usually breaks a project like this is the preview not matching the
print. Here it can't, because they are the same DOM:

- `src/components/AdCanvas.tsx` draws an ad at its true trim size in CSS pixels
  (1in = 96px, so a full page is exactly 816×1056) and then applies a CSS
  `transform: scale()`. The preview is that drawing zoomed out.
- `/print/ad/[id]` and `/print/program` render the same component with no nav or
  margins.
- `src/lib/render.ts` points headless Chrome at those routes with
  `deviceScaleFactor: 3.125` (300 ÷ 96). 816 × 3.125 = 2550. The screenshot *is*
  the print file.

Two consequences worth knowing:

- **Backgrounds are pure CSS** (gradients and inline SVG data URIs) — no image
  assets to load, so nothing can render differently or half-load during a screenshot.
- **Fonts are self-hosted** and declared `font-display: block`, so a screenshot can
  never catch a fallback face mid-swap.
- **Type fitting never measures text.** `src/lib/fit.ts` estimates line counts from
  character counts, so the same message always produces the same font size in the
  browser and in Chrome. Short messages grow into their box (up to 1.35× base),
  long ones shrink (down to 0.5×).

  The line estimate subtracts one average word from each line's character
  capacity. Text wraps at spaces, so a line stops as soon as the next word will
  not fit; dividing by the raw character limit under-counts lines, and a long
  message could be sized to "fit" and then spill out of its box. One average
  word is what matched real rendered line counts — half a word was measurably
  too optimistic on narrow columns.

  This is also why the constants in `src/lib/fonts.ts` have to be measured rather
  than guessed — Bebas Neue fits roughly 47% more characters per line than Montserrat,
  and a wrong constant means text that overflows its box or floats in the middle
  of it. `boldRatio` does the same job for heavily bolded copy, and `headingGlyph`
  for names, which are drawn at the family's heavy weight and run materially
  wider than its 400 (Montserrat gains 11% from 400 to 900).

Uploads are normalised on arrival (`src/lib/files.ts`): EXIF rotation is baked in,
anything over 4500px is downscaled, and dimensions are recorded so the resolution
check is honest.

---

## Changing things

Almost everything the boosters will want to edit is in **`src/lib/config.ts`** —
prices, the deadline, contact details, payment instructions, team names, character
limits.

| To change...             | Edit                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| Prices, deadline, copy   | `src/lib/config.ts`                                                     |
| Sample text on a new ad  | `DEFAULT_AD_TEXT` in `src/lib/config.ts`                                |
| Text size range          | `MIN_TEXT_SCALE` / `MAX_TEXT_SCALE` in `src/lib/config.ts`              |
| Photo library size       | `MAX_LIBRARY_PHOTOS` in `src/lib/config.ts`                             |
| Backgrounds              | `src/lib/backgrounds.ts` — add an object to `BACKGROUNDS`               |
| Fonts                    | `scripts/fetch-fonts.mjs` + `src/lib/fonts.ts`, then re-run both scripts |
| Name effects             | `src/lib/effects.ts`                                                    |
| Type sizes               | `TYPE_BASE` in `src/lib/layouts.ts`                                     |
| Layouts                  | `src/lib/layouts.ts` — boxes are percentages of the trim size           |
| Formatting marks         | `src/lib/richtext.ts`                                                   |
| How pages are assembled  | `src/lib/impose.ts`                                                     |
| Site styling             | `src/app/globals.css`                                                   |

### Prices, after ads already exist

An ad records the price it was created at, so editing `AD_SIZES` only affects ads
made from then on — the ones already in the database keep the old price, which is
what you want when a parent has been quoted a figure and what you do *not* want
when you are correcting the price list before anyone has paid.

To move the existing ones onto the new prices, **on the server**, inside the
container that already has the database mounted and `DATA_DIR` set:

```bash
cd /srv/soccer
docker compose exec app node scripts/reprice-ads.mjs            # show the change, write nothing
docker compose exec app node scripts/reprice-ads.mjs --apply    # do it
```

`exec`, not `run` — it reuses the running container rather than starting a second
one against the same SQLite file.

Locally, where the checkout is the working directory:

```bash
npm run reprice
npm run reprice -- --apply
```

Ads already marked **Paid** are left alone — their price records what somebody
actually handed over, not what they would be quoted today. Pass `--include-paid`
to move those as well. There is no undo, so take a copy of `/srv/soccer/data`
first — see [Backing up](#backing-up) for why copying the `.sqlite` file alone is
not enough.

The script moves ads *onto* the list price, and cannot tell an ad the price
change left behind from one somebody set deliberately — a comped sponsor reads
as "not the list price" just like the rest. Anything off-list appears in the
preview, so read it before applying.

For a single ad — comping a sponsor, honouring a discount, fixing one figure —
use the price beside each ad in the admin screen instead. No server access, it
works on paid ads too, and ads priced away from the list show a small `list $50`
underneath so an intentional exception is visible at a glance.

Deploy the price change *before* running this: the two want to agree, and the
script reads its prices from the same `config.ts` the running site does.

A new layout is just geometry — photo slots plus three text boxes, all in percent:

```ts
{
  id: 'q-my-layout',
  size: 'quarter',
  name: 'My Layout',
  description: 'Shown to parents in the picker.',
  photos: [{ x: 8, y: 7, w: 84, h: 44 }],
  playerName: { x: 6, y: 54, w: 88, h: 8 },
  message:    { x: 9, y: 63.5, w: 82, h: 22 },
  attribution:{ x: 9, y: 86, w: 82, h: 7 },
  align: 'center',
}
```

The preview, the resolution warnings, and the print renderer all pick it up with
no other changes.

---

## Scripts

```bash
npm run dev                    # development server
npm run build && npm start     # production
npm run seed:admin -- <email>  # grant admin ([--revoke] to remove)

# Fonts — only when changing the font list. Output is committed.
node scripts/fetch-fonts.mjs                            # download woff2 + write fonts.css
node scripts/measure-fonts.mjs                          # print avgGlyph / boldRatio

# With the server running:
node scripts/smoke.mjs                                  # end-to-end check (68 assertions)
node scripts/name-fit.mjs <admin-email> <password>      # 2,300 layout x font x name combinations
node scripts/text-fit.mjs <admin-email> <password>      # 135 message fit + orphan combinations
node scripts/contact-sheet.mjs <admin-email> <password> # tile every layout, background, font, effect
```

`scripts/name-fit.mjs` guards the one failure mode that would ruin a printed ad:
a name too big for its box. It renders a brutal 33-character name against every
layout and font and measures the name element against the trim edge in the
browser. Run it after touching `TYPE_BASE`, a name box, or the font list.

`scripts/smoke.mjs` creates throwaway accounts and ads against a running server,
then verifies auth boundaries, the locking rules, that the rendered PNGs come out
at exactly 2550×3300, and that the print render honours the chosen font and
formatting rather than falling back. It writes test data — point it at a scratch
`DATA_DIR`, not the live one.

---

## Notes and limitations

- Ads are editable right up until they are marked paid; after that only an admin
  can change them (undo Paid, edit, re-mark).
- Uploaded photos are served through an authenticated route — only the owner and
  admins can fetch them.
- There is no email sending. Parents check status by signing in; the admin has
  every ordering parent's email and phone in the admin table.
- The PDF renders every ad in one Chrome pass. A few hundred ads is fine; if the
  book ever gets big enough to time out, download sheets individually instead.
