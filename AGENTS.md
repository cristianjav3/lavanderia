# CONTEXTO DEL PROYECTO

Sistema de gestión de lavandería con:

- gestión de pedidos
- recepción de prendas
- control de estados
- impresión de tickets
- caja (apertura y cierre por sesión)
- panel de chofer (retiros y entregas)
- clientes
- logística
- ecommerce en desarrollo (con pago previo y agenda)

El sistema es OPERATIVO y se usa en tiempo real en el negocio.

----------------------------------------

# OBJETIVO PRINCIPAL

- evitar errores operativos
- evitar pérdidas de dinero
- automatizar pedidos con pago previo
- mejorar logística del chofer
- mantener estabilidad del sistema

----------------------------------------

# REGLAS CRÍTICAS DEL NEGOCIO

## PEDIDOS

- Los pedidos NO se eliminan
- Los pedidos pueden cambiar de estado para corregir errores
- Los pedidos cancelados deben seguir visibles
- El estado define la operación (no romper esta lógica)

Estados actuales incluyen:
- pendiente_recepcion
- por_lavar
- listo
- en_reparto
- entregado
- cancelado
- deposito

----------------------------------------

## RECEPCIÓN

- La recepción define la cantidad REAL
- Puede diferir del pedido original
- Puede incluir observaciones y fotos

----------------------------------------

## PAGOS

- TODO cobro debe confirmarse antes de guardarse
- NO se pueden editar pagos ya registrados
- Si hay error → usar ajuste (no modificar)

Métodos de pago obligatorios:
- efectivo
- tarjeta
- mercadoPago

----------------------------------------

## CAJA

- Funciona por sesión (apertura → cierre)
- NO mezclar sesiones
- NO modificar cajas cerradas
- Todos los movimientos deben estar asociados a una sesión activa

----------------------------------------

## TICKETS

- Se pueden reimprimir
- Cada impresión incrementa printCount
- printCount:
  - visible para admin y empleado
  - NO editable
  - NO reseteable

----------------------------------------

## CLIENTES

- Se puede editar teléfono (error de tipeo)
- Historial solo visible para admin

----------------------------------------

# MÓDULO CHOFER (MUY IMPORTANTE)

Actualmente:

- El chofer ve retiros y entregas del día
- Los pedidos pueden cargarse manualmente desde el sistema

NUEVA LÓGICA A RESPETAR:

- El chofer SOLO debe recibir pedidos válidos

REGLAS:

1) Pedido con retiro a domicilio:
   → DEBE tener pago previo (mínimo o total)

2) NO permitir:
   → pedidos sin pago asignados al chofer

3) Origen de pedidos del chofer:
   - desde ecommerce (pago previo confirmado)
   - desde local (pedido ya cobrado o seguro)

4) El panel chofer muestra:
   - retiros del día
   - entregas pendientes

----------------------------------------

# ECOMMERCE (EN IMPLEMENTACIÓN)

Flujo esperado:

1) Cliente entra desde link (WhatsApp comunidad)
2) Selecciona servicio:
   - canasto
   - acolchado
   - retiro y entrega

3) Realiza pago (MercadoPago / tarjeta)

4) SOLO después del pago:
   - puede agendar día y franja horaria

5) Se crea automáticamente el pedido con:
   - estado: pendiente_retiro
   - pago confirmado

6) El pedido aparece en:
   - panel del chofer
   - sistema interno

REGLA CRÍTICA:

→ SIN PAGO NO SE CREA PEDIDO

----------------------------------------

# AGENDA

- Los horarios deben ser definidos por el sistema
- No permitir horarios libres sin control
- Futuro: limitar cupos por franja

----------------------------------------

# ESTRUCTURA DEL PROYECTO

- app/ → vistas (UI)
- components/ → componentes
- lib/ → lógica de negocio (CRÍTICO)
- prisma/ → base de datos
- servidor/ → backend

REGLA:

- NO poner lógica de negocio en el frontend
- usar lib/ o servidor/

----------------------------------------

# DOCKER Y DEPLOY

- Desarrollo local con Docker
- Producción en Railway

REGLAS:

- NO romper Dockerfile
- NO hardcodear datos
- usar variables de entorno (.env)
- mantener compatibilidad con Railway

----------------------------------------

# BASE DE DATOS

- NO eliminar datos existentes
- NO hacer cambios destructivos
- usar migraciones
- mantener integridad de pedidos y pagos

----------------------------------------

# PERMISOS

## ADMIN
- acceso total
- puede ver métricas
- puede corregir errores

## EMPLEADO
- crear pedidos
- cambiar estados
- registrar pagos (con confirmación)
- NO eliminar datos
- NO modificar pagos

----------------------------------------

# BUENAS PRÁCTICAS

- cambios incrementales
- no refactorizar sin necesidad
- no romper funcionalidades existentes
- validar antes de guardar
- mantener trazabilidad (logs si es necesario)

----------------------------------------

# REGLA FINAL (CRÍTICA)

Si un cambio puede afectar:

- caja
- pagos
- pedidos
- lógica del chofer

→ NO implementarlo sin confirmación explícita
