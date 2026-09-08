# SE7EN (Next.js + Nest API)

## Local

```bash
npm install
npm run dev
```

In another terminal:

```bash
cd backend/api
npm run start:dev
```

The UI is [http://localhost](http://localhost) and proxies `/api` to `http://127.0.0.1:3000`.

## Production

Vercel only hosts the Next.js UI. The Nest API and Postgres must run on a Node host (Render is wired in `render.yaml`).

1. [Deploy to Render](https://render.com) from this repo (`render.yaml` creates `se7en-api` + Postgres).
2. Set `CORS_ORIGIN` and `APP_PUBLIC_URL` to `https://se7en-beta.vercel.app` (and any other Vercel domain, comma-separated).
3. In Vercel → Environment Variables, set `API_REWRITE_TARGET` to the Render API origin (no trailing slash).
4. Redeploy the Vercel project so the rewrite is baked into the build.
