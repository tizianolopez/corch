# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

# ── 1. Dependencias y compilación del monorepo ────────────────────────────────
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar configuración de dependencias del monorepo
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY apps/api/package.json ./apps/api/

# Instalar dependencias limpias
RUN npm ci

# Copiar código fuente
COPY packages/core ./packages/core
COPY packages/crypto ./packages/crypto
COPY packages/db ./packages/db
COPY packages/ui ./packages/ui
COPY apps/api ./apps/api
COPY data ./data

# Compilar paquetes compartidos y el servidor de API
RUN npm run build --workspace=@corchetes/core
RUN npm run build --workspace=@corchetes/crypto
RUN npm run build --workspace=@corchetes/db
RUN npm run build --workspace=@corchetes/api

# ── 2. Imagen de producción ligera ────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Usuario no-root para mayor seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 corchetes

# Copiar archivos compilados y dependencias necesarias
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/data ./data

USER corchetes

EXPOSE 4000

WORKDIR /app/apps/api

CMD ["node", "dist/index.js"]
