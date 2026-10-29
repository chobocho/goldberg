import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../scripts/build.mjs';

// 실제 release/ 를 건드리지 않도록 테스트 전용 임시 출력 폴더를 쓴다
const OUT_DIR = join(process.cwd(), '.tmp', 'build-test');

describe('build (단일 파일 산출물)', () => {
  let html = '';

  beforeAll(async () => {
    rmSync(OUT_DIR, { recursive: true, force: true });
    mkdirSync(join(OUT_DIR, 'stale-dir'), { recursive: true });
    writeFileSync(join(OUT_DIR, 'stale.js'), '// 이전 빌드 잔재');
    await build({ outDir: OUT_DIR });
    html = readFileSync(join(OUT_DIR, 'index.html'), 'utf8');
  }, 60_000);

  afterAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true });
  });

  it('출력 폴더에는 index.html 하나만 남는다 (이전 잔재 제거)', () => {
    expect(readdirSync(OUT_DIR)).toEqual(['index.html']);
  });

  it('외부 스크립트/스타일시트/원격 리소스를 참조하지 않는다', () => {
    expect(html).not.toMatch(/<script[^>]*\bsrc\s*=/i);
    expect(html).not.toMatch(/<link[^>]*rel\s*=\s*["']?stylesheet/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/url\(\s*["']?https?:/i);
  });

  it('인라인 자리표시자가 남지 않는다', () => {
    expect(html).not.toContain('<!--@inline');
  });

  it('doctype, UTF-8 charset, 모바일 viewport 메타를 포함한다', () => {
    expect(html.trimStart().toLowerCase().startsWith('<!doctype html>')).toBe(true);
    expect(html).toMatch(/<meta charset="utf-8"/i);
    expect(html).toMatch(/<meta name="viewport"[^>]*width=device-width/i);
  });

  it('게임 캔버스와 번들된 스크립트를 포함한다', () => {
    expect(html).toMatch(/<canvas[^>]*id="game"/);
    expect(html).toMatch(/<script>[\s\S]*getContext[\s\S]*<\/script>/);
  });

  it('한글 제목이 깨지지 않는다', () => {
    expect(html).toContain('<title>골드버그 머신</title>');
    expect(html).not.toContain('�');
  });
});
