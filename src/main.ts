import { GAME_TITLE, WORLD_HEIGHT, WORLD_WIDTH } from './config';
import { computeViewport, type Viewport } from './render/viewport';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const ctx = canvas?.getContext('2d');
if (!canvas || !ctx) {
  throw new Error('Canvas 2D context is not available');
}

let viewport: Viewport = computeViewport({ width: 0, height: 0, dpr: 1 }, WORLD_WIDTH, WORLD_HEIGHT);

function resize(): void {
  viewport = computeViewport(
    { width: canvas!.clientWidth, height: canvas!.clientHeight, dpr: window.devicePixelRatio },
    WORLD_WIDTH,
    WORLD_HEIGHT,
  );
  canvas!.width = viewport.pixelWidth;
  canvas!.height = viewport.pixelHeight;
  draw();
}

// 임시 화면: 월드 영역과 제목만 그린다. 실제 게임 루프는 이후 작업에서 추가한다.
function draw(): void {
  const { dpr, scale, offsetX, offsetY } = viewport;
  ctx!.setTransform(1, 0, 0, 1, 0, 0);
  ctx!.fillStyle = '#11141c';
  ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

  ctx!.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  ctx!.fillStyle = '#1b1f2a';
  ctx!.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx!.fillStyle = '#f2c14e';
  ctx!.textAlign = 'center';
  ctx!.font = 'bold 44px system-ui, sans-serif';
  ctx!.fillText(GAME_TITLE, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20);
  ctx!.fillStyle = '#8a93a8';
  ctx!.font = '22px system-ui, sans-serif';
  ctx!.fillText('준비 중…', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 30);
}

// 폴드 기기는 접고 펼칠 때 크기가 바뀌므로 resize 와 visualViewport 변화를 모두 추적한다
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();
