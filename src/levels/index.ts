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
  // 6~8: 후순위 부품 레벨. 저장된 진행 기록이 깨지지 않도록 기존 레벨 뒤에 덧붙인다.
  {
    id: 'wind-and-belt',
    name: '바람과 벨트',
    hint: '컨베이어로 공을 나르고, 바람으로 기둥 위 바구니까지 띄워 보내세요.',
    fixed: [part('ball', 'ball', 60, 60), part('pillar', 'wall', 470, 770), part('goal', 'basket', 470, 661)],
    inventory: { conveyor: 1, fan: 1 },
  },
  {
    id: 'cut-the-rope',
    name: '끊어진 줄',
    hint: '굴러오는 공이 가위를 치게 하세요. 줄이 끊기면 추가 떨어져요.',
    fixed: [
      part('trigger', 'ball', 480, 40),
      part('ramp', 'plank', 420, 130, -30),
      part('shelf', 'plank', 240, 210),
      part('rope', 'rope', 110, 40),
      part('roof', 'plank', 340, 571),
      part('bell', 'bell', 340, 600),
    ],
    inventory: { scissors: 1, seesaw: 1, ball: 1 },
  },
  {
    id: 'pulley-lift',
    name: '도르래 엘리베이터',
    hint: '쇠공을 도르래 왼쪽 받침에 떨어뜨리면 오른쪽 공이 올라가요.',
    fixed: [
      part('heavy', 'heavyBall', 60, 60),
      part('lift', 'pulley', 300, 400),
      part('ball', 'ball', 360, 497),
      part('roof', 'plank', 360, 353),
      part('bell', 'bell', 360, 383),
    ],
    inventory: { plank: 2 },
  },
  {
    // 풍선이 곧장 떠오르면 위의 가위에 닿아 터진다. 판자 아랫면을 타고 미끄러지게 해서 종으로 보낸다.
    id: 'balloon-flight',
    name: '풍선 비행',
    hint: '풍선은 위로 떠올라요. 판자를 뒤집힌 경사로처럼 써서 가위를 피하세요.',
    fixed: [part('balloon', 'balloon', 80, 780), part('scissors', 'scissors', 80, 120), part('bell', 'bell', 280, 200)],
    inventory: { plank: 2 },
  },
];
