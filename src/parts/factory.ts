import Matter from 'matter-js';
import {
  BASKET_HEIGHT,
  BASKET_WALL,
  BASKET_WIDTH,
  PART_DEFS,
  ROPE_LENGTH,
  ROPE_SEGMENTS,
  SEESAW_BASE_HEIGHT,
  SEESAW_BASE_WIDTH,
  SEESAW_LENGTH,
  SEESAW_THICKNESS,
  type PartSpec,
  type PartType,
} from './defs';

const { Bodies, Constraint, Vector } = Matter;

export type PartRole = 'main' | 'base' | 'wall' | 'sensor' | 'anchor' | 'segment';

/** body.plugin.part 에 저장되는 태그. 렌더러·목표 판정이 바디에서 부품을 역추적할 때 쓴다. */
export interface PartTag {
  id: string;
  type: PartType;
  role: PartRole;
}

export interface PartBodies {
  bodies: Matter.Body[];
  constraints: Matter.Constraint[];
}

// 공은 판자 위를 잘 굴러가도록 마찰을 낮추고, 쇠공은 밀도를 높여 시소·도미노를 확실히 움직이게 한다
const BALL_OPTIONS = { restitution: 0.4, friction: 0.02, frictionAir: 0.001, density: 0.001 };
const HEAVY_BALL_OPTIONS = { restitution: 0.1, friction: 0.05, frictionAir: 0.001, density: 0.008 };
const STATIC_OPTIONS = { isStatic: true, friction: 0.1, restitution: 0.1 };
// 풍선은 공기저항을 크게 줘서 부력으로 천천히 떠오르게 한다
const BALLOON_OPTIONS = { density: 0.0004, frictionAir: 0.03, restitution: 0.3, friction: 0.05 };
// 로프 마디는 무엇과도 충돌하지 않는 질점이다. 줄의 모양만 만들고 물리적 간섭은 추가 담당한다.
const NO_COLLISION = { group: 0, category: 0x0001, mask: 0 };
/** 로프 연결 제약 식별용 라벨 (렌더러와 가위가 찾는다) */
export const ROPE_LABEL = 'rope';

// 같은 시소의 판과 받침은 서로 충돌하지 않아야 축 주변에서 걸리지 않는다.
// matter-js 는 같은 음수 group 끼리 충돌을 생략하므로 시소마다 고유한 음수 그룹을 발급한다.
let nextSeesawGroup = -1;

function tagged(body: Matter.Body, spec: PartSpec, role: PartRole): Matter.Body {
  const tag: PartTag = { id: spec.id, type: spec.type, role };
  body.plugin = { ...body.plugin, part: tag };
  return body;
}

function validate(spec: PartSpec): void {
  if (!Object.prototype.hasOwnProperty.call(PART_DEFS, spec.type)) {
    throw new Error(`Unknown part type: ${String(spec.type)}`);
  }
  if (typeof spec.id !== 'string' || spec.id.length === 0) {
    throw new Error('Part id must be a non-empty string');
  }
  for (const key of ['x', 'y', 'angle'] as const) {
    if (!Number.isFinite(spec[key])) {
      throw new RangeError(`Part ${spec.id}: ${key} must be finite (got ${spec[key]})`);
    }
  }
}

export function createPart(spec: PartSpec): PartBodies {
  validate(spec);
  const { x, y, angle } = spec;
  const def = PART_DEFS[spec.type];

  switch (spec.type) {
    case 'ball':
      return { bodies: [tagged(Bodies.circle(x, y, def.radius!, BALL_OPTIONS), spec, 'main')], constraints: [] };

    case 'heavyBall':
      return { bodies: [tagged(Bodies.circle(x, y, def.radius!, HEAVY_BALL_OPTIONS), spec, 'main')], constraints: [] };

    case 'domino':
      return {
        bodies: [
          // 마찰이 크거나 모서리가 각지면 앞 도미노가 뒤 도미노에 기댄 채 멈춰 연쇄가 끊긴다
          tagged(
            Bodies.rectangle(x, y, def.width, def.height, { angle, density: 0.002, friction: 0.1, chamfer: { radius: 3 } }),
            spec,
            'main',
          ),
        ],
        constraints: [],
      };

    case 'balloon':
      return { bodies: [tagged(Bodies.circle(x, y, def.radius!, BALLOON_OPTIONS), spec, 'main')], constraints: [] };

    case 'rope': {
      const anchor = tagged(Bodies.circle(x, y, 6, { ...STATIC_OPTIONS, collisionFilter: NO_COLLISION }), spec, 'anchor');
      const gap = ROPE_LENGTH / (ROPE_SEGMENTS + 1);
      const segments = Array.from({ length: ROPE_SEGMENTS }, (_, i) =>
        tagged(
          Bodies.circle(x, y + gap * (i + 1), 3, { density: 0.002, frictionAir: 0.02, collisionFilter: NO_COLLISION }),
          spec,
          'segment',
        ),
      );
      const bob = tagged(Bodies.circle(x, y + ROPE_LENGTH, def.radius!, HEAVY_BALL_OPTIONS), spec, 'main');
      const chain = [anchor, ...segments, bob];
      const constraints = chain.slice(1).map((body, i) =>
        Constraint.create({ bodyA: chain[i], bodyB: body, length: gap, stiffness: 1, damping: 0.05, label: ROPE_LABEL }),
      );
      return { bodies: [anchor, ...segments, bob], constraints };
    }

    case 'plank':
    case 'spring':
    case 'wall':
    case 'conveyor':
    case 'fan':
    case 'scissors':
      return {
        bodies: [tagged(Bodies.rectangle(x, y, def.width, def.height, { ...STATIC_OPTIONS, angle }), spec, 'main')],
        constraints: [],
      };

    case 'bell':
      return { bodies: [tagged(Bodies.circle(x, y, def.radius!, STATIC_OPTIONS), spec, 'main')], constraints: [] };

    case 'seesaw': {
      const group = nextSeesawGroup--;
      const board = tagged(
        Bodies.rectangle(x, y, SEESAW_LENGTH, SEESAW_THICKNESS, {
          angle,
          density: 0.002,
          friction: 0.4,
          collisionFilter: { group },
        }),
        spec,
        'main',
      );
      // fromVertices 는 무게중심을 기준 위치로 삼으므로, 꼭짓점이 축(x, y)에 오도록 삼각형 무게중심(높이의 2/3)만큼 내린다
      const base = tagged(
        Bodies.fromVertices(
          x,
          y + (SEESAW_BASE_HEIGHT * 2) / 3,
          [
            [
              { x: 0, y: 0 },
              { x: SEESAW_BASE_WIDTH / 2, y: SEESAW_BASE_HEIGHT },
              { x: -SEESAW_BASE_WIDTH / 2, y: SEESAW_BASE_HEIGHT },
            ],
          ],
          { ...STATIC_OPTIONS, collisionFilter: { group } },
        ),
        spec,
        'base',
      );
      const pivot = Constraint.create({
        pointA: { x, y },
        bodyB: board,
        pointB: { x: 0, y: 0 },
        length: 0,
        stiffness: 1,
      });
      return { bodies: [board, base], constraints: [pivot] };
    }

    case 'basket': {
      const hw = BASKET_WIDTH / 2;
      const hh = BASKET_HEIGHT / 2;
      const bottom = tagged(
        Bodies.rectangle(x, y + hh - BASKET_WALL / 2, BASKET_WIDTH, BASKET_WALL, STATIC_OPTIONS),
        spec,
        'main',
      );
      const left = tagged(
        Bodies.rectangle(x - hw + BASKET_WALL / 2, y, BASKET_WALL, BASKET_HEIGHT, STATIC_OPTIONS),
        spec,
        'wall',
      );
      const right = tagged(
        Bodies.rectangle(x + hw - BASKET_WALL / 2, y, BASKET_WALL, BASKET_HEIGHT, STATIC_OPTIONS),
        spec,
        'wall',
      );
      // 센서는 바구니 안쪽 아래 절반. 공이 테두리를 스치기만 해서는 들어간 것으로 치지 않기 위함이다.
      const innerW = BASKET_WIDTH - BASKET_WALL * 2;
      const sensorH = BASKET_HEIGHT / 2;
      const sensor = tagged(
        Bodies.rectangle(x, y + hh - BASKET_WALL - sensorH / 2, innerW, sensorH, { isStatic: true, isSensor: true }),
        spec,
        'sensor',
      );
      return { bodies: [bottom, left, right, sensor], constraints: [] };
    }
  }
}

export interface Line {
  a: Matter.Vector;
  b: Matter.Vector;
}

function worldPoint(body: Matter.Body | null, point: Matter.Vector): Matter.Vector {
  return body ? Vector.add(body.position, Vector.rotate(point, body.angle)) : point;
}

export function constraintEnds(c: Matter.Constraint): Line {
  return { a: worldPoint(c.bodyA, c.pointA), b: worldPoint(c.bodyB, c.pointB) };
}

/** 로프 연결만 골라 선분으로 바꾼다 (시소 축 같은 다른 제약은 그리지 않는다) */
export function ropeLinesOf(constraints: readonly Matter.Constraint[]): Line[] {
  return constraints.filter((c) => c.label === ROPE_LABEL).map(constraintEnds);
}

export function partTag(body: Matter.Body): PartTag | undefined {
  return (body.parent ?? body).plugin?.part as PartTag | undefined;
}
