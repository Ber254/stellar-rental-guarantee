# PRODUCT — Qué es SAFEXY

## Una frase

**Tu garantía de alquiler, simple y protegida.**

Una persona pone una garantía a favor de otra. El dinero queda protegido: ni el
garante ni el locador pueden sacarlo por su cuenta.

## Qué es

Una **billetera de garantías para alquileres**. El usuario entra, ve su saldo,
ve sus garantías, crea una, la envía a un alias, espera la aceptación, y cuando
el período termina la devuelve o la extiende.

## Qué NO es

- No es una aplicación de blockchain: la tecnología no se muestra salvo que el
  usuario la pida ("Ver detalle técnico").
- No es un exchange ni una app de trading.
- No es un sistema de contratos jurídicos ni un árbitro: la plataforma no decide
  quién tiene razón; sólo ejecuta lo que ambas partes acordaron.

## Roles (por garantía, no por usuario)

| Rol | Quién es |
| --- | --- |
| **Garante** | Pone el dinero como respaldo. |
| **Locador** (dueño) | Recibe la garantía como respaldo. |

El mismo usuario puede ser garante en una garantía y locador en otra. El rol es
un atributo de la relación usuario↔garantía, nunca del usuario.

## Público objetivo

LATAM, 20–45 años, perfil tecnológico, y nómades digitales que alquilan en la
región. Idioma por defecto: español LATAM; disponible en inglés.

## Recorrido mental del usuario

```
Entro → tengo mi saldo → veo mis garantías → creo una → la envío a un alias
→ espero aceptación → la garantía queda activa → puedo devolver/extender
→ veo todo en el historial
```

## Alcance del refactor

Se conserva la infraestructura real que ya funciona (Stellar testnet, escrow
Soroban, USDC, Freighter, autenticación, base Neon). Cambia el modelo de
producto (alias, roles por garantía, estados humanos) y toda la superficie de
UX. No se reemplazan integraciones reales por mocks.
