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
- [ ] `GET /api/puzzle/today`: devuelve el `client_payload` (sin soluciones en claro)
- [ ] Implementar la selección del puzle por `publish_date = TODAY`
- [ ] Añadir cabeceras `Cache-Control` para Cloudflare (TTL hasta 00:00 h)
- [ ] Test: la respuesta no contiene ningún campo `solution` en texto plano

### 2.3 Endpoints de sesión
- [ ] `POST /api/session/start`: crear `play_session`, devolver `sessionId`
- [ ] `POST /api/session/complete`: guardar resultado, ejecutar ZADD en Redis
- [ ] `POST /api/session/hint`: para tipo `'reveal'`, devolver solución en claro
- [ ] Implementar rate limiting en `/api/session/hint` (máx. 60 req/min por IP)

### 2.4 Endpoint de estadísticas
- [ ] `GET /api/stats/today/distribution`: histograma de tiempos desde Redis (ZCOUNT)
- [ ] Calcular y devolver el percentil del jugador en `/api/session/complete`

### 2.5 Conectar apps/web con apps/api
- [ ] Llamar a `POST /api/session/start` al cargar el puzle
- [ ] Llamar a `POST /api/session/complete` al terminar la partida
- [ ] Mostrar el percentil real en la pantalla de cierre de edición
- [ ] Llamar a `POST /api/session/hint` al usar «Revelar término» (tipo `'reveal'`)

---

## Fase 3 — CMS Editorial (apps/cms)

### 3.1 Setup de apps/cms
- [ ] Inicializar Next.js 15 con App Router en `apps/cms`
- [ ] Configurar Supabase Auth con rol `admin`
- [ ] Implementar middleware de autenticación que protege todas las rutas de `/admin`

### 3.2 Editor de puzles
- [ ] Textarea de markup con sintaxis de corchetes
- [ ] Vista previa interactiva en tiempo real (a la derecha del textarea) usando `<ClueTree />`
- [ ] Analizador de complejidad en tiempo real: profundidad máxima, nodos hoja iniciales
- [ ] Alertas: «Solo 1 nodo activo inicial» / «2 nodos con solución idéntica»

### 3.3 Compilación y guardado
- [ ] Al guardar, el CMS llama a la API para compilar el markup → AST → `client_payload` cifrado
- [ ] Guardar en base de datos con `status: 'DRAFT'`
- [ ] Formulario de metadatos: autor, obra, año, nota editorial

### 3.4 Cola de publicación
- [ ] Vista de calendario de semana con las ediciones programadas
- [ ] Asignación de `publish_date` y cambio de estado a `SCHEDULED`
- [ ] Cron job en `apps/api` (00:00 h): publicar puzles `SCHEDULED` + invalidar caché Cloudflare

### 3.5 Analytics del CMS
- [ ] Vista de analíticas por edición: distribución de tiempos, errores por nodo, tasa de abandono
- [ ] Biblioteca: listado de todas las ediciones con búsqueda y filtro por estado

---

## Fase 4 — Usuarios y autenticación

### 4.1 Sesión anónima
- [ ] Generar y persistir `anonymousId` (UUID) en `localStorage` y cookie `HttpOnly`
- [ ] Enviar `anonymousId` en las llamadas a la API de sesión
- [ ] Registrar la `play_session` con `anonymous_id` cuando no hay `user_id`

### 4.2 Registro y login
- [ ] Implementar Magic Link por email con Supabase Auth
- [ ] Implementar Google OAuth con Supabase Auth
- [ ] UI de login/registro integrada sin abandonar el juego (drawer o modal minimalista)

### 4.3 Fusión de sesión anónima → cuenta
- [ ] Al registrarse, enviar `anonymousId` al backend
- [ ] El backend ejecuta una transacción que vincula todas las `play_sessions` del `anonymous_id` al nuevo `user_id`
- [ ] Actualizar racha y estadísticas acumuladas del usuario

### 4.4 Estadísticas de usuario
- [ ] Racha diaria (`streak_current`, `streak_max`) actualizada al completar cada partida
- [ ] Historial de partidas: lista de ediciones jugadas con puntuación y rango

---

## Fase 5 — Compartición y comunidad

### 5.1 Ficha hemerográfica (imagen OG)
- [ ] Implementar `/api/og/[editionNumber]` con `@vercel/og` (Satori)
- [ ] Diseño de la ficha: número de edición, fecha, autor de la cita, árbol minimalista, rango con sello tipográfico
- [ ] Configurar `og:image` en los meta tags del juego

### 5.2 Creador de retos (UGC)
- [ ] Página `/crear`: textarea de markup + vista previa interactiva
- [ ] Al publicar, llamar a `POST /api/community/create`
- [ ] El backend devuelve `{ shortId, url }` — guardar en `community_puzzles`
- [ ] Página `/r/[shortId]`: cargar y jugar el puzle de la comunidad
- [ ] El reto de comunidad no actualiza las estadísticas del usuario (partida informal)

---

## Fase 6 — Pulido y lanzamiento

### 6.1 PWA
- [ ] Configurar Service Worker con Next.js (next-pwa o Workbox)
- [ ] Caché offline del puzle del día (disponible sin conexión una vez cargado)
- [ ] Manifiesto de la app (icono, nombre, color de tema, `display: standalone`)

### 6.2 SEO y accesibilidad
- [ ] Meta tags dinámicos por página (título, descripción, og:image)
- [ ] Schema.org markup para el juego
- [ ] Auditoría de accesibilidad WCAG 2.1 AA (navegación por teclado, contraste, ARIA)
- [ ] Sitemap estático

### 6.3 Tests e2e
- [ ] Test Playwright: juego completo sin ayudas (Gran Maestro)
- [ ] Test Playwright: juego con ayudas (Cronista)
- [ ] Test Playwright: error de respuesta y animación de shake
- [ ] Test Playwright: flujo de registro y fusión de sesión anónima
- [ ] Test Playwright: creador de retos → URL compartible → juego del reto

### 6.4 Lanzamiento
- [ ] Deploy de `apps/web` en Vercel
- [ ] Deploy de `apps/api` en Railway
- [ ] Configurar dominio `corchetes.es` en Cloudflare
- [ ] Configurar reglas de caché en Cloudflare (TTL del payload diario)
- [ ] Configurar WAF y rate limiting en Cloudflare
- [ ] Cargar los primeros 7 puzles en el CMS (semana de lanzamiento)
- [ ] Beta cerrada: enviar a 20-50 usuarios de prueba
- [ ] Revisión de feedback y correcciones previas al lanzamiento público
