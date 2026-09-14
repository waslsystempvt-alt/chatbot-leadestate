# Build context is the repo root (npm workspaces monorepo) — see docker-compose.yml.
# vite.config.ts resolves its outDir as "../dist" relative to this file, i.e.
# apps/widget/dist, which the postbuild script then fills in from apps/widget/*.
FROM node:20-alpine AS build
WORKDIR /app

COPY . .
RUN npm install
RUN npm run build --workspace apps/widget/widget

FROM nginx:alpine
COPY --from=build /app/apps/widget/dist /usr/share/nginx/html
EXPOSE 80
