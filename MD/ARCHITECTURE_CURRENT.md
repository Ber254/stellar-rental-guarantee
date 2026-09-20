# ARCHITECTURE_CURRENT — El sistema tal como está hoy

Análisis previo al refactor SAFEXY. Qué existe, qué se reutiliza y qué cambia.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 · Drizzle ORM sobre
Postgres (Neon) · Stellar SDK 17 + Freighter · contrato Soroban en Rust ·
Vitest · desplegado en Vercel.

## Estructura

```
src/app/            páginas (Server Components) y rutas de API
  page.tsx            home
  login, register     autenticación
  dashboard           lista de contratos del usuario
  contracts/new       alta de contrato
  contracts/[id]      ficha + acciones on-chain
  invite/[token]      aceptación por link
  api/                auth, contracts, contracts/[id]/chain, invites/[token]
src/components/     Client Components (formularios, acciones, wallet, preferencias)
src/lib/
  auth.ts             sesión JWT en cookie httpOnly + bcrypt
  api.ts              respuestas de error con código estable
  contract-state.ts   máquina de estados off-chain
  money.ts            decimal ↔ stroops (7 decimales)
  env.ts              configuración y detección de modo demo
  db/                 esquema Drizzle
  i18n/               diccionarios es/en, cookies de idioma y tema
  services/           contracts.ts (negocio) y chain.ts (orquestación on-chain)
  stellar/            llamadas al contrato, red, validación de XDR, firmante demo
contracts/          contrato Soroban (Rust) + tests
```

## Backend

- **Autenticación**: `src/lib/auth.ts` — registro/login con bcrypt, JWT firmado
  con `AUTH_SECRET`, cookie `rg_session` httpOnly de 7 días.
- **Negocio**: `src/lib/services/contracts.ts` — alta de contrato (crea
  propiedad, referencia `RG-AAAA-NNNNNN` con contador anual, token de
  invitación y fila de garantía), aceptación de invitación, listados, detalle y
  notificaciones.
- **Orquestación on-chain**: `src/lib/services/chain.ts` — un único endpoint
  (`POST /api/contracts/[id]/chain`) con seis pasos (`create`, `fund`,
  `request-release`, `propose`, `accept`, `release`). Cada paso valida rol y
  estado *antes* de construir la llamada, y devuelve o bien un XDR para firmar
  en la wallet, o bien el resultado ya ejecutado (modo demo o cuenta de
  plataforma). Al completarse escribe el efecto off-chain (estado, propuestas,
  acuerdo, transacción, notificación).
- **Errores**: `AppError` con `ErrorCode` estable; la API serializa
  `{ error, code }` y el cliente traduce el código.

## Frontend

Páginas como Server Components que leen idioma/tema de cookies y renderizan ya
traducido; las partes interactivas son Client Components (`auth-form`,
`new-contract-form`, `contract-actions`, `wallet`, `preferences`). La separación
server/client es estricta: `src/lib/i18n/index.ts` es client-safe y
`src/lib/i18n/server.ts` es el único que toca `next/headers`.

## Base de datos

Diez tablas, detalladas en `DATABASE.md`.

## Flujo actual completo

```
registro → alta de contrato (inquilino) → link de invitación → el propietario acepta
→ el inquilino registra y financia la garantía on-chain → activa
→ alguien pide la devolución → propuestas y contraofertas → aceptación
→ release_funds paga el split → completado
```

## Qué se reutiliza tal cual

- Autenticación, sesión y hash de contraseñas.
- Contrato Soroban desplegado y su suite de tests.
- Capa Stellar: construcción de llamadas, firma, envío, **validación del XDR
  firmado** y modo demo.
- `money.ts` (aritmética en stroops) y el tipo `numeric(20,7)`.
- Registro de transacciones on-chain y tabla de notificaciones.
- Infraestructura i18n (es/en) y temas modern/retro.
- Máquina de estados off-chain (se extiende, no se reescribe).
- Deploy en Vercel + Neon.

## Qué debe modificarse

| Área | Cambio |
| --- | --- |
| Usuarios | Alias único, apellido, foto, historial de alias. |
| Roles | De `tenant`/`landlord` fijos a garante/locador **por garantía**. |
| Entidad principal | "Contrato de alquiler con propiedad" → "garantía" (la propiedad deja de ser obligatoria). |
| Contraparte | Del link de invitación al envío por alias. |
| Estados | Agregar `REJECTED` y `EXPIRED`; capa de estados humanos en la UI. |
| Devolución | Total/parcial, iniciable también por el locador, con motivo en el rechazo. |
| Extensión | No existe: flujo nuevo completo. |
| Comisión | No existe: 0,05 % sobre lo devuelto, configurada en un solo lugar. |
| Expiración | No existe: cancelación automática al mes sin aceptación. |
| Notificaciones | Tipar el aviso para poder traducirlo (hoy se guarda texto en inglés). |
| UX | Home, panel, alta, ficha, historial, "¿Cómo funciona?", FAQ. |

## Qué NO se toca

Las integraciones reales de Stellar/Soroban/USDC y la validación de seguridad
del XDR. Si un flujo nuevo excede lo que el contrato permite, se documenta el
límite y se decide explícitamente (ver `BLOCKCHAIN.md`).
