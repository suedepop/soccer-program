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

---

## What parents see

1. **Upload photos** to the library (`/photos`) — up to 100 per account.
2. **Pick a size** — Full, Half, or Quarter page (`/ads/new`).
3. **Design it** (`/ads/[id]/edit`) — a live preview beside four tabs:
   - **Layout** — 7 full-page, 6 half-page, 4 quarter-page arrangements.
   - **Style** — 12 backgrounds in the Red Riders' red / black / white, a font for
     the player's name and one for the message, and an effect for the name
     (shadow, glow, outline).
   - **Photos** — choose from the library per slot, with a resolution check and a
     9-point crop control.
   - **Wording** — player name, message, and attribution, each with bold / italic /
     underline. Everything autosaves.
4. **Preview and submit** (`/ads/[id]`) — the ad becomes **Payment Due**.
5. **Pay the boosters** off-site. When an admin records it, the status flips to **Paid**
   and the ad locks.

An account can hold as many ads as they like; `/dashboard` lists them all with status
and an amount-due total.

### The photo library

Photos live on the account, not on an ad (`/photos`, capped by
`MAX_LIBRARY_PHOTOS` in `src/lib/config.ts`). A parent uploads once — drag a whole
folder in if they like — and then places the same picture into as many ads as
they want. Ordering three ads for three siblings no longer means uploading the
same team photo three times.

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

### Fonts

Nine families, each chosen for a different job — Montserrat, Oswald, Anton,
Bebas Neue, Nunito, Playfair, Lora, Dancing Script, and a typewriter face. A
parent picks one for the player's name and one for the message, or leaves either
on *Match the background* to use that background's pairing.

Every background defaults the name to a heavy sans face, since that is what a
name wants to be. Serif and script are still one click away for anyone who wants
them.

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

Six options, applied to the name only — messages stay clean and readable: none,
soft shadow, hard shadow, glow, outline, and outline + glow.

Each is expressed as a multiple of the font size, so it looks the same on a
quarter page as on a full page and survives the preview → 300 DPI scale-up.
Outlines are built from stacked `text-shadow`s rather than
`-webkit-text-stroke`, which is painted centred over the glyph and eats into the
letterforms.

Effect colours come from the chosen background, and specifically contrast with
the *lettering* rather than the page. Picking by background is the
obvious-looking mistake and produces a dark ring on a dark page and a white ring
on a white one — both invisible.

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

`/admin` (admins only) lists every ad with a thumbnail, who ordered it, contact
details, low-resolution flags, and a free-text note field for tracking payments.
Totals across the top show money due, money collected, and how many printed pages
the book currently runs to.

### Print files

| Download                   | What you get                                                     |
| -------------------------- | ---------------------------------------------------------------- |
| **Print PNG** (per ad)     | The ad alone at 300 DPI — 2550×3300 full, 2550×1650 half, 1275×1650 quarter. |
| **Program PDF**            | The assembled book, 8.5×11 pages, backgrounds printed.           |
| **Program page PNG**       | Any single assembled sheet at 300 DPI (2550×3300).               |

Each is available for everything in the book, or for paid ads only.

Pages are imposed automatically: full-page ads get their own sheet, half pages
pair up, and quarter pages go four to a sheet (two per half-slot).

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

  This is why the constants in `src/lib/fonts.ts` have to be measured rather than
  guessed — Bebas Neue fits roughly 47% more characters per line than Montserrat,
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
| Photo library size       | `MAX_LIBRARY_PHOTOS` in `src/lib/config.ts`                             |
| Backgrounds              | `src/lib/backgrounds.ts` — add an object to `BACKGROUNDS`               |
| Fonts                    | `scripts/fetch-fonts.mjs` + `src/lib/fonts.ts`, then re-run both scripts |
| Name effects             | `src/lib/effects.ts`                                                    |
| Type sizes               | `TYPE_BASE` in `src/lib/layouts.ts`                                     |
| Layouts                  | `src/lib/layouts.ts` — boxes are percentages of the trim size           |
| Formatting marks         | `src/lib/richtext.ts`                                                   |
| How pages are assembled  | `src/lib/impose.ts`                                                     |
| Site styling             | `src/app/globals.css`                                                   |

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
node scripts/smoke.mjs                                  # end-to-end check (46 assertions)
node scripts/name-fit.mjs <admin-email> <password>      # 459 layout x font x name combinations
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
