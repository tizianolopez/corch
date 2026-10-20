# Corchetes — Especificación Funcional
*Versión 1.0 · 20 de octubre de 2026*

> Este documento describe **qué** debe hacer el sistema. No menciona tecnologías concretas, nombres de archivos ni implementaciones. Solo describe el comportamiento esperado desde el punto de vista del jugador y del editor.

---

## Objetivo del producto

**Corchetes** es un juego de palabras diario en español. El jugador reconstruye una cita literaria o hecho histórico resolviendo pistas anidadas entre corchetes, **de dentro hacia afuera**.

Una edición nueva se publica cada día a las 00:00 h (hora de Madrid). Cada jugador solo puede jugar la edición del día una vez.

---

## Mecánica central

### La estructura del puzle

El juego presenta al jugador una frase donde ciertas palabras han sido extraídas y sustituidas por pistas entre corchetes `[...]`. Las pistas pueden estar anidadas: una pista puede contener dentro de sí otra pista.

```
Frase original: «Caminante, no hay camino, se hace camino al andar.»

Versión con corchetes:
«Caminante, no hay [lo que indica [el color que sigue al rojo] en el semáforo],
se hace [sinónimo de senda] al [mover los pies].»
```

### Reglas de resolución

1. **Solo se puede resolver una pista «hoja»** (una pista que no contiene otras pistas dentro). Las pistas con hijos bloqueados no se pueden resolver hasta que sus pistas internas estén resueltas.

2. **El jugador escribe en un campo de texto global.** No necesita hacer clic en una pista concreta. El sistema evalúa si la respuesta escrita coincide con cualquiera de las pistas actualmente activas.

3. **Al acertar una pista**, el corchete desaparece y la palabra resuelta aparece en su lugar. Si la pista padre ya tiene todas sus hijas resueltas, se convierte automáticamente en la nueva pista activa.

4. **Al fallar una respuesta**, el sistema indica el error visualmente sin revelar ninguna pista.

5. **La partida termina** cuando todos los corchetes han sido resueltos y la frase original queda reconstituida.

### Tolerancia en las respuestas

El sistema acepta respuestas con variaciones ortográficas menores sin penalización:

- **Mayúsculas/minúsculas:** indiferentes (`CAMINO` = `camino`).
- **Tildes:** la ausencia de tilde no se penaliza (`cancion` = `canción`).
- **Diéresis:** `pinguino` se acepta como `pingüino`.
- **Números:** se aceptan como dígito o como palabra (`3` = `tres`).
- **`Ñ`:** es un grafema independiente. `canon` ≠ `cañón` (error).
- **Signos de apertura** (`¿`, `¡`): se ignoran en la validación.

---

## Tipología de pistas

El editor puede utilizar cualquiera de estos tipos de pistas. El jugador no recibe explícitamente el tipo; debe deducirlo:

| Tipo | Descripción | Ejemplo |
|---|---|---|
| **Definición directa** | Descripción del significado | «Río que pasa por Gerona» → *Ter* |
| **Anagrama** | Las letras están desordenadas | «El caótico AMOR» → *Roma* |
| **Lectura inversa** | Se lee al revés | «amoR» al revés → *Roma* |
| **Palíndromo** | Igual del derecho que del revés | «Reconocer» |
| **Bifronte** | Al revés forma otra palabra | «Raíz de la zorra» → *azar* |
| **Contenido** | La solución está escondida dentro | «El acordeón esconde un órgano» → *cor* |
| **Localización morfológica** | Extremos de palabras | «Inicio de veterinario, fin de cuchillo» → *ve·llo* |
| **Referencia cultural** | Alusión a obra, personaje o hecho | «El de Disney se llama Kuzco» → *emperador* |
| **Polisemia** | Doble sentido | «Lo que estudian los que no están sentados» → *derecho* |

---

## Sistema de ayudas

El jugador puede solicitar dos tipos de ayuda, con penalización de puntuación en cada caso:

1. **«Solicitar matriz»:** Revela la longitud de la palabra y un patrón de letras conocidas (ej. `_ _ _ i _ o`). Penalización: −8 puntos.

2. **«Revelar término»:** Resuelve directamente la pista seleccionada. La palabra aparece marcada con `†` para indicar que fue revelada. Penalización: −15 puntos.

---

## Sistema de puntuación

La puntuación parte de 100 puntos y se descuenta según los errores y ayudas:

| Evento | Penalización |
|---|---|
| Error de respuesta | −5 puntos (máximo acumulable: −40) |
| Solicitar matriz | −8 puntos |
| Revelar término | −15 puntos |
| Penalización por tiempo (cada 30s tras los 3 min) | −1 punto (máximo: −10) |

### Rangos obtenibles

| Puntuación final | Rango |
|---|---|
| 100 | **Gran Maestro** |
| 85–99 | **Maestro** |
| 65–84 | **Cronista** |
| 40–64 | **Escriba** |
| 0–39 | **Aprendiz** |

---

## Pantalla de cierre de edición

Al resolver el último corchete, el juego no muestra un modal invasivo. En su lugar, el área inferior de la interfaz se transforma suavemente en una **Nota Editorial** que muestra:

1. La cita completa y limpia con el nombre del autor, la obra y el año.
2. Un breve párrafo de contexto cultural o literario (2–3 líneas).
3. Las métricas del jugador: tiempo, precisión, rango obtenido.
4. La comparativa con otros lectores del día: «Has sido más rápido que el 78 % de los lectores».
5. El botón «Copiar crónica» para compartir el resultado.

---

## Compartición de resultados (sin emojis)

Al pulsar «Copiar crónica», se copia al portapapeles un bloque de texto tipográfico con caracteres Unicode:

```
CORCHETES — Edición N.º 142
Martes, 20 de octubre de 2026
──────────────────────────────
Estructura · [ [ · ] [ [ · ] † ] ]
Precisión  · 92 %  (1 consulta al archivo)
Tiempo     · 02m 18s
Rango      · Maestro
──────────────────────────────
corchetes.es
```

**Leyenda de la línea «Estructura»:**
- `[...]` → nivel de anidamiento del árbol del puzle
- `·` → nodo resuelto limpiamente
- `†` → nodo donde se usó «Revelar término»

No se revelan en ningún momento las palabras de la solución.

---

## Identidad de usuario

Para reducir la fricción al máximo, **no es necesario registrarse para jugar**.

- Al entrar por primera vez, el sistema crea una **sesión anónima** vinculada al dispositivo.
- El jugador puede optar a crear una cuenta (mediante enlace mágico por email o Google OAuth) para no perder su racha al cambiar de dispositivo.
- Si se registra, sus partidas anónimas anteriores se fusionan automáticamente con la nueva cuenta.

---

## CMS Editorial (back-office)

El creador de puzles dispone de un panel privado con las siguientes funcionalidades:

1. **Editor en vivo:** El editor escribe la cita con corchetes anidados y ve en tiempo real la vista previa exacta de cómo se jugará.
2. **Analizador de complejidad automático:** El sistema calcula la profundidad máxima, el número de nodos hoja iniciales y emite alertas si el puzle puede bloquear al jugador desde el primer segundo.
3. **Detector de colisiones:** Alerta si dos pistas activas simultáneamente tienen la misma solución.
4. **Cola de publicación:** Permite programar ediciones con semanas de antelación. El sistema las publica automáticamente a medianoche.

---

## Creador de retos (UGC)

Cualquier usuario puede crear su propio puzle en un modo creador:

1. Escribe una frase con corchetes anidados.
2. Define la solución de cada corchete.
3. El sistema genera una URL única y corta (`corchetes.es/r/x8k9p2m1`) que puede compartir con amigos.
4. Los retos de usuario no requieren base de datos: el puzle viaja cifrado en la propia URL.

---

## Criterios de aceptación del MVP

El producto se considerará funcional cuando:

- [ ] El puzle diario carga correctamente a las 00:00 h y no es accesible antes de esa hora.
- [ ] El árbol de corchetes se renderiza correctamente con todos sus niveles de anidamiento.
- [ ] El sistema valida respuestas correctas e incorrectas instantáneamente (sin llamada al servidor).
- [ ] Los corchetes activos se distinguen visualmente de los bloqueados.
- [ ] Al acertar, la animación de «linotipia» se ejecuta correctamente.
- [ ] Al fallar, la animación de «shake» y el cambio de color de error se producen.
- [ ] El sistema de puntuación descuenta correctamente por errores y ayudas.
- [ ] El cierre de edición muestra la cita completa, el autor, el contexto cultural y las métricas.
- [ ] El percentil frente a otros lectores del día se muestra correctamente.
- [ ] «Copiar crónica» genera el texto tipográfico correcto sin revelar la solución.
- [ ] La sesión anónima persiste al recargar la página.
- [ ] El registro con Magic Link funciona y fusiona la sesión anónima.
- [ ] El CMS permite crear, previsualizar y programar puzles.
- [ ] El creador de retos genera URLs compartibles que funcionan sin servidor.
- [ ] Las soluciones no son visibles en texto plano en las herramientas de desarrollo del navegador.
