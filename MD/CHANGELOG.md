# CHANGELOG — Decisiones funcionales

Sólo decisiones de producto y reglas de negocio. Los cambios de código viven en
el historial de git.

## 2026-09-20

- Se crea el context package `/MD` y se documenta el sistema actual antes de
  empezar el refactor a SAFEXY (`ARCHITECTURE_CURRENT.md`).
- Se define el modelo: la garantía es la entidad central; garante y locador son
  roles **de la garantía**, no del usuario.
- Se define el alias como máscara legible y modificable sobre un `user_id`
  inmutable; las garantías referencian siempre al `user_id`.
- Se fija la comisión en **0,05 % del valor devuelto**, cobrada al devolver y
  configurada en un único módulo.
- Se fija la expiración automática: pendiente por más de un mes desde el inicio
  del período → cancelación y liberación de fondos.
- Se define el conjunto de estados visibles y su mapeo con los internos;
  se agregan `REJECTED` y `EXPIRED`, que hoy no existen.
- Devolución parcial: el remanente queda bloqueado y la garantía sigue activa
  con el monto reducido. Pendiente de elegir la implementación (cerrar-y-recrear
  vs. liberación parcial en el contrato) — ver `BUSINESS_RULES.md`.
- Se conservan sin cambios la integración real con Stellar/Soroban/USDC, la
  validación del XDR firmado, la autenticación, los idiomas (es/en) y los temas
  (modern/retro).

## 2026-09-20 (continuación — auditoría y consolidación)

- **Motivo:** se retomó el trabajo con la consigna de auditar el repo antes de
  tocar nada. Hallazgo clave: el trabajo de Devin descrito arriba no estaba en
  `main` — vivía en dos Pull Requests abiertos y nunca mergeados:
  - PR #1 `devin/1789647103-i18n-themes` — i18n es/en + temas modern/retro.
  - PR #2 `devin/1789910654-safexy-md` — el `/MD` completo (12 documentos) +
    reescritura del contrato (`contracts/rental-guarantee` →
    `contracts/safexy-guarantee`) con saldo `locked` para devoluciones
    parciales, comisión configurable (`fee_bps`, tesorería on-chain) y
    extensión (`propose_extension`/`accept_extension`), ya **redesplegado en
    testnet** (`CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV`),
    27 tests de Rust en verde.
  - **Impacto:** ambas ramas se mergearon sin conflictos a
    `claude/dreamy-curie-eopllt` (base `main`). `npm run lint`,
    `npm run typecheck`, `npm test` (22/22) y `npm run build` quedaron en
    verde; `cargo test` en `contracts/` sigue en 27/27. Los PRs #1 y #2 siguen
    abiertos en GitHub — no se cerraron, quedan a criterio del dueño del repo.
- Se corrige `BUSINESS_RULES.md`: la sección de devolución parcial recomendaba
  todavía la opción "cerrar y recrear" como entrega inicial, pero el PR #2 ya
  había implementado y verificado en testnet la opción de liberación parcial
  dentro del contrato. Documento actualizado para reflejar lo que realmente
  está desplegado.
- **Riesgo identificado (no resuelto todavía):** el cliente TypeScript
  (`src/lib/stellar/guarantee-contract.ts`), los servicios
  (`src/lib/services/contracts.ts`, `chain.ts`) y el esquema de base de datos
  (`src/lib/db/schema.ts`, tablas `rental_contracts`/`guarantees`/`proposals`)
  siguen apuntando a la interfaz v1 del contrato viejo
  (`create_guarantee`/`propose_distribution`/`release_funds` sobre
  `tenant`/`landlord`, sin comisión, sin extensión, sin saldo parcial) y a
  `SOROBAN_CONTRACT_ID` vacío (modo demo). Nada de esto mueve fondos reales
  hoy porque todo corre en modo simulado, pero es el motivo por el que **no**
  se tocó el esquema de base de datos ni las rutas de API en esta sesión:
  renombrar columnas (`tenant_id` → `guarantor_id`) o cambiar la forma de
  `guarantees` en un solo paso sin reescribir a la vez servicios, rutas y UI
  habría dejado el build roto. Es trabajo real pendiente, no una decisión de
  arquitectura abierta: el contrato v2 y el modelo de datos objetivo ya están
  definidos en `BLOCKCHAIN.md` y `DATABASE.md`.

### Próximos pasos, en orden

1. Migrar `src/lib/stellar/guarantee-contract.ts` a la interfaz v2
   (`create_guarantee`/`fund_guarantee`/`propose_settlement`/
   `accept_settlement`/`execute_settlement`/`return_to_guarantor`/
   `propose_extension`/`accept_extension`/`quote_fee`, roles
   `guarantor`/`landlord`).
2. Migrar el esquema (`users.alias` + `user_alias_history`,
   `rental_contracts` → conceptualmente `guarantees` con `guarantor_id`,
   estados `REJECTED`/`EXPIRED` + `rejection_reason`, tablas `returns` y
   `extensions`, `notifications.kind`) con una migración Drizzle generada
   (`npm run db:generate`), revisada a mano, no editada.
3. Reescribir `src/lib/services/contracts.ts` y las rutas de
   `src/app/api/contracts/**` sobre el nuevo esquema y el cliente v2:
   alta por alias (no por link), aceptar/denegar con motivo, solicitar
   devolución total/parcial, devolución unilateral del locador, extensión.
4. Expiración automática (chequeo perezoso al leer + job) según
   `BUSINESS_RULES.md`.
5. UI: perfil con alias, dashboard "Mis garantías" / "Garantías a mi favor",
   flujo de devolución/extensión, FAQ y "¿Cómo funciona?" por pantalla.
6. Actualizar `SOROBAN_CONTRACT_ID` en `.env`/Vercel al contrato v2 una vez
   el cliente esté migrado.
