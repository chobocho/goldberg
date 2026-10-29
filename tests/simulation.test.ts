import { describe, expect, it } from 'vitest';
import { FIELD } from '../src/config';
import { Simulation, SPRING_SPEED, advanceFixedSteps } from '../src/core/simulation';
import { PART_DEFS, type PartSpec } from '../src/parts/defs';

const part = (id: string, type: PartSpec['type'], x: number, y: number, angle = 0): PartSpec => ({
  id,
  type,
  x,
  y,
  angle,
});

const mainBody = (sim: Simulation, id: string) => sim.bodiesOf(id).find((b) => b.plugin.part.role === 'main')!;

describe('advanceFixedSteps', () => {
  const STEP = 1000 / 60;

  it('한 프레임 분량이면 1스텝', () => {
    expect(advanceFixedSteps(0, STEP, STEP, 5)).toEqual({ steps: 1, accumulatorMs: 0 });
  });

  it('남은 시간을 누적해 다음 프레임에 쓴다', () => {
    const a = advanceFixedSteps(0, STEP * 0.6, STEP, 5);
    expect(a.steps).toBe(0);
    const b = advanceFixedSteps(a.accumulatorMs, STEP * 0.6, STEP, 5);
    expect(b.steps).toBe(1);
    expect(b.accumulatorMs).toBeCloseTo(STEP * 0.2, 6);
  });

  it('0ms 프레임은 0스텝', () => {
    expect(advanceFixedSteps(0, 0, STEP, 5)).toEqual({ steps: 0, accumulatorMs: 0 });
  });

  it('탭 전환 등 긴 프레임은 maxSteps 로 자르고 누적분을 버린다', () => {
    expect(advanceFixedSteps(0, 5000, STEP, 5)).toEqual({ steps: 5, accumulatorMs: 0 });
  });

  it.each([-10, Number.NaN, Number.POSITIVE_INFINITY])('비정상 프레임 시간(%s)은 0스텝', (frame) => {
    expect(advanceFixedSteps(3, frame, STEP, 5)).toEqual({ steps: 0, accumulatorMs: 3 });
  });
});

describe('Simulation', () => {
  it('빈 필드도 스텝이 진행된다', () => {
    const sim = new Simulation([]);
    sim.stepTimes(10);
    expect(sim.stepCount).toBe(10);
  });

  it('공은 중력으로 떨어져 바닥 위에 멈춘다', () => {
    const sim = new Simulation([part('b', 'ball', 270, 100)]);
    sim.stepTimes(400);
    const ball = mainBody(sim, 'b');
    const r = PART_DEFS.ball.radius!;
    expect(ball.position.y).toBeCloseTo(FIELD.height - r, 0);
    expect(ball.position.x).toBeCloseTo(270, 0);
  });

  it('공은 좌우 벽 밖으로 나가지 않는다', () => {
    const sim = new Simulation([part('b', 'ball', 500, 700, 0), part('p', 'plank', 470, 760, 0.6)]);
    sim.stepTimes(600);
    const ball = mainBody(sim, 'b');
    expect(ball.position.x).toBeGreaterThan(0);
    expect(ball.position.x).toBeLessThan(FIELD.width);
  });

  it('기울어진 판자는 공의 진행 방향을 바꾼다', () => {
    const sim = new Simulation([part('b', 'ball', 200, 100), part('p', 'plank', 220, 300, 0.4)]);
    sim.stepTimes(120);
    expect(mainBody(sim, 'b').position.x).toBeGreaterThan(260);
  });

  it('공에 맞은 도미노는 넘어진다', () => {
    const sim = new Simulation([
      part('b', 'ball', 60, 640),
      part('ramp', 'plank', 110, 700, 0.5),
      part('d', 'domino', 260, FIELD.height - PART_DEFS.domino.height / 2),
    ]);
    sim.stepTimes(300);
    expect(Math.abs(mainBody(sim, 'd').angle)).toBeGreaterThan(1);
  });

  it('시소 한쪽에 무거운 공이 떨어지면 반대쪽 공이 튀어 오른다', () => {
    const sim = new Simulation([
      part('s', 'seesaw', 270, 700),
      part('light', 'ball', 360, 670),
      part('heavy', 'heavyBall', 180, 300),
    ]);
    let minY = Infinity;
    for (let i = 0; i < 200; i++) {
      sim.step();
      minY = Math.min(minY, mainBody(sim, 'light').position.y);
    }
    expect(minY).toBeLessThan(600);
  });

  it('스프링 패드는 닿은 공을 패드 법선 방향으로 SPRING_SPEED 로 튕긴다', () => {
    const sim = new Simulation([part('b', 'ball', 270, 500), part('sp', 'spring', 270, 800)]);
    let minVy = Infinity;
    for (let i = 0; i < 200; i++) {
      sim.step();
      minVy = Math.min(minVy, mainBody(sim, 'b').velocity.y);
    }
    expect(minVy).toBeCloseTo(-SPRING_SPEED, 1);
  });

  it('같은 배치는 항상 같은 결과를 낸다 (결정성)', () => {
    const layout = [
      part('b', 'ball', 60, 640),
      part('ramp', 'plank', 110, 700, 0.5),
      part('d1', 'domino', 260, 812),
      part('d2', 'domino', 300, 812),
      part('d3', 'domino', 340, 812),
    ];
    const a = new Simulation(layout);
    a.stepTimes(500);
    const b = new Simulation(layout);
    b.stepTimes(500);
    expect(b.snapshot()).toEqual(a.snapshot());
  });

  it('snapshot 은 부품별 메인 바디 상태를 담는다', () => {
    const sim = new Simulation([part('b', 'ball', 100, 100)]);
    expect(sim.snapshot()).toEqual([{ id: 'b', x: 100, y: 100, angle: 0 }]);
  });

  // 엣지 케이스
  it('중복 id 는 예외', () => {
    expect(() => new Simulation([part('x', 'ball', 1, 1), part('x', 'plank', 5, 5)])).toThrow(/duplicate/i);
  });
});
