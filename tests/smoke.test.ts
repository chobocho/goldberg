import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../scripts/build.mjs';
import { FIELD } from '../src/config';
import { PROGRESS_KEY } from '../src/game/progress';
import { LEVELS } from '../src/levels';
import { SANDBOX } from '../src/levels/sandbox';
import type { PartType } from '../src/parts/defs';
import { buildLayout, buildMenuLayout, buildWinLayout, type Rect, type UiElement } from '../src/render/ui';
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

function boot(storage: Record<string, string> = {}, width = 412, height = 960): FakeBrowser {
  const browser = new FakeBrowser(width, height, 2.625);
  for (const [k, v] of Object.entries(storage)) browser.storage.set(k, v);
  runInNewContext(script, browser.globals());
  browser.frames(2);
  return browser;
}

/** 상단 바 제목은 "1. 첫 경사로" 처럼 번호가 붙으므로 부분 일치로 찾는다 */
const showsText = (browser: FakeBrowser, text: string) => [...browser.texts].some((t) => t.includes(text));
const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const tapRect = (browser: FakeBrowser, r: Rect) => browser.tap(center(r).x, center(r).y);
const menu = buildMenuLayout(LEVELS.length);
const levelButton = (i: number) => menu.find((e) => e.kind === 'level' && e.index === i)!.rect;
const sandboxButton = menu.find((e) => e.kind === 'sandbox')!.rect;
const playButton = (layout: UiElement[], id: string) =>
  layout.find((e) => e.kind === 'button' && e.id === id)!.rect;

describe('스모크: 번들 실행', () => {
  it('부팅하면 메뉴(타이틀과 레벨 목록)를 그린다', () => {
    const browser = boot();
    expect(browser.errors).toEqual([]);
    expect(browser.texts).toContain('골드버그 머신');
    for (const level of LEVELS) expect(showsText(browser, level.name)).toBe(true);
  });

  it('폴드 접힘/펼침 크기 변경 후에도 계속 그린다', () => {
    const browser = boot();
    browser.resize(884, 1104);
    browser.frames(3);
    browser.resize(412, 960);
    browser.frames(3);
    expect(browser.errors).toEqual([]);
  });

  it('잠긴 레벨은 눌러도 들어가지지 않는다', () => {
    const browser = boot();
    tapRect(browser, levelButton(1));
    browser.frames(2);
    expect(browser.texts).not.toContain('▶ 실행');
  });

  it('레벨 1을 정답 배치로 풀면 진행이 저장되고 다음 레벨로 넘어간다', () => {
    const browser = boot();
    tapRect(browser, levelButton(0));
    browser.frames(2);
    expect(showsText(browser, LEVELS[0].name)).toBe(true);
    expect(browser.texts).toContain('▶ 실행');

    const layout = buildLayout(Object.keys(LEVELS[0].inventory) as PartType[]);
    const slot = layout.find((e) => e.kind === 'slot' && e.type === 'plank')!.rect;
    // 터치 드래그는 부품을 손가락 위 60px 에 띄우므로 필드 (120, 340) 에서 놓으면 판자는 (120, 280) — 레벨 1 정답 위치
    browser.drag(center(slot), { x: FIELD.x + 120, y: FIELD.y + 340 });
    tapRect(browser, playButton(layout, 'rotateRight'));
    tapRect(browser, playButton(layout, 'rotateRight'));
    tapRect(browser, playButton(layout, 'run'));
    browser.frames(300);
    expect(browser.texts).toContain('성공!');
    expect(JSON.parse(browser.storage.get(PROGRESS_KEY)!).cleared).toContain(LEVELS[0].id);

    const next = buildWinLayout(true).find((e) => e.kind === 'button' && e.id === 'winNext')!.rect;
    tapRect(browser, next);
    browser.frames(2);
    expect(showsText(browser, LEVELS[1].name)).toBe(true);
    expect(browser.texts).toContain('▶ 실행');
    expect(browser.errors).toEqual([]);
  });

  it('저장된 진행이 있으면 다음 레벨이 열려 있다', () => {
    const browser = boot({ [PROGRESS_KEY]: JSON.stringify({ cleared: [LEVELS[0].id] }) });
    tapRect(browser, levelButton(1));
    browser.frames(2);
    expect(showsText(browser, LEVELS[1].name)).toBe(true);
    expect(browser.texts).toContain('▶ 실행');
  });

  it('샌드박스에서 부품을 놓고 실행/리셋, 메뉴로 돌아간다', () => {
    const browser = boot();
    tapRect(browser, sandboxButton);
    browser.frames(2);
    const layout = buildLayout(Object.keys(SANDBOX.inventory) as PartType[]);
    const ballSlot = layout.find((e) => e.kind === 'slot' && e.type === 'ball')!.rect;
    browser.drag(center(ballSlot), { x: FIELD.x + 270, y: FIELD.y + 300 });
    browser.frames(2);
    expect(browser.texts).toContain('공 ∞');

    tapRect(browser, playButton(layout, 'run'));
    browser.frames(60);
    expect(browser.texts).toContain('■ 리셋');
    tapRect(browser, playButton(layout, 'run'));
    browser.frames(2);
    expect(browser.texts).toContain('▶ 실행');

    tapRect(browser, playButton(layout, 'menu'));
    browser.frames(2);
    expect(browser.texts).toContain('골드버그 머신');
    expect(browser.texts).not.toContain('▶ 실행');
    expect(browser.errors).toEqual([]);
  });

  it('샌드박스 트레이는 ▶ 로 다음 페이지 부품을 보여 준다', () => {
    const browser = boot();
    tapRect(browser, sandboxButton);
    browser.frames(2);
    const types = Object.keys(SANDBOX.inventory) as PartType[];
    expect(browser.texts).not.toContain('선풍기 ∞');
    tapRect(browser, playButton(buildLayout(types, 0), 'pageNext'));
    browser.frames(2);
    expect(browser.texts).toContain('선풍기 ∞');

    // 다음 페이지의 부품도 끌어 놓을 수 있다
    const fanSlot = buildLayout(types, 1).find((e) => e.kind === 'slot' && e.type === 'fan')!.rect;
    browser.drag(center(fanSlot), { x: FIELD.x + 100, y: FIELD.y + 600 });
    tapRect(browser, playButton(buildLayout(types, 1), 'run'));
    browser.frames(30);
    expect(browser.errors).toEqual([]);
  });

  it('샌드박스에서 로프·풍선·가위를 배치하고 실행해도 예외가 없다', () => {
    const browser = boot();
    tapRect(browser, sandboxButton);
    const types = Object.keys(SANDBOX.inventory) as PartType[];
    const slotRect = (type: PartType, page: number) =>
      buildLayout(types, page).find((e) => e.kind === 'slot' && e.type === type)!.rect;
    const pageOf = (type: PartType) => Math.floor(types.indexOf(type) / 6);
    let page = 0;
    const place = (type: PartType, x: number, y: number) => {
      while (page !== pageOf(type)) {
        tapRect(browser, playButton(buildLayout(types, page), 'pageNext'));
        page = (page + 1) % 3;
      }
      browser.drag(center(slotRect(type, page)), { x: FIELD.x + x, y: FIELD.y + y });
    };
    place('rope', 270, 260);
    place('balloon', 420, 700);
    place('scissors', 330, 320);
    place('ball', 330, 160);
    browser.frames(2);
    tapRect(browser, playButton(buildLayout(types, page), 'run'));
    browser.frames(240);
    expect(browser.texts).toContain('■ 리셋');
    expect(browser.errors).toEqual([]);
  });

  it('멀티터치 두 번째 손가락은 무시한다', () => {
    const browser = boot();
    tapRect(browser, sandboxButton);
    browser.pointer('pointerdown', 270, 400, 1);
    browser.pointer('pointerdown', 100, 400, 2);
    browser.pointer('pointermove', 120, 420, 2);
    browser.pointer('pointerup', 120, 420, 2);
    browser.pointer('pointerup', 270, 400, 1);
    browser.frames(2);
    expect(browser.errors).toEqual([]);
  });
});
