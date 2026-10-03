# FUNDING — Camino a un Instaward y al SCF

Funding-readiness package de SAFEXY. Es el documento que pide el track **Scale**
del Argentina Builder Challenge y la base del borrador de aplicación a Instaward
y al Stellar Community Fund (SCF).

Estado: SAFEXY salió **02 (segundo puesto) en el track Scale** del Argentina
Builder Challenge (BAF × Stellar). El premio es un **camino a un Instaward**:
mentoría 1:1 con BAF, no dinero garantizado. La decisión final de aprobar un
Instaward es de **SDF**, no de BAF.

## Una frase

**Tu garantía de alquiler, simple y protegida.** Un garante bloquea USDC en un
escrow Soroban a favor de un locador; ninguna parte puede retirar el dinero de
forma unilateral.

## Problema

Conseguir garantía de alquiler en LATAM es caro, lento y opaco: meses de
depósito, avales que pocos consiguen, y una devolución final que depende de la
confianza entre las partes. No existe una forma neutral y programable de dejar
el depósito en garantía que ninguna de las dos partes pueda tomar por su cuenta.

## Solución

Una billetera de garantías sobre Stellar:

- El **garante** bloquea USDC en un contrato Soroban (el contrato custodia, no
  la plataforma).
- El **locador** acepta la garantía por alias; el garante la financia.
- Al terminar el período, se hacen **devoluciones parciales o totales** según
  lo que ambas partes acuerden, con una comisión de **0,05 %** sólo sobre lo
  devuelto al garante.
- **Extensiones** con top-up o devolución de diferencia.
- Ni el garante ni el locador pueden retirar fondos sin acuerdo (no hay retiro
  unilateral a favor de ninguna parte).
- Expiración automática si nadie acepta en un mes.

Roles por garantía, no por usuario: la misma persona puede ser garante en una y
locador en otra.

## Integración con Stellar (evidencia técnica)

- **Contrato Soroban** `safexy-guarantee` (Rust, 27 tests): saldo `locked`
  para devoluciones parciales, comisión configurable por `fee_bps` con tesorería
  on-chain, y constructor obligatorio.
- **USDC** vía Stellar Asset Contract (SAC); testnet confirmado.
- **Freighter** para firma en el navegador; la plataforma nunca guarda claves
  privadas de usuarios. El XDR firmado que llega del browser se valida contra la
  llamada que el servidor planificó (`assertMatchesCall`).
- **Stack**: Next.js 16 + TypeScript + Drizzle/Postgres (Neon) + Vercel.

### Verificación end-to-end en testnet (2026-10-03)

Corrida real contra el contrato v2 desplegado — no simulada. Garantía
`SFX-2026-000101` (on-chain `2026000101`): registro por alias, aceptación,
fondeo de 1000 USDC, devolución total pedida por el garante, contraofertas
700/300 y 850/150, aceptación y ejecución.

| Paso | Tx hash |
| --- | --- |
| create | `780b4120083127d6593a271c9f69f79a69c04717600d9f8709c53f9befb69992` |
| fund | `d8744ce47da25a6e27bc110d8b889dd9f9eeb5790a44858a5b6e551f16a44b2f` |
| propose 1000/0 | `80f04154f0e55d8b013bfb8baa35087b1319a3eb3f9db8c3cb353444d869c26c` |
| propose 700/300 | `b5fee84a5994d63cfc269fbb8fe389f6515dbd5da011066dceb7dc14fba4ae55` |
| propose 850/150 | `1305e5e471e2a16b530094ff3d0500aaa05d243e8cff08cee0596bf376f6d6fd` |
| accept | `8f988ba9f8c4ba7c9960b7f117dbfe14b7e2cdff961f65e83317050669e193a1` |
| execute | `a1dbcd9d645fcbf1d4d94d12992b3a8e4b4d9fbed0ccec8fe84b5d3e62e99031` |

Balances (antes → después): garante 1849,575 → **1699,15** USDC; locador
150 → **300** USDC; tesorería 0,575 → **1,00** USDC (+0,425 = 0,05 % de 850).
On-chain: `funded = 1000`, `locked = 0`, `state = Closed`.

## Modelo de negocio

- Comisión de **0,05 %** sobre cada devolución al garante (on-chain, vía
  `fee_bps`, configurable por el admin sin redesplegar, tope 5 %).
- Costo marginal por garantía casi nulo (Soroban + USDC).
- Crecimiento por inmobiliarias/plataformas de alquiler que ya manejan depósitos
  (B2B2C) y por usuarios directos garante↔locador.

## Roadmap a 3 meses

| Mes | Entregable | Métrica de salida |
| --- | --- | --- |
| 1 | Paso a **mainnet** + auditoría del contrato + onboarding de 3 inmobiliarias piloto | Contrato en mainnet, 3 pilotos firmados |
| 2 | Integración de **anchors / activos locales (ARS)** y onboarding self-serve | 10 garantías activas, 1 anchor integrado |
| 3 | Métricas de adopción y preparación de la siguiente ronda (SCF Build Award) | 50 garantías activas, USD 50k de volumen, retención > 60 % |

## Borrador de aplicación a Instaward

- **Proyecto:** SAFEXY — garantía de alquiler en USDC sobre Stellar.
- **Track:** Scale (producto existente, con entrega nueva durante el challenge).
- **Qué se construyó en el challenge:** contrato v2 con saldo `locked`,
  devoluciones parciales, comisión y extensiones; capa de aplicación completa y
  verificación end-to-end en testnet (evidencia arriba).
- **Ask:** sprint de 30 días para el paso a mainnet y los primeros pilotos
  (rango Instaward: USD 1.000–5.000).
- **Aporte de cada parte:** BAF mentorea la aplicación; **SDF decide**.

### Reglas de elegibilidad (a chequear antes de aplicar)

- No se puede tener más de **un Instaward activo** a la vez.
- Tope de **3 rondas** por proyecto (1 inicial + hasta 2 de seguimiento) y
  **USD 15.000** acumulados.
- Si el proyecto ya recibió un **Stellar Build Award** (SCF, hasta USD 150k), no
  se puede aplicar al camino a Instaward de este challenge.
- El acceso a Instawards es a través del **Ambassador Chapter local**, no por
  aplicación abierta.

## Qué falta para aplicar (acciones, no decisiones abiertas)

1. Completar el deck (10 slides) con los datos de esta sección.
2. Confirmar con BAF el contacto del Ambassador Chapter y la fecha del 1:1.
3. Decidir con la contraparte BAF si el ask va a Instaward o directo a SCF Build
   Award, según el tope y las rondas previas del proyecto.

## Paso a mainnet

El contrato y la app están listos para mainnet; falta **ejecutarlo con fondos
reales**, que es lo único que no se puede hacer sin las claves y el XLM reales
del equipo (dinero real, irreversible). El día que exista una identidad de
mainnet fondeada, el deploy es:

```bash
cd contracts
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/safexy_guarantee.wasm \
  --source <admin-mainnet> --network mainnet \
  -- --admin <admin-mainnet> --treasury <treasury-mainnet> --fee_bps 5
```

Checklist antes de tocar mainnet:

1. Identidades `admin`, `treasury` y `platform` de mainnet, fondeadas.
2. Tesorería con trustline de USDC (Circle) para cobrar la comisión.
3. Auditoría del contrato (o revisión externa) — es dinero real.
4. SAC de USDC de mainnet en `STELLAR_USDC_CONTRACT_ID`; `STELLAR_NETWORK=mainnet`
   y el passphrase de la red pública.
5. `PLATFORM_SECRET_KEY` de mainnet con XLM para las fees, y verificación de que
   `execute_settlement` no quede en modo simulado.
6. Repetir la corrida end-to-end (esta vez con USDC real) y recién ahí abrir a
   usuarios.
