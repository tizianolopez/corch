import { NextResponse } from 'next/server'
import { TUTORIAL_SOLUTIONS, TODAY_SOLUTIONS } from '../../../../src/data/puzzles'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nodeId, hintType, puzzleId } = body

    const solutions =
      puzzleId === 'corchetes-tutorial'
        ? TUTORIAL_SOLUTIONS
        : TODAY_SOLUTIONS

    const solution =
      solutions[nodeId] ||
      (TODAY_SOLUTIONS[nodeId] ?? TUTORIAL_SOLUTIONS[nodeId])

    const initialLetter = solution ? solution.charAt(0).toUpperCase() : '?'

    if (hintType === 'matrix') {
      return NextResponse.json({
        success: true,
        hintType: 'matrix',
        nodeId,
        initialLetter,
      })
    }

    if (hintType === 'reveal') {
      return NextResponse.json({
        success: true,
        hintType: 'reveal',
        nodeId,
        solution: solution || '',
      })
    }

    return NextResponse.json({ error: 'Tipo de pista no válido' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Error al procesar pista' }, { status: 400 })
  }
}
