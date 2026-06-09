# syntax=docker/dockerfile:1

# ── deps: install production + build deps once, cached on package files ──────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── builder: produce the standalone Next.js bundle ──────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be present during `npm run build` (the runtime env_file is too late).
# Passed in from docker-compose.prod.yml build.args, which reads them from .env.
ARG NEXT_PUBLIC_PLATFORM_URL
ARG NEXT_PUBLIC_GUEST_EMAIL
ARG NEXT_PUBLIC_GUEST_PASSWORD
ENV NEXT_PUBLIC_PLATFORM_URL=$NEXT_PUBLIC_PLATFORM_URL \
    NEXT_PUBLIC_GUEST_EMAIL=$NEXT_PUBLIC_GUEST_EMAIL \
    NEXT_PUBLIC_GUEST_PASSWORD=$NEXT_PUBLIC_GUEST_PASSWORD
RUN npm run build

# ── runner: minimal image that serves the standalone bundle ─────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# server.js binds to HOSTNAME; 0.0.0.0 so the container is reachable.
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone output: server.js + traced node_modules (incl. node-cron) at root,
# plus static assets and public/ which standalone does not copy by itself.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
