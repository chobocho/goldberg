import { describe, expect, it } from 'vitest';
import { FIELD, WORLD_HEIGHT, WORLD_WIDTH } from '../src/config';
import {
  MIN_TOUCH_TARGET,
  SINGLE_PAGE_MAX,
  SLOTS_PER_PAGE,
  buildLayout,
  hitTestUi,
  pageCount,
  type Rect,
} from '../src/render/ui';
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

describe('트레이 페이지 넘김', () => {
  // 레이아웃은 타입 중복을 신경 쓰지 않으므로 14칸짜리 목록을 반복으로 만든다
  const MANY: PartType[] = [...TYPES, ...TYPES];
  const slotsOf = (layout: ReturnType<typeof buildLayout>) =>
    layout.flatMap((e) => (e.kind === 'slot' ? [e] : []));
  const hasPager = (layout: ReturnType<typeof buildLayout>) =>
    layout.some((e) => e.kind === 'button' && (e.id === 'pagePrev' || e.id === 'pageNext'));

  it(`${SINGLE_PAGE_MAX}종 이하는 한 줄에 모두 보이고 페이지 버튼이 없다`, () => {
    const types = MANY.slice(0, SINGLE_PAGE_MAX);
    expect(pageCount(types.length)).toBe(1);
    expect(slotsOf(buildLayout(types))).toHaveLength(SINGLE_PAGE_MAX);
    expect(hasPager(buildLayout(types))).toBe(false);
  });

  it('초과하면 페이지당 SLOTS_PER_PAGE 칸과 ◀ ▶ 버튼을 둔다', () => {
    expect(pageCount(14)).toBe(Math.ceil(14 / SLOTS_PER_PAGE));
    const layout = buildLayout(MANY, 0);
    expect(slotsOf(layout).map((s) => s.type)).toEqual(MANY.slice(0, SLOTS_PER_PAGE));
    expect(hasPager(layout)).toBe(true);
  });

  it('마지막 페이지는 남은 칸만 보인다', () => {
    const last = pageCount(MANY.length) - 1;
    expect(slotsOf(buildLayout(MANY, last)).map((s) => s.type)).toEqual(MANY.slice(last * SLOTS_PER_PAGE));
  });

  it.each([0, 1, 2])('페이지 %i: 화면 안, 겹침 없음, 필드 침범 없음, 최소 터치 크기', (page) => {
    const layout = buildLayout(MANY, page);
    const fieldRect = { x: FIELD.x, y: FIELD.y, w: FIELD.width, h: FIELD.height };
    for (const [i, a] of layout.entries()) {
      expect(inside(a.rect)).toBe(true);
      expect(overlaps(a.rect, fieldRect)).toBe(false);
      expect(Math.min(a.rect.w, a.rect.h)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      for (const b of layout.slice(i + 1)) expect(overlaps(a.rect, b.rect)).toBe(false);
    }
  });

  it.each([
    [-1, 0],
    [99, 2],
    [Number.NaN, 0],
  ])('범위 밖 페이지(%s)는 %s 로 맞춘다', (page, expected) => {
    expect(slotsOf(buildLayout(MANY, page))).toEqual(slotsOf(buildLayout(MANY, expected)));
  });

  it('빈 목록은 1페이지', () => {
    expect(pageCount(0)).toBe(1);
  });
});
