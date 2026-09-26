# syntax=docker/dockerfile:1
# Container image for any platform: Google Cloud Run, Azure Container Apps, AWS, a plain VM…
#   docker build -t my-app .                         # the web app (listens on $PORT, default 8080)
#   docker build --target migrate -t my-app-migrate .  # one-off job that applies DB migrations
# Runtime settings (DATABASE_URL, BETTER_AUTH_*, STORAGE_*, EMAIL_*) come from environment variables.

FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT=standalone
# Read at build time to allow images from your storage host (see next.config.ts).
ARG STORAGE_PUBLIC_BASE_URL
ENV STORAGE_PUBLIC_BASE_URL=${STORAGE_PUBLIC_BASE_URL}
RUN npm run build

FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY db ./db
CMD ["npx", "drizzle-kit", "migrate"]

FROM base AS runner
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0
RUN groupadd --system app && useradd --system --gid app --home /app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
