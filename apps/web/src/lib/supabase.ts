/**
 * @module lib/supabase
 *
 * Cliente Supabase y funciones de autenticación para jugadores de Corchetes:
 * - Magic Link por correo electrónico
 * - Google OAuth
 * - Consulta y escucha del estado de sesión
 *
 * Fuente de verdad: docs/tasks.md §4.2 (Fase 5.2) y docs/architecture.md
 */

import {
  createClient,
  type SupabaseClient,
  type User,
  type Session,
  type AuthChangeEvent,
} from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zwmvlvzwjypdlyfkngzh.supabase.co'

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bXZsdnp3anlwZGx5ZmtuZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NDE5OTAsImV4cCI6MjEwODMxNzk5MH0.tT3ZSO_Ay3nARr8XJZupmhK0bUnnTYPctyRRUtPMDcg'

/**
 * Cliente singleton de Supabase para apps/web con persistencia en localStorage.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: true,
  },
})

/**
 * Inicia sesión o registra al usuario mediante Magic Link enviado a su correo electrónico.
 */
export async function signInWithMagicLink(
  email: string,
  redirectTo?: string,
): Promise<{ error: Error | null }> {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { error: new Error('Introduce una dirección de correo electrónico válida.') }
  }

  const callbackUrl =
    redirectTo ||
    (typeof window !== 'undefined' ? `${window.location.origin}/` : undefined)

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      emailRedirectTo: callbackUrl,
    },
  })

  return { error: error ? new Error(error.message) : null }
}

/**
 * Inicia el flujo de autenticación federada con Google OAuth.
 */
export async function signInWithGoogle(
  redirectTo?: string,
): Promise<{ url?: string; error: Error | null }> {
  const callbackUrl =
    redirectTo ||
    (typeof window !== 'undefined' ? `${window.location.origin}/` : undefined)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
    },
  })

  if (error) {
    return { error: new Error(error.message) }
  }

  return { url: data?.url ?? undefined, error: null }
}

/**
 * Cierra la sesión activa del usuario.
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut()
  return { error: error ? new Error(error.message) : null }
}

/**
 * Obtiene el usuario autenticado actualmente en la sesión del cliente.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      return null
    }
    return data.user
  } catch {
    return null
  }
}

/**
 * Suscribe un observador a los cambios de estado de autenticación (login, logout, token refresh).
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return {
    unsubscribe: () => data.subscription.unsubscribe(),
  }
}
