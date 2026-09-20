# USERS — Usuario, identidad y alias

## Identidad interna vs. máscara legible

```
user_id  = identificador interno permanente (UUID). Nunca cambia, nunca se muestra.
alias    = máscara legible y modificable. Es lo que se comparte.
```

Toda garantía referencia internamente al `user_id`. Cambiar el alias **no** debe
romper ninguna garantía existente, histórica o activa.

## Alias

- Único en toda la plataforma (case-insensitive; se guarda normalizado en minúsculas).
- Legible, corto, fácil de copiar, compartir, buscar y dictar.
- Formato: minúsculas, números, punto, guion y guion bajo. 3–30 caracteres.
  No puede empezar ni terminar con separador.
- Ejemplos: `juan.perez`, `maria.gomez`, `depto.4b`.
- Se muestra siempre como `@alias`.
- Editable desde el perfil, con verificación de disponibilidad en vivo.
- Se conserva el historial de alias anteriores para auditoría y para mostrar en
  garantías viejas "hoy conocido como @nuevo".

## Perfil

Campos visibles y editables:

- Nombre.
- Apellido.
- Foto (opcional).
- Alias.
- Wallet Stellar (para operar con fondos).
- Datos de identificación necesarios (email verificado; documento cuando aplique).

Acciones siempre disponibles en el perfil: **Copiar alias** y **Editar alias**.

## Saldo

El usuario tiene un saldo disponible en USDC. Un monto comprometido en una
garantía activa o pendiente **no** está disponible; se libera cuando la garantía
se rechaza, vence sin aceptación, o se devuelve.

```
saldo disponible = fondos en la wallet/cuenta − comprometido en garantías pendientes o activas
```

## Autenticación

Email + contraseña (bcrypt) y sesión JWT en cookie `httpOnly` (ya implementado).
La wallet se vincula al perfil; las firmas de operaciones con fondos se hacen en
Freighter, la plataforma nunca guarda claves privadas de usuarios.

## Qué cambia respecto del sistema actual

| Hoy | SAFEXY |
| --- | --- |
| `users` sin alias | `users.alias` único + historial de alias |
| Contraparte por email/token de invitación | Contraparte por alias |
| Rol fijo: tenant = quien crea | Rol por garantía: garante / locador |
| Sin foto ni apellido | Nombre, apellido, foto opcional |
