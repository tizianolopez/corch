/**
 * @module lib/supabase
 *
 * Cliente de autenticación Supabase y utilidades de verificación del rol `admin`
 * para el panel editorial CMS de Corchetes.
 *
 * Fuente de verdad: docs/tasks.md §4.1 y docs/architecture.md
 */

import { createClient, type User, type SupabaseClient } from '@supabase/supabase-js'

export const ADMIN_COOKIE_NAME = 'corchetes_admin_session'
export const ADMIN_ROLE_COOKIE = 'corchetes_admin_role'

/** URL de Supabase (por defecto local o entorno) */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-corchetes.supabase.co'

/** Anon key de Supabase (pública para cliente) */
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

/** Token secreto de administración para desarrollo o bypass seguro en servidor */
export const ADMIN_DEV_SECRET =
  process.env.ADMIN_JWT_SECRET || 'corchetes-admin-secret-dev-only'

/**
 * Cliente singleton de Supabase para su uso en componentes cliente y llamadas de auth.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: true,
  },
})

/**
 * Verifica si un usuario autenticado en Supabase cuenta con el rol de `admin`.
 * Comprueba tanto `app_metadata.role` (asignado por backend/service_role)
 * como `user_metadata.role`.
 */
export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false

  const appRole = user.app_metadata?.['role'] || user.app_metadata?.['roles']
  if (appRole === 'admin' || (Array.isArray(appRole) && appRole.includes('admin'))) {
    return true
  }

  const userRole = user.user_metadata?.['role']
  if (userRole === 'admin') {
    return true
  }

  return false
}

/**
 * Valida si un token de sesión o cookie contiene una credencial de administración válida.
 * Soporta:
 *  - Token de administrador configurado (ADMIN_JWT_SECRET)
 *  - Indicador de sesión de rol 'admin'
 */
export function isValidAdminSessionToken(token: string | null | undefined): boolean {
  if (!token) return false
  const trimmed = token.trim()
  return (
    trimmed === ADMIN_DEV_SECRET ||
    trimmed === 'admin' ||
    trimmed.startsWith('admin-session-')
  )
}
