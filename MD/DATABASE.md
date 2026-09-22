# DATABASE — Modelo de datos

Postgres (Neon) con Drizzle ORM. Esquema en `src/lib/db/schema.ts`, migraciones
SQL en `drizzle/`, aplicadas con `npm run db:migrate`.

## Modelo actual

| Tabla | Rol |
| --- | --- |
| `users` | email único, nombre, hash de contraseña, `stellar_address`. |
| `properties` | etiqueta y dirección del inmueble. |
| `rental_contracts` | el contrato: referencia `RG-AAAA-NNNNNN`, inquilino, propietario, wallets, monto de garantía, alquiler, fechas, estado, token de invitación. |
| `guarantees` | espejo off-chain del escrow: monto, `on_chain_id`, contrato Soroban, estado (`CREATED/LOCKED/RELEASED/CANCELLED`), `simulated`. |
| `proposals` | propuestas de distribución (`to_landlord`, `to_tenant`, ronda, estado). |
| `proposal_actions` | auditoría: quién propuso, aceptó, rechazó o contraofertó. |
| `agreements` | la distribución acordada y congelada. |
| `blockchain_transactions` | una fila por operación on-chain: tipo, estado, hash, ledger, red, monto. |
| `notifications` | avisos por usuario, con `read_at`. |
| `contract_counters` | secuencia anual de referencias. |

Todos los montos son `numeric(20,7)`.

## Cambios para SAFEXY (estado: implementados en `0001_safexy_model_v2.sql`)

1. ~~`users`: agregar `alias`...~~ Hecho: `alias` (único, normalizado),
   `last_name`, `photo_url`. `user_alias_history` (`user_id`, `alias`,
   `changed_at`) guarda el alias anterior en cada cambio (`src/lib/alias.ts`).
2. ~~`rental_contracts` → renombrar...~~ Hecho: `tenant_id` → `guarantor_id`,
   `tenant_wallet` → `guarantor_wallet`, `landlord_name`/`landlord_email`
   eliminados (la contraparte se resuelve por alias, no se tipea a mano),
   `property_id` y `landlord_wallet` ahora nullable — SAFEXY no exige inmueble
   y la wallet del locador se toma de su perfil al aceptar, no se pide al
   crear.
3. ~~Estados: agregar `REJECTED` y `EXPIRED`...~~ Hecho, más `rejection_reason`
   y `rejected_at`.
4. **Decisión distinta de la propuesta original:** no se creó una tabla
   `returns` separada. Tanto la devolución negociada (solicitud + aprobación)
   como la devolución unilateral del locador se modelan como filas de
   `proposals`/`agreements` (con `kind`: `SETTLEMENT` o `UNILATERAL_RETURN`),
   reutilizando la misma infraestructura de auditoría que ya tenía el
   sistema — evita duplicar el concepto de "acuerdo de reparto".
5. ~~Nueva tabla `extensions`~~ Hecho: `contract_id`, nuevo período, nuevo
   monto, `top_up_amount`, `refund_amount`, estado.
6. `notifications.kind` agregado (tipado, ver enum `notification_kind`), pero
   `title`/`body` todavía se guardan como texto ya renderizado en inglés — la
   traducción del aviso según `kind` queda pendiente.
7. Índices por `guarantor_id` y `landlord_id`, más uno por `alias`. Hecho.

Migración: `drizzle/0001_safexy_model_v2.sql`, generada con
`npm run db:generate` tratando cada columna renombrada como
columna-nueva-más-columna-vieja-eliminada (no como rename): no hay datos
reales que proteger (demo/testnet), así que es la opción más simple y
explícita. Aplicarla sobre una base con datos de demo previos requiere una
base vacía o limpiar `rental_contracts`/`guarantees` antes, porque
`guarantor_id` se agrega `NOT NULL` sin default.

## Reglas

- Nunca referenciar a un usuario por alias en otra tabla: siempre por `user_id`.
- Los montos siempre como texto decimal → stroops (`src/lib/money.ts`); nunca
  `float`.
- Las migraciones se generan con `npm run db:generate` y se revisan a mano
  antes de aplicarse; no se edita el snapshot de Drizzle a mano.
