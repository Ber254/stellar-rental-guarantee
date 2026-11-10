# BLOCKCHAIN — Stellar, Soroban y USDC

## Estado actual

- Red **Stellar testnet**; RPC `https://soroban-testnet.stellar.org`,
  Horizon `https://horizon-testnet.stellar.org`.
- Contrato SAFEXY v2 desplegado:
  `CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV`
  (fuente en `contracts/safexy-guarantee/`, 27 tests Rust).
- Tesorería de comisiones (testnet):
  `GCBM7PFRWJ2OKMPI26FK22ZKBNLR4UUSR76NY52FU2JWOAEV4LNKUZUB`; admin:
  `GCE5L7F7MMVFCQ3VQL3QWWTHKY6UWB3KO6FL65EDJFD2TL5UE42MWM7V`; `fee_bps = 5`.
- USDC de prueba: emisor
  `GANGXXPF6NIMUR4CEAFIOCSQH7UMQRCA5SQN6N3NCXOPGMNXNVD5X3HA`,
  SAC `CDSA3RLXVDMZGV6ZWDZY3HKFDJT2ZSEUCHPMG3OQXQUNU5W64XMHCIIO`.
- Firma en el navegador con **Freighter**; la plataforma nunca guarda claves
  privadas de usuarios.
- Validación de seguridad: el XDR firmado que llega del navegador se compara
  contra la llamada que el servidor planificó — mismo contrato, misma función,
  mismos argumentos, una sola operación (`assertMatchesCall`).
- **Modo demo**: si falta configuración de cadena, el flujo completo corre
  off-chain y las operaciones se marcan `simulated`.

## Interfaz v2

```
create_guarantee(id, guarantor, landlord, token, amount, end_date) // auth: garante
fund_guarantee(id)                                                 // auth: garante
cancel_guarantee(id, caller)                                       // sólo si nunca se financió
propose_settlement(id, proposer, to_guarantor, to_landlord)        // la suma puede ser < saldo
accept_settlement(id, acceptor)                                    // no se puede aceptar la propia
reject_settlement(id, caller)
execute_settlement(id)                                             // paga lo acordado
return_to_guarantor(id, amount)                                    // auth: locador, unilateral
propose_extension(id, new_end_date, new_amount)                    // auth: garante
accept_extension(id)                                               // auth: locador
cancel_extension(id, caller)
set_treasury(treasury) / set_fee_bps(bps)                          // auth: admin
get_guarantee / get_settlement / get_agreement / get_extension / get_config / quote_fee
```

Estados on-chain: `Pending → Active → Closed`, más `Cancelled`. `locked` es el
saldo todavía bloqueado y `funded` el total depositado (incluye top-ups). La
garantía cierra sólo cuando `locked` llega a 0, por lo que admite múltiples
devoluciones parciales.

## Comisión

0,5 % (`fee_bps = 50`, denominador 10 000) sobre el monto efectivamente devuelto
al garante, redondeado hacia arriba al stroop, enviado a `treasury`. No se cobra
sobre lo que recibe el locador. Tesorería y porcentaje son configurables por el
admin sin redesplegar (tope 5 %).

> Nota: los primeros despliegues de testnet usaron `fee_bps = 5` (0,05 %). El
> 2026-11-10 se fijó la comisión comercial en **0,5 % (`fee_bps = 50`)**, que es
> la que aplica el código actual (`src/lib/business-rules.ts`). El contrato ya
> desplegado puede actualizarse con `set_fee_bps(50)` desde la cuenta admin, sin
> necesidad de redesplegar.

## Redeployment v2

| | Contrato |
| --- | --- |
| Anterior | `CB3JG5IKMHKUXRPYSZ6UVOEJ42XXGQQOIBK4UBYEPYSTGBZ6IIAN5LAH` (`rental-guarantee`) |
| Nuevo | `CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV` (`safexy-guarantee`) |

Motivo: el contrato anterior no soportaba el modelo SAFEXY. Sus límites eran
bloqueantes y no parcheables por configuración:

1. `release_funds` pagaba el total y cerraba la garantía — sin devolución
   parcial ni saldo remanente.
2. La distribución debía sumar exactamente el monto bloqueado.
3. No existía destino de comisión ni parámetro de fee.
4. No existía extensión de plazo ni cambio de monto.
5. Los roles se llamaban `tenant`/`landlord`, atados al contrato de alquiler.

Diferencias: estados nuevos (`Pending/Active/Closed/Cancelled`), `locked` +
`funded`, settlement que puede sumar menos que el saldo, `return_to_guarantor`
unilateral del locador, extensiones con top-up o devolución de diferencia,
configuración on-chain de admin/tesorería/fee y constructor obligatorio.

Impacto sobre datos existentes: ninguna garantía real está protegida (testnet /
demo). Las garantías creadas contra el contrato anterior quedan huérfanas del
nuevo `SOROBAN_CONTRACT_ID`; se tratan como datos de demo y no se migran. El
contrato anterior sigue existiendo en testnet, sin uso.

Verificación en testnet tras el deploy: `quote_fee(400 USDC) = 0,20 USDC`;
garantía de 1000 USDC creada y financiada, devolución parcial de 300 USDC
acordada y ejecutada → 299,85 USDC al garante, 0,15 USDC a la tesorería y
700 USDC siguen bloqueados con la garantía `Active`.

## Pendientes

1. ~~Actualizar el cliente TypeScript (`src/lib/stellar/`) a la interfaz v2.~~
   Hecho: `guarantee-contract.ts` habla `create_guarantee` (roles
   `guarantor`/`landlord`), `propose_settlement`/`accept_settlement`/
   `reject_settlement`/`execute_settlement`, `return_to_guarantor`,
   `propose_extension`/`accept_extension`/`cancel_extension` y `quote_fee`.
    Verificado end-to-end (creación, aceptación, fondeo, devoluciones
    parciales sucesivas, devolución unilateral, extensión con aumento y con
    disminución) contra un Postgres real en modo simulado. **Hecho también
    contra el contrato desplegado en testnet**:
    - 2026-10-03 (`SFX-2026-000101`, on-chain `2026000101`): split final 850/150
      y comisión de 0,05 % (config vigente en ese momento) confirmados en balances
      reales.
    - 2026-11-08 — Semana 1 Instaward (`SFX-2026-000102`, on-chain `2026000102`):
      **devoluciones parciales sucesivas** con firma de XDR en 2 pasos
      (`startStep` → firma cliente → `completeStep` con `assertMatchesCall`):
      1.ª devolución parcial negociada 250/50 (300 USDC liberados, `locked = 700`
      USDC, `state = Active`) seguida de 2.ª devolución parcial 300/0 (300 USDC
      liberados, **`locked = 400` USDC**, `funded = 1000` USDC, `state = Active`).
    - 2026-11-08 — Semana 2 Instaward (`SFX-2026-000103`, on-chain `2026000103`):
      **devolución unilateral del locador** (parcial de 200 USDC → `locked = 400`
      USDC), **extensión con aumento** (`400 → 700` USDC, top-up de +300 USDC,
      `funded = 900` USDC), **extensión con reducción** (`700 → 500` USDC,
      reembolso de 200 USDC menos comisión de 0,05 % vigente en esa corrida) y **devolución unilateral
      de cierre** (`500` USDC → `locked = 0` USDC, `state = Closed`). Ver
      reporte consolidado en `MD/VERIFICATION.md`.
2. ~~Actualizar `SOROBAN_CONTRACT_ID` en Vercel al contrato nuevo.~~ Hecho en
   `https://rental-guarantee-stellar.vercel.app`.
3. ~~`PLATFORM_SECRET_KEY` está vacía en producción.~~ Cargada y verificada en
   producción (Vercel).

## Regla

No reemplazar estas integraciones por mocks. Si un flujo nuevo necesita algo
que el contrato no soporta, se documenta el límite y se elige explícitamente
entre "resolver off-chain" y "modificar el contrato".
