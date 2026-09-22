# Uniformes — App interna

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
3. El acceso se administra con roles (Admin / Operador) y Unidades desde la
   pantalla "Usuarios" dentro de la app — ver `firestore.rules`. El primer
   Admin no se puede crear desde la app (necesita ya ser Admin para eso): se
   da de alta una sola vez a mano desde la consola de Firebase → Firestore →
   colección `usuarios` → documento con ID = tu correo en minúsculas, campos
   `{ rol: "admin", unidad: null, nombre: "..." }`. De ahí en adelante, ese
   Admin da de alta a los demás desde la app.

## Desarrollo

`npm run dev` habla por defecto con el **emulador local de Firebase**
(Firestore + Auth), no con producción — así nunca se leen ni escriben datos
reales mientras se prueba en el navegador. Se necesitan dos terminales:

```bash
# Terminal 1: deja corriendo el emulador (guarda los datos entre reinicios)
npm run emulators

# Terminal 2 (la primera vez, o cuando el emulador arranque vacío):
# crea un usuario Admin de prueba y una Unidad
npm run seed:emulator tu-correo@ejemplo.com "2da Unidad"

# Terminal 2: la app
npm install
npm run dev
```

Abre `http://localhost:5173`, inicia sesión con el correo que usaste en
`seed:emulator` — el emulador de Auth deja crear esa cuenta de prueba en el
momento, sin que sea una cuenta real de Google. La consola del emulador
(`http://localhost:4000`) deja ver y editar los datos a mano.

`npm run emulators` guarda los datos en `./.emulator-data` al cerrarlo
(`--export-on-exit`) y los recarga la próxima vez, así no hay que sembrar cada
vez. Esa carpeta no se sube al repo (está en `.gitignore`).

¿Necesitas probar puntualmente contra producción? Pon
`VITE_USE_EMULATORS=false` en `.env.local` y usa las credenciales reales de
`VITE_FIREBASE_*` — pero ten cuidado, ahí sí se leen y escriben datos reales.

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

### Pruebas de las reglas de seguridad

`firestore.rules` se prueba contra el emulador de Firestore (necesita Java
instalado). Verifican, por ejemplo, que un Operador no lea otra Unidad, que un
abono solo se cree junto con el descuento exacto en el saldo, y que solo un
Admin borre pagos.

```bash
npm run test:rules
```

Corre esto cada vez que cambies `firestore.rules`.

## Consumo de Firestore (plan gratuito)

La app está hecha para gastar el mínimo de lecturas del plan Spark (50,000
al día):

- **Catálogo, grados, Unidades y usuarios** se guardan en la caché del
  dispositivo y solo se vuelven a descargar cuando un Admin los cambia. Cada
  colección tiene una "versión" en el documento `meta/versiones`; abrir la app
  cuesta 1 lectura (ese documento) en lugar de una por producto, grado, etc.
  Por seguridad se vuelven a descargar cada 3 días aunque no cambien.
- **Elementos**: solo se descargan los que cambiaron desde la última vez
  (campo `actualizadoEn`). La lista completa de una Unidad se vuelve a
  descargar una vez por semana por dispositivo.
- **Número de WhatsApp**: una sola lectura compartida por todas las pantallas.
- Los conteos (elementos por Unidad, uso de un grado) usan consultas de
  conteo: 1 lectura por cada 1,000 documentos.

Las reglas de Firestore obligan a que cada escritura mantenga esto al día (la
versión y `actualizadoEn`). **Si editas catálogo, grados, Unidades o usuarios
a mano desde la consola de Firebase**, los dispositivos lo verán en máximo 3
días; para que lo vean de inmediato, cambia también el campo de esa colección
en `meta/versiones` (tipo *timestamp*, con la hora actual).

### Orden para publicar este cambio

La app nueva y las reglas nuevas van juntas (la app vieja no escribe
`actualizadoEn` y las reglas viejas no la aceptan), pero el índice debe existir
antes:

```bash
firebase deploy --only firestore:indexes
```

Espera a que el índice `elementos (unidad, actualizadoEn)` aparezca como
"Habilitado" en Firebase Console > Firestore > Índices, y después:

```bash
npm run deploy
```

Hazlo en un horario sin uso (no durante el pase de lista). Quien tenga la app
abierta con la versión anterior debe recargarla; hasta entonces sus cambios en
elementos serán rechazados.


## Seguridad

- **Reglas de Firestore** (`firestore.rules`): roles Admin/Operador, datos
  separados por Unidad, saldo y abonos atados entre sí, precio de pedidos fijo,
  y borrado de pagos/elementos solo para Admin.
- **App Check** (opcional pero recomendado): crea una clave de *reCAPTCHA
  Enterprise* para tu dominio, regístrala en Firebase Console > App Check >
  Apps, y pon la clave en `.env` como `VITE_RECAPTCHA_SITE_KEY`. En desarrollo,
  el navegador imprime un *debug token* en la consola: agrégalo en App Check >
  Administrar tokens de depuración. Cuando la app ya envíe tokens válidos,
  activa "Aplicar" (enforce) para Cloud Firestore.
- **Consola de Firebase / Google Cloud** (no se puede hacer desde el código):
  restringir la API key por referrer HTTP, dejar solo tus dominios en
  Authentication > Configuración > Dominios autorizados, dejar solo Google
  como proveedor de acceso, y configurar alertas de presupuesto.

## Elementos, bajas, Estado de Fuerza y reportes

- **Bajas:** un elemento no se elimina; se da de baja (desde su perfil o desde
  Asistencia) y pasa a la pestaña *Bajas*, de donde se puede reactivar.
- **Grados militares:** se administran en *Configuración > Grados* (solo Admin).
  Mientras no se carguen a Firestore se usan los predeterminados. Cada grado
  tiene una categoría (Jefes, Oficiales, Clases, Cadetes, Tropas, Reclutas) que
  define el renglón del Estado de Fuerza.
- **Estado de Fuerza:** en Asistencia, pestaña *Estado de Fuerza*: conteo por
  categoría de Varonil y Femenino, totales y novedades opcionales, para enviar
  por WhatsApp. Cuenta a los elementos de la lista del día seleccionado.
- **Reporte de asistencia:** columnas Unidad, No. de orden, Grado, Nombre y los
  domingos del mes, con marcas A, F, FJ y B; se puede descargar en PDF.
