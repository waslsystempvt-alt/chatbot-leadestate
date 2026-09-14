# Build context is the repo root (npm workspaces monorepo) — see docker-compose.yml.
FROM node:20-alpine AS build
WORKDIR /app

COPY . .
RUN npm install
RUN npm run build --workspace packages/shared-types

# Baked into the static bundle at build time — must be reachable from the
# *browser*, not from inside the Docker network, so it's the API's
# host-published port, not the "api" service name.
ARG VITE_API_BASE=http://localhost:4001
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build --workspace apps/dashboard

FROM nginx:alpine
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
