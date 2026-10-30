import { describe, expect, it } from 'vitest';
import { CONVEYOR_SPEED, Simulation } from '../src/core/simulation';
import { PART_DEFS, type PartSpec } from '../src/parts/defs';
import { createPart } from '../src/parts/factory';

const deg = (d: number) => (d * Math.PI) / 180;
const part = (id: string, type: PartSpec['type'], x: number, y: number, angleDeg = 0): PartSpec => ({
  id,
  type,
  x,
  y,
  angle: deg(angleDeg),
});
const main = (sim: Simulation, id: string) => sim.bodiesOf(id).find((b) => b.plugin.part.role === 'main')!;

describe('컨베이어', () => {
  it('정적이고 회전 가능하다', () => {
    expect(PART_DEFS.conveyor.rotatable).toBe(true);
    expect(createPart(part('c', 'conveyor', 200, 300)).bodies.every((b) => b.isStatic)).toBe(true);
  });

  it('올라탄 공을 벨트 방향(각도 0 이면 오른쪽)으로 나른다', () => {
    const sim = new Simulation([part('b', 'ball', 220, 560), part('c', 'conveyor', 270, 600)]);
    sim.stepTimes(60);
    expect(main(sim, 'b').position.x).toBeGreaterThan(330);
  });

  it('180° 돌리면 반대 방향으로 나른다', () => {
    const sim = new Simulation([part('b', 'ball', 320, 560), part('c', 'conveyor', 270, 600, 180)]);
    sim.stepTimes(60);
    expect(main(sim, 'b').position.x).toBeLessThan(210);
  });

  it('벨트 위에서 공의 벨트 방향 속도는 CONVEYOR_SPEED 다', () => {
    const sim = new Simulation([part('b', 'ball', 200, 570), part('c', 'conveyor', 270, 600)]);
    const samples: number[] = [];
    for (let i = 0; i < 40; i++) {
      sim.step();
      const ball = main(sim, 'b');
      // 착지 후 벨트 위(벨트 오른쪽 끝 이전)에 있는 동안만 측정
      if (ball.position.y > 575 && ball.position.x < 330) samples.push(ball.velocity.x);
    }
    expect(samples.length).toBeGreaterThan(3);
    for (const vx of samples.slice(2)) expect(vx).toBeCloseTo(CONVEYOR_SPEED, 1);
  });
});

describe('선풍기', () => {
  it('정적이고 회전 가능하다', () => {
    expect(PART_DEFS.fan.rotatable).toBe(true);
    expect(createPart(part('f', 'fan', 200, 300)).bodies.every((b) => b.isStatic)).toBe(true);
  });

  it('바람 범위 안의 공을 바람 방향으로 민다', () => {
    const sim = new Simulation([part('f', 'fan', 60, 810), part('b', 'ball', 130, 824)]);
    sim.stepTimes(120);
    expect(main(sim, 'b').position.x).toBeGreaterThan(220);
  });

  it('범위 밖의 공은 밀지 않는다', () => {
    const sim = new Simulation([part('f', 'fan', 60, 810), part('b', 'ball', 420, 824)]);
    sim.stepTimes(120);
    expect(main(sim, 'b').position.x).toBeCloseTo(420, 0);
  });

  it('선풍기 뒤쪽의 공은 밀지 않는다', () => {
    const sim = new Simulation([part('f', 'fan', 200, 810), part('b', 'ball', 140, 824)]);
    sim.stepTimes(120);
    expect(main(sim, 'b').position.x).toBeCloseTo(140, 0);
  });

  it('위로 향하게 돌리면 떨어지는 공을 늦춘다', () => {
    const drop = (withFan: boolean) => {
      const parts = [part('b', 'ball', 270, 480)];
      if (withFan) parts.push(part('f', 'fan', 270, 818, -90));
      const sim = new Simulation(parts);
      sim.stepTimes(45);
      return main(sim, 'b').position.y;
    };
    expect(drop(true)).toBeLessThan(drop(false) - 20);
  });

  it('무거운 공은 가벼운 공보다 훨씬 덜 밀린다', () => {
    const push = (type: 'ball' | 'heavyBall') => {
      const r = PART_DEFS[type].radius!;
      const sim = new Simulation([part('f', 'fan', 60, 810), part('b', type, 130, 840 - r)]);
      sim.stepTimes(60);
      return main(sim, 'b').position.x - 130;
    };
    expect(push('ball')).toBeGreaterThan(push('heavyBall') * 3);
  });
});

describe('결정성', () => {
  it('컨베이어·선풍기가 있어도 같은 배치는 같은 결과', () => {
    const layout = [
      part('b', 'ball', 220, 560),
      part('c', 'conveyor', 270, 600, 15),
      part('f', 'fan', 60, 810),
      part('b2', 'ball', 130, 824),
    ];
    const a = new Simulation(layout);
    a.stepTimes(300);
    const b = new Simulation(layout);
    b.stepTimes(300);
    expect(b.snapshot()).toEqual(a.snapshot());
  });
});
