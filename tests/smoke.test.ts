import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../scripts/build.mjs';
import { FIELD } from '../src/config';
import { PRACTICE } from '../src/levels/practice';
import { buildLayout } from '../src/render/ui';
import { FakeBrowser } from './helpers/fakeBrowser';

// 실제 브라우저 없이 번들된 산출물을 가짜 DOM 위에서 실행해 런타임 예외와 기본 흐름을 확인한다
const OUT_DIR = join(process.cwd(), '.tmp', 'smoke-test');
let script = '';

beforeAll(async () => {
  await build({ outDir: OUT_DIR, minify: false });
  const html = readFileSync(join(OUT_DIR, 'index.html'), 'utf8');
  script = html.match(/<script>([\s\S]*)<\/script>/)![1];
}, 60_000);

afterAll(() => rmSync(OUT_DIR, { recursive: true, force: true }));

function boot(width = 412, height = 960): FakeBrowser {
  const browser = new FakeBrowser(width, height, 2.625);
  runInNewContext(script, browser.globals());
  browser.frames(2);
  return browser;
}

describe('스모크: 번들 실행', () => {
  it('부팅 후 프레임을 그려도 예외가 없다', () => {
    const browser = boot();
    expect(browser.errors).toEqual([]);
    expect(browser.texts.size).toBeGreaterThan(0);
  });

  it('폴드 접힘/펼침 크기 변경 후에도 계속 그린다', () => {
    const browser = boot();
    browser.resize(884, 1104);
    browser.frames(3);
    browser.resize(412, 960);
    browser.frames(3);
    expect(browser.errors).toEqual([]);
  });

  it('트레이에서 부품을 끌어 놓고 실행/리셋을 토글한다', () => {
    const browser = boot();
    const layout = buildLayout(Object.keys(PRACTICE.inventory) as never);
    const slot = layout.find((e) => e.kind === 'slot')!;
    const run = layout.find((e) => e.kind === 'button' && e.id === 'run')!;
    const center = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

    browser.drag(center(slot.rect), { x: FIELD.width / 2, y: FIELD.y + FIELD.height / 2 });
    browser.frames(2);
    expect(browser.texts).toContain('▶ 실행');
    // 첫 슬롯(판자 3개) 중 하나가 필드에 놓였다
    expect(slot.kind === 'slot' && slot.type).toBe('plank');
    expect(browser.texts).toContain('판자 ×2');

    browser.tap(center(run.rect).x, center(run.rect).y);
    browser.frames(120);
    expect(browser.texts).toContain('■ 리셋');

    browser.tap(center(run.rect).x, center(run.rect).y);
    browser.frames(2);
    expect(browser.texts).toContain('▶ 실행');
    expect(browser.errors).toEqual([]);
  });

  it('멀티터치 두 번째 손가락은 무시한다', () => {
    const browser = boot();
    browser.pointer('pointerdown', 270, 400, 1);
    browser.pointer('pointerdown', 100, 400, 2);
    browser.pointer('pointermove', 120, 420, 2);
    browser.pointer('pointerup', 120, 420, 2);
    browser.pointer('pointerup', 270, 400, 1);
    browser.frames(2);
    expect(browser.errors).toEqual([]);
  });
});
