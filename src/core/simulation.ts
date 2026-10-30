import Matter from 'matter-js';
import { FIELD } from '../config';
import { PART_DEFS, type PartSpec } from '../parts/defs';
import { createPart, partTag } from '../parts/factory';

const { Bodies, Body, Bounds, Composite, Engine, Events } = Matter;

// 결정성을 위해 시뮬레이션은 항상 고정 간격으로만 진행한다 (렌더 프레임 간격과 분리)
export const STEP_MS = 1000 / 60;
/** 스프링 패드가 닿은 물체에 주는 속도 (px / 기준 스텝) */
export const SPRING_SPEED = 18;
/** 컨베이어 벨트 표면 속도 (px / 기준 스텝) */
export const CONVEYOR_SPEED = 4;
/** 선풍기 바람이 닿는 거리와 반폭 (px, 선풍기 로컬 좌표) */
export const FAN_RANGE = 240;
export const FAN_HALF_WIDTH = 36;
// 송풍구 바로 앞의 바람 힘. 질량과 무관한 상수라 가벼운 공(중력 약 0.0008)은 크게, 쇠공은 거의 밀리지 않는다.
const FAN_FORCE = 0.0015;

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
  readonly goalIds: string[] = [];
  readonly achievedGoals = new Set<string>();
  solvedAtStep: number | null = null;
  private readonly partBodies = new Map<string, Matter.Body[]>();
  private readonly order: string[] = [];
  private pendingLaunches = new Map<Matter.Body, Matter.Vector>();
  // 목표 판정용: 바구니 센서와 공 바디 목록 (생성 후 바뀌지 않으므로 미리 모아 둔다)
  private readonly basketSensors: { id: string; body: Matter.Body }[] = [];
  private readonly balls: Matter.Body[] = [];
  private readonly fans: Matter.Body[] = [];
  /** 바람·벨트의 영향을 받는 움직이는 바디 */
  private readonly movers: Matter.Body[] = [];
  private pendingBelts = new Map<Matter.Body, number>();

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
      this.indexGoalBodies(spec, bodies);
    }

    Events.on(this.engine, 'collisionStart', (event) => {
      this.collectSpringLaunches(event.pairs);
      this.collectBeltContacts(event.pairs);
      this.detectBellHits(event.pairs);
    });
    // 벨트 위에 계속 머무는 물체는 collisionStart 가 다시 오지 않으므로 active 에서도 모은다
    Events.on(this.engine, 'collisionActive', (event) => this.collectBeltContacts(event.pairs));
  }

  private indexGoalBodies(spec: PartSpec, bodies: Matter.Body[]): void {
    if (spec.type === 'fan') this.fans.push(bodies[0]);
    for (const body of bodies) if (!body.isStatic && !body.isSensor) this.movers.push(body);
    if (spec.type === 'basket' || spec.type === 'bell') this.goalIds.push(spec.id);
    if (spec.type === 'ball' || spec.type === 'heavyBall') this.balls.push(bodies[0]);
    if (spec.type === 'basket') {
      const sensor = bodies.find((b) => partTag(b)?.role === 'sensor');
      if (sensor) this.basketSensors.push({ id: spec.id, body: sensor });
    }
  }

  private collectBeltContacts(pairs: Matter.Pair[]): void {
    for (const pair of pairs) {
      for (const [belt, other] of [
        [pair.bodyA, pair.bodyB],
        [pair.bodyB, pair.bodyA],
      ]) {
        if (partTag(belt)?.type !== 'conveyor') continue;
        const target = other.parent ?? other;
        if (!target.isStatic && !target.isSensor) this.pendingBelts.set(target, belt.angle);
      }
    }
  }

  /**
   * 선풍기 앞 직사각형 범위 안의 물체에 바람 힘을 준다. 가까울수록 세다(선형 감쇠).
   * 벽에 가려지는 효과는 단순화를 위해 계산하지 않는다.
   * O(선풍기 수 × 움직이는 바디 수) per step.
   */
  private applyWind(): void {
    for (const fan of this.fans) {
      const c = Math.cos(fan.angle);
      const s = Math.sin(fan.angle);
      const nozzle = PART_DEFS.fan.width / 2;
      for (const body of this.movers) {
        const dx = body.position.x - fan.position.x;
        const dy = body.position.y - fan.position.y;
        // 선풍기 로컬 좌표로 변환 (로컬 +x 가 바람 방향)
        const lx = dx * c + dy * s;
        const ly = -dx * s + dy * c;
        if (lx < nozzle || lx > nozzle + FAN_RANGE || Math.abs(ly) > FAN_HALF_WIDTH) continue;
        const strength = FAN_FORCE * (1 - (lx - nozzle) / FAN_RANGE);
        Body.applyForce(body, body.position, { x: c * strength, y: s * strength });
      }
    }
  }

  /** 벨트 방향 속도 성분만 벨트 속도로 맞추고 수직 성분(낙하·튐)은 그대로 둔다 */
  private applyBelts(): void {
    for (const [body, angle] of this.pendingBelts) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const along = body.velocity.x * dx + body.velocity.y * dy;
      const delta = CONVEYOR_SPEED - along;
      Body.setVelocity(body, { x: body.velocity.x + delta * dx, y: body.velocity.y + delta * dy });
    }
    this.pendingBelts.clear();
  }

  private achieve(id: string): void {
    this.achievedGoals.add(id);
  }

  private detectBellHits(pairs: Matter.Pair[]): void {
    for (const pair of pairs) {
      for (const [bell, other] of [
        [pair.bodyA, pair.bodyB],
        [pair.bodyB, pair.bodyA],
      ]) {
        const tag = partTag(bell);
        if (tag?.type !== 'bell') continue;
        const target = other.parent ?? other;
        if (!target.isStatic && !target.isSensor) this.achieve(tag.id);
      }
    }
  }

  // 공의 중심이 센서 영역 안에 들어와야 인정한다. 테두리를 스치는 것만으로는 달성되지 않는다.
  // O(바구니 수 × 공 수) per step — 레벨당 둘 다 한 자릿수라 충분히 싸다.
  private detectBasketEntries(): void {
    for (const { id, body } of this.basketSensors) {
      if (this.achievedGoals.has(id)) continue;
      if (this.balls.some((ball) => Bounds.contains(body.bounds, ball.position))) this.achieve(id);
    }
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
    // 힘은 업데이트 직후 matter-js 가 초기화하므로 매 스텝 업데이트 전에 다시 건다
    this.applyWind();
    Engine.update(this.engine, STEP_MS);
    this.applyBelts();
    // 충돌 해소 단계가 속도를 덮어쓰지 않도록 발사는 업데이트가 끝난 뒤 적용한다
    for (const [body, velocity] of this.pendingLaunches) Body.setVelocity(body, velocity);
    this.pendingLaunches.clear();
    this.stepCount++;
    this.detectBasketEntries();
    if (this.solvedAtStep === null && this.allGoalsAchieved()) this.solvedAtStep = this.stepCount;
  }

  private allGoalsAchieved(): boolean {
    return this.goalIds.length > 0 && this.goalIds.every((id) => this.achievedGoals.has(id));
  }

  stepTimes(n: number): void {
    for (let i = 0; i < n; i++) this.step();
  }

  /** 목표가 하나 이상 있고 모두 달성했는지. 목표가 없는 샌드박스는 항상 false. */
  isSolved(): boolean {
    return this.solvedAtStep !== null;
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
