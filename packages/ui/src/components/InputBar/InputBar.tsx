'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import styles from './InputBar.module.css'

export interface InputBarProps {
  /** Texto del placeholder del campo de entrada */
  placeholder?: string
  /** Longitud esperada de la respuesta (para el indicador de longitud) */
  expectedLength?: number
  /** Si true, el componente no responde a interacciones */
  disabled?: boolean
  /** Si true, activa el estado visual de error y shake */
  isError?: boolean
  /** Callback al enviar el valor */
  onSubmit: (value: string) => void
  /** Callback al solicitar «Solicitar matriz» (hint de letra inicial) */
  onHintMatrix?: () => void
  /** Callback al solicitar «Revelar término» */
  onHintReveal?: () => void
  /** Si true, se aplica sticky bottom para móvil */
  sticky?: boolean
}

/**
 * Expone triggerError y focus para que el padre pueda activar la animación
 * o enfocar el input imperativamente.
 */
export interface InputBarHandle {
  triggerError: () => void
  focus: () => void
}

/**
 * Barra de entrada de respuestas del juego.
 * Controla el campo de texto, el indicador de longitud en JetBrains Mono,
 * la animación de shake en error, los botones de ayuda y el anclaje sticky
 * en móvil con ajuste de visualViewport para iOS.
 */
export const InputBar = forwardRef<InputBarHandle, InputBarProps>(function InputBar(
  {
    placeholder = 'Escribe tu respuesta…',
    expectedLength,
    disabled = false,
    isError: controlledError = false,
    onSubmit,
    onHintMatrix,
    onHintReveal,
    sticky = true,
  },
  ref,
): ReactElement {
  const [value, setValue] = useState('')
  const [internalError, setInternalError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isError = controlledError || internalError

  // ── Ajuste de posición por visualViewport (iOS keyboard) ─────────────────
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sticky || typeof window === 'undefined') return

    function handleViewportChange() {
      const vv = window.visualViewport
      if (!vv || !barRef.current) return
      // Offset from bottom of layout viewport to bottom of visual viewport
      const offsetFromBottom =
        window.innerHeight - vv.height - vv.offsetTop
      barRef.current.style.transform = offsetFromBottom > 0
        ? `translateY(-${offsetFromBottom}px)`
        : ''
    }

    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
    }
  }, [sticky])

  // ── Limpiar timer al desmontar ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  // ── Exponer el error visualmente (shake + borde rojo) ────────────────────
  const triggerError = useCallback(() => {
    setInternalError(true)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => {
      setInternalError(false)
    }, 600)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      triggerError,
      focus: () => inputRef.current?.focus(),
    }),
    [triggerError],
  )

  // ── Envío ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue('')
    inputRef.current?.focus()
  }, [value, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
  }, [])

  // ── Indicador de longitud ─────────────────────────────────────────────────
  const showLength = expectedLength !== undefined && expectedLength > 0
  const lengthMatch = showLength && value.trim().length === expectedLength

  // ── Clases del input ──────────────────────────────────────────────────────
  const inputClasses = [
    styles.input,
    isError ? styles.inputError : '',
  ]
    .filter(Boolean)
    .join(' ')

  // ── Clases del contenedor ─────────────────────────────────────────────────
  const barClasses = [
    styles.inputBar,
    sticky ? styles.inputBarSticky : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={barRef} className={barClasses} data-testid="input-bar">
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          id="corchetes-answer-input"
          type="text"
          className={inputClasses}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Campo de respuesta"
          data-testid="answer-input"
        />

        {showLength && (
          <span
            className={[
              styles.lengthIndicator,
              lengthMatch ? styles.lengthIndicatorMatch : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          >
            {value.trim().length}/{expectedLength}
          </span>
        )}

        <button
          id="corchetes-submit-btn"
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Enviar respuesta"
        >
          Enviar
        </button>
      </div>

      {(onHintMatrix || onHintReveal) && (
        <div className={styles.helpRow}>
          {onHintMatrix && (
            <button
              id="corchetes-hint-matrix-btn"
              className={styles.helpBtn}
              onClick={onHintMatrix}
              disabled={disabled}
              aria-label="Solicitar pista de letra inicial"
            >
              Solicitar matriz
            </button>
          )}
          {onHintReveal && (
            <button
              id="corchetes-hint-reveal-btn"
              className={[styles.helpBtn, styles.helpBtnReveal]
                .filter(Boolean)
                .join(' ')}
              onClick={onHintReveal}
              disabled={disabled}
              aria-label="Revelar término con penalización"
            >
              Revelar término
            </button>
          )}
        </div>
      )}
    </div>
  )
})
