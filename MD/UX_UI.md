# UX_UI — Principios de interfaz

## Reglas

- Menos texto, menos botones, menos estados visibles.
- **Una acción principal por pantalla**; el resto, secundario o escondido.
- Jerarquía visual clara: primero el número que importa, después el contexto.
- Información secundaria detrás de "Ver más" o "¿Cómo funciona?".
- Confirmaciones explícitas antes de comprometer dinero.
- Estados en lenguaje humano (ver `STATUSES.md`), nunca enums ni jerga on-chain.
- **Mobile first**.
- Nada de vocabulario blockchain en la superficie: no "escrow", no "XDR", no
  "wasm", no "ledger". Eso vive en "Detalle técnico".

## Home (no autenticado)

Mensaje: **Tu garantía de alquiler, simple y protegida.**

Explica en seis pasos: crear usuario → generar alias → crear garantía →
enviarla al locador → el locador la acepta → al finalizar, devolver o extender.

Acciones: **Ingresar** y **Crear cuenta**. Más abajo: "¿Cómo funciona?" y
"Preguntas frecuentes".

## Panel

Separado en bloques claros:

1. **Saldo disponible** + acciones (`Crear garantía`, `Retirar`).
2. **Garantías que di** (soy garante).
3. **Garantías a mi favor** (soy locador), con las pendientes de revisar arriba.
4. **Historial**.

El mismo usuario puede aparecer en ambos bloques; cada tarjeta indica el rol.

## Ficha de garantía

Estado, monto, la otra persona (`@alias`), fecha inicial y final, y sólo las
acciones válidas para el rol y el estado actual.

## "¿Cómo funciona?"

Botón presente en home, panel, creación de garantía y ficha. Abre un modal o
drawer contextual con la explicación de esa pantalla, no un texto genérico.

## Preguntas frecuentes

Página propia alimentada por `FAQ.md`, enlazada desde el home y el pie.

## Idiomas y temas (ya implementado, se conserva)

- Español LATAM por defecto, inglés disponible; cookie `rg_locale`.
- Dos experiencias en lugar de claro/oscuro: `modern` (oscura, por defecto) y
  `retro` (clara, monoespaciada); cookie `rg_theme`, atributo `data-theme` en
  `<html>`.
- Los textos nuevos se agregan a `src/lib/i18n/dictionaries.ts` en ambos
  idiomas; los errores de API viajan como código estable y se traducen en el
  cliente.
