import type { NextRequest } from 'next/server'
import { renderOgImage } from '../../../../src/lib/og/generateOgImage'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ editionNumber: string }> }
) {
  const resolvedParams = await params
  const editionNumber = resolvedParams?.editionNumber || 'today'
  const searchParams = request.nextUrl.searchParams

  const date = searchParams.get('date') ?? undefined
  const author = searchParams.get('author') ?? undefined
  const work = searchParams.get('work') ?? undefined
  const year = searchParams.get('year') ?? undefined
  const rank = searchParams.get('rank') ?? undefined
  const score = searchParams.get('score') ?? undefined
  const precision = searchParams.get('precision') ?? undefined
  const time = searchParams.get('time') ?? undefined
  const structure = searchParams.get('structure') ?? undefined

  return renderOgImage({
    editionNumber,
    date,
    author,
    work,
    year,
    rank,
    score,
    precision,
    time,
    structure,
  })
}
