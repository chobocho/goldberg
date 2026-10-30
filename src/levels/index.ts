import type { PartSpec } from '../parts/defs';
import type { LevelData } from './schema';

const deg = (d: number) => (d * Math.PI) / 180;
const part = (id: string, type: PartSpec['type'], x: number, y: number, angleDeg = 0): PartSpec => ({
  id,
  type,
  x,
  y,
  angle: deg(angleDeg),
});

// 레벨 설계 원칙:
// - 아무것도 놓지 않으면 클리어되지 않는다 (tests/levels.test.ts 에서 검증)
// - 인벤토리에 공을 줄 때는 목표물을 지붕으로 막아, 공을 목표 위에 떨어뜨리는 꼼수를 막는다
// - 검증된 정답 배치는 tests/fixtures/solutions.ts 에 둔다
export const LEVELS: LevelData[] = [
  {
    id: 'first-ramp',
    name: '첫 경사로',
    hint: '판자를 기울여 공을 바구니까지 굴려 보내세요.',
    fixed: [part('ball', 'ball', 90, 60), part('goal', 'basket', 450, 801)],
    inventory: { plank: 2 },
  },
  {
    id: 'domino-relay',
    name: '도미노 릴레이',
    hint: '공은 종 아래로 지나가 버려요. 도미노로 종까지 이어 주세요.',
    fixed: [part('ball', 'ball', 60, 540), part('ramp', 'plank', 110, 740, 15), part('bell', 'bell', 420, 773)],
    inventory: { domino: 8 },
  },
  {
    id: 'seesaw-launch',
    name: '시소 발사',
    hint: '종은 지붕에 가려져 있어요. 쇠공으로 시소를 눌러 아래에서 쳐 올리세요.',
    fixed: [part('heavy', 'heavyBall', 110, 60), part('roof', 'plank', 400, 340), part('bell', 'bell', 400, 369)],
    inventory: { seesaw: 1, ball: 1 },
  },
  {
    id: 'spring-jump',
    name: '스프링 점프',
    hint: '공은 스스로 출발점보다 높이 오를 수 없어요.',
    fixed: [part('ball', 'ball', 80, 480), part('bell', 'bell', 440, 300)],
    inventory: { spring: 1, plank: 1 },
  },
  {
    id: 'goldberg-finale',
    name: '골드버그 머신',
    hint: '종을 울린 공을 왼쪽 바구니까지 데려가세요.',
    fixed: [
      part('ball', 'ball', 60, 380),
      part('ramp', 'plank', 110, 470, 30),
      part('roof', 'plank', 380, 271),
      part('bell', 'bell', 380, 300),
      part('pillar', 'wall', 60, 770),
      part('goal', 'basket', 60, 661),
    ],
    inventory: { spring: 1, plank: 2 },
  },
];
