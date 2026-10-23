# Corchetes — Tareas del Proyecto
*Actualizado: 20 de octubre de 2026*

> Implementar una tarea a la vez. Marcar como `[x]` al completar. No pasar a la siguiente hasta confirmar con el desarrollador.

---

## Fase 0 — Fundación del monorepo

### 0.1 Setup del entorno
- [x] Inicializar el monorepo con Turborepo (`npx create-turbo@latest`)
- [x] Configurar `turbo.json` con los pipelines `build`, `dev`, `test`, `lint`
- [x] Configurar `tsconfig.base.json` compartido en raíz
- [x] Configurar ESLint y Prettier en raíz (compartido por todos los paquetes)
- [x] Crear la estructura de directorios: `apps/web`, `apps/api`, `apps/cms`, `packages/core`, `packages/ui`, `packages/db`, `packages/crypto`
- [x] Configurar Docker Compose con PostgreSQL local y Redis local para desarrollo

### 0.2 `packages/core` — Parser
- [x] Definir los tipos TypeScript: `ClueType`, `ClueNode`, `PuzzleState` (ver §5.1 de `arquitectura_corchetes.md`)
- [x] Implementar `parsePuzzleMarkup(markup: string): ClueNode[]` con algoritmo de pila (ver §5.2)
- [x] Implementar `getActiveNodes(state: PuzzleState): ClueNode[]` (nodos hoja sin resolver)
- [x] Implementar `recalculateActiveNodes(state: PuzzleState): PuzzleState` (cascade upward)
- [x] Tests unitarios del parser: casos simples, anidamiento múltiple, corchetes no balanceados
- [x] Tests unitarios de `getActiveNodes` y `recalculateActiveNodes`

### 0.3 `packages/core` — Normalización y puntuación
- [x] Implementar `normalize(input: string): string` con las reglas del español (ver §5.4)
  - Tildes → vocal base (excepto Ñ)
  - Ñ se preserva siempre
  - Signos `¿` y `¡` se eliminan
  - Números como palabras → dígitos
- [x] Tests unitarios de `normalize`: tildes, Ñ, diéresis, ¿¡, números
- [x] Implementar `calculateScore(state: PuzzleState): number` (ver §5.5)
- [x] Implementar `getRank(score: number): string` (ver §5.6)
- [x] Tests unitarios del sistema de puntuación

### 0.4 `packages/core` — Motor de estado
- [x] Implementar `onSubmit(input, state): PuzzleState` con validación por hash (ver §5.3)
- [x] Implementar `applyHint(nodeId, hintType, state): PuzzleState`
- [x] Implementar `generateCronica(state): string` (texto tipográfico para compartir, ver §12.1)
- [x] Tests unitarios de `onSubmit`: acierto, fallo, cascade, doble resolución
- [x] Tests unitarios de `generateCronica`

### 0.5 `packages/crypto`
- [x] Implementar `sha256(input: string): Promise<string>` usando Web Crypto API
- [x] Implementar `aesGcmEncrypt(plaintext: string, key: string): Promise<string>`
- [x] Implementar `aesGcmDecrypt(cipher: string, key: string): Promise<string>`
- [x] Implementar `compilePuzzlePayload(ast, puzzleId, dailySalt): Promise<ClientPayload>`
- [x] Tests unitarios: cifrar + descifrar round-trip, hash consistente

### 0.6 `packages/db` — Esquema de base de datos
- [x] Instalar Drizzle ORM y configurar conexión a Supabase
- [x] Definir esquema TypeScript de la tabla `puzzles`
- [x] Definir esquema TypeScript de la tabla `users`
- [x] Definir esquema TypeScript de la tabla `play_sessions`
- [x] Definir esquema TypeScript de la tabla `node_analytics`
- [x] Definir esquema TypeScript de la tabla `community_puzzles`
- [x] Generar y ejecutar la migración inicial en Supabase
- [x] Configurar Row Level Security (RLS) en `play_sessions`
- [x] Crear la vista `public_puzzles` (excluye `compiled_ast`)

---

## Fase 1 — MVP del juego (apps/web)

### 1.1 Setup de apps/web
- [x] Inicializar Next.js 15 con App Router en `apps/web`
- [x] Configurar `next/font` con Newsreader, Inter y JetBrains Mono
- [x] Crear `packages/ui/tokens.css` con todas las variables CSS de la paleta (ver §2.2 de `arquitectura_corchetes.md`)
- [x] Configurar los temas día/noche mediante atributo `data-theme` en `<html>`
- [x] Implementar la lógica de selección de tema por hora del reloj (< 20:00 h = día)

### 1.2 Componente Masthead
- [x] Crear `<Masthead />` en `packages/ui`
- [x] Mostrar: fecha en español, «EDICIÓN DIARIA», número de edición en formato `N.º 00142`
- [x] Implementar los filetes tipográficos (doble línea CSS: 3px + 1px)
- [x] Aplicar tipografía Newsreader al nombre «C O R C H E T E S» (espaciado de letras editorial)
- [x] Test visual: verificar que el masthead es correcto en móvil y desktop

### 1.3 Componente ClueTree (núcleo de la interfaz)
- [x] Crear `<ClueTree />` en `packages/ui` — renderizador recursivo del árbol de corchetes
- [x] Aplicar los estados visuales correctos: BLOQUEADO (gris), ACTIVO (verde inglés + fondo suave), RESUELTO (tinta normal)
- [x] Implementar el dimming contextual al hover sobre un corchete activo (opacity: 0.35 en el resto)
- [x] Aplicar tipografías correctas: Newsreader para texto resuelto/fijo, Inter para pistas en corchetes
- [x] Test: árbol con 1 nivel de profundidad
- [x] Test: árbol con 3 niveles de profundidad anidados

### 1.4 Animaciones de Linotipia
- [x] Instalar Motion (Framer Motion v11+) en `apps/web`
- [x] Implementar animación de colapso de corchete al acertar (scaleX 1→0 en 200ms, luego palabra aparece en 300ms)
- [x] Implementar la fase de cursiva + subrayado punteado de 1500ms tras acertar
- [x] Implementar la fusión final a Newsreader regular en 400ms
- [x] Implementar animación de desbloqueo de pista padre (parpadeo de fondo activo en 400ms)
- [x] Test visual: verificar la secuencia completa de animación

### 1.5 Barra de entrada (InputBar)
- [x] Crear `<InputBar />` en `packages/ui`
- [x] Input controlado con indicador dinámico de longitud en JetBrains Mono
- [x] Animación de shake en error (translateX -4px ↔ +4px × 3 en 300ms)
- [x] Cambio de color de borde a `--color-alert` durante 600ms en error
- [x] Botones «Solicitar matriz» y «Revelar término»
- [x] En móvil: anclar con `position: sticky; bottom: 0` + gestión de `visualViewport` para iOS

### 1.6 Estado global del juego (Zustand)
- [x] Instalar Zustand en `apps/web`
- [x] Crear el store del juego: `PuzzleState` + acciones (`onSubmit`, `applyHint`, `resetGame`)
- [x] Conectar el store con el componente `<ClueTree />`
- [x] Conectar el store con `<InputBar />`

### 1.7 Persistencia local
- [x] Serializar el estado del juego en `localStorage` tras cada acción
- [x] Restaurar el estado al cargar la página (si la edición es la de hoy)
- [x] Limpiar el estado de días anteriores automáticamente

### 1.8 Pantalla de cierre de edición
- [x] Detectar cuando `state.completedAt` pasa a tener valor (todos los nodos resueltos)
- [x] Transformar el `<InputBar />` inferior en la «Nota Editorial» con animación de height
- [x] Mostrar: cita completa, autor, obra, año, nota editorial (2-3 líneas)
- [x] Mostrar: tiempo, precisión, rango con barras horizontales tipográficas de 1px
- [x] Botón «Copiar crónica» que genera y copia el texto de `generateCronica()`
- [x] Placeholder para el percentil (se conectará con el backend en Fase 3)

---

## Fase 2 — API Backend (apps/api)

### 2.1 Setup de apps/api
- [x] Inicializar Fastify 5 con TypeScript en `apps/api`
- [x] Configurar conexión a Supabase (Drizzle ORM desde `packages/db`)
- [x] Configurar conexión a Upstash Redis
- [x] Implementar manejo de errores global y logging con Pino

### 2.2 Endpoint: puzzle del día
- [x] `GET /api/puzzle/today`: devuelve el `client_payload` (sin soluciones en claro)
- [x] Implementar la selección del puzle por `publish_date = TODAY`
- [x] Añadir cabeceras `Cache-Control` para Cloudflare (TTL hasta 00:00 h)
- [x] Test: la respuesta no contiene ningún campo `solution` en texto plano

### 2.3 Endpoints de sesión
- [x] `POST /api/session/start`: crear `play_session`, devolver `sessionId`
- [x] `POST /api/session/complete`: guardar resultado, ejecutar ZADD en Redis
- [x] `POST /api/session/hint`: para tipo `'reveal'`, devolver solución en claro
- [x] Implementar rate limiting en `/api/session/hint` (máx. 60 req/min por IP)

### 2.4 Endpoint de estadísticas
- [x] `GET /api/stats/today/distribution`: histograma de tiempos desde Redis (ZCOUNT)
- [x] Calcular y devolver el percentil del jugador en `/api/session/complete`

### 2.5 Conectar apps/web con apps/api
- [x] Llamar a `POST /api/session/start` al cargar el puzle
- [x] Llamar a `POST /api/session/complete` al terminar la partida
- [x] Mostrar el percentil real en la pantalla de cierre de edición
- [x] Llamar a `POST /api/session/hint` al usar «Revelar término» (tipo `'reveal'`)

---

## Fase 3 — Agente Generador de Puzles (IA)

> Este es el flujo principal de producción de contenido. El CMS (Fase 4) es el panel de supervisión que aprueba los borradores generados aquí.

### 3.1 Extractor de efemérides (Wikimedia API)
- [x] Crear servicio `apps/api/src/services/ephemeris.ts`
- [x] `GET /feed/v1/wikipedia/es/onthisday/selected/{MM}/{DD}` → lista de eventos históricos
- [x] Filtro de relevancia editorial: descartar eventos muy cortos o con títulos ambiguos
- [x] Cachar la respuesta en Redis (TTL 24 h) para no repetir llamadas innecesarias
- [x] Tests unitarios con respuesta mockeada de la API

### 3.2 Agente Gemini (Structured Outputs)
- [x] Instalar `@google/generative-ai` en `apps/api`
- [x] Crear `apps/api/src/services/puzzleGenerator.ts`
- [x] Diseñar el `system prompt` con las reglas del juego (desde `docs/prompt_enigma.md`)
- [x] Definir el `responseSchema` JSON (markup de corchetes + metadatos editoriales)
- [x] Llamar a `gemini-2.0-flash` con `responseMimeType: "application/json"` y schema
- [x] Mecanismo de reintentos: si el markup falla la validación, reenvía el error al modelo (máx. 3 intentos)
- [x] Tests con prompt real usando respuesta mockeada de Gemini

### 3.3 Validador determinista
- [x] Crear `apps/api/src/services/puzzleValidator.ts`
- [x] Invocar `parsePuzzleMarkup()` de `@corchetes/core` sobre el markup generado
- [x] Verificar: ≥ 2 nodos iniciales activos, profundidad entre 2 y 5, sin soluciones duplicadas
- [x] Si falla: construir mensaje de error descriptivo para retroalimentar al agente
- [x] Si supera 3 reintentos fallidos: marcar evento como `REJECTED` y continuar con el siguiente

### 3.4 Compilador y guardado en BD
- [x] Invocar `compilePuzzlePayload()` de `@corchetes/crypto` sobre el AST validado
- [x] Endpoint `POST /api/generate` (requiere token `admin`) que ejecuta el pipeline completo
- [x] Guardar el puzle en BD con `status: 'DRAFT'` y fuente `source: 'AI'`
- [x] Endpoint `POST /api/generate/batch` para generar puzles para los próximos N días
- [x] Tests de integración del pipeline completo (extractor → generador → validador → BD)

### 3.5 Fichero de reglas del agente IA
- [x] Crear `docs/prompt_enigma.md` con el prompt del sistema completo
- [x] Incluir: ejemplos de markup correcto, tipología de pistas, restricciones de profundidad
- [x] Incluir: instruccción de formato específica («Un día como hoy, en {year}...»)

---

## Fase 4 — CMS de Supervisión Editorial (apps/cms)

> Panel de revisión y aprobación de los borradores generados por el agente IA. La creación manual es posible como flujo alternativo.

### 4.1 Setup de apps/cms
- [x] Inicializar Next.js 15 con App Router en `apps/cms`
- [x] Configurar Supabase Auth con rol `admin`
- [x] Implementar middleware de autenticación que protege todas las rutas de `/admin`

### 4.2 Cola de borradores (panel principal)
- [x] Lista de puzles en estado `DRAFT` generados por IA, ordenados por `publish_date`
- [x] Vista previa interactiva de cada borrador usando `<ClueTree />` (jugable antes de aprobar)
- [x] Botón «Aprobar» → cambia estado a `SCHEDULED`
- [x] Botón «Regenerarr» → llama a `POST /api/generate` con el mismo evento y genera un nuevo borrador
- [x] Botón «Editar pista» → edición iníline de una pista sin regenerar todo el puzle

### 4.3 Cola de publicación
- [x] Vista de calendario de semana con las ediciones programadas
- [x] Asignación de `publish_date` y cambio de estado a `SCHEDULED`
- [x] Cron job en `apps/api` (00:00 h): publicar puzles `SCHEDULED` + invalidar caché Cloudflare

### 4.4 Editor manual (flujo alternativo)
- [x] Textarea de markup con sintaxis de corchetes + vista previa interactiva en tiempo real
- [x] Analizador de complejidad en tiempo real: profundidad máxima, nodos hoja iniciales
- [x] Alertas: «Solo 1 nodo activo inicial» / «2 nodos con solución idéntica»
- [x] Formulario de metadatos: autor, obra, año, nota editorial
- [x] Guardar → compila el markup → guarda con `status: 'DRAFT'` y `source: 'MANUAL'`

### 4.5 Analytics del CMS
- [x] Vista de analíticas por edición: distribución de tiempos, errores por nodo, tasa de abandono
- [x] Biblioteca: listado de todas las ediciones con búsqueda y filtro por estado y fuente (`AI` / `MANUAL`)
- [x] Panel de rendimiento del agente: tasa de éxito en la generación, reintentos promedio, rechazos

---

## Fase 5 — Usuarios y autenticación

### 5.1 Sesión anónima
- [x] Generar y persistir `anonymousId` (UUID) en `localStorage` y cookie `HttpOnly`
- [x] Enviar `anonymousId` en las llamadas a la API de sesión
- [x] Registrar la `play_session` con `anonymous_id` cuando no hay `user_id`

### 5.2 Registro y login
- [x] Implementar Magic Link por email con Supabase Auth
- [x] Implementar Google OAuth con Supabase Auth
- [x] UI de login/registro integrada sin abandonar el juego (drawer o modal minimalista)

### 5.3 Fusión de sesión anónima → cuenta
- [x] Al registrarse, enviar `anonymousId` al backend
- [x] El backend ejecuta una transacción que vincula todas las `play_sessions` del `anonymous_id` al nuevo `user_id`
- [x] Actualizar racha y estadísticas acumuladas del usuario

### 5.4 Estadísticas de usuario
- [x] Racha diaria (`streak_current`, `streak_max`) actualizada al completar cada partida
- [x] Historial de partidas: lista de ediciones jugadas con puntuación y rango

---

## Fase 6 — Compartición y comunidad

### 6.1 Ficha hemerográfica (imagen OG)
- [x] Implementar `/api/og/[editionNumber]` con `@vercel/og` (Satori)
- [x] Diseño de la ficha: número de edición, fecha, autor de la cita, árbol minimalista, rango con sello tipográfico
- [x] Configurar `og:image` en los meta tags del juego

### 6.2 Creador de retos (UGC)
- [x] Página `/crear`: textarea de markup + vista previa interactiva
- [x] Al publicar, llamar a `POST /api/community/create`
- [x] El backend devuelve `{ shortId, url }` — guardar en `community_puzzles`
- [x] Página `/r/[shortId]`: cargar y jugar el puzle de la comunidad
- [x] El reto de comunidad no actualiza las estadísticas del usuario (partida informal)

---

## Fase 7 — Pulido y lanzamiento

### 7.1 PWA
- [x] Configurar Service Worker con Next.js (next-pwa o Workbox)
- [x] Caché offline del puzle del día (disponible sin conexión una vez cargado)
- [x] Manifiesto de la app (icono, nombre, color de tema, `display: standalone`)

### 7.2 SEO y accesibilidad
- [x] Meta tags dinámicos por página (título, descripción, og:image)
- [x] Schema.org markup para el juego
- [x] Auditoría de accesibilidad WCAG 2.1 AA (navegación por teclado, contraste, ARIA)
- [x] Sitemap estático

### 7.3 Tests e2e
- [x] Test Playwright: juego completo sin ayudas (Gran Maestro)
- [x] Test Playwright: juego con ayudas (Cronista)
- [x] Test Playwright: error de respuesta y animación de shake
- [x] Test Playwright: flujo de registro y fusión de sesión anónima
- [x] Test Playwright: creador de retos → URL compartible → juego del reto

### 7.4 Lanzamiento
- [x] Configuración de deploy de `apps/web` en Vercel (`vercel.json`, Service Worker, headers)
- [x] Configuración de deploy de `apps/api` en Railway (`Dockerfile` multi-stage, `railway.json`, healthcheck)
- [x] Guía de configuración de dominio `corchetes.es` en Cloudflare (`docs/deployment.md`)
- [x] Configurar reglas de caché en Cloudflare (TTL dinámico del payload diario hasta medianoche)
- [x] Configurar reglas de WAF y rate limiting en Cloudflare
- [x] Cargar y sembrar los primeros 7 puzles en la base de datos / CMS (`packages/db/src/seed.ts`, `data/launch_puzzles_seed.json`)
- [x] Protocolo de beta cerrada: guía de convocatoria a 20-50 usuarios y formulario de feedback (`docs/deployment.md`)
- [x] Pipeline de inteligencia enigmística: ingeniería inversa de Claudàtors (1.827 pistas), escáner de ventana deslizante (`windowScanner.ts`) y dataset de fine-tuning (`data/claudators_tuning.jsonl`)
- [ ] Revisión de feedback y correcciones de la beta previa a la apertura pública general

---

## Fase 8 — Auditoría de Placeholders y Conexión de Producción Real

> Esta fase resuelve todas las discrepancias entre prototipos locales y el entorno de producción desplegado en Vercel y Supabase Cloud.

### 8.1 Diagnóstico y Desconexión de Fallbacks ("En un lugar de la Mancha")
- [x] **Causa raíz diagnosticada de la aparición de Don Quijote en Vercel**:
  1. `apps/web` desplegado en Vercel intentaba consultar `GET /api/puzzle/today`, pero `apps/api` (Fastify) no estaba sirviendo endpoints serverless en Vercel, devolviendo error `404 Not Found`.
  2. Al recibir 404, `InteractiveTreeDemo.tsx` caía en el bloque `catch` y cargaba el `DEMO_PAYLOAD` hardcodeado (Don Quijote, Mancha, edición 142).
  3. El masthead en `apps/web/app/page.tsx` tenía `editionNumber={142}` fijo sin vincular al puzle cargado.
- [x] **Sustitución del payload canónico**: Actualizar `DEMO_PAYLOAD` en `InteractiveTreeDemo.tsx` a la Edición 1 oficial («Un día como hoy, pero en 1940...» Pelé, Brasil, mundiales, goles) con criptografía real Web Crypto SHA-256 y AES-GCM.
- [x] **Limpieza criptográfica en cliente**: Eliminar los atajos de prefijo mockeados (`molinos:`, `quijote:`, `mancha:`) de `appHashFn` en `InteractiveTreeDemo.tsx`.
- [x] **Retirada de botones de depuración en frontend**: Eliminar los atajos visuales «Resolver n3 → «molinos»» y «Resolver n2 → «Quijote»» de la interfaz de juego.
- [x] **Dinamización del Masthead**: Vincular el número de edición del `<Masthead />` directamente a `puzzleState.editionNumber` (muestra N.º 00001).
- [x] **Actualización de fallbacks del backend**:
  - `apps/api/src/routes/puzzle.ts`: `getFallbackDailyPayload()` actualizado a Pelé 1940.
  - `apps/api/src/routes/session.ts`: `DEMO_SOLUTIONS` actualizado a `Brasil`, `Pelé`, `mundiales`, `goles`.

### 8.2 Diagnóstico y Corrección de Autenticación Supabase
- [x] **Causa raíz diagnosticada del redirect a `placeholder-corchetes.supabase.co`**:
  1. `apps/web/src/lib/supabase.ts` y `apps/cms/src/lib/supabase.ts` tenían como valor por defecto `'https://placeholder-corchetes.supabase.co'`.
  2. Next.js incrusta las variables `NEXT_PUBLIC_*` estáticamente durante el build (`next build`). Al desplegar sin variables configuradas en el panel de Vercel, el cliente web compiló la URL de placeholder en el bundle JavaScript.
- [x] **Actualización de credenciales por defecto**:
  - `apps/web/src/lib/supabase.ts`: actualizado al proyecto Supabase Cloud activo (`https://zwmvlvzwjypdlyfkngzh.supabase.co`).
  - `apps/cms/src/lib/supabase.ts`: actualizado al proyecto Supabase Cloud activo y su anon key.
- [ ] **Habilitación de Google OAuth en Supabase Console**:
  - Crear credenciales de aplicación web en Google Cloud Console.
  - Obtener `Client ID` y `Client Secret`.
  - En Supabase (`Authentication` → `Providers` → `Google`), activar el proveedor e ingresar ambas claves con la callback URI: `https://zwmvlvzwjypdlyfkngzh.supabase.co/auth/v1/callback`.
- [ ] **Configuración de URLs de redirección permitidas (Whitelist) en Supabase**:
  - En Supabase (`Authentication` → `URL Configuration`), añadir:
    - `https://corch.vercel.app/**`
    - `https://corchetes.es/**`
    - `http://localhost:3000/**`
- [ ] **Configuración de envío de correo para Magic Link en producción**:
  - Configurar proveedor SMTP / Resend en Supabase (`Authentication` → `Email Templates` y `SMTP Settings`) para evitar la tasa límite del servicio gratuito compartido.

### 8.3 Endpoints API Nativos en Next.js (apps/web) para Operación 100% Serverless
- [x] **`GET /api/puzzle/today` (`apps/web/app/api/puzzle/today/route.ts`)**:
  - Consulta a Supabase PostgreSQL (`public_puzzles`) por `publish_date = TODAY` y `status = 'PUBLISHED'`.
  - Fallback garantizado a la Edición 1 canónica («Un día como hoy») si la base de datos está inaccesible.
  - Cabeceras de caché HTTP para Cloudflare / Vercel Edge Cache (`Cache-Control: public, s-maxage=3600`).
- [x] **`POST /api/session/start` (`apps/web/app/api/session/start/route.ts`)**:
  - Creación y registro de sesión en PostgreSQL con soporte para sesiones anónimas y usuarios registrados.
- [x] **`POST /api/session/complete` (`apps/web/app/api/session/complete/route.ts`)**:
  - Registro de resolución, puntuación, tiempo y cálculo de percentil.
- [x] **`POST /api/session/hint` (`apps/web/app/api/session/hint/route.ts`)**:
  - Entrega de letras iniciales (`matrix`) y soluciones en claro (`reveal`) asegurando que la experiencia de juego funcione de punta a punta en Vercel.

### 8.4 Configuración de Variables de Entorno en el Panel de Vercel
- [ ] **Configurar las variables de entorno en Vercel (`Project Settings` → `Environment Variables`)**:
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://zwmvlvzwjypdlyfkngzh.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGci...`
  - `DATABASE_URL` = Cadena de conexión PostgreSQL (Session Pooler de Supabase)
  - `GEMINI_API_KEY` = API Key para generación de enigmas IA
  - `UPSTASH_REDIS_REST_URL` = URL REST de Upstash Redis
  - `UPSTASH_REDIS_REST_TOKEN` = Token de Upstash Redis
  - `ADMIN_JWT_SECRET` = Clave secreta para acceso administrativo al CMS
- [ ] **Ejecutar Redeploy en Vercel**:
  - Realizar despliegue limpio (Redeploy sin caché) desde el dashboard de Vercel o mediante git push para incrustar las nuevas variables en el cliente.

### 8.5 Auditoría de CMS y Limpieza de Datos Mocks Restantes
- [ ] **Sustituir `samplePuzzles` en `apps/cms/app/admin/analytics/page.tsx`**:
  - Reemplazar el array estático de puzles de prueba (Cervantes, Lorca, Rosalía de Castro) por una consulta directa a la vista analítica de Supabase (`node_analytics`, `play_sessions`, `puzzles`).
- [ ] **Verificar persistencia en el Editor Manual del CMS**:
  - Validar que al guardar un puzle desde `/admin/editor` se inserte directamente en la tabla `puzzles` de Supabase con `source: 'MANUAL'` y `status: 'DRAFT'`.

### 8.6 Automatización del Ciclo de Vida Editorial (Cron)
- [ ] **Cron diario de publicación a medianoche (00:00 h Madrid)**:
  - Configurar Vercel Cron o GitHub Actions Workflow para cambiar el estado de los puzles de `SCHEDULED` a `PUBLISHED` al cambiar el día.
  - Purgar la caché de Cloudflare para la ruta `/api/puzzle/today`.
- [ ] **Generador semanal automático de enigmas con IA**:
  - Programar la ejecución dominical del extractor de efemérides + agente Gemini para mantener un colchón mínimo de 7 borradores revisables en el CMS.

### 8.7 Correcciones de Jugabilidad y Experiencia de Usuario (Beta Feedback)
- [x] **Botón «Jugar de nuevo» funcional**:
  - Implementado `clearTodayState()` en `apps/web/store/usePuzzlePersistence.ts` para purgar `localStorage` al reiniciar, evitando que `initializeGame()` restaure en bucle la partida terminada.
- [x] **Resolución libre de pistas en cualquier momento**:
  - `ClueBracket.tsx`: cualquier corchete sin resolver ahora es clickeable (`cursor: pointer`), permitiendo seleccionar y responder cualquier pista sin forzar un orden lineal estricto.
  - `packages/core/src/engine.ts`: `onSubmit()` evalúa todas las pistas no resueltas del árbol (priorizando el nodo seleccionado). Si se resuelve un padre directamente, se resuelven en cascada sus hijos.
- [x] **Eliminación de la cita duplicada y marcadores `{{n1}}`, `{{n2}}`, `{{n4}}`**:
  - `EndScreen.tsx`: incorporada la prop `hideQuote={true}` para no duplicar la cita ya renderizada con elegancia tipográfica por `<ClueTree />`.
  - Reconstrucción de texto limpio en `EndScreen`: si la cita se renderiza de forma aislada, `reconstructQuote()` reemplaza dinámicamente los placeholders por las soluciones reales, eliminando los identificadores de nodo crudos.
- [x] **Protección total contra fugas de texto cifrado**:
  - `InteractiveTreeDemo.tsx`: `appDecryptFn()` y `handleReveal()` sanitizados para garantizar que nunca se muestre en pantalla una cadena en formato `iv:ciphertext` (`7c6fece1...`), entregando siempre la palabra legible en español.



