import { describe, it, expect } from 'vitest'

interface PuzzleLibraryItem {
  id: string
  editionNumber: number
  publishDate: string
  status: string
  source: string
  quoteAuthor: string | null
  quoteWork: string | null
  rawMarkup: string
}

export function filterLibrary(
  items: PuzzleLibraryItem[],
  filters: {
    status?: string
    source?: string
    search?: string
  },
): PuzzleLibraryItem[] {
  const searchTerm = filters.search?.trim().toLowerCase()

  return items.filter((item) => {
    if (filters.status && filters.status !== 'ALL' && item.status !== filters.status) {
      return false
    }
    if (filters.source && filters.source !== 'ALL' && item.source !== filters.source) {
      return false
    }
    if (searchTerm) {
      const corpus = [
        item.quoteAuthor ?? '',
        item.quoteWork ?? '',
        item.rawMarkup ?? '',
        String(item.editionNumber),
        item.publishDate,
      ]
        .join(' ')
        .toLowerCase()
      if (!corpus.includes(searchTerm)) {
        return false
      }
    }
    return true
  })
}

export function calculateAbandonmentRate(started: number, completed: number): number {
  if (started <= 0) return 0
  if (completed >= started) return 0
  return Math.round(((started - completed) / started) * 100)
}

describe('CMS Analytics & Library Helpers (Fase 4.5)', () => {
  const samplePuzzles: PuzzleLibraryItem[] = [
    {
      id: 'p1',
      editionNumber: 101,
      publishDate: '2026-10-21',
      status: 'PUBLISHED',
      source: 'AI',
      quoteAuthor: 'Neil Armstrong',
      quoteWork: 'Misión Lunar',
      rawMarkup: 'En [1969] la [misión] pisó la Luna.',
    },
    {
      id: 'p2',
      editionNumber: 102,
      publishDate: '2026-10-22',
      status: 'DRAFT',
      source: 'MANUAL',
      quoteAuthor: 'Miguel de Cervantes',
      quoteWork: 'El Quijote',
      rawMarkup: 'En un [lugar de [la Mancha]] de cuyo nombre...',
    },
    {
      id: 'p3',
      editionNumber: 103,
      publishDate: '2026-10-23',
      status: 'SCHEDULED',
      source: 'AI',
      quoteAuthor: 'Federico García Lorca',
      quoteWork: 'Romancero Gitano',
      rawMarkup: 'Verde que te [quiero [verde]]...',
    },
  ]

  it('filtra puzles por fuente (AI vs MANUAL)', () => {
    const aiOnly = filterLibrary(samplePuzzles, { source: 'AI' })
    expect(aiOnly.length).toBe(2)
    expect(aiOnly.every((p) => p.source === 'AI')).toBe(true)

    const manualOnly = filterLibrary(samplePuzzles, { source: 'MANUAL' })
    expect(manualOnly.length).toBe(1)
    expect(manualOnly[0]?.quoteAuthor).toBe('Miguel de Cervantes')
  })

  it('filtra puzles por estado editorial', () => {
    const drafts = filterLibrary(samplePuzzles, { status: 'DRAFT' })
    expect(drafts.length).toBe(1)
    expect(drafts[0]?.id).toBe('p2')

    const scheduled = filterLibrary(samplePuzzles, { status: 'SCHEDULED' })
    expect(scheduled.length).toBe(1)
    expect(scheduled[0]?.id).toBe('p3')
  })

  it('busca coincidencias por texto libre en autor, obra o contenido', () => {
    const searchLorca = filterLibrary(samplePuzzles, { search: 'lorca' })
    expect(searchLorca.length).toBe(1)
    expect(searchLorca[0]?.editionNumber).toBe(103)

    const searchMancha = filterLibrary(samplePuzzles, { search: 'Mancha' })
    expect(searchMancha.length).toBe(1)
    expect(searchMancha[0]?.quoteAuthor).toBe('Miguel de Cervantes')
  })

  it('calcula la tasa de abandono correctamente', () => {
    expect(calculateAbandonmentRate(100, 85)).toBe(15) // 15% abandono
    expect(calculateAbandonmentRate(50, 50)).toBe(0)
    expect(calculateAbandonmentRate(0, 0)).toBe(0)
  })
})
