import type { LevelData } from './schema';

// 자유 모드: 목표 없이 부품을 무제한으로 배치한다.
// 슬롯 폭이 최소 터치 크기 아래로 줄지 않도록 8종만 제공한다 (바구니는 목표 전용이라 제외).
export const SANDBOX: LevelData = {
  id: 'sandbox',
  name: '샌드박스',
  hint: '부품을 마음껏 놓고 나만의 장치를 만들어 보세요.',
  fixed: [],
  inventory: {
    ball: Infinity,
    heavyBall: Infinity,
    plank: Infinity,
    domino: Infinity,
    seesaw: Infinity,
    spring: Infinity,
    wall: Infinity,
    bell: Infinity,
  },
};
