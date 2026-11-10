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

**Lo único que queda pendiente de verdad** es correr el flujo completo contra
el contrato ya desplegado en testnet con cuentas fondeadas — no se pudo hacer
desde este entorno de desarrollo, que no tiene salida de red ni a Stellar ni
a Postgres externo (ver `TESTNET.md`). Todo lo demás de la lista de
prioridades original (job de expiración en segundo plano, notificaciones
traducidas, tests automatizados, saldo real de wallet, editar/cancelar antes
de la aceptación, motivo obligatorio al rechazar, y la decisión sobre el link
de invitación) está resuelto — ver las entradas del 2026-09-21 más abajo.

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

## 2026-09-21 — Job de expiración, notificaciones traducidas, tests, decisión de alcance

Cierre de los cuatro puntos que quedaban en la lista de prioridades anterior.

1. **Job de expiración en segundo plano.** `expireStaleContracts()` en
   `contracts.ts` reutiliza exactamente la misma regla que el chequeo
   perezoso (`applyPendingExpiry`), pero barre todas las garantías
   `PENDING_ACCEPTANCE`/`ACTIVE` en vez de una sola. Expuesto en
   `GET /api/cron/expire`, protegido con `CRON_SECRET` (rechaza toda
   request si no está configurado — no hay modo abierto, porque esto puede
   cancelar o vencer garantías reales). `vercel.json` lo programa a diario
   vía Vercel Cron; fuera de Vercel, cualquier scheduler puede pegarle con
   `Authorization: Bearer $CRON_SECRET`.
2. **Notificaciones traducidas.** `notifications.kind` pasó a `NOT NULL` y
   se agregó `notifications.data` (jsonb) con los valores de interpolación.
   `notify()` ya no recibe `title`/`body` armados en inglés, sólo `kind` +
   `data`; el kind se granularizó (por ejemplo `GUARANTEE_REJECTED` se
   separó en `GUARANTEE_REJECTED_BY_LANDLORD`, `GUARANTEE_WITHDRAWN` y
   `GUARANTEE_CANCELLED_UNFUNDED`, que antes compartían un mensaje
   ambiguo). El diccionario tiene `notifications.titles[kind]` y
   `notifications.bodies[kind]` en ambos idiomas; la página de
   notificaciones interpola en el idioma de quien la lee, no del que la
   generó. Filas viejas (`data` null) siguen mostrando su texto en inglés
   ya guardado, como fallback.
3. **Tests automatizados.** `business-rules.test.ts` y `alias.test.ts`
   (puros, sin DB) más `services/settlement-flows.integration.test.ts`, que
   corre contra un Postgres real y codifica exactamente los escenarios que
   se venían verificando a mano: devoluciones parciales sucesivas + una
   devolución unilateral que cierra la garantía, que un settlement no puede
   superar el saldo bloqueado, motivo obligatorio al rechazar, extensión
   con aumento y con disminución, editar/cancelar sólo antes de la
   aceptación (y que el locador no puede hacerlo), expiración automática, y
   que la comisión se cobra sólo sobre lo que recibe el garante. La suite
   se salta sola (`describe.skipIf`) si no hay una base de datos
   alcanzable, así que no rompe un entorno sin Postgres (por ejemplo, si
   algún día se corre `npm test` en el build de Vercel).
4. **Decisión de alcance: no se repone el link de invitación.** El modelo
   SAFEXY ya asume que el locador tiene cuenta (alta por alias, "si se
   envió a un alias inexistente no se permite"); un fallback por link
   reabriría el caso que el modelo descarta a propósito. Se documenta como
   decisión cerrada en `BUSINESS_RULES.md`, no como pendiente.

Nota operativa para quien aplique `0002_notifications_data_kind.sql` sobre
una base con datos de demo previos a este cambio: el `ALTER TYPE` del enum
de notificaciones falla si hay filas con un valor de `kind` que ya no
existe (por ejemplo `GUARANTEE_REJECTED`). Sobre una base sin datos reales
(testnet/demo), lo más simple es vaciar `notifications` antes de migrar.

Verificado: los tres scripts de verificación manuales anteriores
(`demo-flow.ts` + los dos scripts ad hoc de las sesiones previas) se
volvieron a correr contra Postgres real después de estos cambios y siguen
pasando; se confirmó además que una notificación nueva se renderiza en
español con los datos interpolados correctamente. `lint`, `typecheck`,
`vitest` (43/43, siete de ellos de integración contra Postgres real),
`next build` y `cargo test` (27/27) en verde.

**Pendiente real:** correr contra el contrato desplegado en testnet con
cuentas fondeadas (sigue sin poder hacerse desde este entorno de
desarrollo, que no tiene salida de red a Stellar ni a Postgres externo).

## 2026-10-03 — Verificación end-to-end contra el contrato v2 en testnet

Cerrado el último pendiente real del repo. Se levantó un entorno local completo
(Postgres descartable en `127.0.0.1:5433`, migraciones `0000`–`0002`, servidor
Next.js con `.env.local` apuntando a testnet y al contrato v2) y se corrió
`scripts/demo-flow.ts` con las cuentas de testnet `guarantor`
(`GDGZ7E2PJZ33M2X7EDDZ65KJCJWQP5QCZWDEBHSBRNHNQRYCGMHXJGBH`) y `landlord`
(`GBYME6KARFMF4GX62SOH6WWJJXBOUKZNBJN3XOPOYQUOG3RGF4A3HX5A`).

Resultado (`SFX-2026-000101`, on-chain id `2026000101`): registro por alias,
aceptación del locador, fondeo de 1000 USDC, pedido de devolución total,
contraoferta 700/300, contraoferta 850/150, aceptación y ejecución —
**transacciones reales**, no simuladas.

Verificación on-chain y de balances (previo → posterior):
- `get_guarantee(2026000101)` → `funded = 1000`, `locked = 0`, `state = Closed`.
- Garante: 1849,575 → **1699,15** USDC (−1000 fondeado + 849,575 devuelto).
- Locador: 150 → **300** USDC (+150).
- Tesorería: 0,575 → **1,00** USDC (+0,425 = 0,05 % de los 850 devueltos).

El split 850/150 y la comisión de 0,05 % sobre lo devuelto al garante coinciden
exactamente con lo esperado. Quedan confirmados `SOROBAN_CONTRACT_ID =
CCAT2N5J...` y el SAC de USDC `CDSA3RLX...` como los del contrato v2.

Nota operativa: `contract_counters` se inicializó en 100 para no colisionar con
las garantías `1`/`2` que ya existían en testnet de la verificación previa.

**Pendiente real:** ninguno en el flujo principal. Queda el paso a mainnet y la
decisión de producto que implica — fuera del MVP, que es testnet por diseño.

## 2026-11-08 — Semana 1 Instaward: devoluciones parciales sucesivas on-chain

Ejecutado el entregable de la **Semana 1** del SOW (`scripts/partial-returns-flow.ts`)
contra el contrato v2 en Stellar testnet (`CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV`),
forzando el flujo real de firma en 2 pasos (`startStep` → XDR firmado por la
wallet → `completeStep` con validación `assertMatchesCall` → envío a Soroban RPC).

### Ajustes de integración resueltos al correr contra la red real

1. **Validación de cuenta origen en `assertMatchesCall` (`guarantee-contract.ts` / `chain.ts`)**:
   se verifica que `tx.source` coincida con la wallet de la parte que ejecuta el
   paso (`expectedSource`), además del contrato, método y argumentos, y se
   reintentan envíos cuando Soroban RPC responde `TRY_AGAIN_LATER`.
2. **Numeración de rondas y auto-aceptación en `chain.ts`**: en devoluciones
   parciales sucesivas, `round` ahora continúa la secuencia histórica de la
   garantía (`lastProposalRound + 1`) en lugar de reiniciarse a `1` tras cada
   liquidación parcial; además se bloquea off-chain que quien propuso acepte su
   propia propuesta.
3. **Contraofertas parciales en UI (`contract-actions.tsx`) y validación de
   monto cero (`money.ts`)**: se habilitó el campo editable para el locador en
   contraofertas para permitir repartos parciales (`toGuarantor + toLandlord <= locked`),
   se limpian los inputs tras cada paso y `amountsWithinLocked` rechaza
   propuestas `0 / 0`.
4. **Aislamiento de tests de integración (`settlement-flows.integration.test.ts`)**:
   se fuerza modo simulado en la suite de Postgres cuando `.env.local` tiene
   cargadas las variables de testnet, y se amplió el test para cubrir dos
   devoluciones parciales negociadas sucesivas antes de la devolución unilateral
   (44/44 tests en verde).

### Evidencia on-chain (`SFX-2026-000102`, on-chain id `2026000102`)

| Paso | Operación Soroban | Tx hash | Explorer |
| --- | --- | --- | --- |
| 1. Registro | `create_guarantee(2026000102, 1000 USDC)` | `4eacf18f2bec60137c9774becadc0bda05d9907612223b209d6170bc8dcf16e3` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/4eacf18f2bec60137c9774becadc0bda05d9907612223b209d6170bc8dcf16e3) |
| 2. Fondeo | `fund_guarantee(2026000102)` | `efcd03fb379ac02f9db759c32c2c6135a3ebf224562e873b7a50250cf9f72f59` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/efcd03fb379ac02f9db759c32c2c6135a3ebf224562e873b7a50250cf9f72f59) |
| 3. Parcial #1 — propuesta garante | `propose_settlement(350 / 0)` | `e30dc41d6a0b995dd3867843f4167152d342cb9e9f2a1a003228d7371637ce7f` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/e30dc41d6a0b995dd3867843f4167152d342cb9e9f2a1a003228d7371637ce7f) |
| 4. Parcial #1 — contraoferta locador | `propose_settlement(250 / 50)` | `e09a05153e69a0c9fd0531f2360072bb80d065b3d592fff577d4d19723173ab2` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/e09a05153e69a0c9fd0531f2360072bb80d065b3d592fff577d4d19723173ab2) |
| 5. Parcial #1 — aceptación garante | `accept_settlement(2026000102)` | `587d1bc1f155a5223c2c71e92d982b0cb47dfa014dd5e20af8d315a7107e8ef5` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/587d1bc1f155a5223c2c71e92d982b0cb47dfa014dd5e20af8d315a7107e8ef5) |
| 6. Parcial #1 — ejecución | `execute_settlement(2026000102)` | `a024210adc300cec65af8716fa190d0146f5e3786f47b9692256d1b6af45f637` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/a024210adc300cec65af8716fa190d0146f5e3786f47b9692256d1b6af45f637) |
| 7. Parcial #2 — propuesta garante | `propose_settlement(300 / 0)` | `82c4902d13f2fd6d32d148c453036083b6e11ea872df98eedd0f3822d548ae19` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/82c4902d13f2fd6d32d148c453036083b6e11ea872df98eedd0f3822d548ae19) |
| 8. Parcial #2 — aceptación locador | `accept_settlement(2026000102)` | `faab3c3f3b41efe2dfdd0c0984c12aa3773b950906fc2c4c45be2effb6e654ac` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/faab3c3f3b41efe2dfdd0c0984c12aa3773b950906fc2c4c45be2effb6e654ac) |
| 9. Parcial #2 — ejecución | `execute_settlement(2026000102)` | `fcac62ed1c2b6cae23108a08ac2881c18294504b8c666339d384788195e88b49` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/fcac62ed1c2b6cae23108a08ac2881c18294504b8c666339d384788195e88b49) |

Verificación de estado on-chain y balances (antes → después de Parcial #1 → después de Parcial #2):
- `get_guarantee(2026000102)` tras Parcial #1: `funded = 1000` USDC, **`locked = 700` USDC**, `state = Active`.
- `get_guarantee(2026000102)` tras Parcial #2: `funded = 1000` USDC, **`locked = 400` USDC**, `state = Active`.
- Garante (`GDGZ7E…JGBH`): 1699,15 → **1248,875** USDC (−1000 fondeado + 249,875 neto en Parcial #1 + 299,85 neto en Parcial #2).
- Locador (`GBYME6…HX5A`): 300,00 → **350,00** USDC (+50 en Parcial #1 + 0 en Parcial #2).
- Tesorería (`GCBM7P…UZUB`): 1,00 → **1,275** USDC (+0,125 en Parcial #1 + 0,15 en Parcial #2 = 0,05 % de 550 USDC devueltos al garante).

## 2026-11-08 — Semanas 2, 3 y 4 Instaward: devolución unilateral, extensiones, demo pública y reporte consolidado

Cerrados los entregables restantes del SOW de 30 días:

### Semana 2 — Devolución unilateral del locador y extensiones (aumento y reducción) on-chain

Ejecutado `scripts/unilateral-and-extensions-flow.ts` contra el contrato v2 en
Stellar testnet (`SFX-2026-000103`, on-chain id `2026000103`) con firma de XDR en
2 pasos:

| Paso | Operación Soroban | Tx hash | Explorer |
| --- | --- | --- | --- |
| 1. Registro | `create_guarantee(2026000103, 600 USDC)` | `a59454541b03f4db9dab105c25cddbb511824b312310bad4a61d9b5f44640aa4` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/a59454541b03f4db9dab105c25cddbb511824b312310bad4a61d9b5f44640aa4) |
| 2. Fondeo | `fund_guarantee(2026000103)` | `3534565a9f3ffc75fb78c6e1de444f35136b4e6b0982fe1971d2b9a3ca0aadad` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/3534565a9f3ffc75fb78c6e1de444f35136b4e6b0982fe1971d2b9a3ca0aadad) |
| 3. Devolución unilateral #1 (parcial) | `return_to_guarantor(2026000103, 200 USDC)` | `ba2bd381ec8568a17a430d2429d30a8a2300f6b1f90b1260d67a242573b61076` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/ba2bd381ec8568a17a430d2429d30a8a2300f6b1f90b1260d67a242573b61076) |
| 4. Extensión aumento — propuesta (+300 top-up) | `propose_extension(2026000103, 2027-06-30, 700 USDC)` | `f6e2dad170ce58576e4a60d5c62b5ad008112c1a357c1740f04c0091d8269318` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/f6e2dad170ce58576e4a60d5c62b5ad008112c1a357c1740f04c0091d8269318) |
| 5. Extensión aumento — aceptación | `accept_extension(2026000103)` | `92b8a4a591e8ab30baaa2817fa41e8fc75027f45b7ae9d69acd396f4d6197ef1` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/92b8a4a591e8ab30baaa2817fa41e8fc75027f45b7ae9d69acd396f4d6197ef1) |
| 6. Extensión reducción — propuesta (−200 reembolso) | `propose_extension(2026000103, 2027-12-31, 500 USDC)` | `629a903d3057c24e9d9632efc4bc4bbf0d95e4dbe701b45a87b11c5fc8d4e863` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/629a903d3057c24e9d9632efc4bc4bbf0d95e4dbe701b45a87b11c5fc8d4e863) |
| 7. Extensión reducción — aceptación | `accept_extension(2026000103)` | `24ba11152cb342ef7b4ed678dc480046ed8f1da8d5999d5f1d0891d70cee397c` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/24ba11152cb342ef7b4ed678dc480046ed8f1da8d5999d5f1d0891d70cee397c) |
| 8. Devolución unilateral #2 (cierre) | `return_to_guarantor(2026000103, 500 USDC)` | `94e0e9768870c7f53650bb25bda0941db86fab40ccf9d1b4c7b1cfc222c3f5f6` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/94e0e9768870c7f53650bb25bda0941db86fab40ccf9d1b4c7b1cfc222c3f5f6) |

Estado on-chain verificado tras cada mecánica (`get_guarantee(2026000103)`):
- Tras `fund`: `funded = 600` USDC, `locked = 600` USDC, `state = Active`.
- Tras devolución unilateral #1 (`200` USDC): `funded = 600` USDC, **`locked = 400` USDC**, `state = Active`.
- Tras extensión con aumento (`400 → 700` USDC): **`funded = 900` USDC**, **`locked = 700` USDC**, `endDate = 2027-06-30`, `state = Active`.
- Tras extensión con reducción (`700 → 500` USDC): **`funded = 900` USDC**, **`locked = 500` USDC**, `endDate = 2027-12-31`, `state = Active`.
- Tras devolución unilateral de cierre (`500` USDC): **`funded = 900` USDC**, **`locked = 0` USDC**, **`state = Closed`**.
- Balances en Horizon: garante `1248,875` → **`1248,425` USDC**; locador `350,00` → **`350,00` USDC**; tesorería `1,275` → **`1,725` USDC** (`+0,45` USDC = 0,05 % sobre los 900 USDC devueltos al garante).

### Semana 3 — Deploy público en Vercel y acceso rápido para evaluadores

- `scripts/migrate.ts` inicializa `contract_counters >= 200` (evitando colisiones con garantías previas en testnet) y asegura las cuentas de prueba `@alice.guarantor` (`alice@example.com`) y `@bob.landlord` (`bob@example.com`, contraseña `demo1234`) vinculadas a las wallets fondeadas de testnet.
- Se agregaron botones de acceso en 1 clic para evaluadores en `/login` (`src/components/auth-form.tsx`) y el walkthrough paso a paso en `MD/VERIFICATION.md` y `TESTNET.md`.

### Semana 4 — Reporte consolidado de verificación

- Creado `MD/VERIFICATION.md` con las 24 transacciones reales firmadas de las tres corridas end-to-end (`2026000101`, `2026000102`, `2026000103`), links directos a `stellar.expert`, estados on-chain, balances de Horizon, logs de ejecución y guía para evaluadores.

## 2026-11-10 — Comisión corregida a 0,5 % (mitad del 1 %)

Se corrige el valor de la comisión de plataforma: había quedado tipeada como
`0,05 %` (5 bps) en lugar de la **mitad del 1 % (`0,5 %` = 50 bps)** que era la
intención comercial desde el origen del proyecto.

- `src/lib/business-rules.ts`: `FEE_BPS = 50` (0,5 %). Con una devolución de
  `1.000 USDC` la comisión pasa a **`5,00 USDC`** y el neto a **`995,00 USDC`**.
- `contracts/safexy-guarantee`: el contrato ya era parametrizable en
  `fee_bps`; los tests ahora usan `50` (0,5 %) y siguen cubriendo el redondeo
  hacia arriba al stroop y la regla de cobrar sólo sobre lo devuelto al garante.
- UI, simulador de costo/rendimiento, textos de i18n (es/en), FAQ, deck y
  documentación (`BUSINESS_RULES.md`, `BLOCKCHAIN.md`, `FUNDING.md`,
  `USER_FLOWS.md`, `README.md`, `SMART_CONTRACT.md`, `TESTNET.md`) actualizados
  a 0,5 %.
- **Acción operativa pendiente:** el contrato ya desplegado en testnet conserva
  `fee_bps = 5`; para alinearlo hay que ejecutar `set_fee_bps(50)` desde la
  cuenta `admin` (`GCE5L7F…MWM7V`). No requiere redesplegar.
- Las corridas de verificación on-chain previas (`SFX-2026-000101/102/103`) se
  mantienen tal cual porque documentan lo que realmente ocurrió con la
  configuración vigente en ese momento (5 bps).
- Decisión de producto asociada: la comisión de los **corredores inmobiliarios**
  se cobra aparte, como honorario de gestión propio del corredor, para que el
  incentivo sea relevante para ellos.
