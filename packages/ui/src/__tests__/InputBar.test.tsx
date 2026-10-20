// @vitest-environment happy-dom
/**
 * Tests de InputBar — entorno happy-dom
 * Verifica: renderizado estático, renderizado DOM e interacciones.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InputBar } from '../components/InputBar/InputBar'

const noop = () => undefined

describe('InputBar — renderToStaticMarkup (SSR)', () => {
  it('renderiza el campo de texto y el botón Enviar', () => {
    const html = renderToStaticMarkup(<InputBar onSubmit={noop} />)
    expect(html).toContain('data-testid="answer-input"')
    expect(html).toContain('Enviar')
  })

  it('muestra los botones de ayuda cuando se pasan callbacks', () => {
    const html = renderToStaticMarkup(
      <InputBar
        onSubmit={noop}
        onHintMatrix={() => undefined}
        onHintReveal={() => undefined}
      />,
    )
    expect(html).toContain('Solicitar matriz')
    expect(html).toContain('Revelar término')
  })

  it('no muestra los botones de ayuda sin callbacks', () => {
    const html = renderToStaticMarkup(<InputBar onSubmit={noop} />)
    expect(html).not.toContain('Solicitar matriz')
    expect(html).not.toContain('Revelar término')
  })

  it('renderiza con el placeholder por defecto', () => {
    const html = renderToStaticMarkup(<InputBar onSubmit={noop} />)
    expect(html).toContain('Escribe tu respuesta')
  })

  it('renderiza con placeholder personalizado', () => {
    const html = renderToStaticMarkup(
      <InputBar onSubmit={noop} placeholder="Tu respuesta aquí" />,
    )
    expect(html).toContain('Tu respuesta aqu')
  })
})

describe('InputBar — interacciones DOM (happy-dom)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('el botón Enviar está deshabilitado cuando el input está vacío', () => {
    render(<InputBar onSubmit={noop} />)
    const btn = screen.getByRole('button', { name: /enviar/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('el botón Enviar se habilita al escribir en el input', () => {
    render(<InputBar onSubmit={noop} />)
    const input = screen.getByTestId('answer-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'quijote' } })
    const btn = screen.getByRole('button', { name: /enviar/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('llama a onSubmit con el valor trimmed y vacía el campo', () => {
    const onSubmit = vi.fn()
    render(<InputBar onSubmit={onSubmit} />)
    const input = screen.getByTestId('answer-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: ' dulcinea ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('dulcinea')
    expect(input.value).toBe('')
  })

  it('llama a onSubmit al hacer clic en el botón Enviar', () => {
    const onSubmit = vi.fn()
    render(<InputBar onSubmit={onSubmit} />)
    const input = screen.getByTestId('answer-input')
    fireEvent.change(input, { target: { value: 'quijote' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }))
    expect(onSubmit).toHaveBeenCalledWith('quijote')
  })

  it('muestra el indicador de longitud cuando se pasa expectedLength', () => {
    render(<InputBar onSubmit={noop} expectedLength={7} />)
    const input = screen.getByTestId('answer-input')
    fireEvent.change(input, { target: { value: 'hola' } })
    expect(screen.getByText('4/7')).toBeTruthy()
  })

  it('no muestra el indicador de longitud sin expectedLength', () => {
    render(<InputBar onSubmit={noop} />)
    expect(screen.queryByText(/\d+\/\d+/)).toBeNull()
  })

  it('todos los controles quedan disabled cuando disabled=true', () => {
    render(
      <InputBar
        onSubmit={noop}
        disabled
        onHintMatrix={() => undefined}
        onHintReveal={() => undefined}
      />,
    )
    const buttons = screen.getAllByRole('button') as HTMLButtonElement[]
    buttons.forEach((btn) => expect(btn.disabled).toBe(true))
    expect((screen.getByTestId('answer-input') as HTMLInputElement).disabled).toBe(true)
  })

  it('llama a onHintMatrix y onHintReveal al hacer clic', () => {
    const onMatrix = vi.fn()
    const onReveal = vi.fn()
    render(
      <InputBar
        onSubmit={noop}
        onHintMatrix={onMatrix}
        onHintReveal={onReveal}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /solicitar/i }))
    fireEvent.click(screen.getByRole('button', { name: /revelar/i }))
    expect(onMatrix).toHaveBeenCalledOnce()
    expect(onReveal).toHaveBeenCalledOnce()
  })

  it('vacía el campo tras un submit exitoso', () => {
    render(<InputBar onSubmit={noop} />)
    const input = screen.getByTestId('answer-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }))
    expect(input.value).toBe('')
  })

  it('aplica la clase de error cuando isError=true', () => {
    render(<InputBar onSubmit={noop} isError={true} />)
    const input = screen.getByTestId('answer-input')
    expect(input.className).toMatch(/inputError/)
  })

  it('activa la animación de error y se recupera tras 600ms vía ref imperativa', () => {
    let handle: { triggerError: () => void } | null = null
    render(
      <InputBar
        onSubmit={noop}
        ref={(r) => {
          handle = r
        }}
      />,
    )
    const input = screen.getByTestId('answer-input')
    expect(input.className).not.toMatch(/inputError/)

    act(() => {
      handle?.triggerError()
    })
    expect(input.className).toMatch(/inputError/)

    act(() => {
      vi.advanceTimersByTime(650)
    })
    expect(input.className).not.toMatch(/inputError/)
  })
})
