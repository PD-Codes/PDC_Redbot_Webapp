# syntax=docker/dockerfile:1

# ---- Build stage ------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first for better layer caching.
# `npm ci` is used when a package-lock.json is present, otherwise fall back
# to `npm install`.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
# Build with @sveltejs/adapter-node (output in ./build), then drop dev deps.
RUN npm run build && npm prune --omit=dev

# ---- Runtime stage ----------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# adapter-node reads HOST/PORT/ORIGIN from the environment.
# Override PORT/ORIGIN at runtime (docker-compose / .env) as needed.
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy only what is needed to run.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Writable data dir for persisted logs (see LOG_STORE_DIR).
RUN mkdir -p /app/data && chown node:node /app/data

# Run as non-root.
USER node

EXPOSE 3000
CMD ["node", "build"]
