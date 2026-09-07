# SE7EN (Next.js + Nest API)

## Local

```bash
npm install
npm run dev
```

The UI listens on port 80 and proxies `/api/*` to `API_REWRITE_TARGET` (default `http://127.0.0.1:3000`). Start the Nest API from `backend/api` separately.

## Vercel

Import the GitHub repo. Framework is Next.js at the repository root.

Add env var `API_REWRITE_TARGET` pointing at the hosted Nest API (no trailing slash). On the API, set `CORS_ORIGIN` and `APP_PUBLIC_URL` to the Vercel URL.
