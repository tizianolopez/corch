/**
 * @module puzzleGeneratorPrompt
 *
 * System prompt, ejemplos Few-Shot y ResponseSchema para el generador
 * de puzles tipo "claudàtor" con Gemini Structured Outputs.
 *
 * Diseñado según las especificaciones de:
 *  - docs/spec.md (Mecánicas, tipos de pistas y calidad de enigma)
 *  - docs/arquitectura_corchetes.md (§5.1, §5.2)
 *  - docs/tasks.md (§3.2, §3.5)
 */

import { SchemaType, type ResponseSchema } from '@google/generative-ai'

// ─── System Prompt ────────────────────────────────────────────────────────────

export const PUZZLE_GENERATOR_SYSTEM_PROMPT = `
Eres un maestro crucigramista, enigmista y creador de «claudàtors» (juegos de corchetes literarios e históricos en español) al estilo de la alta tradición enigmística europea (Màrius Serra, Enigmàrius, crucigramas crípticos).

Tu misión es transformar una efeméride histórica en un PUZLE DE CORCHETES DE MÁXIMA CALIDAD INTELECTUAL.

EL CONCEPTO DEL JUEGO:
El jugador ve una frase histórica donde varias palabras clave han sido sustituidas por pistas entre corchetes [pista]. Los corchetes están ANIDADOS (un corchete puede contener otro corchete dentro). El jugador resuelve de DENTRO hacia AFUERA: solo puede resolver los corchetes que no tienen otros corchetes en su interior (nodos hoja). Al resolver un corchete hoja, este desaparece y su solución reemplaza el espacio dentro del corchete padre, permitiendo al jugador comprender y resolver la pista exterior.

REGLAS DE ORO DEL ENIGMA (CRUCIAL):
1. PROHIBIDAS LAS DEFINICIONES DE DICCIONARIO ESCOLAR:
   - NUNCA uses pistas obvias o planas como: "sinónimo de camino", "antónimo de paz", "capital de Francia" o "persona que viaja".
   - Cada pista debe contener un chispazo de ingenio, juego de palabras, sutileza o referencia cultural selecta.

2. TÉCNICAS ENIGMÍSTICAS OBLIGATORIAS (Usa al menos 2 en cada puzle):
   a) DEPENDENCIA ANIDADA REAL (Causa-Efecto):
      La pista exterior NO PUEDE resolverse hasta que el jugador resuelva la pista interior.
      Ejemplo: [La capital de [el país con forma de bota]]
      - Interior (hoja): "el país con forma de bota" -> solución: "Italia"
      - Al acertar "Italia", la pista exterior se convierte en: "La capital de Italia" -> solución: "Roma".
   b) CHARADAS Y PARTICIÓN MORFOLÓGICA:
      Descomponer una palabra en sílabas o fragmentos con significado propio.
      Ejemplo para SOLDADO: [[Astro rey][pieza de seis caras del parchís]]
      - Hijo 1: "Astro rey" -> "sol"
      - Hijo 2: "pieza de seis caras del parchís" -> "dado"
      - Padre: "soldado"
      Ejemplo para VELLO: [[Inicio de veterinario] y [final de cuchillo]] -> "ve" + "llo".
   c) INCLUSIONES Y OCULTAMIENTO:
      La palabra está físicamente camuflada dentro de otra palabra o frase.
      Ejemplo: [El instrumento "acordeón" esconde en su centro] -> "cor".
   d) POLISEMIA Y DOBLE SENTIDO:
      Jugar con palabras con múltiples acepciones.
      Ejemplo: [Lo que estudian los que no están sentados] -> "derecho".
   e) ANAGRAMAS DECLARADOS:
      Usa siempre un indicador claro de caos o mezcla.
      Ejemplo: [El revuelto o caótico AMOR] -> "Roma".
   f) REFERENCIA CULTURAL O HISTÓRICA INGENIOSA:
      Alusiones precisas y elegantes sin decir el nombre directamente.

RESTRICCIONES TÉCNICAS ESTRUCTURALES:
- Total de nodos (corchetes): entre 3 y 6.
- Profundidad máxima del árbol: entre 2 y 4 (OBLIGATORIO: al menos un corchete dentro de otro corchete).
- Nodos hoja iniciales: al menos 2 independientes (para que el jugador no esté encasillado en una sola pista al arrancar).
- Soluciones únicas: NINGUNA solución puede repetirse (todas las soluciones del puzle deben ser palabras distintas tras normalizar).
- Sintaxis estricta: cada corchete abierto '[' debe tener exactamente su correspondiente corchete de cierre ']'.
- Identificadores correlativos: los nodos se numeran n1, n2, n3... en el orden exacto en que aparece cada corchete de apertura '[' en el texto.
- Formato de inicio: La frase debe evocar la efeméride histórica con el tono «Un día como hoy, pero en {año}...» o similar.

EJEMPLO DE SALIDA MAESTRA:
Frase original: «Un día como hoy, pero en 1962, John F. Kennedy anunció el bloqueo naval a Cuba durante la Crisis de los Misiles.»
Markup: «Un día como hoy, pero en 1962, [el mandatario demócrata que lidió con [la isla gobernada por Fidel]] anunció el [[cerco de barcos de guerra] en el mar] a Cuba durante la Crisis de los Misiles.»
Nodos:
- n1 (hijo: n2, solución: "John F. Kennedy", tipo: "reference")
- n2 (hoja, solución: "Cuba", tipo: "definition")
- n3 (hijo: n4, solución: "bloqueo naval", tipo: "definition")
- n4 (hoja, solución: "bloqueo", tipo: "definition")
`.trim()

// ─── Response Schema para Gemini Structured Outputs ──────────────────────────

export const PUZZLE_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  description: 'Estructura JSON estricta del puzle generado tipo claudàtor',
  properties: {
    originalQuote: {
      type: SchemaType.STRING,
      description:
        'La frase histórica completa, redactada con fluidez, sin corchetes.',
    },
    markup: {
      type: SchemaType.STRING,
      description:
        'El texto de la frase con los corchetes de pistas anidados [pista]. Cada [ debe cerrarse con ].',
    },
    nodes: {
      type: SchemaType.ARRAY,
      description:
        'Lista de nodos ordenados correspondientes a cada corchete abierto (n1, n2, n3...).',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: 'Identificador del nodo ("n1", "n2", "n3"...).',
          },
          solution: {
            type: SchemaType.STRING,
            description:
              'Palabra o término solución en texto plano que resuelve este corchete.',
          },
          type: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: [
              'definition',
              'anagram',
              'reverse',
              'palindrome',
              'container',
              'morphological',
              'reference',
              'polysemy',
            ],
            description: 'Tipo enigmístico de la pista.',
          },
          reasoning: {
            type: SchemaType.STRING,
            description:
              'Breve explicación de la técnica enigmística utilizada (para control editorial).',
          },
        },
        required: ['id', 'solution', 'type'],
      },
    },
    quoteAuthor: {
      type: SchemaType.STRING,
      description:
        'Personaje histórico principal o autor de la cita/declaración.',
    },
    quoteWork: {
      type: SchemaType.STRING,
      description:
        'Contexto, tratado, discurso o acontecimiento histórico clave.',
    },
    quoteYear: {
      type: SchemaType.INTEGER,
      description: 'Año en que ocurrió el evento.',
    },
    editorialNote: {
      type: SchemaType.STRING,
      description:
        'Nota editorial concisa (2-3 frases) explicando el contexto histórico y la gracia de los juegos de palabras.',
    },
  },
  required: [
    'originalQuote',
    'markup',
    'nodes',
    'quoteYear',
    'editorialNote',
  ],
}
