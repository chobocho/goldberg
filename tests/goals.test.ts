import { describe, expect, it } from 'vitest';
import { FIELD } from '../src/config';
import { Simulation } from '../src/core/simulation';
import type { PartSpec } from '../src/parts/defs';

const part = (id: string, type: PartSpec['type'], x: number, y: number, angle = 0): PartSpec => ({ id, type, x, y, angle });
const BASKET_Y = FIELD.height - 39;

function runUntilSolved(sim: Simulation, maxSteps: number): void {
  for (let i = 0; i < maxSteps && !sim.isSolved(); i++) sim.step();
}

describe('목표 판정', () => {
  it('바구니 위에서 떨어진 공은 바구니 목표를 달성한다', () => {
    const sim = new Simulation([part('b', 'ball', 300, 300), part('goal', 'basket', 300, BASKET_Y)]);
    expect(sim.goalIds).toEqual(['goal']);
    runUntilSolved(sim, 300);
    expect(sim.isSolved()).toBe(true);
    expect(sim.achievedGoals.has('goal')).toBe(true);
    expect(sim.solvedAtStep).toBeGreaterThan(0);
  });

  it('쇠공도 바구니 목표로 인정한다', () => {
    const sim = new Simulation([part('b', 'heavyBall', 300, 300), part('goal', 'basket', 300, BASKET_Y)]);
    runUntilSolved(sim, 300);
    expect(sim.isSolved()).toBe(true);
  });

  it('바구니를 비껴간 공은 달성하지 못한다', () => {
    const sim = new Simulation([part('b', 'ball', 100, 300), part('goal', 'basket', 400, BASKET_Y)]);
    runUntilSolved(sim, 400);
    expect(sim.isSolved()).toBe(false);
  });

  it('공이 아닌 물체(도미노)는 바구니 목표로 치지 않는다', () => {
    const sim = new Simulation([part('d', 'domino', 300, 500), part('goal', 'basket', 300, BASKET_Y)]);
    runUntilSolved(sim, 300);
    expect(sim.isSolved()).toBe(false);
  });

  it('움직이는 물체가 종에 닿으면 종 목표를 달성한다', () => {
    const sim = new Simulation([part('b', 'ball', 300, 200), part('bell', 'bell', 300, 500)]);
    runUntilSolved(sim, 300);
    expect(sim.isSolved()).toBe(true);
  });

  it('아무것도 닿지 않은 종은 달성되지 않는다', () => {
    const sim = new Simulation([part('b', 'ball', 100, 200), part('bell', 'bell', 400, 500)]);
    runUntilSolved(sim, 300);
    expect(sim.isSolved()).toBe(false);
  });

  it('목표가 여러 개면 모두 달성해야 클리어', () => {
    const sim = new Simulation([
      part('b', 'ball', 300, 200),
      part('bell', 'bell', 300, 500),
      part('goal', 'basket', 100, BASKET_Y),
    ]);
    runUntilSolved(sim, 400);
    expect(sim.achievedGoals.has('bell')).toBe(true);
    expect(sim.isSolved()).toBe(false);
  });

  it('달성한 목표는 공이 빠져나가도 유지된다', () => {
    const sim = new Simulation([part('b', 'ball', 300, 300), part('goal', 'basket', 300, BASKET_Y)]);
    runUntilSolved(sim, 300);
    const step = sim.solvedAtStep;
    sim.stepTimes(100);
    expect(sim.isSolved()).toBe(true);
    expect(sim.solvedAtStep).toBe(step);
  });

  // 엣지 케이스
  it('목표 부품이 없으면 절대 클리어되지 않는다 (샌드박스)', () => {
    const sim = new Simulation([part('b', 'ball', 300, 300)]);
    sim.stepTimes(100);
    expect(sim.goalIds).toEqual([]);
    expect(sim.isSolved()).toBe(false);
    expect(sim.solvedAtStep).toBeNull();
  });
});
