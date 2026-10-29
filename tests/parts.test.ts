import { describe, expect, it } from 'vitest';
import { PART_DEFS, PART_TYPES, type PartSpec } from '../src/parts/defs';
import { createPart } from '../src/parts/factory';

const spec = (type: PartSpec['type'], extra: Partial<PartSpec> = {}): PartSpec => ({
  id: `${type}-1`,
  type,
  x: 200,
  y: 300,
  angle: 0,
  ...extra,
});

/** 외적 부호가 한 방향으로만 나오면 볼록 다각형이다 */
function isConvex(points: { x: number; y: number }[]): boolean {
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross !== 0) {
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
  }
  return sign !== 0;
}

describe('PART_DEFS', () => {
  it('모든 부품 타입에 정의가 있다', () => {
    for (const type of PART_TYPES) expect(PART_DEFS[type]).toBeDefined();
  });

  it.each(PART_TYPES)('%s 의 외곽선은 3점 이상의 볼록 다각형이다', (type) => {
    const outline = PART_DEFS[type].outline;
    expect(outline.length).toBeGreaterThanOrEqual(3);
    expect(isConvex(outline)).toBe(true);
  });
});

describe('createPart', () => {
  it.each(PART_TYPES)('%s 의 모든 바디에 부품 id/type 태그가 붙는다', (type) => {
    const { bodies } = createPart(spec(type));
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body.plugin.part.id).toBe(`${type}-1`);
      expect(body.plugin.part.type).toBe(type);
    }
  });

  it('공과 도미노는 동적, 판자·벽·스프링·바구니·종은 정적이다', () => {
    expect(createPart(spec('ball')).bodies[0].isStatic).toBe(false);
    expect(createPart(spec('heavyBall')).bodies[0].isStatic).toBe(false);
    expect(createPart(spec('domino')).bodies[0].isStatic).toBe(false);
    for (const type of ['plank', 'wall', 'spring', 'basket', 'bell'] as const) {
      for (const body of createPart(spec(type)).bodies) expect(body.isStatic).toBe(true);
    }
  });

  it('무거운 공은 일반 공보다 질량이 크다', () => {
    const light = createPart(spec('ball')).bodies[0];
    const heavy = createPart(spec('heavyBall')).bodies[0];
    expect(heavy.mass).toBeGreaterThan(light.mass * 3);
  });

  it('위치와 각도를 적용한다', () => {
    const body = createPart(spec('plank', { x: 123, y: 456, angle: Math.PI / 6 })).bodies[0];
    expect(body.position.x).toBeCloseTo(123, 6);
    expect(body.position.y).toBeCloseTo(456, 6);
    expect(body.angle).toBeCloseTo(Math.PI / 6, 6);
  });

  it('시소는 동적 판 + 중심 고정 제약을 가진다', () => {
    const { bodies, constraints } = createPart(spec('seesaw'));
    const board = bodies.find((b) => b.plugin.part.role === 'main')!;
    expect(board.isStatic).toBe(false);
    expect(constraints).toHaveLength(1);
    expect(constraints[0].bodyB).toBe(board);
    expect(constraints[0].pointA).toEqual({ x: 200, y: 300 });
  });

  it('바구니에는 내부 감지용 센서 바디가 있다', () => {
    const { bodies } = createPart(spec('basket'));
    const sensors = bodies.filter((b) => b.isSensor);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].plugin.part.role).toBe('sensor');
  });

  // 엣지 케이스
  it('알 수 없는 타입은 예외', () => {
    expect(() => createPart({ ...spec('ball'), type: 'rocket' as never })).toThrow(/unknown part type/i);
  });

  it.each([
    ['x', Number.NaN],
    ['y', Number.POSITIVE_INFINITY],
    ['angle', Number.NaN],
  ] as const)('%s 가 유한수가 아니면 예외', (key, value) => {
    expect(() => createPart(spec('ball', { [key]: value }))).toThrow(RangeError);
  });

  it('빈 id 는 예외', () => {
    expect(() => createPart(spec('ball', { id: '' }))).toThrow(/id/i);
  });
});
