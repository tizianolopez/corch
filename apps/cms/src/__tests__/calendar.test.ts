import { describe, it, expect } from 'vitest'
import { generateDaySlots, type CalendarPuzzle } from '../../app/admin/calendar/page'

describe('Calendario de Publicación (Fase 4.3)', () => {
  it('generateDaySlots genera N días consecutivos a partir de la fecha base', () => {
    const baseDate = new Date('2026-10-22T10:00:00Z')
    const slots = generateDaySlots(baseDate, 7)

    expect(slots).toHaveLength(7)
    expect(slots[0]?.dateStr).toBe('2026-10-22')
    expect(slots[1]?.dateStr).toBe('2026-10-23')
    expect(slots[6]?.dateStr).toBe('2026-10-28')

    for (const slot of slots) {
      expect(slot.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof slot.dayName).toBe('string')
    }
  })

  it('asigna correctamente los puzles existentes a sus casillas por fecha', () => {
    const baseDate = new Date('2026-10-22T10:00:00Z')
    const slots = generateDaySlots(baseDate, 3)

    const mockPuzzles: CalendarPuzzle[] = [
      {
        id: 'puz-22',
        editionNumber: 10,
        publishDate: '2026-10-22',
        status: 'PUBLISHED',
        source: 'AI',
        quoteAuthor: 'Cervantes',
        quoteWork: 'Quijote',
        quoteYear: 1605,
        rawMarkup: 'Frase 22',
      },
      {
        id: 'puz-24',
        editionNumber: 11,
        publishDate: '2026-10-24',
        status: 'SCHEDULED',
        source: 'AI',
        quoteAuthor: 'Machado',
        quoteWork: 'Campos de Castilla',
        quoteYear: 1912,
        rawMarkup: 'Frase 24',
      },
    ]

    const mappedSlots = slots.map((slot) => ({
      ...slot,
      puzzle: mockPuzzles.find((p) => p.publishDate === slot.dateStr),
    }))

    // Día 22: tiene puzle PUBLISHED
    expect(mappedSlots[0]?.puzzle?.id).toBe('puz-22')
    expect(mappedSlots[0]?.puzzle?.status).toBe('PUBLISHED')

    // Día 23: vacío
    expect(mappedSlots[1]?.puzzle).toBeUndefined()

    // Día 24: tiene puzle SCHEDULED
    expect(mappedSlots[2]?.puzzle?.id).toBe('puz-24')
    expect(mappedSlots[2]?.puzzle?.status).toBe('SCHEDULED')
  })
})
