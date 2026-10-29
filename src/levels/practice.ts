import type { Inventory } from '../editor/editor';
import type { PartSpec } from '../parts/defs';

// 편집기 동작 확인용 임시 연습 배치. 레벨 시스템 도입 시 대체한다.
export const PRACTICE: { fixed: PartSpec[]; inventory: Inventory } = {
  fixed: [
    { id: 'ball', type: 'ball', x: 80, y: 80, angle: 0 },
    { id: 'basket', type: 'basket', x: 440, y: 801, angle: 0 },
  ],
  inventory: { plank: 3, domino: 5, seesaw: 1, spring: 1, wall: 2, heavyBall: 1 },
};
