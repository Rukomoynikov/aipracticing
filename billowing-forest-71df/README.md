```txt
npm install
npm run prisma:generate
npm run db:reset:local
npm run db:init:local
npm run dev
```

```txt
npm run deploy
```

```txt
npm run db:verify:remote
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.tsx
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
