/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origem da API quando o front é servido de outro host (ex.: https://api.exemplo.com). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
