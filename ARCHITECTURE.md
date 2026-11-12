# ogclock architecture

A link whose preview shows the minute it was sent. Opening it lands on a page that lets you pick a theme and copy a fresh link.

This file explains the product decisions and the platform research behind them. [README.md](README.md) is the map of the code and the steps for adding a theme.

## Images are a pure function of their URL

The image URL carries every input the renderer reads: the theme, the minute and the zone. The renderer turns those into the same PNG bytes every time. Any cache in front of it is an optimization, never a source of truth, so the app stores nothing.

Two URLs, with opposite lifecycles:

| URL               | Names                      | Served by                                           | Cache-Control                         |
| ----------------- | -------------------------- | --------------------------------------------------- | ------------------------------------- |
| `/{share}`        | a clock                    | Worker, computed per request                        | `no-store`                            |
| `/og/{frame}.png` | one minute, theme and zone | Worker, rendered on first request, then edge cached | `public, max-age=31536000, immutable` |

The time lives in the image URL, not in the image handler. A platform that fetches the image again later (Discord's media proxy does) gets identical bytes, rendered fresh or from cache.

## Why render on demand

Render volume follows shares, not views. Platforms copy the image once into their own CDN (X, Slack, Discord, Facebook). iMessage and WhatsApp embed it in the message. A tweet seen by a million people costs one render.

The cost per render is small. Third-party measurements of Satori and resvg on Workers report 56 to 170 ms CPU warm, plus about 93 ms of wasm init per isolate. We have not measured our own themes on Workers yet. Crawler budgets are seconds: Discord allows 10 s. A million renders at 150 ms is 150 million CPU ms, about $3 at the Workers Paid rate of $0.02 per million CPU ms.

That buys themes that compute anything from the minute. `sunset` counts down to the sunset at the zone's coordinates, `asleep` counts the people in their night, and `year` reads the date. The image space is every theme times every minute times 419 zones, which no set of static files covers.

The rejected alternative pre-rendered every (theme, local minute) pair as static files. It has no cold render on the crawler path. It also rules out any theme that depends on the date or the zone, and every new theme multiplies the file count against the 20,000-file upload and 100,000-file asset limits.

## What "the time it was sent" means

The shown time is the minute the platform first fetched that exact URL, in the sender's zone. For chat apps this is paste time, a few seconds before Send. X and Telegram fetch while you compose, so a draft left open shows when it was pasted.

The page makes every copy a URL no platform has seen:

- On load, the address bar gets a token nobody has seen. The Worker mints one into `Boot.link`. If the browser's zone differs from the zone the edge saw, the browser mints one in its own zone. `history.replaceState` swaps it in.
- Copy and Share hand out the current link and mint the next one at once. The address bar never holds a link that was already handed out.
- Returning to a hidden tab (`visibilitychange`) mints again.
- The page marks each link it puts in the address bar through `history.state`. A reload or a restored tab then knows the link is its own, not one it received.

A received link pasted again without opening it shows the first sender's time on the same platform, inside that platform's cache window. On another platform, or after the window, it shows the current time in the original sender's zone. Forwarding a message natively keeps its original preview.

Rejected alternative. Freeze the time at Copy, sign it into the URL, store the PNG, and meter minting. Every link would have one fixed meaning. But a link copied from someone's tweet and sent to a friend would show the tweet's time, not now. That breaks the loop that makes this spread.

## Themes

A theme is one file that turns a `Moment` into an image and a line of text. The contract is in `src/og/theme.ts`:

```ts
export interface Theme {
	/** Stable wire code inside links. Never reuse or renumber. 0 is reserved for Auto. */
	readonly code: number;
	readonly id: string;
	readonly name: string;
	/** The image's line as plain text: og:title, alt text and the page caption. */
	readonly line: (m: Moment) => string;
	readonly render: (m: Moment) => JSXElement;
}
```

A `Moment` (`src/core/moment.ts`) is one minute as lived in one zone: `instant` (epoch milliseconds, floored to the minute), `zone` (with the tzdb coordinates the sun maths uses), `year`, `month`, `day`, `weekday`, `hour`, `minute` and `minuteOfDay`. Every theme reads the whole `Moment` and nothing else. Anything a theme needs beyond that, such as week progress or sunset times, is computed from it in `src/core`.

What follows from the contract:

- **Links share frames.** A frame token holds the theme code, the minute and the zone, and nothing about the link. Every link with the same theme, zone and minute points at one image, so the edge renders it once per data center.
- **Auto is not a theme.** A share token with theme 0 means "let the director choose". `resolveTheme` in `src/og/director.ts` turns it into a concrete theme before the Worker builds the frame URL, so Auto links share frames with links that chose the theme by hand. `DIRECTION` is an ordered table and the first matching row wins. Most rows are `during("17:00-18:00")` windows from `src/core/hours.ts`, which can run past midnight and be limited to weekdays. A share token whose theme code no longer exists falls back to Auto.
- **`line` is the text platforms print.** The Worker uses it as `og:title`, `twitter:title` and `og:image:alt`, and the page shows it as the caption. A test checks that every theme writes a line for every 7th minute of a week.
- **Fonts come from the element tree.** `fontsOf` in `src/og/fonts.ts` walks the tree as Satori does: it calls components and inherits family, weight and style. The renderer loads only the faces that walk finds. A face missing from the catalog throws, where Satori would quietly draw the nearest one it has.
- **The page never renders a theme.** Theme tiles and the stage show the real `/og/{frame}.png` images, which the Worker lists for this minute and the next. The browser bundle contains no theme code and no Satori, so the preview and the shared image cannot drift.

Theme wire codes are 1 to 8 today, and the token has 7 bits for them.

## URL scheme

Everything is in the path. Nothing reads the query string, so tracking parameters like `?utm_source=...` are ignored. A query only makes the URL new to platform caches, which is harmless.

Both tokens are fixed-width bit fields packed most significant first, then written in lowercase Crockford base32 (`src/core/codec.ts`, `src/core/tokens.ts`). The alphabet has no `i`, `l`, `o` or `u`, so a link survives being read aloud.

```
share token, 15 chars (71 bits)
https://ogclock.app/{version:3}{zone:10}{place:1}{theme:7}{nonce:50}

frame token, 10 chars (47 bits)
https://ogclock.app/og/{version:3}{theme:7}{minute:27}{zone:10}.png
```

- **Zone, not city.** The Worker needs the sender's zone to compute their local time, so the share token always carries it. It travels as a 10-bit index into a table of IANA zones generated from tzdb release 2026f by `pnpm gen:zones`. The table holds 419 zones. tzdb links distant zones whose clocks agree (Oslo to Berlin), so a link that `zone.tab` gives a location of its own keeps its own code, and the sun maths uses that city's coordinates. Names with no location of their own (`US/Eastern`) are aliases of the zone they point at. Codes are append-only. A test pins known codes and a SHA-256 digest of the first 419 ids, so a reorder or rename fails. The URL never spells out a place, and the coordinates never reach an image as text.
- **Place bit.** One bit is reserved for an opt-in place label. It is always 0, and the decoder rejects a token with it set. If the label ships, it stays off by default, so the image and `og:title` show only what the theme shows.
- **Theme.** The 7-bit theme code, 0 for Auto. Themes have no parameters, so nothing free-form reaches an image served from this domain.
- **Nonce.** 50 random bits from `crypto.getRandomValues`. 30 bits would give a high chance of collisions within one zone and theme at viral volume.
- **Minute.** The frame holds epoch minutes in 27 bits, which lasts until the 2220s.
- **Version.** 3 bits in each token. Both decoders accept only version 1.
- **Strict, canonical parsing.** Each value has exactly one spelling. The decoder rejects a token with the wrong length, a character outside the alphabet, non-zero padding bits, an unknown zone or a version other than 1. On the image route, a rejected token gets a 404, so nobody can fragment the cache with equivalent URLs. On the share route, it falls back to the home page with status 200, so a typo still unfurls.
- **No future frames.** The image route 404s a frame more than 2 minutes ahead of the server's clock. Pages only issue this minute and the next, and the slack absorbs clock skew between edges.

## Routes

`src/worker/app.ts` holds the route table. Static assets are checked before the Worker on every path except `/`.

| Route                     | Behavior                                                         | Cache-Control                                             |
| ------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| `GET /{share}`            | page with OG tags for this minute in the link's zone             | `no-store`                                                |
| `GET /`, `GET /{garbled}` | page with the brand card, for any one-segment path without a dot | `no-store`                                                |
| `GET /og/{frame}.png`     | Cache API lookup, else render, put, return                       | `public, max-age=31536000, immutable`                     |
| `GET /card-{hash}.png`    | the prebuilt brand card, named by a hash of its bytes            | `public, max-age=31536000, immutable`                     |
| `GET /api/now/{zone}`     | every theme's line and frame for this minute and the next        | `public, max-age=0, s-maxage=` seconds to the next minute |
| `/assets/*`, favicon      | Vite's build, through the assets binding                         | the platform default (no `_headers` file)                 |
| 404 and 500               | plain text                                                       | `no-store`                                                |

Any method other than GET and HEAD gets a 405.

Rules that apply across routes:

- `og:url` is the origin plus the share token, with no query. No `rel=canonical`. A canonical pointing at the root would make Facebook and LinkedIn scrape the root instead.
- No redirect anywhere on the image path. WhatsApp reportedly drops images behind redirects.
- The OG tags go right after `<meta charset>`, well inside the first 4 KB. Slack fetches only the head with a Range request. The Worker ignores Range and returns the full page with 200. HEAD gets the same headers with no body.
- Bot Fight Mode and AI bot blocking stay off for the zone. They block Discordbot and similar crawlers. These are Cloudflare zone settings, not code in this repo.
- The Cache API only works on a custom domain, not `workers.dev`, and is per data center. A miss in another data center renders identical bytes again.

### Render failure

If a render throws, the image route logs the error and returns the brand card's bytes with `no-store`. `pnpm gen:card` prebuilds that PNG and the Worker bundles it, so the fallback needs neither wasm engine. The share gets a brand card instead of a broken image, and nothing wrong gets cached under the frame URL. Reddit fetches once per post, so this fallback is what a failed render looks like there. A render that exceeds the CPU limit is cut off by the platform and cannot fall back.

The card's URL is `/card-{hash}.png`, where the hash is FNV-1a over the PNG bytes. A redesigned card gets a new URL, so no cache keeps serving the old one under an immutable header.

### The bare domain shows no time

A clock at a URL with no nonce would freeze on X for about 7 days, and every tweet reusing that URL would show the same wrong time. So `/` serves the brand card to every fetcher, with `og:title` "ogclock: this link knows when you send it".

## How "now" reaches the image

1. The page picks the sender's zone. It maps `Intl.DateTimeFormat().resolvedOptions().timeZone` through the zone table, aliases included. If the table does not know that id, it uses the zone the edge saw in `request.cf.timezone`, and the edge falls back to UTC.
2. A crawler fetches `/{share}`. The Worker computes the wall-clock minute in the link's zone with `Intl.DateTimeFormat` in `h23`, floored to the minute (`momentAt`). It resolves Auto to a concrete theme and asks that theme for its line.
3. The Worker sets `og:image` to the frame URL, with `og:image:type` `image/png`, `og:image:width` 1200, `og:image:height` 630 and `og:image:alt` set to the line. It also sets `og:title` and `twitter:title` to the line, and `twitter:card` to `summary_large_image`.
4. iMessage, Slack, Discord, Telegram and WhatsApp print the title, and Apple advises against relying on text inside images. X shows only the image. So the line has to work as plain text without the picture, for example "60.6% of Wednesday is already gone."

## The page keeps the server's clock

The page promises a time: after Copy it says "Paste it now and they'll see 14:32". That promise has to match what the Worker will render, so the page runs on the server's clock, not the device's.

- `Boot.serverNow` is the server's clock as it built the page. The page measures its offset from the device clock at the navigation's `responseStart`, the reading closest to the moment the server read its clock. Reading the clock once the script runs would count the page's own load time as skew.
- The minute turns on the server's :00. A device that runs 30 seconds behind still copies a link for the minute the Worker will show.
- The Worker sends this minute and the next. The page fetches `/api/now/{zone}` when it needs a new next minute, and doubles its wait after each fetch that does not move it forward, up to a minute. It preloads the next minute's image 2 seconds before :00.
- A hidden tab does no minute work: no ticks, no fetches, no preloads. It catches up and mints a fresh link when it shows again. A theme thumbnail takes a new image only while it is on screen.

## Rendering

- The renderer is `satori/standalone` 0.32.0 and `@resvg/resvg-wasm` 2.6.2, with both wasm modules imported statically. Later Satori versions bundle HarfBuzz, which cannot load inside a Worker. `createRenderer(engine)` returns a function from a scene (an element tree and its font faces) to PNG bytes. The Worker, the scripts and the tests each pass their own engine.
- The wasm engines start once per isolate, on the first render. If one fails to start, the next render retries it.
- Images are 1200x630 PNG. A test renders every theme at six moments (night, polar night, Friday evening, Sunday evening and New Year among them) and fails any PNG over 120 KB. A full-canvas radial gradient costs about 75 KB, so use them sparingly.
- Fonts are TTF files that `pnpm gen:fonts` downloads from Google Fonts, one file per face in the catalog, bundled into the Worker. Variable fonts pin an optical size, because Satori cannot pick one from the font size. The page uses its own self-hosted WOFF2 subsets, not these files.
- Composition guideline: keep the main figure or line inside the centered 630x630 square, so it stays legible at Reddit's thumbnail of about 140 px. Nothing checks this.
- A redesigned theme keeps its frame URLs. Platforms and edge caches that already hold a frame keep the old pixels, and a cache miss renders the new design. That mix is accepted, because platforms rarely fetch an image again. The version field is for a change to what a token means. Since decoders accept only version 1, a bump would 404 every existing frame unless the decoder keeps reading version 1.

## The page

- The page's state is the visitor's zone, the chosen theme and the next link to hand out. A share link is `mint(zone, theme)` with a fresh nonce, minted in the browser so Copy never waits on the network.
- Opening someone else's link keeps their theme and switches to the visitor's own zone and time. The sender's zone and time belong to the sender.
- The Worker fills the page's first paint from the same `slots(state)` function the browser uses afterwards. The README explains the slot directives.
- Nothing on the page takes free text, so nobody can put arbitrary words on images served from this domain.

## Cost and abuse

- Renders scale with shares, not views, because platforms rehost the image.
- The frame space is every theme, every zone and every past minute, plus the next two. A script can ask for a new frame on every request, at about $3 per million renders by the estimate above. The cap is a Cloudflare WAF rate-limit rule on `/og/*` per IP. It is zone configuration, so this repo does not set it.
- Workers Paid ($5/month) is required. Free allows 10 ms CPU per request and 100,000 requests a day, and a render alone exceeds the CPU limit.
- No database, KV, R2, Durable Object or analytics beyond Workers observability. If the edge cache hit rate turns out too low, R2 can sit behind the Cache API without changing any URL.

## Platform behavior

"Time" means the minute of the platform's first fetch of that exact URL.

| Platform    | Fetches                         | Cache per URL                           | Recipient sees             | Source                                       |
| ----------- | ------------------------------- | --------------------------------------- | -------------------------- | -------------------------------------------- |
| X           | server, at compose or post      | about 7 days                            | image and domain only      | third-party, X staff quotes                  |
| Slack       | server, on post                 | about 30 min, global                    | title, description, image  | api.slack.com/robots (verified)              |
| Discord     | server, on post, 10 s budget    | about 30 min, images re-proxied         | title, description, image  | docs.discord.com link previews (verified)    |
| Telegram    | server, on paste in composer    | undocumented                            | title, description, image  | telegram.org/blog/link-preview (verified)    |
| Facebook    | server                          | about 30 days                           | title, image               | third-party                                  |
| LinkedIn    | server                          | cached, existing posts keep old preview | title, image               | linkedin.com help (verified), TTL unverified |
| Reddit      | server, at submit               | per post                                | thumbnail or large preview | third-party                                  |
| iMessage    | sender's device, at paste       | embedded in message, local cache likely | image and title            | 2020 study, TN3156                           |
| WhatsApp    | sender's phone (Web may differ) | embedded in message                     | image, title, description  | 2020 study, sources conflict                 |
| Hacker News | nobody                          | none                                    | bare URL                   | observed                                     |

## Claims still to check on real platforms

The table and the cost figures rest partly on third-party reports. Check these from a deployed Worker on a custom domain, from a phone outside the US:

1. Cold and warm render CPU and wall time, from Workers logs, for every theme. The design holds if a cold render stays well under 1 s.
2. On X, Slack, Discord, Telegram, iMessage, WhatsApp mobile and Web, LinkedIn and Reddit, a fresh link shows the time in the sender's zone.
3. The same link pasted again a few minutes later. Which platforms reuse the first time.
4. A natively forwarded message keeps its preview.

## Open product questions

- Domain name.
- The opt-in place label, which has a reserved bit in the share token.
- A live clock on the bare domain for on-device fetchers (iMessage, WhatsApp mobile), in the zone of `request.cf.timezone`. It needs proof that those apps fetch from the device and that `cf.timezone` is right through iCloud Private Relay. Until then, `/` shows the brand card to everyone.
