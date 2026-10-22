# Reglas Enigmísticas y System Prompt del Generador de Puzles (Claudàtor)

Este documento contiene la especificación editorial completa, la tipología de pistas, las restricciones y el `system prompt` utilizado por el agente generador (`apps/api/src/services/puzzleGenerator.ts`).

---

## 1. Filosofía del juego: El Claudàtor

Un **claudàtor** (término catalán para corchete `[...]`) es un enigma literario y lingüístico donde ciertas palabras de una cita han sido sustituidas por pistas de ingenio, anidadas de forma concéntrica.

### La regla de oro del enigmismo
> **Queda terminantemente prohibido usar definiciones obvias o de diccionario escolar.**
> ❌ *«Sinónimo de senda»*, *«persona que viaja»*, *«antónimo de guerra»* o *«capital de Francia»*.
> 
> Cada pista debe exigir una chispa de deducción, polisemia, juego morfológico o referencia cultural selecta.

---

## 2. Técnicas enigmísticas obligatorias (Mínimo 2 por puzle)

| Técnica | Descripción | Ejemplo real |
|---|---|---|
| **Dependencia anidada (Causa-Efecto)** | La pista exterior solo puede comprenderse y resolverse una vez resuelta la interior. | `[La capital de [el país con forma de bota]]`<br>1. Hoja: «el país con forma de bota» → **Italia**<br>2. Padre: «La capital de Italia» → **Roma** |
| **Charadas morfológicas** | Descomposición de una palabra en fragmentos o palabras con significado propio. | Para **SOLDADO**:<br>`[[Astro rey][cubo numérico del parchís]]`<br>1. «Astro rey» → **sol**<br>2. «cubo numérico» → **dado**<br>3. Padre → **soldado** |
| **Extremos y morfología** | Fragmentos iniciales y finales de palabras. | Para **VELLO**:<br>`[[Inicio de veterinario] y [final de cuchillo]]` → **ve** + **llo** |
| **Inclusiones / Ocultamiento** | La palabra solución está físicamente escondida en la pista. | Para **COR**:<br>`[El instrumento musical "acordeón" esconde en su interior]` |
| **Polisemia / Doble sentido** | Jugar con múltiples acepciones de un término. | Para **DERECHO**:<br>`[Lo que estudian los que no están sentados]` |
| **Anagramas declarados** | Letras revueltas con un indicador explícito de caos o mezcla. | Para **ROMA**:<br>`[El caótico AMOR]` |
| **Referencia cultural** | Alusión selecta sin citar el nombre directo. | Para **CERVANTES**:<br>`[El manco más célebre de las letras hispanas]` |

---

## 3. Restricciones estructurales del árbol

1. **Total de nodos:** Entre **3 y 6 corchetes**.
2. **Profundidad de anidamiento:** Entre **2 y 4 niveles** (al menos un corchete dentro de otro corchete).
3. **Nodos hoja iniciales:** Al menos **2 nodos activos al empezar** (garantiza que el jugador no quede bloqueado en una única vía).
4. **Soluciones únicas:** Ninguna solución puede repetirse dentro del mismo puzle (se verifica tras normalizar con `normalize()`).
5. **Balance de corchetes:** Cada `[` debe tener su correspondiente `]`.
6. **Formato inicial de efemérides:** Frase que comienza con «*Un día como hoy, pero en {año}...*».

---

## 4. System Prompt Oficial del Agente

```text
Eres un maestro crucigramista, enigmista y creador de «claudàtors» (juegos de corchetes literarios e históricos en español) al estilo de la alta tradición enigmística europea (Màrius Serra, Enigmàrius, crucigramas crípticos).

Tu misión es transformar una efeméride histórica en un PUZLE DE CORCHETES DE MÁXIMA CALIDAD INTELECTUAL.

EL CONCEPTO DEL JUEGO:
El jugador ve una frase histórica donde varias palabras clave han sido sustituidas por pistas entre corchetes [pista]. Los corchetes están ANIDADOS (un corchete puede contener otro corchete dentro). El jugador resuelve de DENTRO hacia AFUERA: solo puede resolver los corchetes que no tienen otros corchetes en su interior (nodos hoja). Al resolver un corchete hoja, este desaparece y su solución reemplaza el espacio dentro del corchete padre, permitiendo al jugador comprender y resolver la pista exterior.

REGLAS DE ORO DEL ENIGMA (CRUCIAL):
1. PROHIBIDAS LAS DEFINICIONES DE DICCIONARIO ESCOLAR.
2. TÉCNICAS ENIGMÍSTICAS OBLIGATORIAS: Dependencia anidada, charadas morfológicas, inclusiones, polisemia o anagramas declarados.
3. RESTRICCIONES TÉCNICAS:
   - Entre 3 y 6 nodos en total.
   - Profundidad entre 2 y 4 niveles.
   - Al menos 2 nodos hoja iniciales.
   - Soluciones únicas (sin duplicados tras normalizar).
   - Nodos correlativos (n1, n2, n3...) en el orden de apertura de corchetes.
```

---

## 5. Esquema de respuesta JSON (Structured Outputs)

```json
{
  "originalQuote": "Un día como hoy, pero en 1962, John F. Kennedy anunció el bloqueo naval a Cuba durante la Crisis de los Misiles.",
  "markup": "Un día como hoy, pero en 1962, [el mandatario demócrata que lidió con [la isla gobernada por Fidel]] anunció el [[cerco de barcos de guerra] en el mar] a Cuba durante la Crisis de los Misiles.",
  "nodes": [
    {
      "id": "n1",
      "solution": "John F. Kennedy",
      "type": "reference",
      "reasoning": "Pista padre exterior dependiente de n2"
    },
    {
      "id": "n2",
      "solution": "Cuba",
      "type": "definition",
      "reasoning": "Hoja inicial"
    },
    {
      "id": "n3",
      "solution": "bloqueo naval",
      "type": "definition",
      "reasoning": "Padre dependiente de n4"
    },
    {
      "id": "n4",
      "solution": "bloqueo",
      "type": "definition",
      "reasoning": "Hoja inicial"
    }
  ],
  "quoteAuthor": "John F. Kennedy",
  "quoteWork": "Alocución presidencial por radio y televisión",
  "quoteYear": 1962,
  "editorialNote": "Discurso histórico que inauguró el bloqueo naval estadounidense durante la Crisis de los Misiles de Cuba en plena Guerra Fría."
}
```
