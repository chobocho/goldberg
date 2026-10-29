import Matter from 'matter-js';
import { FIELD } from '../config';
import type { PartSpec } from '../parts/defs';
import { createPart, partTag } from '../parts/factory';

const { Bodies, Body, Composite, Engine, Events } = Matter;

// 결정성을 위해 시뮬레이션은 항상 고정 간격으로만 진행한다 (렌더 프레임 간격과 분리)
export const STEP_MS = 1000 / 60;
/** 스프링 패드가 닿은 물체에 주는 속도 (px / 기준 스텝) */
export const SPRING_SPEED = 18;

const BOUNDARY_THICKNESS = 60;

export interface BodyState {
  id: string;
  x: number;
  y: number;
  angle: number;
}

/**
 * 렌더 프레임 시간을 고정 스텝 수로 환산한다.
 * 탭 전환처럼 긴 공백 뒤에는 따라잡기 스텝이 폭주하지 않도록 maxSteps 에서 자르고 남은 시간은 버린다.
 */
export function advanceFixedSteps(
  accumulatorMs: number,
  frameMs: number,
  stepMs: number,
  maxSteps: number,
): { steps: number; accumulatorMs: number } {
  if (!Number.isFinite(frameMs) || frameMs < 0) return { steps: 0, accumulatorMs };
  const total = accumulatorMs + frameMs;
  // 부동소수 오차로 정확히 한 스텝 분량이 0.999.. 스텝이 되는 것을 막는다
  const steps = Math.floor(total / stepMs + 1e-9);
  if (steps > maxSteps) return { steps: maxSteps, accumulatorMs: 0 };
  return { steps, accumulatorMs: Math.max(0, total - steps * stepMs) };
}

export class Simulation {
  readonly engine: Matter.Engine;
  stepCount = 0;
  private readonly partBodies = new Map<string, Matter.Body[]>();
  private readonly order: string[] = [];
  private pendingLaunches = new Map<Matter.Body, Matter.Vector>();

  constructor(parts: readonly PartSpec[]) {
    this.engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    // 도미노처럼 맞닿은 물체가 많은 장면에서 관통·떨림을 줄이기 위해 반복 횟수를 기본값보다 높인다
    this.engine.positionIterations = 10;
    this.engine.velocityIterations = 8;
    this.addBoundaries();

    for (const spec of parts) {
      if (this.partBodies.has(spec.id)) throw new Error(`Duplicate part id: ${spec.id}`);
      const { bodies, constraints } = createPart(spec);
      this.partBodies.set(spec.id, bodies);
      this.order.push(spec.id);
      Composite.add(this.engine.world, [...bodies, ...constraints]);
    }

    Events.on(this.engine, 'collisionStart', (event) => this.collectSpringLaunches(event.pairs));
  }

  // 바닥과 좌우 벽. 높이 튀어 오른 물체도 잡도록 벽은 필드 위아래로 길게 둔다.
  private addBoundaries(): void {
    const { width, height } = FIELD;
    const t = BOUNDARY_THICKNESS;
    const options = { isStatic: true, friction: 0.3, label: 'boundary' };
    Composite.add(this.engine.world, [
      Bodies.rectangle(width / 2, height + t / 2, width + t * 2, t, options),
      Bodies.rectangle(-t / 2, height / 2, t, height * 3, options),
      Bodies.rectangle(width + t / 2, height / 2, t, height * 3, options),
    ]);
  }

  private collectSpringLaunches(pairs: Matter.Pair[]): void {
    for (const pair of pairs) {
      for (const [spring, other] of [
        [pair.bodyA, pair.bodyB],
        [pair.bodyB, pair.bodyA],
      ]) {
        if (partTag(spring)?.type !== 'spring') continue;
        const target = other.parent ?? other;
        if (target.isStatic || target.isSensor) continue;
        const a = spring.angle;
        // 패드 윗면 법선 (각도 0 이면 정확히 위쪽)
        this.pendingLaunches.set(target, { x: Math.sin(a) * SPRING_SPEED, y: -Math.cos(a) * SPRING_SPEED });
      }
    }
  }

  step(): void {
    Engine.update(this.engine, STEP_MS);
    // 충돌 해소 단계가 속도를 덮어쓰지 않도록 발사는 업데이트가 끝난 뒤 적용한다
    for (const [body, velocity] of this.pendingLaunches) Body.setVelocity(body, velocity);
    this.pendingLaunches.clear();
    this.stepCount++;
  }

  stepTimes(n: number): void {
    for (let i = 0; i < n; i++) this.step();
  }

  bodiesOf(id: string): Matter.Body[] {
    return this.partBodies.get(id) ?? [];
  }

  allBodies(): Matter.Body[] {
    return Composite.allBodies(this.engine.world);
  }

  /** 부품별 메인 바디 상태 (배치 순서 유지) */
  snapshot(): BodyState[] {
    return this.order.map((id) => {
      const main = this.bodiesOf(id).find((b) => partTag(b)?.role === 'main')!;
      return { id, x: main.position.x, y: main.position.y, angle: main.angle };
    });
  }
}
