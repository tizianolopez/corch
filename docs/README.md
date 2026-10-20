# Corchetes — El juego de reconstrucción léxica

> **Corchetes** es un juego de palabras diario en español donde el jugador reconstruye una cita literaria o hecho histórico resolviendo pistas anidadas entre corchetes, de dentro hacia afuera.

---

## Filosofía de desarrollo: especificaciones + IA

Este proyecto sigue un **método de desarrollo estructurado** donde las especificaciones preceden al código. La IA implementa lo que el equipo ha diseñado; no decide la arquitectura ni el comportamiento del producto.

### Los documentos de referencia del proyecto

El repositorio mantiene cuatro documentos que actúan como fuente de verdad:

| Documento | Propósito |
|---|---|
| `spec.md` | **Qué** debe hacer el sistema. Requisitos funcionales, mecánicas de juego, criterios de aceptación. Sin mencionar código ni tecnologías. |
| `architecture.md` | **Cómo** está organizado el proyecto. Estructura de monorepo, responsabilidad de cada paquete, dependencias entre capas. |
| `arquitectura_corchetes.md` | **Diseño integral** completo: identidad visual, UX/UI, motor de juego, stack técnico, base de datos, seguridad, CMS y roadmap. |
| `tasks.md` | **Qué queda por hacer**, fase a fase. Cada tarea es pequeña, independiente y verificable. |
| `reglesIA.md` | **Cómo trabaja la IA** en este proyecto. Protocolo de trabajo tarea a tarea, restricciones y criterios de calidad. |

> *Si no controlas `spec.md`, la IA implementará cosas que no necesitas.*
> *Si no controlas `architecture.md`, la IA inventará una estructura que no entenderás.*
> *Si no controlas `tasks.md`, la IA se saltará pasos o los implementará en orden incorrecto.*

---

## Cómo interactuar con la IA tarea a tarea

Este método está diseñado para que el desarrollador **dialogue con la IA** para construir la solución paso a paso, manteniendo en todo momento el control del proyecto.

### Flujo de trabajo

**1. El desarrollador escribe y revisa los documentos de especificación.**

Antes de pedir cualquier código, los documentos `spec.md`, `architecture.md` y `tasks.md` deben estar actualizados y reflejar el estado actual del proyecto.

**2. El desarrollador pide a la IA una tarea concreta.**

En lugar de «hazme todo el proyecto», se pide **una tarea a la vez**:

```
Lee spec.md, architecture.md y tasks.md e implementa la tarea [ID de tarea].
```

**3. El desarrollador verifica la tarea.**

Si hay errores, se pide corrección. Si funciona correctamente, se confirma.

**4. Se repite para cada tarea.**

```
La tarea anterior está verificada. Implementa la siguiente tarea.
```

### Resumen de acciones por interacción

| Paso | Acción |
|---|---|
| 1 | Revisar y actualizar los archivos `.md` antes de pedir código |
| 2 | Pedir **una sola tarea** a la vez, nunca el proyecto entero |
| 3 | Leer y testear el código generado antes de aceptarlo |
| 4 | Informar a la IA de cualquier error o comportamiento inesperado |
| 5 | Confirmar la tarea completada antes de pasar a la siguiente |

### Qué NO hacer

- **No pedir «haz todo el proyecto de una vez»** — genera código desorganizado que no sigue las especificaciones.
- **No aceptar código sin leerlo** — si no entiendes una línea, pregunta a la IA por qué funciona así.
- **No saltarte tareas** — cada tarea depende de la anterior.
- **No ignorar los errores** — repórtalos y pide corrección antes de avanzar.

### Ejemplos de prompts

```
# Para iniciar una tarea:
"Lee spec.md, architecture.md y tasks.md. Implementa la tarea [ID]."

# Para pedir explicación del código:
"Explica paso a paso qué hace la función [nombre]."

# Para corregir un error:
"El componente de corchetes no renderiza correctamente. Revisa [archivo] y dime qué falla."

# Para añadir una mejora no planificada:
"Quiero añadir [descripción]. ¿Es coherente con la arquitectura actual?
Si lo es, dime qué nueva tarea crear en tasks.md."

# Para verificar coherencia global:
"Revisa todos los archivos del proyecto y dime si el código es coherente
con spec.md y architecture.md."
```

---

## Estructura del monorepo

```
corchetes/
├── docs/
│   ├── README.md                   ← Este archivo
│   ├── spec.md                     ← Especificación funcional
│   ├── architecture.md             ← Arquitectura técnica del monorepo
│   ├── arquitectura_corchetes.md   ← Documento de diseño integral
│   ├── tasks.md                    ← Tareas pendientes por fase
│   └── reglesIA.md                 ← Reglas de trabajo con la IA
├── apps/
│   ├── web/                        ← Next.js 15 (juego público)
│   ├── api/                        ← Fastify 5 (backend API)
│   └── cms/                        ← Next.js (back-office editorial)
└── packages/
    ├── core/                       ← Motor de juego, parser, normalización
    ├── ui/                         ← Componentes compartidos web/cms
    ├── db/                         ← Esquemas Drizzle ORM + migraciones
    └── crypto/                     ← SHA-256 + AES-GCM (compartido)
```

---

## Deuda cognitiva y responsabilidad

Cuando se trabaja con IA para programar, es fácil dejar que la IA implemente cambios cada vez más grandes hasta que **el código deja de ser verdaderamente nuestro**. Funciona, pero ya no entendemos por qué. En ese momento empezamos a acumular **deuda cognitiva**.

El objetivo, por tanto, **no es escribir todo el código manualmente**, sino mantener un **nivel de comprensión** suficiente para seguir **participando activamente** en el desarrollo. Cada vez que la IA genera una solución, deberíamos poder explicar:

- por qué funciona,
- qué decisiones de diseño se tomaron,
- qué alternativas existían,
- y qué limitaciones tiene.

Solo así podemos mantener el control del proyecto.

---

## Licencia

Proyecto de desarrollo privado. Todos los derechos reservados.
