# Corchetes — Arquitectura Técnica del Monorepo
*Versión 1.0 · 20 de octubre de 2026*

> Este documento describe **cómo está organizado** el proyecto: estructura de directorios, responsabilidad de cada paquete, dependencias entre capas y decisiones de diseño técnico. Para el diseño integral (visual, UX, motor, base de datos, seguridad), ver `arquitectura_corchetes.md`.

---

## Estructura del monorepo (Turborepo)

```
corchetes/
├── docs/                           ← Documentación del proyecto
│   ├── README.md
│   ├── spec.md
│   ├── architecture.md             ← Este archivo
│   ├── arquitectura_corchetes.md   ← Diseño integral
│   ├── tasks.md
│   └── reglesIA.md
│
├── apps/
│   ├── web/                        ← Aplicación pública (juego)
│   ├── api/                        ← Servidor de API
│   └── cms/                        ← Back-office editorial (privado)
│
├── packages/
│   ├── core/                       ← Motor de juego (lógica pura)
│   ├── ui/                         ← Componentes de interfaz compartidos
│   ├── db/                         ← Esquemas de base de datos y migraciones
│   └── crypto/                     ← Utilidades criptográficas (hash + cifrado)
│
├── turbo.json                      ← Configuración de Turborepo
├── package.json                    ← Raíz del workspace
└── tsconfig.base.json              ← TypeScript base compartido
```

---

## Responsabilidad de cada paquete

### `apps/web` — Aplicación pública (Next.js 15)

Es la aplicación que ve el jugador. Responsabilidades:

- Renderizar el puzle diario con su árbol de corchetes anidados.
- Gestionar el estado global del juego (árbol de nodos, puntuación, historial de intentos).
- Validar respuestas en el cliente usando `packages/crypto` (sin llamadas al servidor).
- Mostrar las animaciones de «linotipia» (acierto) y «shake» (error).
- Renderizar el masthead tipográfico (fecha, número de edición, nombre del juego).
- Gestionar la persistencia local (`localStorage`) para sesiones en curso.
- Mostrar la pantalla de cierre de edición con métricas y contexto cultural.
- Generar el texto «Copiar crónica» para compartir.
- Gestionar la autenticación (Magic Link / Google OAuth) mediante Supabase Auth.
- Interactuar con `apps/api` para iniciar/completar sesiones y obtener percentiles.

Tecnologías: **Next.js 15 (App Router)**, **TypeScript 5**, **CSS Modules**, **Motion**, **Zustand**, **Zod**, **next/font**.

### `apps/api` — Servidor de API (Fastify 5)

Es el servidor backend que no ve el jugador. Responsabilidades:

- Servir el payload del puzle diario (árbol cifrado, sin soluciones en claro).
- Registrar el inicio y fin de sesiones de juego en la base de datos.
- Calcular y devolver el percentil del jugador usando Redis.
- Enviar la solución en claro **solo** cuando el jugador solicita explícitamente «Revelar término».
- Compilar el markup del editor → AST → payload cifrado (en el flujo del CMS).
- Publicar puzles programados mediante un cron job diario a las 00:00 h.
- Invalidar la caché de Cloudflare al publicar un nuevo puzle.
- Aplicar rate limiting en los endpoints sensibles.

Tecnologías: **Fastify 5**, **Node.js 22 LTS**, **TypeScript 5**, **Upstash Redis**, **Drizzle ORM**.

### `apps/cms` — Back-office editorial (Next.js 15, ruta privada)

Es el panel de administración que usa el equipo editorial. Responsabilidades:

- Permitir al editor escribir la frase con corchetes y ver la vista previa interactiva en tiempo real.
- Ejecutar el analizador de complejidad automático (profundidad, nodos hoja, alertas).
- Detectar colisiones entre pistas activas con la misma solución.
- Gestionar la cola de publicación (calendario de ediciones programadas).
- Mostrar las analíticas de cada edición (distribución de tiempos, errores por nodo).

Tecnologías: **Next.js 15 (App Router)**, **TypeScript 5**, **CSS Modules**, **Supabase Auth** (rol `admin`).

### `packages/core` — Motor de juego

Es TypeScript puro, sin dependencias de framework. Responsabilidades:

- **Parser:** Convierte el markup con corchetes anidados en un árbol de nodos (`ClueNode[]`).
- **Motor de estado:** Gestiona los estados BLOQUEADO / ACTIVO / RESUELTO de cada nodo.
- **Cascade:** Recalcula los nodos activos tras cada acierto (ascenso al nodo padre).
- **Normalización:** Aplica las reglas de normalización de input específicas del español (tildes, Ñ, diéresis, signos de apertura, números como palabras).
- **Puntuación:** Calcula la puntuación y el rango tras cada evento.
- **Generador de «Crónica»:** Genera el texto tipográfico para compartir.

Este paquete es la pieza más crítica del proyecto. Debe tener cobertura de tests > 90 % antes de usarse en `apps/web` o `apps/api`.

### `packages/crypto` — Utilidades criptográficas

Código compartido entre `apps/web` (cliente) y `apps/api` (servidor). Responsabilidades:

- **`sha256(input: string): string`** — Hash SHA-256 para la validación de respuestas.
- **`aesGcmEncrypt(plaintext: string, key: string): string`** — Cifra la solución original para incluirla en el payload.
- **`aesGcmDecrypt(cipher: string, key: string): string`** — Descifra la solución al acertar en el cliente.
- **`compilePuzzlePayload(ast, puzzleId, dailySalt): ClientPayload`** — Genera el payload seguro completo.

> **Regla crítica:** Este paquete **nunca** debe exponer una función que devuelva la solución en claro sin requerir la propia respuesta del usuario como clave.

### `packages/db` — Base de datos

Esquemas Drizzle ORM y migraciones para PostgreSQL. Responsabilidades:

- Definir los esquemas TypeScript de las tablas: `puzzles`, `users`, `play_sessions`, `node_analytics`, `community_puzzles`.
- Gestionar las migraciones de base de datos.
- Exportar los tipos TypeScript inferidos de los esquemas para uso en `apps/api`.

### `packages/ui` — Componentes compartidos

Componentes de interfaz reutilizables entre `apps/web` y `apps/cms`. Responsabilidades:

- **`<Masthead />`:** Cabecera tipográfica con fecha, número de edición y nombre.
- **`<ClueTree />`:** Renderizador recursivo del árbol de corchetes (componente central del juego).
- **`<InputBar />`:** Barra de entrada con indicador de longitud.
- **Tokens CSS:** Las variables CSS (`--color-paper`, `--color-active`, etc.) se definen aquí y se importan en ambas apps.

---

## Dependencias entre capas

```
apps/web  ──────────────────────────────────────────►  packages/core
apps/web  ───────────────────────────────────────────► packages/crypto
apps/web  ───────────────────────────────────────────► packages/ui
apps/web  ─── HTTP ──────────────────────────────────► apps/api

apps/cms  ───────────────────────────────────────────► packages/core
apps/cms  ───────────────────────────────────────────► packages/ui
apps/cms  ─── HTTP ──────────────────────────────────► apps/api

apps/api  ───────────────────────────────────────────► packages/core
apps/api  ───────────────────────────────────────────► packages/crypto
apps/api  ───────────────────────────────────────────► packages/db
apps/api  ─── Supabase Client ───────────────────────► PostgreSQL (Supabase)
apps/api  ─── Upstash Client ────────────────────────► Redis (Upstash)
```

**Regla:** Los paquetes en `packages/` **nunca** importan de `apps/`. El flujo de dependencias es siempre unidireccional: de apps hacia packages.

---

## Infraestructura y despliegue

| Componente | Plataforma | Notas |
|---|---|---|
| `apps/web` | **Vercel** | Edge Network nativo con Next.js |
| `apps/api` | **Railway** | Servidor Node.js dedicado |
| `apps/cms` | **Vercel** (ruta `/admin` protegida) | O subdominio `cms.corchetes.es` |
| Base de datos | **Supabase** (PostgreSQL 16) | RLS habilitado |
| Caché / Stats | **Upstash Redis** | Serverless, sin instancia dedicada |
| CDN / WAF | **Cloudflare** | Caché del payload diario + Rate limiting |
| Imágenes OG | **`@vercel/og`** (Satori) | Genera fichas en el edge |

---

## Variables de entorno

### `apps/api`

```env
DATABASE_URL=          # Supabase connection string
SUPABASE_SERVICE_KEY=  # Service key (solo servidor, nunca cliente)
UPSTASH_REDIS_URL=     # Upstash REST URL
UPSTASH_REDIS_TOKEN=   # Upstash REST Token
CLOUDFLARE_ZONE_ID=    # Para invalidación de caché
CLOUDFLARE_API_TOKEN=  # Para invalidación de caché
ADMIN_JWT_SECRET=      # Firma de tokens de admin del CMS
```

### `apps/web`

```env
NEXT_PUBLIC_API_URL=       # URL base de apps/api
NEXT_PUBLIC_SUPABASE_URL=  # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON= # Anon key pública de Supabase
```

> **Regla:** Ninguna variable con `SUPABASE_SERVICE_KEY` ni `ADMIN_JWT_SECRET` puede aparecer en `NEXT_PUBLIC_*` ni en el bundle del cliente.

---

## Herramientas de desarrollo

| Herramienta | Uso |
|---|---|
| **Turborepo** | Orquestación del monorepo (build, dev, test en paralelo) |
| **Vitest** | Tests unitarios de `packages/core` y `packages/crypto` |
| **Playwright** | Tests e2e de la experiencia de juego completa |
| **Prettier** | Formato de código (config en raíz del monorepo) |
| **ESLint** | Linting (config en raíz del monorepo) |
| **Docker Compose** | PostgreSQL local + Redis local para desarrollo sin conexión |

---

## Decisiones de diseño

- **CSS Modules en lugar de Tailwind:** máximo control tipográfico; los tokens de diseño del diario requieren variables CSS nativas sin la capa de abstracción de Tailwind.
- **Fastify en lugar de Express:** 2× más rápido; tipado TypeScript nativo; JSON Schema validation integrada.
- **Zustand en lugar de Redux:** sin boilerplate; ideal para el estado del árbol de corchetes que muta con frecuencia.
- **Drizzle en lugar de Prisma:** más ligero en bundle; tipado estricto sin generación de código separada; ideal para Edge/Node.
- **Validación en cliente (sin servidor):** el payload llega cifrado con SHA-256 + AES-GCM; el cliente valida instantáneamente sin latencia de red. Ver `arquitectura_corchetes.md` §9.
- **Monorepo con Turborepo:** el motor de juego (`packages/core`) es compartido entre el cliente (web), el servidor (api) y el CMS, garantizando que la lógica de validación es idéntica en todos los contextos.
