import { parsePuzzleMarkup, normalize } from '../packages/core/src/index'
import { compilePuzzlePayload, type RawPuzzle } from '../packages/crypto/src/index'

async function compileTutorial() {
  const markup =
    'En Corchetes se avanza siempre hacia [el destino al que sales desde [lo contrario de fuera]], descifrando cada [misterio que se guarda oculto] con [el deshojado y revuelto RAMO] por el lenguaje.'

  const parsed = parsePuzzleMarkup(markup)

  const raw: RawPuzzle = {
    puzzleId: 'corchetes-tutorial',
    editionNumber: 0,
    publishDate: '2026-10-23',
    rootTemplate: parsed.rootTemplate,
    nodes: {
      n1: {
        id: 'n1',
        clueText: parsed.nodes.n1.clueText,
        children: parsed.nodes.n1.children,
        parent: parsed.nodes.n1.parent,
        type: 'reference',
        solution: 'afuera',
      },
      n2: {
        id: 'n2',
        clueText: parsed.nodes.n2.clueText,
        children: parsed.nodes.n2.children,
        parent: parsed.nodes.n2.parent,
        type: 'definition',
        solution: 'dentro',
      },
      n3: {
        id: 'n3',
        clueText: parsed.nodes.n3.clueText,
        children: parsed.nodes.n3.children,
        parent: parsed.nodes.n3.parent,
        type: 'definition',
        solution: 'secreto',
      },
      n4: {
        id: 'n4',
        clueText: parsed.nodes.n4.clueText,
        children: parsed.nodes.n4.children,
        parent: parsed.nodes.n4.parent,
        type: 'anagram',
        solution: 'amor',
      },
    },
    quoteAuthor: 'Guía del iniciado',
    quoteWork: 'Cómo jugar a Corchetes',
    quoteYear: 2026,
    editorialNote:
      '¡Enhorabuena! Has completado el tutorial. Recuerda: en Corchetes se resuelve de dentro hacia afuera. Al resolver «dentro», desbloqueaste la pista exterior para hallar «afuera».',
  }

  const payload = await compilePuzzlePayload(raw, 'salt-tutorial', normalize)
  console.log(JSON.stringify(payload, null, 2))
}

compileTutorial().catch(console.error)
