import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/core/simulation';
import { GRID, ROTATION_STEP, checkPlacement } from '../src/editor/placement';
import { LEVELS } from '../src/levels';
import { validateLevel, type LevelData } from '../src/levels/schema';
import type { PartSpec } from '../src/parts/defs';
import { SOLUTIONS } from './fixtures/solutions';

// 20초 (60fps 기준)
const MAX_STEPS = 1200;

function solves(parts: PartSpec[]): boolean {
  const sim = new Simulation(parts);
  for (let i = 0; i < MAX_STEPS; i++) {
    sim.step();
    if (sim.isSolved()) return true;
  }
  return false;
}

const base: LevelData = {
  id: 'test',
  name: '테스트',
  hint: '',
  fixed: [
    { id: 'ball', type: 'ball', x: 100, y: 100, angle: 0 },
    { id: 'goal', type: 'basket', x: 400, y: 801, angle: 0 },
  ],
  inventory: { plank: 1 },
};

describe('validateLevel', () => {
  it('정상 레벨은 오류 없음', () => {
    expect(validateLevel(base)).toEqual([]);
  });

  it('무제한(Infinity) 수량은 허용한다', () => {
    expect(validateLevel({ ...base, inventory: { plank: Infinity } })).toEqual([]);
  });

  it.each<[string, Partial<LevelData>, RegExp]>([
    ['빈 id', { id: '' }, /id/],
    ['빈 이름', { name: '  ' }, /name/],
    ['목표 없음', { fixed: [{ id: 'ball', type: 'ball', x: 100, y: 100, angle: 0 }] }, /goal/],
    [
      '고정 부품 id 중복',
      { fixed: [...base.fixed, { id: 'ball', type: 'plank', x: 300, y: 400, angle: 0 }] },
      /duplicate/,
    ],
    ['필드 밖 고정 부품', { fixed: [...base.fixed, { id: 'p', type: 'plank', x: 10, y: 400, angle: 0 }] }, /bounds/],
    ['겹친 고정 부품', { fixed: [...base.fixed, { id: 'p', type: 'plank', x: 110, y: 100, angle: 0 }] }, /overlap/],
    ['알 수 없는 타입', { fixed: [...base.fixed, { id: 'x', type: 'rocket' as never, x: 300, y: 300, angle: 0 }] }, /type/],
    ['비유한 좌표', { fixed: [...base.fixed, { id: 'x', type: 'plank', x: Number.NaN, y: 300, angle: 0 }] }, /finite/],
    ['음수 수량', { inventory: { plank: -1 } }, /inventory/],
    ['소수 수량', { inventory: { plank: 1.5 } }, /inventory/],
    ['목표 부품을 인벤토리로 제공', { inventory: { plank: 1, basket: 1 } }, /goal/],
    ['빈 인벤토리', { inventory: {} }, /inventory/],
  ])('%s → 오류', (_, patch, pattern) => {
    const errors = validateLevel({ ...base, ...patch });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toMatch(pattern);
  });
});

describe('LEVELS', () => {
  it('오리지널 스테이지 9개, id 중복 없음', () => {
    expect(LEVELS).toHaveLength(9);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(9);
  });

  it('기존 레벨 id 와 순서는 유지된다 (저장된 진행 기록 호환)', () => {
    expect(LEVELS.slice(0, 5).map((l) => l.id)).toEqual([
      'first-ramp',
      'domino-relay',
      'seesaw-launch',
      'spring-jump',
      'goldberg-finale',
    ]);
  });

  it('후반 레벨은 새 부품(컨베이어·선풍기, 로프·가위, 도르래, 풍선)을 다룬다', () => {
    const uses = (i: number) =>
      new Set([...LEVELS[i].fixed.map((p) => p.type), ...Object.keys(LEVELS[i].inventory)]);
    expect([...uses(5)]).toEqual(expect.arrayContaining(['conveyor', 'fan']));
    expect([...uses(6)]).toEqual(expect.arrayContaining(['rope', 'scissors']));
    expect([...uses(7)]).toEqual(expect.arrayContaining(['pulley']));
    expect([...uses(8)]).toEqual(expect.arrayContaining(['balloon']));
  });

  it('모든 레벨에 정답 배치가 준비되어 있다', () => {
    for (const level of LEVELS) expect(SOLUTIONS[level.id], level.id).toBeDefined();
  });

  describe.each(LEVELS.map((l) => [l.id, l] as const))('%s', (_, level) => {
    it('스키마가 유효하다', () => {
      expect(validateLevel(level)).toEqual([]);
    });

    it('아무것도 놓지 않으면 클리어되지 않는다', () => {
      expect(solves(level.fixed)).toBe(false);
    });

    it('정답 배치는 인벤토리 수량과 배치 규칙을 지킨다', () => {
      const solution = SOLUTIONS[level.id];
      const counts: Record<string, number> = {};
      for (const spec of solution) counts[spec.type] = (counts[spec.type] ?? 0) + 1;
      for (const [type, n] of Object.entries(counts)) {
        expect(n, type).toBeLessThanOrEqual(level.inventory[type as PartSpec['type']] ?? 0);
      }
      const placed: PartSpec[] = [];
      for (const spec of solution) {
        expect(checkPlacement(spec, [...level.fixed, ...placed]), spec.id).toEqual({ ok: true });
        placed.push(spec);
      }
    });

    it('정답 배치는 플레이어가 실제로 만들 수 있다 (격자 스냅, 15° 회전 단계)', () => {
      for (const spec of SOLUTIONS[level.id]) {
        expect(spec.x % GRID, spec.id).toBe(0);
        expect(spec.y % GRID, spec.id).toBe(0);
        const steps = spec.angle / ROTATION_STEP;
        expect(Math.abs(steps - Math.round(steps)), spec.id).toBeLessThan(1e-9);
      }
    });

    it('정답 배치로 20초 안에 클리어된다', () => {
      expect(solves([...level.fixed, ...SOLUTIONS[level.id]])).toBe(true);
    });
  });
});
