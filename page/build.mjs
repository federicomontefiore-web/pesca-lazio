// Bundle della pagina: page/src/app.js (+ motore + contenuti) → dist/pesca.html
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ESBUILD = ['esbuild', '/opt/npm-tools/node_modules/esbuild'];
let esbuild;
for (const p of ESBUILD) { try { esbuild = require(p); break; } catch { /* prova il prossimo */ } }
if (!esbuild) throw new Error('esbuild non trovato');

const r = await esbuild.build({ entryPoints: ['page/src/app.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('page/src/page.html', 'utf8').replace('<!--APP-->', () => `<script>${js}</script>`);
if (!existsSync('dist')) mkdirSync('dist');
writeFileSync('dist/pesca.html', html);
console.log(`dist/pesca.html ${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB`);
