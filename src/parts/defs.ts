export interface Vec {
  x: number;
  y: number;
}

export const PART_TYPES = [
  'ball',
  'heavyBall',
  'plank',
  'domino',
  'seesaw',
  'spring',
  'wall',
  'basket',
  'bell',
  'conveyor',
  'fan',
  'balloon',
  'rope',
  'scissors',
  'pulley',
] as const;

export type PartType = (typeof PART_TYPES)[number];

/** 레벨/편집기/시뮬레이션이 공유하는 부품 배치 정보. 좌표는 필드 로컬 좌표(px). */
export interface PartSpec {
  id: string;
  type: PartType;
  x: number;
  y: number;
  /** 라디안 */
  angle: number;
}

export interface PartDef {
  label: string;
  /** 바운딩 크기 (각도 0 기준) */
  width: number;
  height: number;
  /** 원형 부품의 반지름 */
  radius?: number;
  /** 배치 판정용 로컬 볼록 외곽선 (각도 0 기준, 중심 원점) */
  outline: Vec[];
  rotatable: boolean;
  /** 실행 중 움직이는 부품인지 (편집기 표시·센서 판정용) */
  dynamic: boolean;
}

function rectOutline(w: number, h: number): Vec[] {
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
}

// 원은 16각형으로 근사한다. 배치 겹침 판정에서는 이 정도 오차로 충분하다.
function circleOutline(r: number, segments = 16): Vec[] {
  const points: Vec[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return points;
}

// 시소 치수: 판(가로 SEESAW_LENGTH)이 받침 꼭짓점을 축으로 회전한다
export const SEESAW_LENGTH = 220;
export const SEESAW_THICKNESS = 14;
export const SEESAW_BASE_WIDTH = 50;
export const SEESAW_BASE_HEIGHT = 40;

// 로프 치수: 고정점(spec 위치)에서 추 중심까지의 길이와 중간 마디 수
export const ROPE_LENGTH = 120;
export const ROPE_SEGMENTS = 6;
const ROPE_BOB_RADIUS = 14;

// 도르래 치수: 바퀴(spec 위치) 좌우 PULLEY_SPAN, 아래 PULLEY_DROP 에 받침이 매달린다.
// 받침은 바퀴에 닿기 전까지 PULLEY_TRAVEL 만큼만 오르내린다.
export const PULLEY_SPAN = 60;
export const PULLEY_DROP = 120;
export const PULLEY_TRAVEL = 90;
export const PULLEY_WHEEL_RADIUS = 16;
export const PULLEY_PLATFORM = { width: 80, height: 12 };

// 바구니 치수: 바깥 크기와 벽 두께. 내부 센서는 벽 안쪽 아랫부분을 차지한다.
export const BASKET_WIDTH = 96;
export const BASKET_HEIGHT = 78;
export const BASKET_WALL = 8;

export const PART_DEFS: Record<PartType, PartDef> = {
  ball: {
    label: '공',
    width: 32,
    height: 32,
    radius: 16,
    outline: circleOutline(16),
    rotatable: false,
    dynamic: true,
  },
  heavyBall: {
    label: '쇠공',
    width: 44,
    height: 44,
    radius: 22,
    outline: circleOutline(22),
    rotatable: false,
    dynamic: true,
  },
  plank: {
    label: '판자',
    width: 160,
    height: 14,
    outline: rectOutline(160, 14),
    rotatable: true,
    dynamic: false,
  },
  // 치수는 matter-js 에서 연쇄 전도가 안정적으로 이어지는 값을 실험으로 찾은 것 (간격 24~36px)
  domino: {
    label: '도미노',
    width: 10,
    height: 60,
    outline: rectOutline(10, 60),
    rotatable: false,
    dynamic: true,
  },
  seesaw: {
    label: '시소',
    width: SEESAW_LENGTH,
    height: SEESAW_THICKNESS / 2 + SEESAW_BASE_HEIGHT,
    // 판 + 받침 삼각형의 볼록 껍질
    outline: [
      { x: -SEESAW_LENGTH / 2, y: -SEESAW_THICKNESS / 2 },
      { x: SEESAW_LENGTH / 2, y: -SEESAW_THICKNESS / 2 },
      { x: SEESAW_LENGTH / 2, y: SEESAW_THICKNESS / 2 },
      { x: SEESAW_BASE_WIDTH / 2, y: SEESAW_BASE_HEIGHT },
      { x: -SEESAW_BASE_WIDTH / 2, y: SEESAW_BASE_HEIGHT },
      { x: -SEESAW_LENGTH / 2, y: SEESAW_THICKNESS / 2 },
    ],
    rotatable: false,
    dynamic: true,
  },
  spring: {
    label: '스프링',
    width: 64,
    height: 16,
    outline: rectOutline(64, 16),
    rotatable: true,
    dynamic: false,
  },
  wall: {
    label: '벽',
    width: 20,
    height: 140,
    outline: rectOutline(20, 140),
    rotatable: true,
    dynamic: false,
  },
  basket: {
    label: '바구니',
    width: BASKET_WIDTH,
    height: BASKET_HEIGHT,
    outline: rectOutline(BASKET_WIDTH, BASKET_HEIGHT),
    rotatable: false,
    dynamic: false,
  },
  conveyor: {
    label: '컨베이어',
    width: 160,
    height: 16,
    outline: rectOutline(160, 16),
    rotatable: true,
    dynamic: false,
  },
  fan: {
    label: '선풍기',
    width: 44,
    height: 44,
    outline: rectOutline(44, 44),
    rotatable: true,
    dynamic: false,
  },
  balloon: {
    label: '풍선',
    width: 40,
    height: 40,
    radius: 20,
    outline: circleOutline(20),
    rotatable: false,
    dynamic: true,
  },
  // 고정점이 spec 위치, 추가 그 아래 ROPE_LENGTH 에 매달린다. 외곽선은 고정점~추 전체를 덮는다.
  rope: {
    label: '로프',
    width: 32,
    height: ROPE_LENGTH + ROPE_BOB_RADIUS + 6,
    radius: ROPE_BOB_RADIUS,
    outline: rectOutline(32, 0).map((p, i) => ({ x: p.x, y: i < 2 ? -6 : ROPE_LENGTH + ROPE_BOB_RADIUS })),
    rotatable: false,
    dynamic: true,
  },
  scissors: {
    label: '가위',
    width: 56,
    height: 24,
    outline: rectOutline(56, 24),
    rotatable: true,
    dynamic: false,
  },
  // 외곽선은 바퀴와 양쪽 받침의 초기 위치를 덮는다 (실행 중 받침이 오르내리는 범위는 포함하지 않음)
  pulley: {
    label: '도르래',
    width: PULLEY_SPAN * 2 + PULLEY_PLATFORM.width,
    height: PULLEY_DROP + PULLEY_WHEEL_RADIUS + PULLEY_PLATFORM.height / 2,
    radius: PULLEY_WHEEL_RADIUS,
    outline: [
      { x: -(PULLEY_SPAN + PULLEY_PLATFORM.width / 2), y: -PULLEY_WHEEL_RADIUS },
      { x: PULLEY_SPAN + PULLEY_PLATFORM.width / 2, y: -PULLEY_WHEEL_RADIUS },
      { x: PULLEY_SPAN + PULLEY_PLATFORM.width / 2, y: PULLEY_DROP + PULLEY_PLATFORM.height / 2 },
      { x: -(PULLEY_SPAN + PULLEY_PLATFORM.width / 2), y: PULLEY_DROP + PULLEY_PLATFORM.height / 2 },
    ],
    rotatable: false,
    dynamic: true,
  },
  bell: {
    label: '종',
    width: 44,
    height: 44,
    radius: 22,
    outline: circleOutline(22),
    rotatable: false,
    dynamic: false,
  },
};
