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

Justificación y límite técnico: el escrow actual libera el total en una sola
operación (`release_funds` exige `to_landlord + to_tenant == amount`) y luego
marca la garantía como `Released`. Para soportar una devolución parcial con
remanente bloqueado hay dos caminos, y hay que elegir uno antes de implementar:

1. **Ciclo cerrar-y-recrear** (sin tocar el contrato): se libera el total, se le
   devuelve al garante la parte devuelta y se vuelve a bloquear el remanente en
   una garantía nueva encadenada a la anterior. Simple de implementar, cuesta
   una transacción extra y fragmenta el historial on-chain.
2. **Liberación parcial en el contrato** (`release_partial`): requiere modificar
   y redesplegar el contrato Soroban. Más limpio, pero toca la pieza que hoy
   funciona y obliga a migrar las garantías existentes.

Recomendación: opción 1 para la primera entrega — no rompe nada de lo que ya
funciona on-chain — y opción 2 como mejora posterior planificada.

## Contradicciones con el comportamiento actual (a resolver)

| Regla SAFEXY | Comportamiento actual | Resolución |
| --- | --- | --- |
| Quien pone el dinero es el garante | Lo pone el `tenant` (inquilino) y lo crea él | Renombrar el rol; la mecánica coincide |
| Contraparte por alias | Por token de invitación en un link | Buscar por alias; conservar el link como fallback |
| Rechazo con motivo | No existe rechazo de la invitación | Nuevo estado `REJECTED` + motivo |
| Expiración automática al mes | No existe | Job/chequeo perezoso al leer la garantía |
| Comisión 0,05 % | No hay comisión | Nueva salida en la distribución |
| Devolución unilateral del locador | Sólo el tenant puede pedir la devolución | Habilitar la solicitud al locador |
| Extensión | No existe | Nuevo flujo (ver `GUARANTEES.md`) |
| Estados humanos | Se muestran estados internos | Capa de presentación de estados |
