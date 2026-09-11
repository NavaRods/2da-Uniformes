# Uniformes Club — App interna

App privada (PWA) para gestionar clientes, pagos de uniformes, asistencia y
documentación del club. Pensada para funcionar sin internet: los datos se
guardan localmente y se sincronizan solos cuando vuelve la conexión
(persistencia offline de Firestore).

## Requisitos

- Node.js 20+
- Un proyecto de Firebase (gratis, plan Spark) con Firestore y Authentication
  (Google) activados.

## Configuración

1. Copia `.env.example` a `.env.local`.
2. Llena las variables `VITE_FIREBASE_*` con los datos de tu app web de
   Firebase (Configuración del proyecto → tus apps → Config).
3. En `VITE_ALLOWED_EMAILS` pon, separados por coma, los correos de Google
   autorizados a entrar a la app.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

```bash
npm run build
npm run preview
```

El resultado en `dist/` es una PWA instalable (se puede alojar gratis en
Firebase Hosting, Vercel o Netlify).

## Pruebas

La lógica de negocio (`src/lib/*.js`: pedidos, catálogo, elementos, mensajes
de WhatsApp) tiene pruebas automatizadas con [Vitest](https://vitest.dev).
Estas pruebas no tocan Firebase real: simulan (mockean) el SDK de Firestore
para verificar que cada función arma los datos correctos.

```bash
npm test          # corre las pruebas una vez
npm run test:watch  # las vuelve a correr al guardar cambios
```

Qué cubren:

- **pedidos**: un pedido nuevo arranca con el saldo completo y sin entregar;
  cada abono descuenta del saldo sin "cerrar" el pedido a mano; marcar/
  resolver un cambio pendiente guarda y limpia el motivo correctamente;
  entregar (o cancelar la entrega) registra quién y cuándo.
- **catálogo**: crear un producto usa valores por defecto razonables;
  agregar una talla no duplica las existentes; vaciar el catálogo borra
  todo en un solo batch y no hace nada si ya está vacío.
- **elementos**: dar de alta un elemento aplica los valores por defecto
  esperados y filtra teléfonos vacíos.
- **whatsapp**: los mensajes de comprobante, entrega y cambio pendiente
  incluyen el texto y los datos correctos según el caso.

Antes de subir un cambio a la lógica de `src/lib/`, corre `npm test` para
confirmar que nada se rompió.
