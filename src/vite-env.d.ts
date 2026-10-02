/// <reference types="vite/client" />

// Variables de entorno que usa la app (.env.local). Todas son texto y pueden
// faltar, por eso son opcionales.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_USE_EMULATORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
