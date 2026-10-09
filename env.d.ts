/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of ships-go-3d. Defaults to this page's host on VITE_API_PORT. */
  readonly VITE_API_URL?: string
  /** Port of ships-go-3d on this page's host, when VITE_API_URL is unset. Default 3000. */
  readonly VITE_API_PORT?: string
}
