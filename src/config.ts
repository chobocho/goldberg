// 논리 화면 크기. 폴드 커버 화면(세로 약 9:21)에 맞춘 세로 우선 1:2 비율로 고정하고,
// 다른 비율의 화면은 viewport 에서 레터박스로 처리한다.
export const WORLD_WIDTH = 540;
export const WORLD_HEIGHT = 1080;

// 화면 분할: 상단 바(레벨명·실행 버튼) / 물리 필드 / 하단 트레이(부품 인벤토리).
// 엄지가 닿기 쉬운 하단에 조작부를 몰아 한 손 조작을 우선한다.
export const TOP_BAR_HEIGHT = 72;
export const TRAY_HEIGHT = 168;
export const FIELD = {
  x: 0,
  y: TOP_BAR_HEIGHT,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT - TOP_BAR_HEIGHT - TRAY_HEIGHT,
} as const;

export const GAME_TITLE = '골드버그 머신';
