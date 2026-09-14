# Build context is the repo root (npm workspaces monorepo) — see docker-compose.yml.
FROM node:20-alpine
WORKDIR /app

# Prisma's engine binary needs OpenSSL, which isn't in the base Alpine image.
RUN apk add --no-cache openssl

COPY . .
RUN npm install
RUN npm run build --workspace packages/shared-types
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace apps/api

WORKDIR /app/apps/api
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/main.js"]
