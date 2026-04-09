@AGENTS.md

# Proyecto: Sistema de gestión de lavandería

## Stack técnico

- **Next.js 16.2.2** — App Router, `proxy.ts` reemplaza a `middleware.ts` (deprecated)
- **Prisma 6 + PostgreSQL** — base de datos `lavanderia` en localhost:5432
- **NextAuth v4** — autenticación con credenciales; sesión tiene `id`, `name`, `email`, `role`
- **Tailwind CSS v4** — no usar clases dinámicas (son purgadas); siempre clases literales
- **TypeScript** estricto en todo el proyecto

## Regla crítica: Prisma en Windows

`npx prisma generate` falla con EPERM mientras el servidor de desarrollo esté corriendo (Windows bloquea el DLL del query engine). **Solución permanente**: usar `prisma.$queryRaw` y `prisma.$executeRaw` para todos los modelos nuevos o renombrados. Los modelos viejos que ya tenía el cliente generado pueden usar el ORM normal (ej: `prisma.pedido`, `prisma.cliente`, `prisma.user`). Nunca usar `prisma.cajaSesion`, `prisma.registroPago`, `prisma.logEstadoPedido` — solo raw SQL para estos.

Para aplicar migraciones: `npx prisma migrate deploy` (no `migrate dev`, requiere interactividad).

---

## Base de datos — Modelos principales

### Pedido
```
id, numero (autoincrement), clienteId, estado (EstadoPedido), estadoPago (EstadoPago),
total, pagado, saldo, tipoEntrega (domicilio|sucursal), sucursal?, fechaRetiro?,
franjaHoraria?, enDeposito, printCount (contador de impresiones), createdAt, updatedAt
```

### Cliente
```
id, nombre, telefono, direccion?, createdAt
```

### User
```
id, name, email, password, role (admin|empleado), activo, sucursalId?, telefono?, createdAt
```

### CajaSesion ← (renombrada de CajonDia)
```
id, userId, sucursalId?, saldoInicial, saldoFinal?, fechaCierre?, estado (abierto|cerrado), createdAt
Tabla: "CajaSesion"
```

### MovimientoCaja
```
id, sesionId (FK → CajaSesion), tipo (ingreso|gasto), conceptoId?, descripcion?, monto, createdAt
```

### RegistroPago
```
id, pedidoId, sesionId? (FK → CajaSesion), monto, metodoPago (efectivo|tarjeta|mercadopago), createdAt
```

### LogEstadoPedido ← NUEVO
```
id, pedidoId, estadoAnterior, estadoNuevo, userId, userName, motivo?, createdAt
```

### Otros modelos: Item, Paquete, Recepcion, Observacion, Foto, Entrega, Sucursal, ConceptoCaja

---

## Enums

```
EstadoPedido: pendiente_recepcion | validacion | por_lavar | listo | en_reparto |
              no_entregado | en_sucursal | deposito | entregado | cancelado
EstadoPago: pendiente | parcial | pagado
TipoEntrega: domicilio | sucursal
MetodoPago: efectivo | tarjeta | mercadopago
EstadoCajon: abierto | cerrado
TipoMovimiento: ingreso | gasto
Role: admin | empleado
```

---

## Precios (`lib/constants.ts`)

```ts
PRECIOS = { canasto: 10000, acolchado: 25000, retiro: 5000, reintento: 2500 }
PRENDAS_POR_CANASTO = 12
calcularCanastos(prendas) = Math.ceil(prendas / 12)
```

---

## Estructura de rutas

### Páginas (`app/(app)/`)
| Ruta | Descripción | Acceso |
|------|-------------|--------|
| `/pedidos` | Lista de pedidos con filtros por estado | Todos |
| `/pedidos/nuevo` | Crear nuevo pedido | Todos |
| `/pedidos/[id]` | Detalle del pedido | Todos |
| `/pedidos/[id]/confirmar` | Confirmar/cancelar pedido recién creado | Todos |
| `/recepcion/[id]` | Recepcionar pedido | Todos |
| `/impresion/[id]` | Vista de impresión del ticket térmico | Todos |
| `/cajon` | Gestión de caja (empleado) / supervisión (admin) | Todos |
| `/cajon/[id]/reporte` | Reporte de cierre de caja | Todos |
| `/deposito` | Pedidos en depósito | Todos |
| `/chofer` | Vista del chofer para repartos | Todos |
| `/dashboard` | Dashboard general | Todos |
| `/clientes` | Historial de clientes con estadísticas | Solo admin |
| `/admin/usuarios` | CRUD de usuarios/empleados | Solo admin |
| `/admin/sucursales` | CRUD de sucursales | Solo admin |

### API routes (`app/api/`)
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/pedidos` | GET, POST | Listar / crear pedidos |
| `/api/pedidos/[id]` | GET, PATCH | Detalle / actualizar pedido |
| `/api/pedidos/[id]/estado` | POST (cambiar), GET (audit log) | Estado + log de auditoría |
| `/api/pedidos/[id]/pago` | POST | Registrar pago parcial |
| `/api/pedidos/[id]/entrega` | POST | Marcar entrega/no entrega |
| `/api/pedidos/[id]/paquetes` | POST | Generar paquetes |
| `/api/pedidos/[id]/recepcion` | POST | Recepcionar pedido |
| `/api/pedidos/[id]/aceptar` | POST | Aceptar pedido (confirmar) |
| `/api/pedidos/[id]/imprimir` | GET (leer count), POST (incrementar) | Control de impresiones |
| `/api/clientes` | GET, POST | Buscar / crear clientes; `?stats=1` para historial admin |
| `/api/clientes/[id]` | PATCH | Editar teléfono del cliente |
| `/api/cajon` | GET, POST | Sesión activa / abrir nueva caja |
| `/api/cajon/[id]/movimiento` | POST | Agregar ingreso/gasto a la sesión |
| `/api/cajon/[id]/cierre` | POST | Cerrar sesión con arqueo |
| `/api/cajon/[id]/reporte` | GET | Reporte completo de la sesión |
| `/api/cajon/conceptos` | GET | Conceptos de ingreso/gasto |
| `/api/deposito` | GET | Pedidos en depósito |
| `/api/chofer` | GET | Pedidos en reparto |
| `/api/sucursales` | GET | Lista de sucursales |
| `/api/admin/usuarios` | GET, POST | Gestión de usuarios |
| `/api/admin/usuarios/[id]` | PATCH | Editar usuario |

---

## Lógica de negocio clave

### Flujo de estados de un pedido
```
pendiente_recepcion → [recepcionar] → por_lavar → [listo] → listo
listo → [entrega sucursal] → entregado
listo → [enviar domicilio] → en_reparto → entregado | no_entregado | en_sucursal
listo / en_sucursal → [validación] → validacion → listo
listo / en_sucursal → [7 días sin retiro] → deposito → entregado
```

Cualquier estado puede corregirse desde la sección "Corrección de estado" en el detalle del pedido. Cada cambio queda en `LogEstadoPedido`.

### Cálculo de balance de caja
```
efectivoEsperado = saldoInicial + cobros_efectivo + otros_ingresos - gastos
```
- Tarjeta y Mercado Pago **no suman al efectivo físico** (son digitales)
- El arqueo al cierre se compara contra `efectivoEsperado`
- Diferencia positiva = sobrante, negativa = faltante

### Sesión de caja — reglas
- Un empleado solo puede tener **una sesión abierta** a la vez
- Al cerrar: se registra `saldoFinal` y `fechaCierre`, estado = `cerrado`
- Después de cerrar: puede abrir una nueva sesión (saldo inicial = lo que cuente el empleado)
- Todos los `RegistroPago` y `MovimientoCaja` se vinculan a `sesionId` — **nunca mezclar entre sesiones**
- Admin no abre caja, solo supervisa las sesiones del día

### Registro de pagos
Cada vez que se cobra (al crear pedido, pago parcial, o al entregar) se inserta un `RegistroPago` con:
- `pedidoId`, `sesionId` (sesión activa del empleado), `monto`, `metodoPago`

Si el empleado no tiene sesión abierta, `sesionId` queda en `null` (no crashea).

### Control de impresiones
- Campo `printCount` en `Pedido` (INT DEFAULT 0)
- `GET /api/pedidos/[id]/imprimir` → devuelve `{ printCount }`
- `POST /api/pedidos/[id]/imprimir` → incrementa +1, devuelve nuevo valor
- El botón "Imprimir ticket" en detalle del pedido llama al POST antes de navegar a `/impresion/[id]`

### Depósito automático (7 días)
Si un pedido está en `listo`, `en_sucursal` o `no_entregado` y lleva ≥7 días sin actualizar:
- Aparece banner de alerta en el detalle del pedido
- Botones: "Mover a depósito" y "Recordar al cliente" (WhatsApp)

---

## lib/cajon.ts

```ts
getSesionActiva(userId) // raw SQL → devuelve { id } de la sesión abierta o null
registrarPago(userId, pedidoId, monto, metodoPago) // raw SQL → INSERT en RegistroPago
```

---

## Autenticación y autorización

- Layout `app/(app)/layout.tsx` verifica sesión NextAuth; si no hay → redirect a `/login`
- **Empleados**: deben tener una `CajaSesion` creada hoy (abierta o cerrada) para acceder a la app; si no → redirect a `/cajon`
- **Admin**: omite la verificación de cajón; accede a todo
- La página `/clientes` y `GET /api/clientes?stats=1` requieren `role === "admin"`

---

## proxy.ts (raíz del proyecto)

Reemplaza al `middleware.ts` deprecado en Next.js 16. Inyecta el header `x-pathname` para que el layout server-side pueda leer la ruta actual.

```ts
export function proxy(request: NextRequest) { ... }
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
```

---

## Componentes relevantes

- `components/Navbar.tsx` — links comunes para todos + links de admin (`Personal`, `Sucursales`, `Clientes`) separados por `|`
- `app/(app)/impresion/[id]/page.tsx` — ticket térmico con QR, estilos inline para impresión, contador de impresiones, botón WA
- `app/(app)/cajon/page.tsx` — vista empleado (apertura/cierre/movimientos) y vista admin (supervisión de sesiones del día)
- `app/(app)/cajon/[id]/reporte/page.tsx` — reporte imprimible con balance discriminado por método de pago
- `app/(app)/clientes/page.tsx` — historial admin con pedidos totales, monto gastado, última compra, frecuencia

---

## WhatsApp — mensajes disponibles en detalle del pedido

Todos usan `https://wa.me/{telefono}?text={mensaje}`:
- **Recordatorio** — pedido en proceso
- **Estado de lavado** — ropa siendo lavada
- **Listo para retiro** — con total y saldo
- **Retiro pendiente** — con días transcurridos y saldo
- **Enviar ticket** — texto completo del ticket con items y totales

---

## Confirmación de cobros

Antes de guardar cualquier pago desde el detalle del pedido, se muestra un modal que resume:
- Cliente, monto, método de pago, saldo restante estimado
- Botones: **Confirmar** (guarda) / **Cancelar** (no registra nada)

---

## Auditoría de cambios de estado

Tabla `LogEstadoPedido` — cada `POST /api/pedidos/[id]/estado` inserta un registro con estado anterior, nuevo estado, usuario, y motivo opcional. El detalle del pedido muestra el historial completo (colapsable) y permite hacer correcciones manuales con motivo desde la sección "Corrección de estado".

---

## Migraciones aplicadas (en orden)

1. `20260405064155_init` — esquema inicial
2. `20260405070647_add_numero_sucursal` — número en pedido, sucursal
3. `20260405081521_add_user_sucursal` — relación usuario-sucursal
4. `20260405082100_add_user_telefono` — teléfono en User
5. `20260405084035_add_cajon` — modelo CajonDia original
6. `20260405084909_add_metodo_pago` — enum MetodoPago
7. `20260405090000_registro_pago` — tabla RegistroPago, drop metodoPago de Pedido
8. `20260405100000_caja_sesion` — rename CajonDia→CajaSesion, apertura→saldoInicial, cierre→saldoFinal, cajonId→sesionId, agrega fechaCierre
9. `20260405110000_add_print_count` — campo printCount en Pedido
10. `20260405120000_log_estado_pedido` — tabla LogEstadoPedido

---

## Lo que NO hacer

- No usar `prisma.cajaSesion`, `prisma.registroPago`, `prisma.logEstadoPedido` — usar raw SQL
- No agregar clases Tailwind dinámicas (string interpolation) — serán purgadas
- No modificar los cálculos de caja existentes
- No mezclar operaciones de distintas sesiones de caja
- No bloquear apertura de nueva caja si la anterior ya está cerrada (solo bloquear si hay una `abierto`)
- No correr `prisma migrate dev` — usar `prisma migrate deploy`
