# Setup del proyecto

## Requisitos
- Node.js 18+
- PostgreSQL corriendo en localhost:5432

## 1. Configurar base de datos
Editar `.env` con tu conexión PostgreSQL:
```
DATABASE_URL="postgresql://usuario:password@localhost:5432/lavanderia"
```

## 2. Instalar dependencias
```bash
npm install
```

## 3. Crear tablas
```bash
npm run db:migrate
```

## 4. Cargar usuarios iniciales
```bash
npm run db:seed
```

## 5. Correr el servidor
```bash
npm run dev
```

Abrir http://localhost:3000

## Usuarios por defecto
- Admin: admin@lavanderia.com / admin123
- Empleado: empleado@lavanderia.com / empleado123

## Comandos útiles
- `npm run db:studio` — Abrir Prisma Studio (explorar BD)
- `npm run db:reset` — Resetear BD y re-seedear
