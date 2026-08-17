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
