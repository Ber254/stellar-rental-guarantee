# BUSINESS_RULES — Reglas de negocio

Toda regla configurable vive en un único módulo (`src/lib/business-rules.ts`),
nunca duplicada en componentes o servicios.

## Comisión

- **0,05 % del valor devuelto**, cobrada en el momento de la devolución.
- Se aplica sobre el monto que efectivamente se devuelve, no sobre el total de
  la garantía.
- Configurable centralmente; cualquier cambio se anota en `CHANGELOG.md`.

Ejemplo:

```
Devolución:        1000 USDC
Comisión (0,05 %):    0,50 USDC
Neto al usuario:    999,50 USDC
```

Redondeo: la comisión se calcula en stroops (7 decimales) y se redondea **hacia
arriba** al stroop; el neto es `devuelto − comisión`, de modo que la suma
distribuida siempre iguala el monto liberado.

## Expiración por falta de aceptación

Si una garantía sigue pendiente **más de un mes después del inicio del período**:

1. Se cancela automáticamente.
2. El monto vuelve a estar disponible para el garante.
3. Queda registrado en el historial y se notifica a ambas partes.

## Quién puede hacer qué

| Acción | Garante | Locador |
| --- | --- | --- |
| Crear garantía | Sí | — |
| Aceptar / denegar | — | Sí (motivo obligatorio al denegar) |
| Solicitar devolución total o parcial | Sí | — |
| Aprobar / rechazar devolución | — | Sí (motivo obligatorio al rechazar) |
| Devolución unilateral a favor del garante | — | Sí |
| Iniciar extensión | Sí | — |
| Aceptar extensión | — | Sí |
| Retirar fondos de forma unilateral | No | No |

## Fondos

- Ninguna parte puede retirar fondos sin acuerdo; la plataforma no arbitra.
- El monto de una garantía pendiente o activa está comprometido y no cuenta en
  el saldo disponible.
- Toda salida de dinero genera un registro de transacción con su hash.

## Devolución parcial: qué pasa con el remanente

**Decisión:** el remanente queda bloqueado y la garantía sigue activa por el
monto reducido, sin cambiar el período.

**Resuelto:** implementado como liberación parcial dentro del contrato
(`contracts/safexy-guarantee`, desplegado en testnet como
`CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV`). El contrato lleva
un saldo `locked` que se descuenta en cada `execute_settlement` o
`return_to_guarantor`; la garantía sigue `Active` mientras `locked > 0` y pasa
a `Closed` sólo cuando llega a 0. No hay ciclo cerrar-y-recrear ni
fragmentación del historial on-chain — ver `BLOCKCHAIN.md` para la interfaz
completa y la verificación en testnet.

Pendiente: el cliente TypeScript (`src/lib/stellar/guarantee-contract.ts`) y
los servicios de la app todavía apuntan a la interfaz v1
(`create_guarantee`/`propose_distribution`/`release_funds` sobre
`tenant`/`landlord`) y al contrato viejo. Migrarlos a la interfaz v2 es el
siguiente paso antes de poder ofrecer devoluciones parciales reales desde la
UI.

## Contradicciones con el comportamiento original (resueltas)

| Regla SAFEXY | Comportamiento original | Resolución | Estado |
| --- | --- | --- | --- |
| Quien pone el dinero es el garante | Lo pone el `tenant` (inquilino) y lo crea él | Rol renombrado a `guarantor` en DB, contrato y UI | Hecho |
| Contraparte por alias | Por token de invitación en un link | `landlordAlias` resuelve a un `user_id` existente al crear; ya no hay invitación por link | Hecho |
| Rechazo con motivo | No existe rechazo de la invitación | Estado `REJECTED` + `rejection_reason` obligatorio | Hecho |
| Expiración automática al mes | No existe | Chequeo perezoso en `getContractForUser`/`listContracts` (`applyPendingExpiry`) | Hecho — falta un job en background para guarantías que nadie vuelve a abrir |
| Comisión 0,05 % | No hay comisión | Cobrada on-chain (`fee_bps`) y reflejada off-chain (`agreements.fee_amount`) | Hecho |
| Devolución unilateral del locador | Sólo el tenant puede pedir la devolución | `return_to_guarantor` / paso `return-unilateral` | Hecho |
| Extensión | No existe | `propose_extension`/`accept_extension`/`cancel_extension`, con top-up o devolución de la diferencia | Hecho |
| Estados humanos | Se muestran estados internos | `t.status[...]` en toda la UI, `STATUSES.md` como fuente de verdad | Hecho |
| Notificaciones traducidas | `title`/`body` en inglés ya renderizado | Sigue en inglés; `notifications.kind` está tipado pero no se usa todavía para traducir | Pendiente |
| Saldo disponible en el perfil | No existía | El perfil muestra el monto comprometido en garantías; el saldo de la wallet en sí no se consulta on-chain todavía | Parcial |
