'use client'

import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type ReactElement,
} from 'react'
import type { User } from '@supabase/supabase-js'
import {
  signInWithMagicLink,
  signInWithGoogle,
  signOutUser,
  getCurrentUser,
  onAuthStateChange,
} from '../../lib/supabase'
import styles from './AuthDrawer.module.css'

export interface AuthDrawerProps {
  /** Indica si el drawer/modal está visible */
  isOpen: boolean
  /** Callback para cerrar el panel */
  onClose: () => void
  /** Callback opcional notificado cuando cambia el usuario autenticado */
  onUserChange?: (user: User | null) => void
}

/**
 * Panel lateral / drawer editorial para registro e inicio de sesión de lectores.
 * Permite identificación mediante Google OAuth o Magic Link por email sin abandonar la partida.
 */
export function AuthDrawer({
  isOpen,
  onClose,
  onUserChange,
}: AuthDrawerProps): ReactElement | null {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Cargar usuario actual y suscribir a cambios de sesión
  useEffect(() => {
    let mounted = true

    void getCurrentUser().then((user) => {
      if (mounted) {
        setCurrentUser(user)
        onUserChange?.(user)
      }
    })

    const { unsubscribe } = onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      if (mounted) {
        setCurrentUser(u)
        onUserChange?.(u)
        if (u) {
          setStatusMessage(null)
        }
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [onUserChange])

  // Cierre con la tecla Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  // ── Manejadores de autenticación ───────────────────────────────────

  const handleMagicLinkSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatusMessage(null)

    if (!email.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Por favor, escribe tu correo electrónico.',
      })
      return
    }

    setLoading(true)
    try {
      const { error } = await signInWithMagicLink(email)
      if (error) {
        setStatusMessage({
          type: 'error',
          text: error.message || 'Error al enviar el enlace. Inténtalo de nuevo.',
        })
      } else {
        setStatusMessage({
          type: 'success',
          text: 'Enlace enviado. Revisa tu bandeja de entrada para iniciar sesión.',
        })
        setEmail('')
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Ocurrió un error inesperado de conexión.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setStatusMessage(null)
    setLoading(true)
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setStatusMessage({
          type: 'error',
          text: error.message || 'Error al conectar con Google OAuth.',
        })
        setLoading(false)
      }
      // Si tiene éxito, Supabase redirige automáticamente al flujo de Google
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Ocurrió un error al contactar con el proveedor de autenticación.',
      })
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    setStatusMessage(null)
    try {
      const { error } = await signOutUser()
      if (error) {
        setStatusMessage({
          type: 'error',
          text: 'No se pudo cerrar la sesión.',
        })
      } else {
        setCurrentUser(null)
        onUserChange?.(null)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-drawer-title"
    >
      <aside
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Drawer */}
        <header className={styles.header}>
          <div className={styles.doubleRuleTop} aria-hidden="true" />
          <div className={styles.headerRow}>
            <span className={styles.categoryLabel}>REGISTRO DE LECTOR</span>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Cerrar panel de identificación"
            >
              [cerrar]
            </button>
          </div>
          <h2 id="auth-drawer-title" className={styles.title}>
            Tu archivo personal
          </h2>
          <p className={styles.subtitle}>
            Guarda tu racha diaria, conserva tus crónicas y sincroniza tus progresos en cualquier dispositivo.
          </p>
        </header>

        {/* Contenido según estado de autenticación */}
        <div className={styles.content}>
          {currentUser ? (
            <div className={styles.loggedInSection}>
              <div className={styles.sessionStatusBadge}>
                <span className={styles.statusBullet}>·</span> Sesión activa
              </div>
              <p className={styles.userEmail}>{currentUser.email}</p>
              <p className={styles.userNote}>
                Tus crónicas y estadísticas quedan asociadas a esta dirección.
              </p>
              <button
                type="button"
                className={styles.signOutButton}
                onClick={handleSignOut}
                disabled={loading}
              >
                {loading ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </div>
          ) : (
            <div className={styles.authForms}>
              {/* Botón de Google OAuth */}
              <button
                type="button"
                className={styles.googleButton}
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg
                  className={styles.googleIcon}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </button>

              {/* Separador tipográfico editorial */}
              <div className={styles.divider}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerText}>o con enlace a tu correo</span>
                <div className={styles.dividerLine} />
              </div>

              {/* Formulario de Magic Link */}
              <form onSubmit={handleMagicLinkSubmit} className={styles.magicForm}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="auth-email-input" className={styles.label}>
                    Dirección de correo
                  </label>
                  <input
                    id="auth-email-input"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lector@ejemplo.es"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={loading}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? 'Enviando enlace…' : 'Enviar enlace de acceso'}
                </button>
              </form>

              {/* Mensajes de retroalimentación */}
              {statusMessage && (
                <div
                  className={
                    statusMessage.type === 'success'
                      ? styles.messageSuccess
                      : styles.messageError
                  }
                  role="status"
                >
                  {statusMessage.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie editorial */}
        <footer className={styles.footer}>
          <div className={styles.doubleRuleBottom} aria-hidden="true" />
          <p className={styles.privacyNote}>
            Corchetes no envía publicidad ni comparte tus datos. El acceso se realiza de forma directa sin contraseñas que recordar.
          </p>
        </footer>
      </aside>
    </div>
  )
}
