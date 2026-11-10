# DECK — SAFEXY (camino a un Instaward)

Guion slide por slide, listo para pasar a Google Slides / PowerPoint. Cada
sección trae el texto que va en la slide y, en cursiva, la nota para quien
presenta. Regla: una idea por slide, números grandes, cero jerga de blockchain
salvo en la slide técnica.

---

## Slide 1 — Portada

**SAFEXY**
Tu garantía de alquiler, simple y protegida.

*pie:* Argentina Builder Challenge · BAF × Stellar · Track Scale · 2º puesto

## Slide 2 — El problema

**Conseguir una garantía de alquiler en Argentina es caro, lento y de confianza.**

- Meses de depósito inmovilizado o un aval que casi nadie consigue.
- La devolución final depende de la palabra entre las partes.
- No existe una forma neutral y programable de dejar el dinero en garantía.

*Enfatizar: el problema no es pagar, es la desconfianza sobre cómo vuelve el depósito.*

## Slide 3 — La solución

**Un escrow de USDC donde ninguna parte puede tomar el dinero por su cuenta.**

1. El garante bloquea USDC a favor del locador.
2. El locador acepta por alias y la garantía queda activa.
3. Al terminar, se devuelve **total o parcial** según lo que ambas partes acuerden.
4. Si nadie acepta en un mes, se cancela sola.

*Decir explícito: "el contrato custodia; la plataforma no decide ni arbitra".*

## Slide 4 — Demo

**En vivo: crear → aceptar → financiar → devolver → ejecutar.**

*Mostrar la app. Si no hay internet, video de 60–90 s. Cerrar con el hash de la
transacción real en stellar.expert.*

## Slide 5 — Por qué Stellar

- **Soroban**: escrow con saldo `locked` (devoluciones parciales reales),
  comisión configurable on-chain y extensiones.
- **USDC** vía Stellar Asset Contract: el depósito no se licúa.
- **Freighter**: el usuario firma; la plataforma nunca guarda claves.

*Mencionar: 27 tests del contrato, flujo verificado en testnet con tx reales.*

## Slide 6 — Cómo funciona el negocio

- **0,5 %** sobre cada devolución al garante, cobrado on-chain.
- Configurable por el admin (tope 5 %) sin redesplegar.
- Costo marginal por garantía casi nulo.

*Ejemplo concreto: devolución de 1000 USDC → 0,50 USDC de comisión.*

## Slide 7 — Tracción y validación

**Estado real, sin maquillar.**

- Producto funcional de punta a punta, verificado en testnet (7 transacciones reales).
- 2º puesto en el track Scale del Argentina Builder Challenge.
- *Gap honesto:* todavía sin usuarios reales ni volumen. Es exactamente lo que
  el Instaward viene a financiar.

*Aca va el compromiso de los próximos 30 días.*

## Slide 8 — Roadmap 90 días

| Mes | Entregable | Meta |
| --- | --- | --- |
| 1 | Mainnet + auditoría + 3 inmobiliarias piloto | Contrato en mainnet, 3 pilotos |
| 2 | Anchors / activos locales (ARS) + alta self-serve | 10 garantías activas |
| 3 | Métricas y preparación de la ronda siguiente | 50 garantías, USD 50k de volumen |

## Slide 9 — Equipo

**Bernardo Foco · Fernando Farfan**
*Una línea cada uno: qué hizo cada uno y por qué son las personas para esto.*

## Slide 10 — El ask

**Pedimos un Instaward para un sprint de 30 días:**
llevar SAFEXY a **mainnet** y cerrar los **3 pilotos**.

- Uso de fondos: deploy + auditoría del contrato, onboarding de pilotos.
- Rango Instaward: USD 1.000–5.000.
- Después: pipeline del Stellar Community Fund.

*Cerrar con la frase: "el problema es real, el producto ya funciona; falta el push a producción".*

---

## Checklist de armado

- [ ] Pasar este guion a slides (10 slides, una idea por slide).
- [ ] Grabar el demo (60–90 s) o preparar el deploy en vivo.
- [ ] Reemplazar los *gaps honestos* por los números de la última corrida.
- [ ] Un dato por slide, tipografía grande, sin bloques de texto.
