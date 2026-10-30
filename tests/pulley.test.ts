import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/core/simulation';
import { PULLEY_DROP, PULLEY_SPAN, PULLEY_TRAVEL, type PartSpec } from '../src/parts/defs';
import { createPart } from '../src/parts/factory';

const part = (id: string, type: PartSpec['type'], x: number, y: number, angle = 0): PartSpec => ({ id, type, x, y, angle });
const role = (sim: Simulation, id: string, r: string) => sim.bodiesOf(id).find((b) => b.plugin.part.role === r)!;

// 도르래 (270, 300): 왼쪽 받침 (210, 420), 오른쪽 받침 (330, 420)
const PX = 270;
const PY = 300;
const LEFT0 = { x: PX - PULLEY_SPAN, y: PY + PULLEY_DROP };
const RIGHT0 = { x: PX + PULLEY_SPAN, y: PY + PULLEY_DROP };

describe('도르래 구조', () => {
  it('정적 바퀴 + 회전이 잠긴 동적 받침 두 개', () => {
    const { bodies } = createPart(part('p', 'pulley', PX, PY));
    const wheel = bodies.find((b) => b.plugin.part.role === 'base')!;
    const platforms = bodies.filter((b) => ['main', 'platform'].includes(b.plugin.part.role));
    expect(wheel.isStatic).toBe(true);
    expect(platforms).toHaveLength(2);
    for (const p of platforms) {
      expect(p.isStatic).toBe(false);
      expect(p.inertia).toBe(Infinity);
    }
  });
});

describe('도르래 동작', () => {
  it('아무것도 없으면 양쪽이 균형을 유지한다', () => {
    const sim = new Simulation([part('p', 'pulley', PX, PY)]);
    sim.stepTimes(120);
    expect(role(sim, 'p', 'main').position.y).toBeCloseTo(LEFT0.y, 0);
    expect(role(sim, 'p', 'platform').position.y).toBeCloseTo(RIGHT0.y, 0);
  });

  it('왼쪽에 쇠공이 떨어지면 왼쪽은 내려가고 오른쪽은 같은 만큼 올라간다', () => {
    const sim = new Simulation([part('p', 'pulley', PX, PY), part('h', 'heavyBall', LEFT0.x, 200)]);
    sim.stepTimes(90);
    const left = role(sim, 'p', 'main').position;
    const right = role(sim, 'p', 'platform').position;
    expect(left.y).toBeGreaterThan(LEFT0.y + 20);
    expect(right.y).toBeLessThan(RIGHT0.y - 20);
    expect(left.y - LEFT0.y + (right.y - RIGHT0.y)).toBeCloseTo(0, 0);
  });

  it('받침은 좌우로 움직이지 않는다', () => {
    const sim = new Simulation([part('p', 'pulley', PX, PY), part('h', 'heavyBall', LEFT0.x + 25, 200)]);
    sim.stepTimes(120);
    expect(role(sim, 'p', 'main').position.x).toBeCloseTo(LEFT0.x, 6);
    expect(role(sim, 'p', 'platform').position.x).toBeCloseTo(RIGHT0.x, 6);
  });

  it(`이동 거리는 ±${PULLEY_TRAVEL}px 로 제한된다 (받침이 바퀴를 뚫고 올라가지 않음)`, () => {
    const sim = new Simulation([part('p', 'pulley', PX, PY), part('h', 'heavyBall', LEFT0.x, 200)]);
    let minRightY = Infinity;
    for (let i = 0; i < 400; i++) {
      sim.step();
      minRightY = Math.min(minRightY, role(sim, 'p', 'platform').position.y);
    }
    expect(minRightY).toBeGreaterThanOrEqual(RIGHT0.y - PULLEY_TRAVEL - 0.5);
  });

  it('오른쪽 받침의 공을 들어 올린다', () => {
    const sim = new Simulation([
      part('p', 'pulley', PX, PY),
      part('b', 'ball', RIGHT0.x, RIGHT0.y - 24),
      part('h', 'heavyBall', LEFT0.x, 150),
    ]);
    let minBallY = Infinity;
    for (let i = 0; i < 200; i++) {
      sim.step();
      minBallY = Math.min(minBallY, role(sim, 'b', 'main').position.y);
    }
    expect(minBallY).toBeLessThan(RIGHT0.y - 24 - 50);
  });

  it('같은 배치는 같은 결과 (결정성)', () => {
    const layout = [part('p', 'pulley', PX, PY), part('h', 'heavyBall', LEFT0.x, 200), part('b', 'ball', RIGHT0.x, 380)];
    const a = new Simulation(layout);
    a.stepTimes(300);
    const b = new Simulation(layout);
    b.stepTimes(300);
    expect(b.snapshot()).toEqual(a.snapshot());
  });
});
