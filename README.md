# SE7EN (Next.js)

The UI and API run in one Next.js app. `/api/*` is the Nest API. Postgres stays external (Neon, Vercel Postgres, or any `DATABASE_URL`).

## Local

Copy `.env.example` to `.env` and set at least `DATABASE_*` (or `DATABASE_URL`) and `JWT_SECRET`.

```bash
npm install
npm run migration:run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in as `admin` / `admin123`. Swagger (when `SWAGGER_ENABLED=true`): [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

## Vercel

1. Create a hosted Postgres database (Neon or Vercel Postgres).
2. Deploy this repo as a Next.js project.
3. Set environment variables:

- `DATABASE_URL`
- `JWT_SECRET` (16+ characters)
- `APP_PUBLIC_URL` (your Vercel origin, e.g. `https://se7en-beta.vercel.app`)
- Optional: `JIRACODERS_API_TOKEN`, `TALYN_INGEST_API_KEY`, Google/Microsoft calendar secrets

`DB_SYNCHRONIZE` must stay `false` in production. Run `npm run migration:run` against that database before first login (local machine or a one-off CI step).

Uploads use `/tmp` on Vercel and do not persist across deploys. Swap `FileStorageService` for object storage if you need durable files.
