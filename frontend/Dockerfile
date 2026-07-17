# Pinned (not `node:20-alpine`) to a verified-good patch. A silent bump to a
# newer Node can reintroduce the dev-mode Clerk middleware EvalError (#192):
# Next 14's Edge Runtime evaluates middleware in a `vm` context with
# codeGeneration.strings=false, and stricter vm enforcement in some Node builds
# rejects the eval()-based HMR source maps. 20.20.2 runs the current Clerk
# cleanly. Bump deliberately, then re-test `docker compose up` signed in.
FROM node:20.20.2-alpine AS base

WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package*.json ./
RUN npm ci --include=dev

# --- Build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args for Next.js (needed at build time for static optimization)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
ARG NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
ARG NEXT_PUBLIC_API_URL
# Optional: set to "1" to expose the dev /preview route on this deploy.
# Leave unset on real prod environments — the page will redirect to /today.
ARG NEXT_PUBLIC_PREVIEW_ENABLED

ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL
ENV NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PREVIEW_ENABLED=$NEXT_PUBLIC_PREVIEW_ENABLED

RUN npm run build

# --- Dev ---
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]    

# --- Production ---
FROM base AS runner
ENV NODE_ENV=production

# Copy built assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Railway sets PORT automatically; default to 3000
EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "PORT=${PORT:-3000} node server.js"]
