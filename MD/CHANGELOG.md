# CHANGELOG — Decisiones funcionales

Sólo decisiones de producto y reglas de negocio. Los cambios de código viven en
el historial de git.

## Para quien retome el trabajo (Devin u otro agente)

**Rama de partida obligatoria: `claude/dreamy-curie-eopllt`.** No arrancar
desde `main` ni desde `devin/1789647103-i18n-themes` o
`devin/1789910654-safexy-md` — esas dos ramas (PR #1 y PR #2 en GitHub) ya
están mergeadas *dentro* de `claude/dreamy-curie-eopllt`, más la integración
completa de la capa de aplicación (esquema, cliente Stellar v2, servicios,
UI). Si se ignora esto se pierde todo ese trabajo o se duplica.

Orden de prioridad sugerido para lo que falta (detalle técnico de cada punto
más abajo, sección "Pendiente" del 2026-09-20):

1. **Job de expiración en segundo plano.** Hoy la cancelación por falta de
   aceptación al mes y el pasaje a `EXPIRED` son perezosos (sólo recalculan
   si alguien abre esa garantía puntual). Es lo más importante porque es una
   regla de negocio explícita que hoy no se cumple sola.
2. Traducir `notifications.title`/`body` usando `notifications.kind` (ya
   tipado en el esquema) en vez de guardar texto en inglés ya renderizado.
3. Tests automatizados de devolución parcial, devolución unilateral y
   extensión (se verificaron a mano contra un Postgres real, no quedaron
   como test del repo — ver la sección de abajo para el detalle exacto de
   qué se probó).
4. Correr el flujo completo contra el contrato desplegado en testnet real
   (hoy sólo se verificó en modo simulado) — requiere cuentas fondeadas,
   ver `TESTNET.md`.
5. Decidir si se repone el link de invitación como fallback del alta por
   alias (se sacó por completo; `BUSINESS_RULES.md` documentaba conservarlo
   como fallback).

~~Saldo real de wallet en el perfil~~ y ~~editar/cancelar antes de la
aceptación~~ y ~~motivo obligatorio al rechazar una devolución~~ — resueltos,
ver la entrada de más abajo.

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

## 2026-09-20 (continuación — integración completa de la capa de aplicación)

Se ejecutaron los 6 pasos del backlog anterior. Cambios principales (el
detalle de cada archivo vive en el historial de git de la rama
`claude/dreamy-curie-eopllt`):

- **Cliente Stellar v2** (`src/lib/stellar/guarantee-contract.ts`): habla la
  interfaz completa de `safexy-guarantee` (`create_guarantee`,
  `fund_guarantee`, `cancel_guarantee`, `propose_settlement`,
  `accept_settlement`, `reject_settlement`, `execute_settlement`,
  `return_to_guarantor`, `propose_extension`, `accept_extension`,
  `cancel_extension`, `quote_fee`).
- **Esquema** (`src/lib/db/schema.ts` + `drizzle/0001_safexy_model_v2.sql`):
  alias/`user_alias_history`, roles `guarantor`/`landlord`, propiedad
  opcional, `REJECTED`/`EXPIRED` + motivo, tabla `extensions`,
  `guarantees.locked_amount`/`funded_amount` (saldo vivo, no el monto fijo
  original), `notifications.kind`. Aplicada y probada contra un Postgres real.
- **`src/lib/business-rules.ts`**: único lugar para la comisión (0,05 %,
  redondeo hacia arriba al stroop) y el umbral de expiración por falta de
  aceptación (30 días desde el inicio del período).
- **`src/lib/alias.ts`**: normalización, validación de formato, verificación
  de disponibilidad y registro de historial al cambiar de alias.
- **Servicios** (`src/lib/services/contracts.ts`, `chain.ts`): alta por
  alias (ya no por link de invitación — se eliminó `/invite/[token]` y
  `/api/invites/[token]`), aceptar/rechazar con motivo obligatorio,
  expiración perezosa (`applyPendingExpiry`, corre en cada lectura), 11 pasos
  de cadena (`create`, `fund`, `cancel`, `propose`, `accept`, `reject`,
  `execute`, `return-unilateral`, `extend-propose`, `extend-accept`,
  `extend-cancel`). Las devoluciones parciales, la devolución unilateral y
  las extensiones se modelan reutilizando `proposals`/`agreements` (con un
  `kind` nuevo) en vez de tablas separadas — ver `DATABASE.md`.
- **API**: nuevas rutas `POST /api/contracts/[id]/accept`,
  `GET /api/users/lookup`, `GET`/`PATCH /api/users/alias`; `reject` ahora
  exige `{ reason }`; `chain` acepta los payloads de devolución unilateral y
  extensión.
- **UI**: alta con alias + apellido y verificación de disponibilidad en vivo
  (registro y perfil), alta de garantía por alias con verificación previa del
  locador, dashboard partido en "Garantías que di" / "Garantías a mi favor",
  detalle de garantía con todas las acciones nuevas (solicitar devolución
  total/parcial, aprobar/rechazar con motivo, devolución unilateral,
  proponer/aceptar/retirar extensión), página de perfil (alias, wallet, monto
  comprometido), página `/faq` con las 15 preguntas mínimas del brief, y un
  `¿Cómo funciona?` colapsable en el detalle de la garantía (oculto por
  defecto). Página `/notifications` + contador de no leídas en el header.
- **Referencia**: prefijo de garantía `RG-` → `SFX-` (`SFX-2026-000123`).

**Verificado end-to-end** contra un Postgres real y el servidor Next.js en
modo simulado (sin contrato desplegado): registro, creación por alias,
aceptar/rechazar con motivo, fondeo, dos devoluciones parciales sucesivas más
una devolución unilateral que cierra la garantía, y una extensión con aumento
seguida de una extensión con disminución — en todos los casos el saldo
bloqueado y el estado terminan donde deberían. `npm run lint`,
`npm run typecheck`, `npm test` (24/24) y `cargo test` (27/27) en verde.

**Pendiente (no bloqueante, documentado para continuar):**

1. Correr el mismo flujo contra el contrato v2 ya desplegado en testnet
   (requiere cuentas fondeadas con USDC de prueba; ver `TESTNET.md`).
2. `notifications.title`/`body` siguen en inglés y ya renderizados; falta
   traducir por `kind`.
3. El perfil muestra el monto comprometido en garantías, no el saldo real de
   la wallet (requeriría consultar el balance USDC en Horizon).
4. La expiración por falta de aceptación y por vencimiento de período es
   perezosa (corre al leer una garantía); no hay todavía un job en segundo
   plano para garantías que nadie vuelve a abrir.
5. No se agregó un test de integración automatizado para los flujos de
   devolución parcial/unilateral/extensión — se verificaron manualmente con
   un script (`scripts/demo-flow.ts` cubre la negociación; el resto se probó
   ad hoc y no quedó como test del repositorio).

## 2026-09-21 — Cierre de huecos contra el mensaje original

Revisión punto por punto del mensaje original (regla 10, 14, 8/21, 22) contra
lo implementado; se encontraron y cerraron cuatro huecos reales:

1. **Editar/cancelar antes de la aceptación** (regla 10: "Antes de ser
   aceptada: puede editarse; puede cancelarse"). Antes sólo se podía cancelar
   después de que el locador aceptaba y antes de fondear. Ahora, mientras la
   garantía está `PENDING_ACCEPTANCE`, el garante puede:
   - Editar monto, alquiler, fechas y notas (`PATCH /api/contracts/[id]`,
     `updatePendingContract`). No se puede cambiar el locador ni el alias —
     eso es crear una garantía nueva, no editar la existente.
   - Cancelarla directamente (`POST /api/contracts/[id]/cancel`,
     `cancelPendingContract`), sin pasar por el escrow porque todavía no hay
     nada registrado on-chain.
2. **Motivo obligatorio al rechazar una devolución.** El rechazo de la
   invitación ya lo exigía; el rechazo de una propuesta de devolución durante
   la negociación no tenía campo en la UI y era opcional en el backend.
   Ahora `chain.ts` rechaza el paso `reject` con `reasonRequired` si no hay
   motivo, y la UI muestra el campo obligatorio.
3. **Saldo disponible real** (regla 8/21: "saldo disponible = fondos en la
   wallet − comprometido"). Se agregó `fetchUsdcBalance` (lee el balance USDC
   de Horizon para la wallet del usuario) en `src/lib/stellar/network.ts`. El
   perfil ahora muestra el saldo disponible real (`balance − comprometido`)
   cuando hay un emisor de USDC configurado (`STELLAR_USDC_ISSUER`); en modo
   demo, sin emisor configurado, sigue mostrando sólo lo comprometido, con la
   etiqueta que ya aclaraba esa limitación.
4. **"¿Cómo funciona?" en cada pantalla importante** (regla 22). Estaba sólo
   en el detalle de la garantía. Se agregó también en el dashboard y en el
   alta de nueva garantía, con texto propio de cada pantalla, siempre
   colapsado por defecto.

Efecto colateral corregido de paso: `proposePayloadSchema` exigía
`toGuarantor`/`toLandlord` incluso para el paso `reject` (que sólo necesita
`reason`), lo que rompía el request con un 422 antes de llegar a la
validación de negocio. Se separó en `proposePayloadSchema` (campos opcionales,
para la validación de forma en la ruta) y `settlementAmountsSchema` /
`proposeWithReasonSchema` (campos requeridos, usados dentro de `propose`).

Verificado con dos escenarios nuevos contra un Postgres real (edición +
cancelación pendiente, incluyendo que el locador no puede editar ni aceptar
una garantía ya cancelada; rechazo de devolución sin motivo devuelve 400
`reasonRequired` y con motivo pasa) además de repetir los cinco escenarios
anteriores para confirmar que no se rompió nada. `lint`, `typecheck`,
`vitest` (24/24) y `next build` en verde.

**Lo que sigue pendiente** (sin cambios respecto a la entrada anterior): job
de expiración en segundo plano, notificaciones traducidas, tests
automatizados en el repo, verificación contra testnet real, y la decisión
sobre el link de invitación como fallback.
