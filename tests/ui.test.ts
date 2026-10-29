import { describe, expect, it } from 'vitest';
import { FIELD, WORLD_HEIGHT, WORLD_WIDTH } from '../src/config';
import { MIN_TOUCH_TARGET, buildLayout, hitTestUi, type Rect } from '../src/render/ui';
import type { PartType } from '../src/parts/defs';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= WORLD_WIDTH && r.y + r.h <= WORLD_HEIGHT;

const TYPES: PartType[] = ['ball', 'plank', 'domino', 'seesaw', 'spring', 'wall', 'heavyBall'];

describe('buildLayout', () => {
  it.each([0, 1, 4, 7])('슬롯 %i개: 화면 안, 서로 겹치지 않음, 필드와도 겹치지 않음', (n) => {
    const layout = buildLayout(TYPES.slice(0, n));
    const fieldRect = { x: FIELD.x, y: FIELD.y, w: FIELD.width, h: FIELD.height };
    expect(layout.filter((e) => e.kind === 'slot')).toHaveLength(n);
    for (const [i, a] of layout.entries()) {
      expect(inside(a.rect)).toBe(true);
      expect(overlaps(a.rect, fieldRect)).toBe(false);
      for (const b of layout.slice(i + 1)) expect(overlaps(a.rect, b.rect)).toBe(false);
    }
  });

  it('모든 터치 대상은 최소 크기 이상이다 (폴드 커버에서 약 44 CSS px)', () => {
    for (const e of buildLayout(TYPES)) {
      expect(Math.min(e.rect.w, e.rect.h)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('실행·메뉴·회전·삭제 버튼을 포함한다', () => {
    const ids = buildLayout(TYPES).flatMap((e) => (e.kind === 'button' ? [e.id] : []));
    expect(ids).toEqual(expect.arrayContaining(['menu', 'run', 'rotateLeft', 'rotateRight', 'delete', 'clear']));
  });
});

describe('hitTestUi', () => {
  const layout = buildLayout(TYPES);

  it('슬롯 중앙을 누르면 해당 슬롯', () => {
    const slot = layout.find((e) => e.kind === 'slot' && e.type === 'domino')!;
    const hit = hitTestUi(layout, { x: slot.rect.x + slot.rect.w / 2, y: slot.rect.y + slot.rect.h / 2 });
    expect(hit).toBe(slot);
  });

  it('버튼의 왼쪽 위 모서리는 포함, 오른쪽 아래 모서리는 제외 (반열린 구간)', () => {
    const run = layout.find((e) => e.kind === 'button' && e.id === 'run')!;
    expect(hitTestUi(layout, { x: run.rect.x, y: run.rect.y })).toBe(run);
    expect(hitTestUi(layout, { x: run.rect.x + run.rect.w, y: run.rect.y + run.rect.h })).not.toBe(run);
  });

  it('필드 안은 null', () => {
    expect(hitTestUi(layout, { x: 270, y: FIELD.y + 300 })).toBeNull();
  });
});
