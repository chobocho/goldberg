// TS 소스를 번들하고 CSS와 함께 index.html 하나로 합쳐 release/ 에 출력한다.
import { build as esbuild, transform } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlineHtml } from './inline.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

/**
 * 출력 폴더를 통째로 비우므로, 프로젝트 루트나 그 상위 폴더를 실수로 지우지 않게 막는다.
 * @param {string} outDir
 */
function assertSafeOutDir(outDir) {
  const rel = relative(outDir, ROOT);
  if (rel === '' || !rel.startsWith('..') || resolve(outDir) === resolve(outDir, '..')) {
    throw new Error(`Refusing to clean unsafe outDir: ${outDir}`);
  }
}

/**
 * @param {{ outDir?: string, minify?: boolean }} [options]
 * @returns {Promise<{ outFile: string, bytes: number }>}
 */
export async function build(options = {}) {
  const outDir = resolve(options.outDir ?? join(ROOT, 'release'));
  const minify = options.minify ?? true;
  assertSafeOutDir(outDir);

  const [template, cssSource, bundle] = await Promise.all([
    readFile(join(SRC, 'index.html'), 'utf8'),
    readFile(join(SRC, 'style.css'), 'utf8'),
    esbuild({
      entryPoints: [join(SRC, 'main.ts')],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2020',
      minify,
      legalComments: 'none',
      // 한글 문자열을 \uXXXX 로 이스케이프하지 않고 그대로 두어 용량과 가독성을 지킨다
      charset: 'utf8',
    }),
  ]);
  const css = await transform(cssSource, { loader: 'css', minify, charset: 'utf8' });

  const html = inlineHtml(template, { js: bundle.outputFiles[0].text.trim(), css: css.code.trim() });

  // 이전 빌드 잔재가 남으면 "산출물 하나" 원칙이 깨지므로 폴더를 비우고 다시 쓴다
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, 'index.html');
  await writeFile(outFile, html, 'utf8');
  return { outFile, bytes: Buffer.byteLength(html, 'utf8') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { outFile, bytes } = await build();
  console.log(`built ${relative(ROOT, outFile)} (${(bytes / 1024).toFixed(1)} KB)`);
}
