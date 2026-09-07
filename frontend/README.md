# SE7EN web app (Next.js)

## Local

From this directory:

```bash
npm install
npm run dev
```

The UI listens on port 80 and proxies `/api/*` to `API_REWRITE_TARGET` (default `http://127.0.0.1:3000`).

## Vercel

1. Import the GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Add env var `API_REWRITE_TARGET` pointing at the hosted Nest API (no trailing slash).
4. On the API, set `CORS_ORIGIN` to the Vercel URL (and `APP_PUBLIC_URL` to that same origin).
