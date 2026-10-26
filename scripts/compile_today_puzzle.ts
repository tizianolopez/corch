import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { normalize, parsePuzzleMarkup, type ClientPayload } from '@corchetes/core'
import { compilePuzzlePayload, type RawPuzzle, type RawPuzzleNode } from '@corchetes/crypto'

const quote =
  'Bajo el solemne cielo de Aravá, Isaac Rabin y Abdelsalam al-Majali sellan en 1994 la paz definitiva entre Israel y Jordania.'

const markup =
  'Bajo el [Sello menos formal que [Brota como consecuencia tras el paso del [Lo que todo lo cura sin recetar remedios]] majestuoso y grave] [Techo azul donde [Ocupan morada [Lejanos en el espacio y en la memoria] que residen en el mundo] las estrellas y las aves] de Aravá, Isaac [Sabio hebreo leído al revés en la [[Inmune al profano roce de lo cotidiano] recinto donde se congregan los fieles hebreos]]n y Abdel[Espacio principal donde se recibe a las visitas [Brillan con luz propia los personajes célebres y memorables]]m al-[Maravilla de [Fría piedra noble que inmortaliza al gran escultor] blanco que corona la India]i [Cierran con pacto firme lo que otros ya [Validaron con su rúbrica el pacto definitivo y sellado]] en 1994 la [[Profunda ausencia de sonido que habita en la calma] anhelado que precede a las grandes treguas] [Delimitó con precisión exacta los contornos del concepto]tiva [En medio de dos mundos sin tocar ninguno] Israel y [Cauce sagrado donde el Bautista sumergió al Mesías]ia.'

const nodesData: Record<string, { solution: string; type: any; reasoning: string }> = {
  n1: { solution: 'solemne', type: 'anagram', reasoning: 'Anagrama de sello menos que da como resultado solemne.' },
  n2: { solution: 'resulta', type: 'definition', reasoning: 'Significado verbal de derivar o acontecer sin caer en literalidad escolar.' },
  n3: { solution: 'tiempo', type: 'polysemy', reasoning: 'Juego con el refrán popular de que el tiempo todo lo cura.' },
  n4: { solution: 'cielo', type: 'definition', reasoning: 'Uso poético y metafórico para definir el firmamento.' },
  n5: { solution: 'habitan', type: 'definition', reasoning: 'Describe la acción de vivir en un lugar utilizando sinónimos poéticos.' },
  n6: { solution: 'aquellos', type: 'definition', reasoning: 'Apunta a la distancia temporal y espacial del pronombre.' },
  n7: { solution: 'Rabi', type: 'reverse', reasoning: 'Inversión y juego con letras hebreas para Rabin.' },
  n8: { solution: 'sinagoga', type: 'reference', reasoning: 'Evoca el templo de reunión judío mediante un contexto cultural claro.' },
  n9: { solution: 'Sagrado', type: 'polysemy', reasoning: 'Contrasta lo divino y apartado de lo mundano.' },
  n10: { solution: 'sala', type: 'definition', reasoning: 'Definición literaria de la estancia principal de una casa.' },
  n11: { solution: 'ilustres', type: 'polysemy', reasoning: 'Doble sentido entre la luz física y la fama intelectual.' },
  n12: { solution: 'Majal', type: 'reference', reasoning: 'Referencia cultural al Taj Mahal.' },
  n13: { solution: 'mármol', type: 'reference', reasoning: 'Evoca el material clásico del arte escultórico.' },
  n14: { solution: 'sellan', type: 'polysemy', reasoning: 'Juego con la acción de estampar un sello o clausurar un acuerdo.' },
  n15: { solution: 'firmaron', type: 'definition', reasoning: 'Acto de suscribir un documento con un tono literario.' },
  n16: { solution: 'paz', type: 'reference', reasoning: 'Concepto filosófico y literario asociado al cese de conflictos.' },
  n17: { solution: 'Silencio', type: 'polysemy', reasoning: 'Explora la naturaleza intangible de la quietud acústica.' },
  n18: { solution: 'defini', type: 'definition', reasoning: 'Fijar los límites de algo en definitiva.' },
  n19: { solution: 'entre', type: 'polysemy', reasoning: 'Preposición que indica posición intermedia.' },
  n20: { solution: 'Jordan', type: 'reference', reasoning: 'Referencia bíblica al río Jordán.' },
}

async function run() {
  const parseResult = parsePuzzleMarkup(markup)
  const rawNodes: Record<string, RawPuzzleNode> = {}

  for (const [id, parsed] of Object.entries(parseResult.nodes)) {
    const meta = nodesData[id]
    if (!meta) throw new Error(`Falta nodo ${id}`)
    rawNodes[id] = {
      id,
      clueText: parsed.clueText,
      children: parsed.children,
      parent: parsed.parent,
      type: meta.type,
      solution: meta.solution,
    }
  }

  const rawPuzzle: RawPuzzle = {
    puzzleId: 'corchetes-2026-10-26',
    editionNumber: 1,
    publishDate: '2026-10-26',
    rootTemplate: parseResult.rootTemplate,
    nodes: rawNodes,
    quoteAuthor: '',
    quoteWork: 'Tratado de Paz de Aravá',
    quoteYear: 1994,
    editorialNote:
      'El 26 de octubre de 1994, Isaac Rabin y Abdelsalam al-Majali sellaron la paz histórica en el valle de Aravá, poniendo fin a 46 años de estado de beligerancia entre Israel y Jordania.',
  }

  const dailySalt = 'salt-2026-10-26'
  const payload: ClientPayload = await compilePuzzlePayload(rawPuzzle, dailySalt, normalize)

  // Guardar en data/puzzles/today_2026-10-26.json
  const outDir = path.resolve(process.cwd(), 'data', 'puzzles')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  const outFile = path.join(outDir, 'today_2026-10-26.json')
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`✓ Puzle compilado y guardado en: ${outFile}`)

  // También guardar el rawPuzzle completo (con soluciones) para el servidor/CMS
  const rawFile = path.join(outDir, 'raw_2026-10-26.json')
  fs.writeFileSync(rawFile, JSON.stringify(rawPuzzle, null, 2), 'utf-8')
  console.log(`✓ RawPuzzle guardado en: ${rawFile}`)
}

run().catch(console.error)
