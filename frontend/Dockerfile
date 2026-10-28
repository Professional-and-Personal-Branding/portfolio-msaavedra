# Sitio estático servido por Caddy, que además hace de proxy hacia la API
# por la red privada de Railway (ver frontend/Caddyfile y docs/DEPLOY.md § 9.5).
# Así el navegador habla con un solo origen: sin CORS y con la cookie en SameSite=strict.

FROM node:22.23.3-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlina las variables en el bundle, así que tiene que estar en el build.
# Vacío a propósito: el cliente usa rutas relativas (/api/...) que resuelve el proxy.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM caddy:2.11.4-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
