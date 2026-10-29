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
  domino: {
    label: '도미노',
    width: 12,
    height: 56,
    outline: rectOutline(12, 56),
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
