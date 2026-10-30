import type { PartSpec } from '../../src/parts/defs';

const deg = (d: number) => (d * Math.PI) / 180;
const part = (id: string, type: PartSpec['type'], x: number, y: number, angleDeg = 0): PartSpec => ({
  id,
  type,
  x,
  y,
  angle: deg(angleDeg),
});

// 레벨별 검증된 정답 배치 (플레이어 부품만). 시뮬레이션 탐색으로 찾은 값이며 레벨 수정 시 함께 갱신해야 한다.
export const SOLUTIONS: Record<string, PartSpec[]> = {
  'first-ramp': [part('p1', 'plank', 120, 280, 30)],
  'domino-relay': [210, 240, 270, 300, 330, 360, 390].map((x, i) => part(`d${i}`, 'domino', x, 810)),
  'seesaw-launch': [part('s', 'seesaw', 190, 600), part('b', 'ball', 290, 570)],
  'spring-jump': [part('sp', 'spring', 80, 780, 15)],
  'goldberg-finale': [part('sp', 'spring', 200, 590, 15), part('p1', 'plank', 380, 480, -30)],
};
