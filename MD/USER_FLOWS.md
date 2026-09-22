# USER_FLOWS — Flujos

## 1. Alta y alias

1. Crear cuenta (email + contraseña).
2. Completar nombre, apellido y foto opcional.
3. Elegir alias (disponibilidad en vivo) y vincular wallet.
4. Ir al panel.

## 2. Crear una garantía (garante)

1. Botón principal **Crear garantía**.
2. Alias del locador → confirmación visual de la persona encontrada
   (foto, nombre y apellido, `@alias`).
3. Monto y moneda.
4. Período: mes/año de inicio + cantidad de meses (se muestra la vigencia
   resultante, p. ej. `Noviembre 2026 → Octubre 2028`).
5. Pantalla de confirmación:

```
Confirmá tu garantía

A favor de     María Gómez  @maria.gomez
Monto          1000 USDC
Vigencia       Noviembre 2026 → Octubre 2028
Total          1000 USDC

[ Confirmar garantía ]   [ Editar ]
```

6. Antes de confirmar se puede editar monto, período y locador, o cancelar.
7. Al confirmar: los fondos se bloquean, la garantía queda **Pendiente** y se
   notifica al locador.

## 3. Aceptación o rechazo (locador)

El locador ve en su panel: **Tenés una garantía para revisar**, con garante,
alias, monto y vigencia.

- **Aceptar** → la garantía pasa a **Activa**; ambos la ven; ambos reciben aviso.
- **Denegar** → se pide motivo (obligatorio); queda **Rechazada**; se notifica al
  garante y el monto vuelve a estar disponible.

## 4. Expiración sin respuesta

Pendiente por más de un mes desde el inicio del período → cancelación
automática, fondos liberados, evento en el historial y aviso a ambos.

## 5. Vida de la garantía activa

La ficha muestra estado, monto, persona a favor, fecha inicial, fecha final y
sólo las acciones que corresponden al rol de quien mira.

## 6. Fin del período

Al llegar la fecha final la garantía pasa a **Vencida** y se avisa a ambas
partes. Opciones: **Devolver** o **Extender**.

## 7. Devolución

Iniciada por el garante:

1. Elige total o parcial (monto).
2. El locador recibe la solicitud y acepta o rechaza (rechazo con motivo).
3. Si acepta: se libera el monto, se descuenta la comisión de 0,05 % y se
   registra la operación en Stellar.
4. Si es parcial, el remanente sigue bloqueado (ver `BUSINESS_RULES.md`).

Iniciada por el locador (unilateral), total o parcial: se libera a favor del
garante sin aprobación adicional.

## 8. Extensión

1. La inicia el garante: nuevo período y/o nuevo monto total.
2. Si el monto sube, deposita la diferencia.
3. Si baja, la diferencia se devuelve y el locador debe aprobarlo.
4. Aceptada la extensión, la garantía vuelve a **Activa** con la nueva vigencia.

## 9. Historial

Cada usuario ve el historial completo de sus garantías (dadas y recibidas) con
todos los eventos y montos, y puede abrir el detalle técnico de cada operación
on-chain si quiere.
