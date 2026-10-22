'use client'

import { useState, Suspense, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  supabase,
  isAdminUser,
  ADMIN_COOKIE_NAME,
  ADMIN_ROLE_COOKIE,
  ADMIN_DEV_SECRET,
} from '../../../src/lib/supabase'
import styles from './login.module.css'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTarget = searchParams?.get('redirect') || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guarda las cookies administrativas locales
  const setAdminCookies = (sessionToken: string) => {
    document.cookie = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(
      sessionToken,
    )}; path=/; max-age=86400; SameSite=Lax`
    document.cookie = `${ADMIN_ROLE_COOKIE}=admin; path=/; max-age=86400; SameSite=Lax`
  }

  // Inicio de sesión con Supabase Auth
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        throw new Error(authError.message)
      }

      const user = data.user
      if (!isAdminUser(user)) {
        throw new Error(
          'Acceso denegado: El usuario no cuenta con el rol de administrador.',
        )
      }

      const token = data.session?.access_token || ADMIN_DEV_SECRET
      setAdminCookies(token)
      router.push(redirectTarget)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Acceso directo para desarrollo local (permite probar sin configurar Supabase)
  const handleDevBypass = () => {
    setAdminCookies(ADMIN_DEV_SECRET)
    router.push(redirectTarget)
    router.refresh()
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.masthead}>Corchetes</h1>
        <p className={styles.subtitle}>Supervisión Editorial CMS</p>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="editor@corchetes.es"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className={styles.input}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={styles.btnPrimary}
        >
          {loading ? 'Accediendo...' : 'Iniciar sesión editorial'}
        </button>

        <div className={styles.divider}>
          <span>O bien</span>
        </div>

        <button
          type="button"
          onClick={handleDevBypass}
          className={styles.btnDev}
        >
          Acceso Rápido de Desarrollo (Local Dev)
        </button>
      </form>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div className={styles.card}>Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
