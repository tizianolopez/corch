# Corchetes — Documento de Arquitectura Integral
*Versión 0.1 · Borrador definitivo pre-implementación · 20 de octubre de 2026*

---

> [!IMPORTANT]
> Este documento es la **fuente de verdad de diseño** del proyecto. Cubre identidad visual, UX/UI, motor de juego, stack tecnológico, base de datos, seguridad, CMS y estadísticas.
> - Para los requisitos funcionales → ver `spec.md`
> - Para la estructura del monorepo → ver `architecture.md`
> - Para las tareas pendientes → ver `tasks.md` (el roadmap de §13 es orientativo; `tasks.md` es el documento operativo)
> - Para el protocolo de trabajo con la IA → ver `reglesIA.md`

---

## Tabla de Contenidos

1. [Identidad y Concepto](#1-identidad-y-concepto)
2. [Identidad Visual](#2-identidad-visual)
3. [Sistema Tipográfico](#3-sistema-tipográfico)
4. [Arquitectura UX/UI](#4-arquitectura-uxui)
5. [Motor de Juego (Frontend Logic)](#5-motor-de-juego-frontend-logic)
6. [Stack Tecnológico](#6-stack-tecnológico)
7. [Arquitectura de Backend](#7-arquitectura-de-backend)
8. [Base de Datos](#8-base-de-datos)
9. [Seguridad y Anti-Spoiler](#9-seguridad-y-anti-spoiler)
10. [CMS Editorial](#10-cms-editorial)
11. [Sistema de Estadísticas](#11-sistema-de-estadísticas)
12. [Compartición y Ficha Hemerográfica](#12-compartición-y-ficha-hemerográfica)
13. [Hoja de Ruta (Roadmap)](#13-hoja-de-ruta-roadmap)
14. [Decisiones de Producto Clave](#14-decisiones-de-producto-clave)

---

## 1. Identidad y Concepto

| Atributo | Valor |
|---|---|
| **Nombre** | **Corchetes** |
| **Dominio** | `corchetes.es` (tentativo) |
| **Tagline** | *El juego de reconstrucción léxica* |
| **Subtítulo** | *Se resuelve de dentro hacia afuera* |
| **Idioma** | Español (España y variantes hispanoamericanas) |
| **Cadencia** | Una edición diaria oficial a las 00:00 h |
| **Inspiración** | Claudàtors (ca), Bracket City (en) |

### Concepto central

Corchetes presenta al jugador una cita literaria o hecho histórico donde ciertas palabras han sido extraídas y sustituidas por pistas anidadas entre corchetes `[...]`. Las pistas forman un árbol jerárquico que **solo puede resolverse de dentro hacia afuera**: primero las pistas más internas (hojas del árbol), cuya resolución desbloquea progresivamente las pistas contenedoras.

```
[Pista externa ... [Pista interna (ACTIVA)] ... ]  →  Se resuelve la interna
[Pista externa ... «PALABRA» ... ]                 →  La externa cobra sentido
«FRASE FINAL RECONSTITUIDA»                        →  Victoria
```

---

## 2. Identidad Visual

### 2.1. Filosofía de Diseño: «El Diario Digital»

El objetivo es trasladar la **autoridad, calma y elegancia del papel prensa** al entorno digital. Nada de colores estridentes, botones redondeados infantiles ni iconografía excesiva. La interfaz es en sí misma un ejercicio tipográfico.

Referentes directos: *The New York Times Games*, *The Atlantic*, *Le Monde Interactif*.

### 2.2. Paleta Cromática

#### Modo Día (Edición Matutina)

| Token | Hex | Función |
|---|---|---|
| `--color-paper` | `#F7F4EF` | Fondo principal — papel prensa cálido |
| `--color-paper-alt` | `#EFECE6` | Fondo secundario — tarjetas y paneles |
| `--color-ink` | `#1A1917` | Tinta principal — texto de la cita y titulares |
| `--color-ink-muted` | `#6E6A63` | Tinta secundaria — pistas bloqueadas, metadatos |
| `--color-active` | `#1B4D3E` | Verde inglés — corchetes activos (resolubles) |
| `--color-active-bg` | `rgba(27,77,62,0.08)` | Fondo suave de pista activa |
| `--color-alert` | `#9E2A2B` | Carmesí editorial — errores y ayudas usadas |
| `--color-border` | `#C8C4BB` | Filetes tipográficos |
| `--color-border-heavy` | `#1A1917` | Filetes gruesos de cabecera |

#### Modo Noche (Edición Nocturna)

| Token | Hex | Función |
|---|---|---|
| `--color-paper` | `#141413` | Fondo principal — carbón profundo |
| `--color-paper-alt` | `#1E1E1C` | Fondo secundario — gris plomo |
| `--color-ink` | `#EAE6DF` | Tinta principal — blanco pergamino |
| `--color-ink-muted` | `#8C877E` | Tinta secundaria — gris ceniza |
| `--color-active` | `#52B788` | Verde salvia luminoso — corchetes activos |
| `--color-active-bg` | `rgba(82,183,136,0.10)` | Fondo suave de pista activa nocturno |
| `--color-alert` | `#E06D53` | Terracota suave — errores |
| `--color-border` | `#3A3834` | Filetes tipográficos |
| `--color-border-heavy` | `#EAE6DF` | Filetes gruesos de cabecera |

> [!NOTE]
> El modo día/noche no se activa por preferencia del sistema (`prefers-color-scheme`) sino por la **hora real del reloj**: antes de las 20:00 h → Edición Matutina; después → Edición Nocturna. Es coherente con la metáfora del diario.

### 2.3. Espaciado y Proporción

Sistema de espaciado basado en **múltiplos de 4px** con una escala de 8 valores:

```
--space-1: 4px   --space-2: 8px   --space-3: 12px  --space-4: 16px
--space-5: 24px  --space-6: 32px  --space-7: 48px  --space-8: 64px
```

Ancho máximo de columna de lectura: **640px** (equivalente a ~75 caracteres en cuerpo de texto).

---

## 3. Sistema Tipográfico

### 3.1. Tres familias con roles estrictos

| Rol | Familia | Uso |
|---|---|---|
| **Serif Editorial** | **Newsreader** (Google Fonts) | Cuerpo de la cita, frase final, cabecera del *masthead* |
| **Sans-Serif Grotesca** | **Inter** (Google Fonts) | Pistas dentro de los corchetes, UI, botones, metadatos |
| **Monoespaciada Técnica** | **JetBrains Mono** (Google Fonts) | Cronómetro, número de edición, estadísticas, indicador de longitud `_ _ _ _` |

> [!IMPORTANT]
> El contraste tipográfico **Serif (frase) vs Sans-Serif (pistas)** es una decisión funcional, no solo estética: permite al jugador distinguir instantáneamente qué es texto definitivo y qué es un enigma por resolver.

### 3.2. Escala Tipográfica

```
--text-xs:   12px / 1.4  (JetBrains Mono — datos técnicos)
--text-sm:   14px / 1.5  (Inter — metadatos, ayudas)
--text-base: 16px / 1.6  (Inter — pistas, UI)
--text-lg:   18px / 1.5  (Inter — pistas destacadas)
--text-xl:   20px / 1.4  (Newsreader — cuerpo de la cita)
--text-2xl:  26px / 1.3  (Newsreader — fragmentos de cita amplios)
--text-3xl:  36px / 1.1  (Newsreader — masthead / nombre del juego)
--text-4xl:  48px / 1.0  (Newsreader — titular edición especial)
```

### 3.3. El Masthead (Cabecera)

Emula la cabecera de un periódico clásico mediante **filetes tipográficos** con líneas dobles:

```
══════════════════════════════════════════════════════════════════════
MARTES, 20 DE OCTUBRE DE 2026          EDICIÓN DIARIA          N.º 00142
──────────────────────────────────────────────────────────────────────
                          C O R C H E T E S
                    El juego de reconstrucción léxica
══════════════════════════════════════════════════════════════════════
```

Implementado en CSS con `border-top: 3px solid` + `border-bottom: 1px solid` para el doble filete.

---

## 4. Arquitectura UX/UI

### 4.1. Layout General (Desktop)

```
┌─────────────────────────────────────────────────────────────┐
│  MASTHEAD: Fecha · Edición N.º · Nombre del juego           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ZONA DE LA CITA (max-width: 640px, centrada)              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  «...texto fijo... [PISTA ACTIVA] ...texto... »       │  │
│  │  — Autor, Obra (Año)                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  BARRA DE ENTRADA (siempre visible, anclada visualmente)   │
│  ┌────────────────────────────────────┬──────────────────┐  │
│  │  Escribe aquí...          7 letras │  [Enviar / ↵]    │  │
│  └────────────────────────────────────┴──────────────────┘  │
│  [Solicitar matriz]                         [Revelar término]│
├─────────────────────────────────────────────────────────────┤
│  PIE: Estadísticas del día · Icono modo noche · Racha       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2. Layout Mobile (320px–768px)

```
┌────────────────────────────┐
│  MASTHEAD (comprimido)      │
│  N.º 142 · 20 Oct          │
├────────────────────────────┤
│                            │
│  ZONA DE LA CITA           │
│  (scroll vertical libre)   │
│  «...texto...              │
│   [PISTA ACTIVA]           │
│   ...texto...»             │
│  — Autor, Obra             │
│                            │
├────────────────────────────┤
│  BARRA DE ENTRADA          │  ← Anclada sobre el teclado
│  [Input──────────] [↵]    │     con position: sticky
│  Matriz · Revelar          │     bottom: 0
└────────────────────────────┘
│  ← Teclado virtual →      │
└────────────────────────────┘
```

> [!TIP]
> En mobile, usar `window.visualViewport` API para detectar la altura real del viewport cuando el teclado virtual sube, y ajustar dinámicamente la posición `bottom` del input. Esto evita el `viewport jump` clásico en iOS Safari.

### 4.3. Estados Visuales de los Corchetes

| Estado | Visual | Color | Peso |
|---|---|---|---|
| **BLOQUEADO** (tiene hijos sin resolver) | `[texto de pista...]` | `--color-ink-muted` | Regular |
| **ACTIVO / HOJA** (resoluble ahora) | `[texto de pista...]` | `--color-active` | Semibold + bg suave |
| **RESUELTO** (animación de entrada) | `palabra` | `--color-ink` | Italic + subrayado punteado (1.5s) |
| **RESUELTO** (estado final) | `palabra` | `--color-ink` | Normal, integrado |
| **REVELADO con ayuda** | `palabra†` | `--color-alert` | Normal + marca `†` |

### 4.4. Animaciones («Linotipia»)

Todas las animaciones siguen la curva `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.

1. **Colapso de corchete al acertar:**
   - El texto del corchete se contrae horizontalmente (`scaleX: 1 → 0`, `width: auto → 0`) en `200ms`.
   - La palabra resuelta aparece con `opacity: 0 → 1` + tipografía *Newsreader italic* + `text-decoration: underline dashed` en `300ms`.
   - Tras `1500ms`, la cursiva se funde en Newsreader regular eliminando el subrayado en `400ms`.

2. **Error de respuesta (Shake):**
   - El input vibra: `transform: translateX(-4px) → translateX(4px)` × 3 ciclos en `300ms total`.
   - El borde del input cambia a `--color-alert` durante `600ms`.

3. **Desbloqueo de pista padre (Cascade):**
   - Una vez el último hijo se resuelve, el corchete padre parpadea suavemente con `--color-active-bg` durante `400ms` antes de activarse visualmente.

4. **Dimming contextual (hover/focus):**
   - Al pasar el cursor sobre un corchete activo, el resto del párrafo baja su `opacity` a `0.35` en `150ms`.
   - El corchete activo y su padre inmediato mantienen `opacity: 1`.

5. **Pantalla de cierre de edición:**
   - El input inferior se transforma en la «Nota Editorial» con un `height` animado de `64px → auto` + fade-in de contenido en `500ms`.

---

## 5. Motor de Juego (Frontend Logic)

### 5.1. Estructura de Datos: El Árbol de Nodos

```typescript
type ClueType = 
  | 'definition'    // Definición directa
  | 'anagram'       // Letras desordenadas
  | 'reverse'       // Se lee al revés
  | 'palindrome'    // Simétrico
  | 'container'     // La solución está contenida dentro de otra palabra
  | 'morphological' // Extremos de palabras
  | 'reference'     // Referencia cultural
  | 'polysemy';     // Doble sentido

interface ClueNode {
  id: string;                    // "n1", "n2", "n3"...
  clueText: string;              // Texto de la pista (con refs a hijos: {{n3}})
  children: string[];            // IDs de nodos hijo
  parent: string | null;         // ID del nodo padre (null = raíz)
  type: ClueType;
  // Campos de seguridad (ver sección 9):
  solutionHash: string;          // SHA-256(normalizado + salt)
  solutionCipher: string;        // AES-GCM(solución_original, normalizado)
  // Estado en runtime (NO viaja desde servidor):
  isResolved: boolean;           // false por defecto
  isActive: boolean;             // true si todos los hijos están resueltos
  revealedWithHint: boolean;     // false por defecto
  resolvedText: string | null;   // Texto descifrado al acertar
}

interface PuzzleState {
  puzzleId: string;
  editionNumber: number;
  publishDate: string;           // ISO date
  rootTemplate: string;          // Texto con {{n1}}, {{n2}} como placeholders
  nodes: Record<string, ClueNode>;
  // Estado global:
  startedAt: number;             // Date.now()
  completedAt: number | null;
  hintsUsed: Array<{ nodeId: string; type: 'matrix' | 'reveal'; at: number }>;
  mistakesCount: number;
  score: number;                 // 0-100
  // Metadata (revelada solo al terminar):
  quoteAuthor: string;
  quoteWork: string;
  quoteYear: number;
  editorialNote: string;
}
```

### 5.2. Parser (Markup → AST)

El editor escribe la cita con corchetes anidados en un lenguaje de marcado simple:

```
«Caminante, [no hay [camino [de baldosas amarillas]] antes de andar]»
```

El parser utiliza una **pila (stack)** para construir el árbol:

```typescript
function parsePuzzleMarkup(markup: string): ClueNode[] {
  const stack: ClueNode[] = [];
  const nodes: ClueNode[] = [];
  let nodeCounter = 0;
  let currentText = '';

  for (const char of markup) {
    if (char === '[') {
      // Nuevo nivel: apilar contexto actual
      const newNode: ClueNode = {
        id: `n${++nodeCounter}`,
        clueText: '',
        children: [],
        parent: stack[stack.length - 1]?.id ?? null,
        // ...resto de campos
      };
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(newNode.id);
      }
      stack.push(newNode);
      currentText = '';
    } else if (char === ']') {
      // Cerrar nivel: desapilar
      const closedNode = stack.pop()!;
      closedNode.clueText = currentText;
      nodes.push(closedNode);
      currentText = '';
    } else {
      currentText += char;
    }
  }
  return nodes;
}
```

### 5.3. Motor de Estado: Resolución y Cascada

```typescript
function onSubmit(input: string, state: PuzzleState): PuzzleState {
  const normalized = normalize(input); // minúsculas, sin tildes, sin ñ→n NO, ñ se mantiene
  
  // Obtener nodos activos (hojas sin resolver)
  const activeNodes = getActiveNodes(state);
  
  for (const node of activeNodes) {
    const candidateHash = sha256(normalized + ':' + state.puzzleId + ':' + node.id + ':' + DAILY_SALT);
    
    if (candidateHash === node.solutionHash) {
      // ✓ ACIERTO
      const resolvedText = aesGcmDecrypt(node.solutionCipher, normalized);
      state = resolveNode(state, node.id, resolvedText);
      state = recalculateActiveNodes(state); // Cascade upward
      state = updateScore(state, 'correct');
      return state;
    }
  }
  
  // ✗ ERROR
  state.mistakesCount++;
  state = updateScore(state, 'mistake');
  emitShakeAnimation();
  return state;
}
```

### 5.4. Normalización de Input (Reglas Específicas del Español)

```typescript
function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    // Tildes → vocal base (PERO preservar Ñ)
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    // Ü → u (diéresis en pingüino) - ya cubierto por la regla de ú/ù/ü/û
    // Ñ → NO se normaliza, es grafema propio
    // Signos de apertura → eliminar
    .replace(/[¿¡]/g, '')
    // Números: se aceptan como texto o dígito (se normalizan al dígito)
    .replace(/\buno\b/g, '1').replace(/\bdos\b/g, '2')
    // ... etc.
    .trim();
}
```

> [!IMPORTANT]
> La `Ñ` **nunca** se normaliza a `N`. Es un grafema independiente. Si el jugador escribe "canon" cuando la respuesta es "cañón", debe contar como error (aunque sin tilde sí se acepta: "canon" ≠ "cañon" → "cañon" normalizado = "canon"... esperar feedback real de jugadores para afinar esta regla).

### 5.5. Sistema de Puntuación (0–100)

```
Base:          100 puntos
Por cada error:  -5 puntos (máximo -40)
Por cada 'Solicitar matriz': -8 puntos
Por cada 'Revelar término': -15 puntos
Penalización por tiempo: -1 punto por cada 30s después de los 3 minutos (máximo -10)
```

### 5.6. Sistema de Rangos (Medieval-Literario)

| Puntuación | Rango |
|---|---|
| 100 | **Gran Maestro** |
| 85–99 | **Maestro** |
| 65–84 | **Cronista** |
| 40–64 | **Escriba** |
| 0–39 | **Aprendiz** |

---

## 6. Stack Tecnológico

### 6.1. Frontend

| Capa | Tecnología | Justificación |
|---|---|---|
| **Framework** | **Next.js 15** (App Router) | SSR para SEO, Route Handlers para API proxy, `@vercel/og` para fichas sociales |
| **Lenguaje** | **TypeScript 5** | Tipado estricto, fundamental para el AST del puzle |
| **Estilos** | **CSS Modules** + **CSS Custom Properties** | Sin dependencia de Tailwind; tokens como variables CSS nativas; máximo control tipográfico |
| **Animaciones** | **Motion** (antes Framer Motion) | `layout` animations para el colapso de corchetes; `AnimatePresence` |
| **Estado Global** | **Zustand** | Ligero, sin boilerplate de Redux; ideal para el estado del árbol de corchetes |
| **Fuentes** | **`next/font`** con Google Fonts | Optimización automática, sin CLS ni FOUT |
| **Validación** | **Zod** | Tipado en runtime de los payloads del servidor |

### 6.2. Backend

| Capa | Tecnología | Justificación |
|---|---|---|
| **Runtime** | **Node.js 22 LTS** | |
| **Framework** | **Fastify 5** | 2× más rápido que Express; tipado con TypeScript nativo; JSON Schema validation |
| **Base de Datos** | **Supabase (PostgreSQL 16)** | Row Level Security nativo; Auth incluido; Edge Functions disponibles |
| **Caché / Stats** | **Upstash Redis** (serverless) | Redis-compatible; no requiere instancia dedicada; ideal para Sorted Sets de percentiles |
| **Imágenes OG** | **`@vercel/og`** (Satori) | Genera la ficha hemerográfica en el edge, sin servidor de imágenes separado |
| **Deploy Frontend** | **Vercel** | Edge Network nativo con Next.js; fácil invalidación de caché |
| **Deploy Backend** | **Railway** o **Render** | Servidor Node.js dedicado sin los límites de las serverless functions |
| **CDN** | **Cloudflare** (delante de todo) | Caché del payload del puzle diario; WAF; Rate Limiting |

### 6.3. Herramientas de Desarrollo

| Herramienta | Uso |
|---|---|
| **Turborepo** | Monorepo: `apps/web`, `apps/api`, `apps/cms`, `packages/core` |
| **Vitest** | Tests unitarios del motor de juego y el parser |
| **Playwright** | Tests e2e de la experiencia de juego |
| **Prettier + ESLint** | Formato y linting |
| **Docker Compose** | Entorno de desarrollo local (PostgreSQL + Redis local) |

### 6.4. Estructura del Monorepo

```
corchetes/
├── apps/
│   ├── web/          ← Next.js 15 (juego público)
│   ├── api/          ← Fastify 5 (backend API)
│   └── cms/          ← Next.js (back-office editorial, ruta privada)
└── packages/
    ├── core/         ← Motor de juego, parser, normalización (TypeScript puro)
    ├── ui/           ← Componentes compartidos web/cms
    ├── db/           ← Esquemas Drizzle ORM + migraciones
    └── crypto/       ← Hash y AES-GCM (compartido front/back)
```

---

## 7. Arquitectura de Backend

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CLIENTE WEB / PWA                               │
│                    (Next.js en Vercel)                              │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CDN / EDGE LAYER (Cloudflare + Vercel Edge)            │
│  ┌──────────────────────┐   ┌────────────────────────────────────┐  │
│  │ Caché payload diario │   │ Edge: Ficha hemerográfica (@og)    │  │
│  │ TTL: hasta medianoche│   │ Edge: Validación rate limit básica │  │
│  └──────────────────────┘   └────────────────────────────────────┘  │
└───────────────────────────────┬────────────────────────────────────┘
                                │ Cache MISS → origen
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API BACKEND (Fastify / Railway)                   │
│                                                                     │
│  ┌────────────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│  │  /puzzle           │  │  /session       │  │  /admin (CMS)  │   │
│  │  GET /today        │  │  POST /start    │  │  CRUD puzles   │   │
│  │  GET /:id          │  │  POST /complete │  │  Auth: JWT     │   │
│  │  (payload cifrado) │  │  POST /hint     │  │  admin-only    │   │
│  └────────────────────┘  └─────────────────┘  └────────────────┘   │
│                                                                     │
│  ┌────────────────────┐  ┌─────────────────┐                        │
│  │  /stats            │  │  /community     │                        │
│  │  GET /today/dist   │  │  GET /:shortId  │                        │
│  │  GET /user/history │  │  POST /create   │                        │
│  └────────────────────┘  └─────────────────┘                        │
└────────────────┬────────────────────┬──────────────────────────────┘
                 │                    │
    ┌────────────▼──────┐    ┌───────▼────────────────┐
    │  Supabase         │    │  Upstash Redis         │
    │  (PostgreSQL 16)  │    │  (Estadísticas diarias)│
    │  - puzzles        │    │  ZSET: tiempos         │
    │  - users          │    │  Contadores: errores   │
    │  - play_sessions  │    │  Rate limiting         │
    │  - node_analytics │    │  TTL: reset medianoche │
    │  - community_puzz │    └────────────────────────┘
    └───────────────────┘
```

### 7.1. Endpoints Principales

#### `GET /api/puzzle/today`
- Responde con el `client_payload` (árbol cifrado, sin soluciones en texto plano).
- Cacheado por Cloudflare hasta `00:00` hora española.
- Incluye: `editionNumber`, `publishDate`, nodos con `solutionHash` + `solutionCipher`, texto del `rootTemplate`.

#### `POST /api/session/start`
- Crea un registro `play_session` en DB.
- Devuelve `sessionId` (UUID corto).
- Acepta `anonymousId` (desde `localStorage`) o `userId` (si autenticado).

#### `POST /api/session/complete`
- Body: `{ sessionId, duration_ms, mistakes, hintsUsed, score, rank }`.
- Actualiza la play_session en PostgreSQL.
- Ejecuta `ZADD` en Redis con el tiempo de resolución.
- Ejecuta `ZCOUNT` para calcular el percentil y lo devuelve en la respuesta.

#### `POST /api/session/hint`
- Body: `{ sessionId, nodeId, hintType: 'matrix' | 'reveal' }`.
- Para `'reveal'`: el servidor devuelve la solución en texto plano (único momento donde el servidor la envía desencriptada, solo tras solicitud explícita del usuario).

#### `GET /api/stats/today/distribution`
- Devuelve histograma de tiempos del día actual (desde Redis).
- Usado para el gráfico de percentil en el cierre de edición.

#### `POST /api/community/create`
- Body: `{ markup, creatorAlias }`.
- El servidor compila el markup → AST → genera payload cifrado.
- Devuelve `{ shortId: 'x8k9p2m1', url: 'corchetes.es/r/x8k9p2m1' }`.

---

## 8. Base de Datos

### 8.1. Esquema PostgreSQL (Drizzle ORM)

```sql
-- Puzles oficiales
CREATE TABLE puzzles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_number  INT UNIQUE NOT NULL,
  publish_date    DATE UNIQUE NOT NULL,
  raw_markup      TEXT NOT NULL,         -- El texto original con corchetes
  compiled_ast    JSONB NOT NULL,        -- AST completo con soluciones (solo servidor)
  client_payload  JSONB NOT NULL,        -- AST ofuscado con hashes+AES (público)
  quote_author    VARCHAR(200),
  quote_work      VARCHAR(300),
  quote_year      INT,
  editorial_note  TEXT,                  -- Contexto cultural revelado al final
  difficulty_score FLOAT,               -- Calculado por el CMS (0.0 - 1.0)
  max_depth       INT,                   -- Profundidad máxima del árbol
  total_nodes     INT,
  initial_leaves  INT,
  status          VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SCHEDULED, PUBLISHED
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  published_at    TIMESTAMPTZ
);

-- Usuarios
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE,
  display_name    VARCHAR(100),
  anonymous_id    UUID UNIQUE,           -- Fusionado si se registra
  created_at      TIMESTAMPTZ DEFAULT now(),
  streak_current  INT DEFAULT 0,
  streak_max      INT DEFAULT 0,
  total_plays     INT DEFAULT 0,
  total_wins      INT DEFAULT 0
);

-- Sesiones de juego (una por usuario/día)
CREATE TABLE play_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id       UUID REFERENCES puzzles(id),
  user_id         UUID REFERENCES users(id),   -- NULL si anónimo
  anonymous_id    UUID,
  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  mistakes_count  INT DEFAULT 0,
  hints_used      JSONB DEFAULT '[]',           -- [{nodeId, type, at_ms}]
  score           INT,                          -- 0-100
  rank_achieved   VARCHAR(50),
  is_complete     BOOLEAN DEFAULT FALSE,
  UNIQUE (puzzle_id, user_id),                 -- Un juego por día por usuario
  UNIQUE (puzzle_id, anonymous_id)
);

-- Analytics por nodo (qué pistas atascan a la gente)
CREATE TABLE node_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id       UUID REFERENCES puzzles(id),
  node_id         VARCHAR(20) NOT NULL,
  total_attempts  INT DEFAULT 0,
  total_fails     INT DEFAULT 0,
  hints_requested INT DEFAULT 0,
  reveals_used    INT DEFAULT 0,
  avg_time_to_solve_ms INT,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (puzzle_id, node_id)
);

-- Puzles de la comunidad
CREATE TABLE community_puzzles (
  id              VARCHAR(8) PRIMARY KEY,       -- NanoID corto: "x8k9p2m1"
  creator_alias   VARCHAR(100),
  raw_markup      TEXT NOT NULL,
  client_payload  JSONB NOT NULL,
  plays_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  is_flagged      BOOLEAN DEFAULT FALSE
);

-- Índices
CREATE INDEX idx_puzzles_publish_date ON puzzles(publish_date);
CREATE INDEX idx_play_sessions_puzzle_user ON play_sessions(puzzle_id, user_id);
CREATE INDEX idx_node_analytics_puzzle ON node_analytics(puzzle_id);
```

### 8.2. Row Level Security (Supabase RLS)

```sql
-- Los usuarios solo pueden ver sus propias sesiones
ALTER TABLE play_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_sessions" ON play_sessions
  FOR ALL USING (auth.uid() = user_id);

-- El compiled_ast nunca sale del servidor (columna excluida en cliente)
-- Se logra con una VIEW pública que omite compiled_ast:
CREATE VIEW public_puzzles AS
  SELECT id, edition_number, publish_date, client_payload,
         quote_author, quote_work, quote_year, editorial_note,
         difficulty_score, max_depth, total_nodes, initial_leaves
  FROM puzzles WHERE status = 'PUBLISHED';
```

---

## 9. Seguridad y Anti-Spoiler

### 9.1. Arquitectura Híbrida de Validación (Latencia 0 + Sin Spoilers)

**Problema:** Si el JSON del puzle contiene las soluciones en texto plano, cualquier usuario puede verlas en DevTools. Si cada intento requiere una llamada al servidor, la experiencia degrada con mala conexión.

**Solución:**

```
SERVIDOR (en compilación del puzle):
  Para cada nodo con solución "sendero":
    normalized = normalize("sendero") = "sendero"
    salt = DAILY_SALT_2026_10_20  (rotado diariamente, público)
    
    solutionHash   = SHA-256(normalized + ":" + puzzleId + ":" + nodeId + ":" + salt)
    solutionCipher = AES-GCM-encrypt(plaintext: "Sendero", key: normalized)
    
    → En client_payload: { solutionHash, solutionCipher }  (sin "sendero")

CLIENTE (al intentar resolver):
  userInput = normalize("SENDERO") = "sendero"
  candidateHash = SHA-256("sendero:puzzle123:n3:DAILY_SALT")
  
  if (candidateHash === node.solutionHash):
    resolvedText = AES-GCM-decrypt(node.solutionCipher, key: "sendero")
    // → "Sendero" (con mayúsculas/tildes originales para mostrar)
    ✓ Instante. Sin red. Sin spoilers.
```

**¿Qué hay en DevTools?**
- `solutionHash`: Un hash SHA-256 de 64 caracteres hex. Sin la normalización y el salt, es computacionalmente irreversible.
- `solutionCipher`: Texto cifrado con AES-GCM. Sin la clave (que es la propia respuesta), indescifrable.

### 9.2. Protección contra Brute Force

El `DAILY_SALT` es una cadena aleatoria de 32 bytes generada el día anterior y publicada con el payload del puzle. Un atacante que quiera hacer fuerza bruta sobre el vocabulario español (~500.000 palabras) tendría que calcular 500.000 SHA-256 por cada nodo. Es técnicamente posible pero requiere esfuerzo deliberado y no es el perfil de amenaza real de un juego de entretenimiento. Si se quiere reforzar, se puede usar **Argon2id** en lugar de SHA-256 (con cost factor 1 para que sea tolerable en cliente pero costoso en fuerza bruta).

### 9.3. Rate Limiting

Cloudflare WAF: máximo 60 peticiones/minuto por IP al endpoint `/api/session/hint` (que es el único que devuelve la solución en claro).

---

## 10. CMS Editorial

### 10.1. Flujo de Creación de un Puzle

```
Editor escribe markup en textarea
         ↓
Parser en tiempo real → Preview interactiva
         ↓
Analizador de complejidad automático:
  - Profundidad máxima
  - Nodos hoja iniciales
  - Métricas de dificultad estimada
  - Alertas: "Solo 1 nodo activo inicial → posible bloqueo total"
  - Alertas: "2 nodos activos con solución idéntica"
         ↓
Editor añade metadatos: autor, obra, año, nota editorial
         ↓
[Guardar borrador] → status: DRAFT
[Programar publicación] → status: SCHEDULED + publish_date
         ↓
Cron Job (00:00 h diario):
  - Publica el puzle del día (status → PUBLISHED)
  - Llama a Cloudflare API → purga caché /api/puzzle/today
  - Envía notificación push (futuro)
```

### 10.2. Interfaz del CMS

El CMS es una aplicación Next.js en una ruta privada (`/admin`) o un dominio separado (`cms.corchetes.es`), protegida por autenticación de administrador (Supabase Auth con rol `admin`).

Pantallas principales:
- **Editor de Puzle:** Textarea con markup + preview en tiempo real lado a lado.
- **Cola Editorial:** Calendario de ediciones programadas. Vista de semana.
- **Analytics:** Para cada puzle publicado, gráficos de distribución de tiempos, errores por nodo, tasa de abandono.
- **Biblioteca:** Historial de todas las ediciones con búsqueda.

---

## 11. Sistema de Estadísticas

### 11.1. Percentil en Tiempo Real (Redis)

```
Al completar una partida (tiempo: 138 segundos):
  
  BACKEND:
    ZADD stats:edition:142:times 138 <sessionId>
    ZCOUNT stats:edition:142:times 0 138  → X  (cuántos terminaron más rápido o igual)
    ZCARD stats:edition:142:times         → Total
    percentile = Math.round((X / Total) * 100)
    → "Has sido más rápido que el 78% de los lectores"

  Al final del día (Cron 00:01 h):
    Volcar stats a PostgreSQL (tabla edition_stats)
    DEL stats:edition:142:*  (liberar memoria Redis)
```

### 11.2. Datos Mostrados al Terminar (Cierre de Edición)

```
┌──────────────────────────────────────────────────────┐
│  «Caminante, no hay camino, se hace camino al andar» │
│  — Antonio Machado, Proverbios y Cantares (1912)     │
│                                                      │
│  Machado escribió estos versos como parte de...      │
│  [2-3 líneas de contexto cultural editorial]          │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Tu edición · N.º 142                                │
│  Tiempo          02m 18s  ──────────────── (78%)     │
│  Precisión       92%      ─────────────── (84%)      │
│  Rango           ████████████  MAESTRO               │
│                                                      │
│  [Copiar crónica]          [Nueva partida mañana]    │
└──────────────────────────────────────────────────────┘
```

Las barras de percentil son líneas horizontales de `1px` de grosor, puramente tipográficas.

---

## 12. Compartición y Ficha Hemerográfica

### 12.1. Formato Texto (Tipográfico / ASCII)

Al pulsar «Copiar crónica», se copia al portapapeles:

```
CORCHETES — Edición N.º 142
Martes, 20 de octubre de 2026
──────────────────────────────
Estructura · [ [ · ] [ [ · ] † ] ]
Precisión  · 92 %  (1 consulta al archivo)
Tiempo     · 02m 18s
Rango      · Maestro
──────────────────────────────
corchetes.es
```

**Leyenda de la línea «Estructura»:**
- `[...]` → nivel de anidamiento
- `·` → nodo resuelto limpiamente
- `†` → nodo donde se usó ayuda (sin revelar la palabra)

### 12.2. Ficha Hemerográfica (Imagen OG)

Generada con `@vercel/og` (Satori) en el edge al llamar a `/api/og/142`.

Aspecto visual: **ficha de biblioteca clásica** / recorte de prensa con sello tipográfico.

Contenido:
- Número de edición y fecha
- Nombre del autor de la cita (sin mostrar la cita)
- Árbol minimalista de nodos (círculos conectados, monocromático)
- Sello con el rango obtenido (ej. `■ MAESTRO`)
- URL: `corchetes.es`

---

## 13. Hoja de Ruta (Roadmap)

### Fase 0 — Fundación (Semanas 1–2)
- [ ] Setup del monorepo (Turborepo + TypeScript)
- [ ] Package `core`: parser, motor de juego, normalización, hash/AES
- [ ] Tests unitarios del `core` (Vitest, cobertura >90%)
- [ ] Setup Supabase: esquema DB + migraciones (Drizzle)
- [ ] Setup Upstash Redis
- [ ] Setup Vercel + Railway + Cloudflare

### Fase 1 — MVP del Juego (Semanas 3–5)
- [ ] API Fastify: endpoints `/puzzle/today`, `/session/*`
- [ ] Frontend Next.js: layout, masthead, zona de la cita
- [ ] Componente recursivo de renderizado de corchetes
- [ ] Input y motor de validación cliente
- [ ] Animaciones de linotipia
- [ ] Persistencia en `localStorage` (estado mid-game)
- [ ] Pantalla de cierre de edición
- [ ] 5 puzles de prueba con citas literarias en español

### Fase 2 — CMS y Editorial (Semanas 6–7)
- [ ] App `/admin` con editor de markup + preview
- [ ] Analizador de complejidad automático
- [ ] Cola de publicación y cron job
- [ ] Integración Cloudflare Cache Purge API

### Fase 3 — Usuarios y Estadísticas (Semanas 8–9)
- [ ] Auth (Magic Link + Google OAuth) con Supabase Auth
- [ ] Fusión sesión anónima → cuenta
- [ ] Racha diaria en servidor
- [ ] Sistema de percentiles Redis → Cierre de edición
- [ ] Dashboard de estadísticas personales

### Fase 4 — Compartición y Comunidad (Semanas 10–11)
- [ ] Generación ficha hemerográfica con `@vercel/og`
- [ ] «Copiar crónica» (texto tipográfico)
- [ ] Modo creador de retos (markup → NanoID URL)

### Fase 5 — Pulido y Lanzamiento (Semana 12)
- [ ] PWA: Service Worker, instalación en móvil, offline mid-game
- [ ] Tests e2e (Playwright)
- [ ] Modo día/noche por hora
- [ ] SEO: sitemap, meta tags dinámicos, Schema.org
- [ ] Auditoría de accesibilidad (WCAG 2.1 AA)
- [ ] Lanzamiento beta cerrada

---

## 14. Decisiones de Producto Clave

| Aspecto | Decisión |
|---|---|
| **Nombre** | Corchetes |
| **Frontend** | Next.js 15 (App Router) + TypeScript + CSS Modules |
| **Backend** | Fastify 5 (Node.js 22) en Railway |
| **Base de datos** | Supabase (PostgreSQL 16) con Drizzle ORM |
| **Caché / Estadísticas** | Upstash Redis (Sorted Sets) |
| **Tipografía Serif** | Newsreader |
| **Tipografía Sans** | Inter |
| **Tipografía Mono** | JetBrains Mono |
| **Paleta base** | Papel prensa cálido (#F7F4EF) / Carbón profundo (#141413) |
| **Modo día/noche** | Activado por hora del reloj, no por sistema |
| **Emojis** | Prohibidos. Sustitución: tipografía Unicode + ficha hemerográfica |
| **Rangos** | Aprendiz → Escriba → Cronista → Maestro → Gran Maestro |
| **Anti-spoiler** | SHA-256 hash + AES-GCM en cliente; solución nunca en texto plano en red |
| **Identidad de usuario** | Anónima por defecto; fusión transparente al registrarse |
| **Contenido** | CMS privado solo para editores; comunidad con retos por URL |
| **MVP Scope** | Completo: juego + registro + creador + CMS |
| **Monorepo** | Turborepo: `apps/web`, `apps/api`, `apps/cms`, `packages/core` |
