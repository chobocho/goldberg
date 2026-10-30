import { describe, expect, it } from 'vitest';
import { FIELD, WORLD_HEIGHT, WORLD_WIDTH } from '../src/config';
import { MIN_TOUCH_TARGET, buildMenuLayout, buildWinLayout, hitTestUi, type Rect } from '../src/render/ui';
import { SANDBOX } from '../src/levels/sandbox';
import { validateLevel } from '../src/levels/schema';
import { buildLayout } from '../src/render/ui';
import type { PartType } from '../src/parts/defs';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const insideWorld = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= WORLD_WIDTH && r.y + r.h <= WORLD_HEIGHT;
const insideField = (r: Rect) =>
  r.x >= FIELD.x && r.y >= FIELD.y && r.x + r.w <= FIELD.x + FIELD.width && r.y + r.h <= FIELD.y + FIELD.height;

describe('buildMenuLayout', () => {
  it.each([1, 5, 8])('레벨 %i개: 레벨 버튼 + 샌드박스 버튼, 화면 안, 겹침 없음, 최소 터치 크기', (n) => {
    const layout = buildMenuLayout(n);
    expect(layout.filter((e) => e.kind === 'level').map((e) => (e.kind === 'level' ? e.index : -1))).toEqual(
      [...Array(n).keys()],
    );
    expect(layout.filter((e) => e.kind === 'sandbox')).toHaveLength(1);
    for (const [i, a] of layout.entries()) {
      expect(insideWorld(a.rect)).toBe(true);
      expect(Math.min(a.rect.w, a.rect.h)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      for (const b of layout.slice(i + 1)) expect(overlaps(a.rect, b.rect)).toBe(false);
    }
  });

  it('레벨 0개여도 샌드박스 버튼은 있다', () => {
    expect(buildMenuLayout(0).map((e) => e.kind)).toEqual(['sandbox']);
  });

  it('hitTestUi 로 메뉴 버튼을 찾을 수 있다', () => {
    const layout = buildMenuLayout(5);
    const third = layout.find((e) => e.kind === 'level' && e.index === 2)!;
    expect(hitTestUi(layout, { x: third.rect.x + 1, y: third.rect.y + 1 })).toBe(third);
  });
});

describe('buildWinLayout', () => {
  it.each([true, false])('다음 레벨 존재=%s: 필드 안, 겹침 없음, 최소 터치 크기', (hasNext) => {
    const layout = buildWinLayout(hasNext);
    const ids = layout.map((e) => (e.kind === 'button' ? e.id : ''));
    expect(ids).toEqual(hasNext ? ['winRetry', 'winNext'] : ['winRetry', 'winMenu']);
    for (const [i, a] of layout.entries()) {
      expect(insideField(a.rect)).toBe(true);
      expect(Math.min(a.rect.w, a.rect.h)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      for (const b of layout.slice(i + 1)) expect(overlaps(a.rect, b.rect)).toBe(false);
    }
  });
});

describe('SANDBOX', () => {
  it('목표 없이 부품만 제공하므로 레벨 스키마의 목표 규칙 외에는 유효하다', () => {
    const errors = validateLevel(SANDBOX);
    expect(errors.filter((e) => !/goal/.test(e))).toEqual([]);
  });

  it('모든 인벤토리는 무제한이다', () => {
    for (const count of Object.values(SANDBOX.inventory)) expect(count).toBe(Infinity);
  });

  it('슬롯이 최소 터치 크기를 지키는 개수만 제공한다', () => {
    const slots = buildLayout(Object.keys(SANDBOX.inventory) as PartType[]).filter((e) => e.kind === 'slot');
    for (const s of slots) expect(s.rect.w).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});
