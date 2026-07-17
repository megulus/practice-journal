# Deploying Kantelo to Railway

This guide walks through deploying the Kantelo backend (FastAPI) and frontend (Next.js) to [Railway](https://railway.com) with a managed PostgreSQL database.

**Cost:** ~$5/month on the Hobby plan (includes $5 usage credit).

---

## Prerequisites

- A Railway account (sign up at [railway.com](https://railway.com))
- A Clerk account with API keys (sign up at [clerk.com](https://clerk.com))
- This repository pushed to GitHub

---

## 1. Create a Railway project

1. Go to [railway.com/new](https://railway.com/new)
2. Select **"Deploy from GitHub Repo"**
3. Connect your GitHub account and select the `practice-journal` repository
4. Railway will create a project — don't deploy yet, we need to configure services first

---

## 2. Add PostgreSQL

1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway provisions a managed Postgres instance and exposes a `DATABASE_URL` variable
3. Note: Railway's `DATABASE_URL` uses `postgresql://` — the backend automatically converts this to `postgresql+asyncpg://` for the async driver

---

## 3. Deploy the backend

1. In your Railway project, click **"+ New"** → **"GitHub Repo"** → select `practice-journal`
2. In the service settings:
   - **Root Directory:** `backend`
   - **Build Command:** (leave default — Railway will auto-detect the Dockerfile)
3. Add these **environment variables** (Settings → Variables):

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Click **"Add Reference"** → select the Postgres service's `DATABASE_URL` |
   | `CLERK_SECRET_KEY` | Your Clerk secret key (from [dashboard.clerk.com](https://dashboard.clerk.com)) |
   | `CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key — **required**: the backend derives Clerk's JWKS/issuer from it to verify JWT signatures |
   | `CORS_ORIGINS` | The frontend's Railway URL (you'll get this in step 4 — come back and set it) |
   | `ENVIRONMENT` | `production` |

   > The backend verifies each request's Clerk JWT signature against Clerk's
   > JWKS (public keys), derived from `CLERK_PUBLISHABLE_KEY`. To override the
   > derivation (proxy / custom issuer), set `CLERK_JWKS_URL` and/or
   > `CLERK_ISSUER` explicitly.

4. Deploy. The Dockerfile runs `alembic upgrade head` before starting uvicorn, so migrations run automatically on every deploy.

5. Once deployed, note the backend's public URL (e.g., `https://kantelo-backend-production.up.railway.app`). You'll need this for the frontend.

---

## 4. Deploy the frontend

1. In your Railway project, click **"+ New"** → **"GitHub Repo"** → select `practice-journal` again
2. In the service settings:
   - **Root Directory:** `frontend`
   - **Build Command:** (leave default — Railway will auto-detect the Dockerfile)
3. The `frontend/railway.toml` file automatically passes `NEXT_PUBLIC_*` env vars as Docker build args so they're available at Next.js build time. You just need to set them as regular environment variables.
4. Add these **environment variables**:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | The backend's Railway URL from step 3 (e.g., `https://kantelo-backend-production.up.railway.app`) |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key |
   | `CLERK_SECRET_KEY` | Your Clerk secret key |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` |

4. Deploy. Note the frontend's public URL.

5. **Go back to step 3** and set the backend's `CORS_ORIGINS` variable to the frontend URL (e.g., `https://kantelo-frontend-production.up.railway.app`).

---

## 5. Configure Clerk

1. In your [Clerk dashboard](https://dashboard.clerk.com), go to your application settings
2. Under **"Domains"**, add both the frontend Railway URL and the backend Railway URL as allowed origins
3. If you later add a custom domain (e.g., `kantelo.app`), add that too

---

## 6. Seed the curated block library (optional)

Railway provides a shell for each service. To seed the global block library:

1. Go to the backend service in Railway
2. Open the **"Shell"** tab (or use `railway run` via the CLI)
3. Run: `python scripts/seed_curated_blocks.py`

---

## 7. Verify

1. Visit the backend URL + `/health` — should return `{"status": "healthy"}`
2. Visit the backend URL + `/docs` — should show the Swagger UI
3. Visit the frontend URL — should show the Clerk sign-in page
4. Sign in and verify the API works (instrument list, etc.)

---

## Custom domain (optional)

Railway supports custom domains on all paid plans:

1. In Railway, go to your frontend service → **Settings** → **Domains**
2. Click **"+ Custom Domain"** and enter your domain (e.g., `kantelo.app`)
3. Railway will provide DNS records (CNAME) to add at your domain registrar
4. Do the same for the backend if you want `api.kantelo.app`
5. Update `CORS_ORIGINS` and Clerk allowed origins to include the custom domain

---

## Automatic deploys

Railway auto-deploys on every push to your default branch. To change this:

- Go to service **Settings** → **Deploy** → configure the branch trigger
- You can also enable PR preview environments (creates a temporary deploy per PR)

---

## Troubleshooting

**Backend won't start:**
- Check the deploy logs in Railway for the service
- Verify `DATABASE_URL` is set (click the variable and confirm it resolves)
- Check that Alembic migrations succeeded in the deploy log

**Auth not working:**
- Verify `CLERK_SECRET_KEY` is set on both backend and frontend
- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set on the frontend
- Check that the Railway URLs are added to Clerk's allowed origins

**CORS errors:**
- Verify `CORS_ORIGINS` on the backend includes the exact frontend URL (with `https://`, no trailing slash)

**Database connection errors:**
- The `DATABASE_URL` reference from the Postgres service should auto-update. If you see connection errors, check that the Postgres service is running.
