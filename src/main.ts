import { FIELD, GAME_TITLE, TOP_BAR_HEIGHT, WORLD_HEIGHT, WORLD_WIDTH } from './config';
import { STEP_MS, Simulation, advanceFixedSteps } from './core/simulation';
import type { PartSpec } from './parts/defs';
import { COLORS, drawBodies, drawFieldBackground } from './render/renderer';
import { computeViewport, type Viewport } from './render/viewport';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const ctx = canvas?.getContext('2d');
if (!canvas || !ctx) {
  throw new Error('Canvas 2D context is not available');
}

// 임시 데모 장면: 물리 부품이 연쇄로 동작하는지 눈으로 확인하기 위한 배치. 편집기 작업에서 교체한다.
const DEMO: PartSpec[] = [
  { id: 'b1', type: 'ball', x: 60, y: 120, angle: 0 },
  { id: 'p1', type: 'plank', x: 120, y: 220, angle: 0.35 },
  { id: 'p2', type: 'plank', x: 330, y: 360, angle: -0.3 },
  { id: 'heavy', type: 'heavyBall', x: 470, y: 120, angle: 0 },
  { id: 'p3', type: 'plank', x: 420, y: 200, angle: -0.35 },
  { id: 's1', type: 'seesaw', x: 270, y: 650, angle: 0 },
  { id: 'b2', type: 'ball', x: 360, y: 620, angle: 0 },
  { id: 'd1', type: 'domino', x: 60, y: 812, angle: 0 },
  { id: 'd2', type: 'domino', x: 100, y: 812, angle: 0 },
  { id: 'sp', type: 'spring', x: 470, y: 820, angle: -0.3 },
  { id: 'basket', type: 'basket', x: 470, y: 470, angle: 0 },
  { id: 'bell', type: 'bell', x: 40, y: 500, angle: 0 },
];

let viewport: Viewport = computeViewport({ width: 0, height: 0, dpr: 1 }, WORLD_WIDTH, WORLD_HEIGHT);
let sim = new Simulation(DEMO);
let accumulator = 0;
let lastTime = performance.now();

function resize(): void {
  viewport = computeViewport(
    { width: canvas!.clientWidth, height: canvas!.clientHeight, dpr: window.devicePixelRatio },
    WORLD_WIDTH,
    WORLD_HEIGHT,
  );
  canvas!.width = viewport.pixelWidth;
  canvas!.height = viewport.pixelHeight;
}

function draw(): void {
  const { dpr, scale, offsetX, offsetY } = viewport;
  ctx!.setTransform(1, 0, 0, 1, 0, 0);
  ctx!.fillStyle = COLORS.background;
  ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

  const s = dpr * scale;
  ctx!.setTransform(s, 0, 0, s, dpr * offsetX, dpr * offsetY);
  ctx!.fillStyle = COLORS.gold;
  ctx!.textAlign = 'center';
  ctx!.textBaseline = 'middle';
  ctx!.font = 'bold 28px system-ui, sans-serif';
  ctx!.fillText(GAME_TITLE, WORLD_WIDTH / 2, TOP_BAR_HEIGHT / 2);

  ctx!.save();
  ctx!.translate(FIELD.x, FIELD.y);
  drawFieldBackground(ctx!);
  drawBodies(ctx!, sim.allBodies());
  ctx!.restore();

  ctx!.fillStyle = COLORS.subtext;
  ctx!.font = '20px system-ui, sans-serif';
  ctx!.fillText('화면을 탭하면 다시 시작', WORLD_WIDTH / 2, FIELD.y + FIELD.height + 60);
}

function frame(now: number): void {
  const result = advanceFixedSteps(accumulator, now - lastTime, STEP_MS, 5);
  lastTime = now;
  accumulator = result.accumulatorMs;
  for (let i = 0; i < result.steps; i++) sim.step();
  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', () => {
  sim = new Simulation(DEMO);
});

// 폴드 기기는 접고 펼칠 때 크기가 바뀌므로 resize 와 visualViewport 변화를 모두 추적한다
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
