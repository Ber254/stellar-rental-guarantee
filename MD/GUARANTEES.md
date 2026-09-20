# GUARANTEES — La garantía

## Definición

Una garantía es un compromiso de dinero que **un garante** pone **a favor de un
locador**, por un período, y que queda bloqueado en un escrow hasta que ambas
partes acuerden su destino.

## Campos

| Campo | Descripción |
| --- | --- |
| `id` | Identificador interno. |
| `reference` | Código legible (`SFX-2026-000123`), también usado como id on-chain. |
| `guarantor_id` | `user_id` de quien pone el dinero. |
| `landlord_id` | `user_id` de quien la recibe (null hasta que acepta, si se envió a un alias inexistente no se permite). |
| `amount` | Monto total en USDC (7 decimales). |
| `currency` | Moneda configurada actualmente (USDC). |
| `period_start` / `period_end` | Vigencia. Se captura como mes/año + cantidad de meses. |
| `status` | Ver `STATUSES.md`. |
| `created_at`, `accepted_at`, `rejected_at`, `closed_at` | Marcas de tiempo. |
| `rejection_reason` | Motivo obligatorio al denegar. |

La vigencia se muestra siempre en lenguaje humano: `Noviembre 2026 → Octubre 2028`.

## Roles dentro de la garantía

- **Garante**: crea, financia, pide devolución, propone extensión.
- **Locador**: acepta o deniega, acepta o rechaza devoluciones, puede devolver
  unilateralmente (total o parcial).

Nadie puede retirar fondos por su cuenta: toda salida de dinero requiere una
distribución acordada (o una devolución iniciada por el locador, que sólo puede
ir en favor del garante).

## Operaciones

| Operación | Quién | Efecto |
| --- | --- | --- |
| Crear | Garante | Queda pendiente de aceptación; el monto se compromete. |
| Aceptar | Locador | Pasa a activa. |
| Denegar | Locador | Queda rechazada con motivo; se libera el monto. |
| Vencimiento del período | Sistema | Pasa a "Vencida"; habilita devolver o extender. |
| Expiración sin aceptación | Sistema | Se cancela automáticamente (ver `BUSINESS_RULES.md`). |
| Solicitar devolución (total o parcial) | Garante | Requiere aprobación del locador. |
| Aprobar / rechazar devolución | Locador | Aprobar libera fondos; rechazar exige motivo. |
| Devolución unilateral | Locador | Libera fondos al garante sin aprobación adicional. |
| Extender | Garante | Nuevo período y/o nuevo monto total. |

## Extensión

- La inicia el garante y la acepta el locador.
- Permite nuevo período y nuevo monto total.
- Si el monto **aumenta**, el garante deposita la diferencia antes de que la
  extensión quede activa.
- Si el monto **disminuye**, la diferencia se devuelve al garante y requiere la
  aprobación del locador (es una devolución parcial acoplada a la extensión).

## Devolución parcial

El remanente sigue bloqueado y la garantía continúa activa con el monto
reducido; el período no cambia. Ver la regla completa y su justificación en
`BUSINESS_RULES.md`.

## Historial

Cada garantía guarda una línea de tiempo: creación, envío, aceptación/rechazo,
financiación, solicitudes, aprobaciones, devoluciones, extensiones, vencimiento
y cierre, con autor, fecha, monto y — cuando corresponde — el hash de la
transacción en Stellar.
