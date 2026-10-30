/** Tipe lingkungan Vite tanpa bergantung pada resolusi `vite/client` di node_modules (berguna jika deps belum terpasang). */
interface ImportMetaEnv {
  readonly [key: string]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {}
