import dotenv from 'dotenv'
import { z } from 'zod'

// Cargar variables de entorno desde .env si existe
dotenv.config()

/**
 * Esquema de validación para las variables de entorno de apps/api
 */
export const envSchema = z.object({
  /** Puerto del servidor HTTP */
  PORT: z.coerce.number().int().positive().default(4000),

  /** Host en el que escucha el servidor */
  HOST: z.string().default('0.0.0.0'),

  /** Entorno de ejecución */
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  /** Nivel de log para Pino */
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  /** Orígenes CORS permitidos (separados por coma o URL individual) */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  /** Cadena de conexión PostgreSQL (Supabase o Docker Compose local) */
  DATABASE_URL: z.string().optional(),

  /** Clave de servicio de Supabase (solo servidor) */
  SUPABASE_SERVICE_KEY: z.string().optional(),

  /** URL de conexión REST a Upstash Redis */
  UPSTASH_REDIS_URL: z.string().optional(),

  /** Token de autorización REST a Upstash Redis */
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  /** Cloudflare Zone ID para invalidación de caché */
  CLOUDFLARE_ZONE_ID: z.string().optional(),

  /** Token API de Cloudflare con permisos de purge_cache */
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  /** Secreto para firmar tokens de administración (CMS) */
  ADMIN_JWT_SECRET: z.string().default('corchetes-admin-secret-dev-only'),
})

export type AppConfig = z.infer<typeof envSchema>

/**
 * Lee y valida las variables de entorno actuales.
 * En caso de error de validación, lanza un error descriptivo.
 */
export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const parsed = envSchema.safeParse({
    ...process.env,
    ...overrides,
  })

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `Error en la configuración de entorno de @corchetes/api:\n${errorDetails}`,
    )
  }

  return parsed.data
}

export const config = loadConfig()
