import { describe, expect, it } from 'vitest';
import { FIELD } from '../src/config';
import { SCISSORS_REACH, Simulation } from '../src/core/simulation';
import { PART_DEFS, ROPE_LENGTH, ROPE_SEGMENTS, type PartSpec } from '../src/parts/defs';
import { createPart } from '../src/parts/factory';

const part = (id: string, type: PartSpec['type'], x: number, y: number, angle = 0): PartSpec => ({ id, type, x, y, angle });
const main = (sim: Simulation, id: string) => sim.bodiesOf(id).find((b) => b.plugin.part.role === 'main')!;

describe('풍선', () => {
  it('공보다 가벼운 동적 부품이다', () => {
    const balloon = createPart(part('b', 'balloon', 100, 100)).bodies[0];
    const ball = createPart(part('c', 'ball', 100, 100)).bodies[0];
    expect(balloon.isStatic).toBe(false);
    expect(balloon.mass).toBeLessThan(ball.mass);
  });

  it('위로 떠오른다', () => {
    const sim = new Simulation([part('bal', 'balloon', 270, 600)]);
    sim.stepTimes(120);
    expect(main(sim, 'bal').position.y).toBeLessThan(450);
  });

  it('지붕에 막히면 그 아래에 머문다', () => {
    const sim = new Simulation([part('roof', 'plank', 270, 300), part('bal', 'balloon', 270, 600)]);
    sim.stepTimes(400);
    const y = main(sim, 'bal').position.y;
    expect(y).toBeGreaterThan(300);
    expect(y).toBeLessThan(340);
  });

  it('아래에서 종을 치면 종 목표를 달성한다', () => {
    const sim = new Simulation([part('bell', 'bell', 270, 300), part('bal', 'balloon', 270, 600)]);
    sim.stepTimes(300);
    expect(sim.isSolved()).toBe(true);
  });

  it('가위에 닿으면 터져서 월드에서 사라진다', () => {
    const sim = new Simulation([part('sc', 'scissors', 270, 300), part('bal', 'balloon', 270, 600)]);
    sim.stepTimes(300);
    expect(sim.removedParts.has('bal')).toBe(true);
    expect(sim.allBodies()).not.toContain(main(sim, 'bal'));
  });
});

describe('로프', () => {
  it('정적 고정점 + 충돌하지 않는 마디 + 동적 추, 마디 수+1 개의 연결', () => {
    const { bodies, constraints } = createPart(part('r', 'rope', 200, 100));
    const roles = bodies.map((b) => b.plugin.part.role);
    expect(roles.filter((r) => r === 'anchor')).toHaveLength(1);
    expect(roles.filter((r) => r === 'segment')).toHaveLength(ROPE_SEGMENTS);
    expect(bodies.find((b) => b.plugin.part.role === 'anchor')!.isStatic).toBe(true);
    expect(bodies.find((b) => b.plugin.part.role === 'main')!.isStatic).toBe(false);
    for (const seg of bodies.filter((b) => b.plugin.part.role === 'segment')) expect(seg.collisionFilter.mask).toBe(0);
    expect(constraints).toHaveLength(ROPE_SEGMENTS + 1);
  });

  it('추는 고정점 아래 로프 길이만큼에 매달려 있다', () => {
    const sim = new Simulation([part('r', 'rope', 270, 200)]);
    sim.stepTimes(180);
    const bob = main(sim, 'r');
    expect(bob.position.x).toBeCloseTo(270, 0);
    expect(Math.abs(bob.position.y - (200 + ROPE_LENGTH))).toBeLessThan(10);
  });

  it('외곽선은 고정점부터 추까지 덮는다', () => {
    const ys = PART_DEFS.rope.outline.map((p) => p.y);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(ROPE_LENGTH + PART_DEFS.rope.radius!);
  });
});

describe('가위', () => {
  // 로프(x=270)와 가위 중심(x=320) 거리 50 < SCISSORS_REACH, 공이 위에서 가위를 친다
  const rigged = (): PartSpec[] => [
    part('r', 'rope', 270, 200),
    part('sc', 'scissors', 320, 260),
    part('b', 'ball', 320, 100),
  ];

  it('정적이고 회전 가능하며, 작동 거리 안에 로프가 닿는 배치를 허용한다', () => {
    expect(PART_DEFS.scissors.rotatable).toBe(true);
    expect(createPart(part('s', 'scissors', 100, 100)).bodies.every((b) => b.isStatic)).toBe(true);
    expect(SCISSORS_REACH).toBeGreaterThan(50);
  });

  it('물체가 치면 근처 로프의 연결 하나를 끊고, 추는 바닥까지 떨어진다', () => {
    const sim = new Simulation(rigged());
    const before = sim.ropeLines().length;
    sim.stepTimes(240);
    expect(sim.ropeLines()).toHaveLength(before - 1);
    expect(sim.snippedScissors.has('sc')).toBe(true);
    const bob = main(sim, 'r');
    expect(bob.position.y).toBeCloseTo(FIELD.height - PART_DEFS.rope.radius!, 0);
  });

  it('아무것도 치지 않으면 로프는 그대로다', () => {
    const sim = new Simulation(rigged().filter((p) => p.id !== 'b'));
    const before = sim.ropeLines().length;
    sim.stepTimes(240);
    expect(sim.ropeLines()).toHaveLength(before);
    expect(sim.snippedScissors.size).toBe(0);
  });

  it('작동 거리 밖의 로프는 끊지 않는다', () => {
    const far = [part('r', 'rope', 100, 200), part('sc', 'scissors', 320, 260), part('b', 'ball', 320, 100)];
    const sim = new Simulation(far);
    const before = sim.ropeLines().length;
    sim.stepTimes(240);
    expect(sim.snippedScissors.has('sc')).toBe(true);
    expect(sim.ropeLines()).toHaveLength(before);
  });

  it('작동하면 거리 안의 풍선도 터뜨린다', () => {
    // 풍선은 가로로 눕힌 벽 아래(중심 y≈292)에 머물러 있다가, 공이 가위(300,300)를 치면 거리 약 50 에서 터진다
    const parts = [
      part('roof', 'wall', 400, 262, Math.PI / 2),
      part('bal', 'balloon', 350, 330),
      part('sc', 'scissors', 300, 300),
      part('b', 'ball', 300, 100),
    ];
    const sim = new Simulation(parts);
    sim.stepTimes(240);
    expect(sim.removedParts.has('bal')).toBe(true);
  });

  it('같은 배치는 같은 결과 (결정성)', () => {
    const a = new Simulation(rigged());
    a.stepTimes(300);
    const b = new Simulation(rigged());
    b.stepTimes(300);
    expect(b.snapshot()).toEqual(a.snapshot());
  });
});
