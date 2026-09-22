# STATUSES — Estados

## Estados visibles (los únicos que ve el usuario)

| Estado | Significado para el usuario |
| --- | --- |
| Borrador | La estás armando, todavía no la enviaste. |
| Pendiente | Enviada, esperando que el locador la acepte. |
| Activa | Aceptada y con los fondos protegidos. |
| Rechazada | El locador la denegó (con motivo). |
| Vencida | Terminó el período: se puede devolver o extender. |
| En devolución | Hay una devolución pedida o en curso. |
| Completada | El dinero ya se distribuyó; nada queda bloqueado. |
| Cancelada | Se dio de baja (por expiración o antes de estar activa). |

## Mapeo con los estados internos actuales

Los estados internos siguen siendo más detallados; la UI nunca los muestra.

| Interno (`contract_status`) | Visible |
| --- | --- |
| `DRAFT` | Borrador |
| `PENDING_ACCEPTANCE` | Pendiente |
| `AWAITING_FUNDING` | Pendiente |
| `ACTIVE` | Activa |
| `RETURN_REQUESTED`, `NEGOTIATION`, `AGREED` | En devolución |
| `RELEASED`, `COMPLETED` | Completada |
| `CANCELLED` | Cancelada / Rechazada (según el motivo) |
| *(nuevo)* `REJECTED` | Rechazada |
| *(nuevo)* `EXPIRED` | Vencida |

`Rechazada` y `Vencida` no existen hoy y hay que agregarlos: hoy ambos casos
colapsan en `CANCELLED`, lo que impide distinguir "el locador dijo que no" de
"nadie respondió a tiempo".

## Estados on-chain (contrato Soroban)

`Created → Funded → ReturnRequested → Negotiation → Agreed → Released`, más
`Cancelled` para una garantía nunca financiada. Son estados del escrow, no del
producto, y no deben mostrarse crudos (ya se corrigió ese caso en la pantalla de
detalle).

## Transiciones válidas (objetivo)

```
Borrador      → Pendiente | Cancelada
Pendiente     → Activa | Rechazada | Cancelada (expiración)
Activa        → En devolución | Vencida
Vencida       → En devolución | Activa (extensión aceptada)
En devolución → Activa (devolución parcial) | Completada | Vencida (rechazo de la devolución)
```
