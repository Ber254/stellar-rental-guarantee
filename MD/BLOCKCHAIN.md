# BLOCKCHAIN — Stellar, Soroban y USDC

## Qué está funcionando hoy (no romper)

- Red **Stellar testnet**; RPC `https://soroban-testnet.stellar.org`,
  Horizon `https://horizon-testnet.stellar.org`.
- Contrato de escrow Soroban desplegado:
  `CB3JG5IKMHKUXRPYSZ6UVOEJ42XXGQQOIBK4UBYEPYSTGBZ6IIAN5LAH`
  (fuente en `contracts/rental-guarantee/`, 16 tests Rust).
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

## Interfaz del contrato

```
create_guarantee(id, tenant, landlord, token, amount, end_date)  // auth: tenant
fund_guarantee(id)                                               // auth: tenant, transfiere al escrow
request_release(id, caller)                                      // auth: cualquiera de las partes
propose_distribution(id, proposer, to_landlord, to_tenant)       // la suma debe igualar el total
accept_proposal(id, acceptor)                                    // no se puede aceptar la propia
release_funds(id)                                                // paga la distribución acordada
cancel_guarantee(id, caller)                                     // sólo si nunca se financió
```

Estados on-chain: `Created → Funded → ReturnRequested → Negotiation → Agreed →
Released`, más `Cancelled`.

Garantías de seguridad ya implementadas: el dinero sólo sale por
`release_funds`; el split debe sumar exactamente el monto bloqueado; el estado
se escribe antes de transferir (evita doble pago); sólo las partes pueden
operar.

## Mapeo con SAFEXY

| Concepto SAFEXY | On-chain |
| --- | --- |
| Garante | `tenant` |
| Locador | `landlord` |
| Crear + financiar | `create_guarantee` + `fund_guarantee` |
| Solicitud de devolución | `request_release` |
| Monto propuesto a devolver | `propose_distribution(to_tenant = devuelto, to_landlord = resto)` |
| Aprobación del locador | `accept_proposal` |
| Pago | `release_funds` (lo firma la cuenta de plataforma) |

El contrato ya soporta el caso "el locador devuelve": él puede proponer una
distribución 100 % al garante y el garante la acepta. La "devolución
unilateral" de SAFEXY se implementa como esa propuesta, auto-aceptada por
regla de negocio del lado del garante (le es siempre favorable).

## Límites conocidos

1. **No hay liberación parcial**: `release_funds` paga el total y cierra la
   garantía. La devolución parcial con remanente bloqueado necesita una
   decisión — ver `BUSINESS_RULES.md`.
2. **No hay comisión on-chain**: la distribución sólo tiene dos destinos. La
   comisión de 0,05 % exige un tercer destino (`to_platform`) o una
   transferencia posterior desde la cuenta de plataforma. Preferible agregar
   el tercer destino al contrato cuando se lo modifique.
3. **No hay extensión on-chain**: cambiar monto o `end_date` requiere una
   función nueva o el ciclo cerrar-y-recrear.
4. `PLATFORM_SECRET_KEY` está vacía en producción, así que el pago final corre
   simulado hasta que se cargue una cuenta de testnet.

## Regla

No reemplazar estas integraciones por mocks. Si un flujo nuevo necesita algo
que el contrato no soporta, se documenta el límite y se elige explícitamente
entre "resolver off-chain" y "modificar el contrato".
