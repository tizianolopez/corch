---
proyecto: Corchetes
archivo: reglesIA.md
versión: 1.0
descripción: Protocolo de trabajo de la IA en este proyecto. Lectura obligatoria antes de generar cualquier código.
---

## Propósito

Este documento describe cómo debe trabajar el asistente de IA en el proyecto **Corchetes**. Garantiza que el trabajo sea coherente con los documentos existentes y que el desarrollador mantenga la responsabilidad sobre el código.

Se asume que **el desarrollador es responsable de cada línea que entra al repositorio**. La IA es un asistente, no un tomador de decisiones.

---

## Principio fundamental

Solo aceptes código que puedas:

1. Explicar.
2. Modificar.
3. Depurar.
4. Mantener.

Si alguna de estas condiciones no se cumple: **PARA.**

---

## Documentos de referencia obligatorios

Antes de generar cualquier código, la IA debe leer:

```
docs/spec.md                   ← Qué debe hacer el sistema
docs/architecture.md           ← Cómo está organizado el monorepo
docs/arquitectura_corchetes.md ← Diseño integral: visual, UX, motor, DB, seguridad
docs/tasks.md                  ← Tareas pendientes, fase por fase
```

Si alguno de estos archivos contradice a otro, **preguntar antes de implementar**.

---

## Restricciones absolutas (nunca hacer sin autorización explícita)

- **No crear archivos fuera de la estructura definida en `architecture.md`.**
- **No cambiar el stack tecnológico** definido en `arquitectura_corchetes.md` §6.
- **No modificar `packages/crypto`** para exponer soluciones en texto plano bajo ninguna circunstancia.
- **No añadir variables de entorno con `NEXT_PUBLIC_`** que contengan claves privadas o service keys.
- **No usar Tailwind CSS.** Los estilos se hacen con CSS Modules + CSS Custom Properties.
- **No usar emojis** en ninguna parte de la interfaz de usuario (fichas de compartición, rangos, estados).
- **No normalizar `Ñ` a `N`** en ninguna función de normalización de input.
- **No implementar múltiples tareas en una sola interacción** salvo instrucción explícita del desarrollador.

---

## Protocolo de trabajo por fases

### Fase 1 — Revisión de especificaciones

Antes de codificar, leer `spec.md` y confirmar:

- Cuáles son los requisitos funcionales que aplican a la tarea.
- Cuáles son los criterios de aceptación relevantes.
- Si hay alguna ambigüedad, preguntar antes de continuar.

---

### Fase 2 — Revisión de arquitectura

Leer `architecture.md` y `arquitectura_corchetes.md` y confirmar:

- En qué paquete o app se debe implementar la tarea.
- Qué interfaces TypeScript ya están definidas en `packages/core`.
- Qué tokens CSS usar (paleta en §2.2 de `arquitectura_corchetes.md`).
- Qué tipografías usar y para qué rol (§3 de `arquitectura_corchetes.md`).

Si la tarea implica lógica de juego (parser, normalización, puntuación), implementarla en `packages/core`, no inline en un componente de React.

---

### Fase 3 — Planificación de la tarea

Antes de generar código, declarar explícitamente:

- Qué hace la tarea seleccionada.
- Qué archivos toca y por qué.
- Qué funciones o componentes se van a escribir.
- Cómo se verificará que funciona correctamente.
- Si la tarea requiere un test unitario (Vitest), declararlo también.

---

### Fase 4 — Implementación

Generar únicamente el código necesario para la tarea seleccionada. No implementar el proyecto entero de una vez.

Para cada cambio, verificar que:

- Es coherente con `spec.md`.
- Respeta la estructura de `architecture.md`.
- Usa los tokens CSS y tipografías definidos en `arquitectura_corchetes.md`.
- Incluye comentarios en las partes no evidentes.
- El código TypeScript está correctamente tipado (sin `any` implícitos).

---

### Fase 5 — Revisión inmediata

Tras implementar una tarea, revisar:

- **Corrección:** ¿Cumple el requisito funcional?
- **Seguridad:** ¿Ninguna solución queda expuesta en texto plano?
- **Tipado:** ¿Todos los tipos TypeScript son correctos y explícitos?
- **Estilo:** ¿El CSS usa tokens de diseño en lugar de valores hardcodeados?
- **Legibilidad:** ¿El código es claro y autodocumentado?

Si algo falla, refactorizar antes de declarar la tarea completada.

---

### Fase 6 — Cierre de tarea

Tras completar y revisar cada tarea:

1. Marcar la tarea como `[x]` en `tasks.md`.
2. Informar al desarrollador de:
   - Qué tarea se ha completado.
   - Qué archivos se han tocado y por qué.
   - Cómo puede verificar que funciona.
3. **PARAR. No continuar con la siguiente tarea hasta que el desarrollador confirme explícitamente.**

---

## Reglas específicas del proyecto Corchetes

### Sobre el motor de juego (`packages/core`)

- Todo el código de lógica de juego reside en `packages/core`, no en componentes de React.
- El parser de markup debe pasar los tests unitarios antes de usarse en la UI.
- La función `normalize()` debe respetar exactamente las reglas de §5.4 de `arquitectura_corchetes.md`.
- La función `onSubmit()` solo itera sobre los nodos con estado `ACTIVE`, nunca sobre todos los nodos.

### Sobre la seguridad del puzle (`packages/crypto`)

- Las soluciones **nunca** viajan en texto plano en el `client_payload`.
- El `client_payload` solo contiene: `solutionHash` (SHA-256) y `solutionCipher` (AES-GCM).
- La clave de descifrado AES-GCM es la propia respuesta normalizada del jugador.
- El `DAILY_SALT` es público y se incluye en el payload; la seguridad no depende de su secreto.

### Sobre los estilos

- Los colores se definen **únicamente** como variables CSS en `packages/ui/tokens.css`.
- Nunca usar valores hex directamente en un componente (siempre `var(--color-active)`).
- El modo día/noche se gestiona mediante un atributo `data-theme="day"|"night"` en el elemento `<html>`, activado por hora del reloj, no por `prefers-color-scheme`.
- Las animaciones usan `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.

### Sobre la tipografía

- **Serif (Newsreader):** solo para la cita/frase a reconstruir y el masthead.
- **Sans (Inter):** para pistas, UI, botones, metadatos.
- **Mono (JetBrains Mono):** para cronómetro, número de edición, estadísticas, indicador de longitud.
- Nunca mezclar los roles: las pistas dentro de los corchetes son siempre Sans-Serif.

### Sobre la compartición

- El texto «Copiar crónica» usa únicamente caracteres Unicode tipográficos (`─`, `·`, `†`, `[`, `]`).
- La línea «Estructura» muestra el esqueleto del árbol con `·` (resuelto limpiamente) y `†` (revelado con ayuda). **Nunca muestra las palabras de la solución.**

---

## Requisitos adicionales del asistente IA

- Siempre leer `spec.md`, `architecture.md`, `arquitectura_corchetes.md` y `tasks.md` antes de generar cualquier código.
- No añadir nuevas dependencias npm sin justificarlo explícitamente y sin esperar confirmación del desarrollador.
- No cambiar la estructura del monorepo sin autorización.
- No generar código de migración de base de datos sin revisión del desarrollador.
- Proponer cambios solo cuando estén justificados por el requisito de la tarea.
- Priorizar claridad y legibilidad sobre brevedad.
- En caso de duda entre dos soluciones técnicas, presentar ambas con sus pros y contras y esperar decisión del desarrollador.
