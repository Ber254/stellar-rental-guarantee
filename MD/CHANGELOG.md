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
