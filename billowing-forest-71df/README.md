## Local development

```txt
npm install
npm run prisma:generate
npm run db:reset:local
npm run db:init:local
cp .dev.vars.example .dev.vars
# set GOOGLE_MAPS_API_KEY in .dev.vars (optional but required for address autocomplete)
npm run dev
```

## Deploy

```txt
npm run db:verify:remote
npx wrangler secret put GOOGLE_MAPS_API_KEY
npm run deploy
```

## Google Maps / Places autocomplete

Admin event forms use Google Places autocomplete for the address field.

- Enable both APIs in Google Cloud: `Maps JavaScript API` and `Places API`.
- Create an API key and restrict it to your site origins (HTTP referrers).
- Local dev: set `GOOGLE_MAPS_API_KEY` in `.dev.vars`.
- Production: set `GOOGLE_MAPS_API_KEY` with `wrangler secret put`.

If `GOOGLE_MAPS_API_KEY` is missing, autocomplete is disabled and admins can still pick event coordinates by clicking on the map.

## Worker type generation

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.tsx
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
