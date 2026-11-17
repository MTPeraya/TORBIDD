# Multi-Stage Production Dockerfile
# Stack: Next.js 16 (App Router) + Node 22 + TypeScript

# Stages:
#   1. deps    — Install production node_modules
#   2. builder — Full build (TypeScript strict check + Next.js standalone)
#   3. runner  — Minimal runtime image (non-root, no dev tools)

# Build:
#   docker build -t torbidd-app ./torbidd-app

# Run:
#   docker run -p 3000:3000 --env-file .env.local torbidd-app

# Stage 1: Install dependencies 
FROM node:22-alpine AS deps

# Install libc compatibility for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests first for layer caching
COPY package.json package-lock.json ./

# Clean install — respects package-lock.json, no postinstall scripts for speed
RUN npm ci --ignore-scripts --legacy-peer-deps

# Stage 2: Build the Next.js application 
FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Disable Next.js telemetry in CI/Docker
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--tls-min-v1.2
ENV NODE_TLS_REJECT_UNAUTHORIZED=1

# Stub-only env vars required for `next build` type-checking.
# Real secrets are injected at runtime via --env-file or Docker secrets.
ENV NODE_ENV=production
ENV MONGODB_URI=mongodb+srv://placeholder:placeholder@cluster.invalid/torbidd?tls=true
ENV MONGODB_DB=torbidd
ENV GOOGLE_CLOUD_PROJECT=placeholder
ENV GOOGLE_CLOUD_LOCATION=asia-southeast1
ENV VERTEX_AI_MODEL_PRO=gemini-1.5-pro
ENV VERTEX_AI_MODEL_FLASH=gemini-1.5-flash
ENV NEXT_PUBLIC_APP_URL=https://localhost

# Build — next.config.ts output: 'standalone' creates a self-contained bundle
RUN npm run build

# Stage 3: Minimal production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--tls-min-v1.2
ENV NODE_TLS_REJECT_UNAUTHORIZED=1
ENV PORT=3443
ENV INTERNAL_HTTP_PORT=3000

# Security: create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy the standalone output (includes server.js + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets (public/ and .next/static/)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts/secure-server.mjs ./secure-server.mjs

USER nextjs

EXPOSE 3443

# Health check validates the internal TLS certificate using its private CA.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const h=require('https'),f=require('fs');h.get({host:'127.0.0.1',port:3443,servername:'app',ca:f.readFileSync('/run/secrets/internal_tls_ca')},r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

# Start the standalone server
CMD ["node", "secure-server.mjs"]
