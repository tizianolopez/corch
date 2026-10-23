# Guía de Despliegue en Producción y Protocolo de Beta Cerrada

Este documento detalla los pasos operativos, configuraciones de infraestructura, reglas de red y el protocolo de beta cerrada para el lanzamiento de **Corchetes** (`corchetes.es`).

---

## 1. Arquitectura de Infraestructura

```text
                                  ┌────────────────────────┐
                                  │      Cloudflare DNS    │
                                  │   (corchetes.es + WAF) │
                                  └───────────┬────────────┘
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
          ┌─────────────────────┐                           ┌─────────────────────┐
          │       Vercel        │                           │       Railway       │
          │   apps/web (Next)   │                           │  apps/api (Fastify) │
          └──────────┬──────────┘                           └──────────┬──────────┘
                     │                                                 │
                     ▼                                                 ▼
          ┌─────────────────────┐                           ┌─────────────────────┐
          │    Supabase Auth    │                           │  Supabase Postgres  │
          │ (Magic Link/OAuth)  │                           │   + Upstash Redis   │
          └─────────────────────┘                           └─────────────────────┘
```

---

## 2. Configuración en Cloudflare (`corchetes.es`)

### 2.1 Enrutamiento DNS
- **Dominio raíz y web:**
  - Tipo: `CNAME` | Nombre: `@` | Contenido: `cname.vercel-dns.com` | Proxy: **Activado (Naranja)**
  - Tipo: `CNAME` | Nombre: `www` | Contenido: `cname.vercel-dns.com` | Proxy: **Activado (Naranja)**
- **API backend:**
  - Tipo: `CNAME` | Nombre: `api` | Contenido: `[dominio-generado-por-railway].up.railway.app` | Proxy: **Activado (Naranja)**

### 2.2 SSL/TLS y Seguridad
1. **Modo de cifrado:** `Full (Strict)`.
2. **HSTS:** Activado (Max-Age: 1 año / 31536000s, incluir subdominios y precarga).
3. **Versión mínima de TLS:** TLS 1.2 (recomendado TLS 1.3 con 0-RTT).
4. **Always Use HTTPS:** Activado.
5. **Bot Fight Mode:** Activado.

### 2.3 Reglas de Caché (Cloudflare Cache Rules)

#### Regla 1: Caché agresiva del puzle diario en el Edge
- **Condición:**
  - `(http.request.uri.path eq "/api/puzzle/today" or http.request.uri.path eq "/puzzle/today")`
- **Configuración de caché:**
  - **Cache eligibility:** *Cache everything*.
  - **Edge Cache TTL:** *Respect origin headers* (el backend Fastify emite dinámicamente `s-maxage` calculando los segundos exactos restantes hasta la medianoche de Madrid, asegurando renovación automática a las 00:00:00).
  - **Browser Cache TTL:** *Bypass by default* o *1 hour*.

#### Regla 2: Bypass obligatorio para sesiones, analíticas y autenticación
- **Condición:**
  - `(http.request.uri.path starts_with "/api/session" or http.request.uri.path starts_with "/api/auth" or http.request.uri.path eq "/api/community/create")`
- **Configuración:**
  - **Cache eligibility:** *Bypass cache*.

### 2.4 Reglas de WAF y Rate Limiting

#### Regla de Rate Limiting 1: Protección de envíos de respuestas
- **Condición:** `(http.request.uri.path eq "/api/session/submit" and http.request.method eq "POST")`
- **Límite:** 60 solicitudes por minuto por dirección IP.
- **Acción:** *Block* (código 429) durante 60 segundos.

#### Regla de Rate Limiting 2: Creación de retos comunitarios
- **Condición:** `(http.request.uri.path eq "/api/community/create" and http.request.method eq "POST")`
- **Límite:** 10 solicitudes por minuto por dirección IP.
- **Acción:** *Managed Challenge*.

---

## 3. Despliegue del Frontend en Vercel (`apps/web`)

1. **Vincular repositorio:** Conectar el repositorio monorepo en Vercel.
2. **Configuración del proyecto:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install` (desde la raíz del monorepo mediante Turbo)
3. **Variables de Entorno en Vercel:**
   ```bash
   NODE_ENV=production
   NEXT_PUBLIC_APP_URL=https://corchetes.es
   NEXT_PUBLIC_API_URL=https://api.corchetes.es
   NEXT_PUBLIC_SUPABASE_URL=https://[TU-PROYECTO].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[TU-ANON-KEY-DE-SUPABASE]
   ```
4. **Verificación de Headers y PWA:**
   - Confirmar que `apps/web/vercel.json` aplica `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y cabeceras `Cache-Control: no-cache` para el Service Worker (`/sw.js`).

---

## 4. Despliegue del Backend en Railway (`apps/api`)

1. **Crear servicio en Railway:** Seleccionar "Deploy from GitHub repo" y especificar el directorio `apps/api`.
2. **Configuración del Build:**
   - Railway detectará automáticamente el archivo `apps/api/Dockerfile` multi-stage y el archivo `railway.json`.
   - **Healthcheck Path:** `/health`
   - **Restart Policy:** `ON_FAILURE` (máximo 5 reintentos).
3. **Variables de Entorno en Railway:**
   ```bash
   NODE_ENV=production
   PORT=4000
   FASTIFY_ADDRESS=0.0.0.0
   CORS_ORIGIN=https://corchetes.es
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
   SUPABASE_URL=https://[TU-PROYECTO].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[TU-SERVICE-ROLE-KEY-PRIVADA]
   UPSTASH_REDIS_REST_URL=https://[TU-INSTANCIA].upstash.io
   UPSTASH_REDIS_REST_TOKEN=[TU-REDIS-TOKEN]
   GEMINI_API_KEY=[TU-GEMINI-API-KEY]
   GEMINI_MODEL=gemini-1.5-flash
   LOG_LEVEL=info
   ```
4. **Dominio personalizado:** Vincular el dominio `api.corchetes.es` en la pestaña de Networking de Railway.

---

## 5. Migraciones de Base de Datos y Carga de Puzles Iniciales (Seed)

Una vez conectada la base de datos de producción (Supabase Postgres):

1. **Ejecutar migraciones Drizzle:**
   ```bash
   DATABASE_URL="tu-connection-string" npm run db:migrate --workspace=@corchetes/db
   ```
2. **Sembrar los 7 puzles de la semana inaugural:**
   ```bash
   DATABASE_URL="tu-connection-string" npm run db:seed --workspace=@corchetes/db
   ```
3. **Verificación inmediata:**
   Comprobar que el endpoint devuelve el payload criptográfico seguro sin exponer soluciones:
   ```bash
   curl -I https://api.corchetes.es/api/puzzle/today
   # Debe retornar: HTTP/2 200 con Cache-Control: public, max-age=..., s-maxage=...
   ```

---

## 6. Protocolo de Beta Cerrada (20 a 50 Usuarios)

### 6.1 Objetivos de la Beta
- **Validar el balance de dificultad:** Analizar si el 70-85% de los jugadores completa el puzle y la distribución de rangos (Gran Maestro vs. Cronista).
- **Comportamiento en dispositivos móviles:** Comprobar la experiencia táctil, apertura del teclado virtual y ausencia de saltos de zoom involuntarios (`touch-action: manipulation`).
- **Rendimiento offline y PWA:** Confirmar que jugadores que abren la app en el metro o sin cobertura pueden resolver el puzle cacheado.
- **Fusión de sesiones:** Verificar que usuarios anónimos que juegan y posteriormente introducen su correo fusionan correctamente sus estadísticas y racha.

### 6.2 Perfil del Grupo de Control
- 10-15 amantes de los crucigramas tradicionales y pasatiempos de prensa.
- 10-15 lectores habituales o entusiastas de la literatura en español.
- 10-15 perfiles casuales de Wordle o juegos lexicales diarios.

### 6.3 Plantilla de Invitación (Email / Mensajería)

```text
Asunto: Invitación exclusiva a la beta cerrada de Corchetes

Hola [Nombre],

Te invitamos a probar en primicia «Corchetes», un nuevo juego lingüístico y literario diario en español inspirado en la tradición de los claudàtors y crucigramas crípticos.

Enlace de acceso a la beta:
👉 https://corchetes.es

¿En qué consiste?
Cada día a las 00:00 se publica una cita célebre donde varias palabras clave han sido sustituidas por pistas ingeniosas entre corchetes anidados [...]. Tu objetivo es resolver los corchetes interiores para desbloquear el contexto que te permitirá resolver los exteriores.

Instrucciones para la prueba:
1. Accede preferiblemente desde tu móvil (o navegador de escritorio).
2. Resuelve el puzle de hoy sin prisas (se resuelve de dentro hacia afuera).
3. Si te quedas atascado, utiliza las pistas de longitud o primera letra.
4. Al terminar, puedes compartir tu crónica y registrarte con tu correo para guardar tu racha.

Tu opinión es fundamental. Al completar tu primera partida, te agradeceremos enormemente que respondas a este breve cuestionario de 2 minutos:
👉 [Enlace a Formulario de Feedback]

¡Muchas gracias por acompañarnos en este lanzamiento!
```

### 6.4 Cuestionario de Feedback de la Beta (4 Preguntas Clave)

1. **Claridad de la mecánica (1 al 5):** ¿Entendiste de inmediato que debías resolver los corchetes interiores antes de los exteriores?
2. **Nivel de dificultad (1 al 5):** ¿El enigma te pareció:
   - 1 = Demasiado evidente
   - 3 = Nivel óptimo de ingenio y reto
   - 5 = Imposible sin gastar todas las pistas
3. **Sensación del teclado e interfaz:** ¿Tuviste algún problema visual, lentitud o dificultad al escribir desde el móvil?
4. **Comentarios libres:** ¿Qué pista te pareció más brillante y cuál te generó confusión?

### 6.5 Criterios de Éxito para Apertura Pública
- [ ] 0 errores críticos en Sentry / logs de Railway.
- [ ] Tasa de compleción del puzle ≥ 70%.
- [ ] Tiempo medio de resolución entre 3 y 8 minutos.
- [ ] Cero discrepancias en la normalización de la letra 'ñ'.
- [ ] Cache hit ratio en Cloudflare para `/api/puzzle/today` > 90%.
