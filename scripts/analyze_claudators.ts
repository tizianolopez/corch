import * as fs from 'fs'

const data = JSON.parse(fs.readFileSync('data/claudators_corpus.json', 'utf8'))

console.log('=== ESTUDIO DETALLADO DE LONGITUD Y DENSIDAD EN CLAUDÀTORS ===\n')

let totalQuoteLen = 0
let totalRoots = 0
let totalNodes = 0
let withAttribution = 0

const samples = data.slice(0, 5)

samples.forEach((p: any, idx: number) => {
  const quote = p.quote
  const roots = p.raw_puzzle.clues
  let allNodes = 0
  function countNodes(clues: any[]) {
    clues.forEach((c) => {
      allNodes++
      if (c.clues) countNodes(c.clues)
    })
  }
  countNodes(roots)

  const dashIdx = quote.indexOf('—')
  const quoteBody = dashIdx !== -1 ? quote.slice(0, dashIdx).trim() : quote
  const attribution = dashIdx !== -1 ? quote.slice(dashIdx).trim() : ''

  console.log(`\n--- Puzle ${idx + 1} (${p.date}) ---`)
  console.log(`Frase completa (${quote.length} caracteres):`)
  console.log(`  «${quote}»`)
  console.log(`  - Cuerpo de la frase: ${quoteBody.length} chars («${quoteBody}»)`)
  console.log(`  - Atribución: ${attribution.length} chars («${attribution}»)`)
  console.log(`Nodos: Total = ${allNodes} | Raíces en cita = ${roots.length}`)
  console.log(`Raíces: ${roots.map((r: any) => r.value).join(', ')}`)
})

data.forEach((p: any) => {
  totalQuoteLen += p.quote.length
  totalRoots += p.raw_puzzle.clues.length
  if (p.quote.includes('—')) withAttribution++
  let n = 0
  function count(clues: any[]) {
    clues.forEach((c) => {
      n++
      if (c.clues) count(c.clues)
    })
  }
  count(p.raw_puzzle.clues)
  totalNodes += n
})

const avgQuoteLen = (totalQuoteLen / data.length).toFixed(1)
const avgRoots = (totalRoots / data.length).toFixed(1)
const avgNodes = (totalNodes / data.length).toFixed(1)

console.log('\n=== PROMEDIOS GLOBALES SOBRE 89 PUZLES ===')
console.log(`Longitud media de 'quote': ${avgQuoteLen} caracteres`)
console.log(`Media de nodos totales: ${avgNodes}`)
console.log(`Media de raíces (Nivel 0 en la cita): ${avgRoots}`)
console.log(`Media de hijos/nietos (Nivel 1+ dentro de pistas): ${(Number(avgNodes) - Number(avgRoots)).toFixed(1)}`)
console.log(`Puzles con '— Atribución' dentro de la cita: ${withAttribution} / ${data.length} (${((withAttribution / data.length) * 100).toFixed(0)}%)`)
console.log(`Caracteres promedio por nodo raíz en la cita: ${(Number(avgQuoteLen) / Number(avgRoots)).toFixed(1)} chars`)
