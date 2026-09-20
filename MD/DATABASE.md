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

## Cambios necesarios para SAFEXY

1. `users`: agregar `alias` (único, normalizado), `last_name`, `photo_url`.
2. Nueva tabla `user_alias_history` (`user_id`, `alias`, `changed_at`) para que
   cambiar el alias no rompa referencias históricas.
3. `rental_contracts` → renombrar conceptualmente a **garantías**:
   `tenant_id` → `guarantor_id`, `landlord_id` se mantiene, y las columnas de
   propiedad (`property_id`, alquiler, notas) pasan a ser opcionales: SAFEXY no
   pide inmueble para crear una garantía.
4. Estados: agregar `REJECTED` y `EXPIRED` al enum, más `rejection_reason`.
5. Nueva tabla `returns` (devolución total o parcial): quién la inicia, monto,
   comisión aplicada, estado, motivo de rechazo.
6. Nueva tabla `extensions`: nuevo período, nuevo monto, diferencia, estado.
7. `notifications`: agregar `kind` tipado para poder traducir el aviso en vez de
   guardar texto en inglés (hoy se guarda el string ya renderizado).
8. Índices por `guarantor_id` y `landlord_id` (ya existen sus equivalentes) y
   uno nuevo por `alias`.

## Reglas

- Nunca referenciar a un usuario por alias en otra tabla: siempre por `user_id`.
- Los montos siempre como texto decimal → stroops (`src/lib/money.ts`); nunca
  `float`.
- Las migraciones se generan con `npm run db:generate` y se revisan a mano
  antes de aplicarse; no se edita el snapshot de Drizzle a mano.
