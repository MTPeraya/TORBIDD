# Multi-Stage Production Dockerfile (Repository Root)
# Stack: Next.js 16 (App Router) + Node 22 + TypeScript
#
# Build from repository root:
#   docker build -t torbidd-app .
#
# Run:
#   docker run -p 3000:3000 --env-file torbidd-app/.env.local torbidd-app

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY torbidd-app/package.json torbidd-app/package-lock.json ./
RUN npm ci --ignore-scripts --legacy-peer-deps

# Stage 2: Build the Next.js application
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY torbidd-app/ ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV MONGODB_URI=mongodb://localhost:27017/torbidd
ENV MONGODB_DB=torbidd
ENV GOOGLE_CLOUD_PROJECT=placeholder
ENV GOOGLE_CLOUD_LOCATION=asia-southeast1
ENV VERTEX_AI_MODEL_PRO=gemini-1.5-pro
ENV VERTEX_AI_MODEL_FLASH=gemini-1.5-flash
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV SESSION_SECRET=build-time-placeholder-replace-at-runtime

RUN npm run build

# Stage 3: Minimal production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]

