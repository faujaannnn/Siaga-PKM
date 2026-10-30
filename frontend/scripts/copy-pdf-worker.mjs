/**
 * Salin worker PDF.js ke public/*.js agar di produksi MIME-nya application/javascript
 * (banyak reverse proxy mengembalikan application/octet-stream untuk .mjs → modul worker gagal).
 * Polyfill Promise.withResolvers disisipkan di awal worker (thread terpisah dari halaman).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const polyfillSrc = path.join(root, 'public', 'polyfills', 'promise-with-resolvers.js')
const destDir = path.join(root, 'public', 'pdfjs')
const dest = path.join(destDir, 'pdf.worker.js')

if (!fs.existsSync(src)) {
  console.error('copy-pdf-worker: berkas tidak ada:', src)
  process.exit(1)
}
if (!fs.existsSync(polyfillSrc)) {
  console.error('copy-pdf-worker: polyfill tidak ada:', polyfillSrc)
  process.exit(1)
}

const polyfill = fs.readFileSync(polyfillSrc, 'utf8').trim()
const worker = fs.readFileSync(src, 'utf8')
fs.mkdirSync(destDir, { recursive: true })
fs.writeFileSync(dest, `${polyfill}\n${worker}`)
console.log('copy-pdf-worker:', path.relative(root, dest))
