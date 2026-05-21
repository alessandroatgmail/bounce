# ── Stage 1: build ────────────────────────────────────────────────────────────
# We use Node to install dependencies and run "vite build".
# The output will be in /app/dist
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first — Docker caches this layer.
# If package.json doesn't change, npm install is skipped on rebuild.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code and build
COPY . .
RUN npm run build

# ── Stage 2: serve with Nginx ─────────────────────────────────────────────────
# We throw away the Node image and keep only the /dist folder.
# Nginx serves the static files — much smaller final image.
FROM nginx:1.25-alpine

# Copy the built React app into Nginx's default web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx config (we'll create this next)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80