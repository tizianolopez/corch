import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CANONICAL_SOLUTIONS: Record<string, { solution: string; initialLetter: string }> = {
  n1: { solution: 'afuera', initialLetter: 'A' },
  n2: { solution: 'dentro', initialLetter: 'D' },
  n3: { solution: 'secreto', initialLetter: 'S' },
  n4: { solution: 'amor', initialLetter: 'A' },
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nodeId, hintType } = body

    const nodeData = CANONICAL_SOLUTIONS[nodeId]

    if (hintType === 'matrix') {
      return NextResponse.json({
        success: true,
        hintType: 'matrix',
        nodeId,
        initialLetter: nodeData?.initialLetter || '?',
      })
    }

    if (hintType === 'reveal') {
      return NextResponse.json({
        success: true,
        hintType: 'reveal',
        nodeId,
        solution: nodeData?.solution || '',
      })
    }

    return NextResponse.json({ error: 'Tipo de pista no válido' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Error al procesar pista' }, { status: 400 })
  }
}
