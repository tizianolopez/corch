import { describe, it, expect } from 'vitest'
import { normalize, normalizedEquals } from '../normalize.js'

describe('normalize', () => {
  it('convierte mayúsculas a minúsculas', () => {
    expect(normalize('HOLA MUNDO')).toBe('hola mundo')
    expect(normalize('CORCHETES')).toBe('corchetes')
  })

  it('elimina tildes en vocales base (á, é, í, ó, ú)', () => {
    expect(normalize('canción')).toBe('cancion')
    expect(normalize('árbol')).toBe('arbol')
    expect(normalize('murciélago')).toBe('murcielago')
    expect(normalize('río')).toBe('rio')
    expect(normalize('último')).toBe('ultimo')
  })

  it('PRESERVA siempre la letra Ñ (tanto mayúscula como minúscula)', () => {
    expect(normalize('CAÑÓN')).toBe('cañon')
    expect(normalize('año')).toBe('año')
    expect(normalize('Ñandú')).toBe('ñandu')
    expect(normalize('español')).toBe('español')
    // Comprobar que "cañon" no es igual a "canon"
    expect(normalize('cañón')).not.toBe(normalize('canon'))
  })

  it('elimina diéresis (ü -> u)', () => {
    expect(normalize('pingüino')).toBe('pinguino')
    expect(normalize('bilingüe')).toBe('bilingue')
    expect(normalize('vergüenza')).toBe('verguenza')
  })

  it('elimina signos de apertura y cierre (¿, ¡, ?, !)', () => {
    expect(normalize('¿dónde?')).toBe('donde')
    expect(normalize('¡adelante!')).toBe('adelante')
    expect(normalize('¿¡qué!?')).toBe('que')
  })

  it('reduce espacios múltiples y hace trim', () => {
    expect(normalize('   hola    mundo   ')).toBe('hola mundo')
  })

  it('convierte palabras numéricas a dígitos', () => {
    expect(normalize('uno')).toBe('1')
    expect(normalize('una')).toBe('1')
    expect(normalize('dos')).toBe('2')
    expect(normalize('tres')).toBe('3')
    expect(normalize('cuatro')).toBe('4')
    expect(normalize('cinco')).toBe('5')
    expect(normalize('diez')).toBe('10')
    expect(normalize('quince')).toBe('15')
    expect(normalize('veinte')).toBe('20')
    expect(normalize('cien')).toBe('100')
    expect(normalize('mil')).toBe('1000')
    expect(normalize('tres tristes tigres')).toBe('3 tristes tigres')
  })

  it('no sustituye subcadenas que no sean palabras numéricas completas', () => {
    // "unos" no debe ser "1s", "doscientos" no debe ser "2cientos"
    expect(normalize('unos')).toBe('unos')
    expect(normalize('camino')).toBe('camino')
  })
})

describe('normalizedEquals', () => {
  it('retorna true para variaciones ortográficas equivalentes', () => {
    expect(normalizedEquals('Canción', 'cancion')).toBe(true)
    expect(normalizedEquals('¿DÓNDE?', 'donde')).toBe(true)
    expect(normalizedEquals('Pingüino', 'pinguino')).toBe(true)
    expect(normalizedEquals('tres', '3')).toBe(true)
  })

  it('retorna false cuando la letra Ñ o la raíz difiere', () => {
    expect(normalizedEquals('cañón', 'canon')).toBe(false)
    expect(normalizedEquals('año', 'ano')).toBe(false)
    expect(normalizedEquals('hola', 'adios')).toBe(false)
  })
})
