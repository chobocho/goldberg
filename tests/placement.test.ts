import { describe, expect, it } from 'vitest';
import { FIELD } from '../src/config';
import { polygonBounds, worldOutline } from '../src/editor/geometry';
import {
  ROTATION_STEP,
  checkPlacement,
  clampIntoField,
  hitTestParts,
  normalizeAngle,
  rotated,
  snap,
} from '../src/editor/placement';
import type { PartSpec } from '../src/parts/defs';

const p = (id: string, type: PartSpec['type'], x: number, y: number, angle = 0): PartSpec => ({ id, type, x, y, angle });

describe('snap', () => {
  it.each([
    [14, 10],
    [15, 20],
    [-14, -10],
    [0, 0],
  ])('%s → %s (격자 10)', (v, expected) => {
    expect(snap(v, 10)).toBe(expected);
  });

  it.each([0, -5, Number.NaN])('격자 크기 %s 는 RangeError', (grid) => {
    expect(() => snap(10, grid)).toThrow(RangeError);
  });
});

describe('normalizeAngle', () => {
  it.each([
    [0, 0],
    [Math.PI * 2, 0],
    [-Math.PI, Math.PI],
    [Math.PI * 3, Math.PI],
    [-Math.PI / 2, -Math.PI / 2],
  ])('%s → %s', (a, expected) => {
    expect(normalizeAngle(a)).toBeCloseTo(expected, 9);
  });
});

describe('rotated', () => {
  it('회전 가능한 부품은 한 단계(15°)씩 돈다', () => {
    expect(rotated(p('a', 'plank', 100, 100), 1)!.angle).toBeCloseTo(ROTATION_STEP, 9);
    expect(rotated(p('a', 'plank', 100, 100), -1)!.angle).toBeCloseTo(-ROTATION_STEP, 9);
  });

  it('24단계 돌면 원래 각도로 돌아온다 (누적 오차 없음)', () => {
    let spec = p('a', 'plank', 100, 100);
    for (let i = 0; i < 24; i++) spec = rotated(spec, 1)!;
    expect(spec.angle).toBeCloseTo(0, 9);
  });

  it('회전 불가 부품은 null', () => {
    expect(rotated(p('b', 'ball', 100, 100), 1)).toBeNull();
  });
});

describe('checkPlacement', () => {
  it('빈 필드 안쪽이면 ok', () => {
    expect(checkPlacement(p('a', 'plank', 270, 400), [])).toEqual({ ok: true });
  });

  it('필드 밖으로 나가면 out-of-bounds', () => {
    expect(checkPlacement(p('a', 'plank', 50, 400), [])).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(checkPlacement(p('a', 'ball', 270, FIELD.height - 10), [])).toEqual({ ok: false, reason: 'out-of-bounds' });
  });

  it('경계에 정확히 닿는 것은 허용', () => {
    expect(checkPlacement(p('a', 'domino', 6, FIELD.height - 28), [])).toEqual({ ok: true });
  });

  it('다른 부품과 겹치면 overlap 과 상대 id 를 알려준다', () => {
    const result = checkPlacement(p('a', 'plank', 270, 400), [p('b', 'ball', 300, 405)]);
    expect(result).toEqual({ ok: false, reason: 'overlap', otherId: 'b' });
  });

  it('맞닿기만 한 이웃 도미노는 허용', () => {
    expect(checkPlacement(p('a', 'domino', 100, 500), [p('b', 'domino', 112, 500)])).toEqual({ ok: true });
  });

  it('자기 자신(같은 id)과는 비교하지 않는다', () => {
    expect(checkPlacement(p('a', 'plank', 270, 400), [p('a', 'plank', 270, 400)])).toEqual({ ok: true });
  });
});

describe('clampIntoField', () => {
  it('바닥 아래로 끌린 도미노는 바닥 위에 선다', () => {
    const spec = clampIntoField(p('a', 'domino', 200, 900));
    expect(polygonBounds(worldOutline(spec)).maxY).toBeCloseTo(FIELD.height, 9);
    expect(spec.x).toBe(200);
  });

  it('왼쪽/위쪽 밖은 안쪽으로 밀어 넣는다', () => {
    const b = polygonBounds(worldOutline(clampIntoField(p('a', 'plank', -50, -20))));
    expect(b.minX).toBeCloseTo(0, 9);
    expect(b.minY).toBeCloseTo(0, 9);
  });

  it('이미 안쪽이면 그대로', () => {
    const spec = p('a', 'ball', 200, 200);
    expect(clampIntoField(spec)).toEqual(spec);
  });
});

describe('hitTestParts', () => {
  const parts = [p('under', 'plank', 200, 300), p('over', 'ball', 200, 300), p('d', 'domino', 400, 500)];

  it('겹친 경우 나중에 그려진(위에 있는) 부품을 고른다', () => {
    expect(hitTestParts(parts, { x: 200, y: 300 })).toBe('over');
  });

  it('얇은 도미노도 손가락 여유 범위 안이면 잡힌다', () => {
    expect(hitTestParts(parts, { x: 415, y: 500 })).toBe('d');
  });

  it('여유 범위 밖이면 null', () => {
    expect(hitTestParts(parts, { x: 470, y: 700 })).toBeNull();
  });

  it('빈 목록은 null', () => {
    expect(hitTestParts([], { x: 0, y: 0 })).toBeNull();
  });
});
