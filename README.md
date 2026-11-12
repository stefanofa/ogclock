# ogclock

A link whose preview shows the moment it was sent. Paste `ogclock.app/<token>` anywhere and the
image says something true about that minute: "60.6% of Wednesday is already gone."

Product decisions and platform research live in [ARCHITECTURE.md](ARCHITECTURE.md). This file is
the map of the code.

## Commands

```sh
pnpm dev                    # Worker on http://localhost:5173 (cf dev, real workerd runtime)
pnpm check                  # typecheck (Worker, Node, browser), lint, test
pnpm render                 # every theme at the canonical moment → out/*.png
pnpm render texting 2026-11-12T03:12 [Asia/Tokyo]   # one theme, any local time and zone
pnpm gen:card               # prebuild the brand card PNG the Worker serves
pnpm gen:fonts              # download the font catalog as TTF
pnpm gen:zones              # refresh the timezone table from the pinned tzdb release (append-only)
pnpm gen:web-fonts          # download the page's Latin WOFF2 subsets
pnpm gen:land               # Natural Earth land outline for the asleep map
pnpm gen:metrics            # glyph widths so fitSize can size lines before layout
pnpm deploy                 # cf deploy
```

## Layout

Each layer depends only on the ones above it: the Worker on the page and the images, both
of those on core.

```
src/core/      Pure domain. No IO, runs in Workers, browsers and Node.
  moment.ts      Moment: one minute as lived in a zone. Everything renders from this.
  zone.ts        Zones and their stable wire codes (zones.gen.ts is generated).
  calendar.ts    Names, day of year, "14:32".
  progress.ts    Day and year progress, and honest percentages.
  week.ts        Where a moment sits in the week (a discriminated union).
  hours.ts       Stretches of local time, "22:00-02:00" on Fridays, and `during` to test them.
  duration.ts    Spans in days, hours and minutes: "2 days, 9 hours, 28 minutes", "50 days".
  sun.ts         Sunrise, sunset, solar altitude, the sun's phase and subsolar point.
  terminator.ts  Lines of equal solar elevation: the night's edge and its twilights.
  population.ts  People per timezone, and how many are in their night at an instant.
  places.ts      Recognisable places by zone, for every UTC offset in use.
  codec.ts       Composable bit codecs → short Crockford base32 tokens.
  tokens.ts      The two public identifiers: share links and image frames.

src/og/        Images.
  theme.ts       The Theme contract.
  themes/        One file per theme, plus the registry (index.ts). sunset/light.ts holds
                 the sunset's palettes.
  director.ts    Auto mode: which theme has the strongest line for this minute.
  render.ts      Scene → PNG. Satori lays out, resvg rasterises. Runtime-agnostic.
  engine.node.ts The renderer's wasm and fonts read from disk, for scripts and tests.
  fonts.ts       The font catalog, and fontsOf: the faces a render sets text in. fonts/*.bin
                 are the TTFs it names.
  ui.tsx         Shared pieces: Canvas, Band, Mark.
  color.ts       OKLab mixing and gradients as data, for themes that blend palettes.
  metrics.ts     Text width before layout, to fit a line (metrics.gen.ts is generated).
  measure.node.ts How wide Satori sets text, which metrics.gen.ts is made from and tested against.
  world.ts       The world map's projection (land.gen.ts is the coastline in it).
  random.ts      A seeded random stream, for texture that stays the same per minute.
  card.tsx       The timeless brand card for the bare domain. card.png.bin is its prebuilt PNG,
                 which the Worker also serves when a render fails.

src/web/       The page. Pure modules here run in the Worker and the browser alike.
  protocol.ts    The JSON the page receives: boot payload and /api/now. The Worker produces it.
  state.ts       State, Actions and the reducer. No clock, network or DOM.
  slots.ts       State → named strings, and the data-* directives that place them. The Worker
                 and the browser each adapt their elements to it and paint from it.
  link.ts        Mints share links in the browser from core's codec.
  dom/           Browser only: main.ts wires events and the store's effects, view.ts patches
                 slots and runs the motion, effects.ts owns the store, clipboard, share,
                 history, timers, fetch, sheet.ts drags the theme sheet.
  styles/        fonts, base (palette and shadows), page (desktop), phone. page.css names the
                 sizes phones change as custom properties; phone.css overrides them.
  fonts/         Self-hosted WOFF2 subsets (pnpm gen:web-fonts).

src/worker/    The Cloudflare Worker.
  app.ts         Routes, pages, /api/now and caching, against an injected Runtime.
  index.ts       Binds the Runtime: wasm modules, bundled fonts, Cache API, clock, assets.
  page.ts        One page's per-request parts: OG tags, theme tiles, boot JSON.
  shell.ts       Personalises Vite's built index.html with HTMLRewriter.
  html.ts        Escape-by-default HTML templating.

index.html     The page shell. Vite builds it into hashed assets; the Worker fills it.
```

The page is written once, as `index.html`. Elements name the state they show with
`data-text`, `data-attr` and `data-fade`. On each request the Worker reads the built shell
through the `ASSETS` binding and fills those slots, so first paint is the real page with the
real image. The browser then fills the same slots from the same `slots(state)` function as
the state changes. Both parse the directives with `bindings` in `slots.ts`, and a test fails
on any binding in the shell that `slots` does not fill. Nothing on the page is rendered twice
in two ways.

## Adding a theme

1. Create `src/og/themes/<id>.tsx` and export `{ code, id, name, line, render } satisfies Theme`.
   `code` is a wire code inside links: pick the next unused number, never change it, and add it
   to the code list in the "never renumbers a theme" test.
2. Compute everything from the `Moment`. Shared facts (progress, week, sun, durations) belong in
   `src/core`. Copy that varies by time is a rules table, not a chain of `if`s (see
   `texting.tsx`), and a stretch of local time is `hours("22:00-02:00", [5])` or
   `during(...)` from `src/core/hours.ts`.
3. Set text in faces from `src/og/fonts.ts`. A render loads the faces its text uses, and throws
   on one the catalog lacks. For a new face, add it there and run `pnpm gen:fonts` (it fetches
   only missing faces; `--all` refetches). Variable fonts pin an `opticalSize`. A line that must
   shrink to fit uses `fitSize`; add its face to `scripts/metrics.tsx` and run
   `pnpm gen:metrics`. `pnpm gen:land` regenerates the coastline.
4. Register it in `src/og/themes/index.ts`. The tests then render it and check its line for every
   7th minute of a week. For Auto to pick it, add a row to `DIRECTION` in `src/og/director.ts`:
   the first row that matches wins, and most rows are `during` windows.
5. `pnpm render <id> <local time>` to look at it.

Themes render with [Satori](https://github.com/vercel/satori): flexbox and absolute positioning,
linear and radial gradients, box and text shadows, 2D transforms, inline SVG. No grid, no CSS
filters, no blend modes. Satori places `bottom: 0` lower than browsers do, so pin absolute
elements with `top`. It sets mixed font sizes on a line by their tops, so baseline-align by hand
(see `sunset.tsx`). 2D gradients are the expensive pixels: resvg's PNG of a full-canvas radial
gradient costs about 75 KB, a vertical one about 1 KB.

## Decisions worth knowing

- **Satori is pinned to 0.32.0.** Later versions bundle HarfBuzz, whose loader reads
  `self.location` and fetches its wasm from a path. Workers have neither. 0.32 is the last release
  without it, and the version Cloudflare's own `@cf-wasm/satori` pins.
- **Images are a pure function of their URL.** An image token holds the theme, the minute and the
  zone, so the response is `immutable` and the Cache API is an optimisation, never a source of
  truth.
- **Three typecheck targets.** `tsconfig.json` sees Workers globals, `tsconfig.node.json` sees
  Node for scripts and tests, `tsconfig.web.json` sees the DOM for `src/web`. None leaks into
  another, so `src/web/dom` is the only code allowed to touch `document`. A source file that
  needs Node outside `scripts/` and tests is named `*.node.ts`.
