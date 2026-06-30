# syntax=docker/dockerfile:1

# ---- Build-Stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Abhängigkeiten zuerst (besseres Layer-Caching)
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Runtime-Stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# adapter-node liest HOST/PORT aus der Umgebung
ENV HOST=0.0.0.0
ENV PORT=3000

# Nur das Nötige übernehmen
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Als Nicht-Root laufen
USER node

EXPOSE 3000
CMD ["node", "build"]
