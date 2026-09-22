# /MD — Context package de SAFEXY

Documentación funcional del producto. Es la fuente de verdad para humanos y para
futuras sesiones de IA: antes de tocar código, leer estos documentos; después de
cambiar una decisión funcional, actualizarlos y anotarlo en `CHANGELOG.md`.

| Documento | Contiene |
| --- | --- |
| `PRODUCT.md` | Qué es SAFEXY, para quién, y qué NO es. |
| `USERS.md` | Usuario, alias, perfil, identidad interna vs. máscara legible. |
| `USER_FLOWS.md` | Flujos paso a paso: crear, aceptar, devolver, extender, vencer. |
| `GUARANTEES.md` | La garantía como entidad: campos, roles, vigencia, montos. |
| `STATUSES.md` | Estados visibles y su mapeo con los estados internos y on-chain. |
| `BUSINESS_RULES.md` | Reglas duras: comisión, expiración, quién puede hacer qué. |
| `DATABASE.md` | Modelo de datos actual y el modelo objetivo. |
| `BLOCKCHAIN.md` | Qué hace Stellar/Soroban hoy y qué límites impone. |
| `UX_UI.md` | Principios de interfaz, jerarquía, textos, temas e idiomas. |
| `FAQ.md` | Preguntas frecuentes en lenguaje de usuario (fuente de la página FAQ). |
| `ARCHITECTURE_CURRENT.md` | Análisis del sistema tal como está hoy y qué se reutiliza. |
| `CHANGELOG.md` | Decisiones funcionales, con fecha. |

Convenciones:

- Español rioplatense/LATAM para el producto; inglés sólo en identificadores de código.
- Montos en USDC con 7 decimales (stroops), nunca en `float`.
- Un usuario no "es" garante ni locador: lo es **dentro de una garantía**.
