// 고해상도 기기에서 캔버스 픽셀 수가 과도해지면 프레임이 떨어지므로 dpr 상한을 둔다.
// 폴드 커버 화면(dpr ≈ 2.6)은 상한 안에 들어온다.
export const MAX_DPR = 3;

export interface ScreenSize {
  /** CSS 픽셀 */
  width: number;
  /** CSS 픽셀 */
  height: number;
  dpr: number;
}

export interface Viewport {
  dpr: number;
  /** 캔버스 백버퍼 크기 (기기 픽셀) */
  pixelWidth: number;
  pixelHeight: number;
  /** 월드 좌표 → CSS 픽셀 배율 */
  scale: number;
  /** 월드 원점의 CSS 픽셀 위치 (레터박스 여백) */
  offsetX: number;
  offsetY: number;
}

function normalizeDpr(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(dpr, MAX_DPR);
}

/** 월드 비율을 유지한 채 화면에 꽉 차게 맞추고(contain), 남는 공간은 양쪽에 균등 분배한다. */
export function computeViewport(screen: ScreenSize, worldWidth: number, worldHeight: number): Viewport {
  if (!(Number.isFinite(worldWidth) && worldWidth > 0 && Number.isFinite(worldHeight) && worldHeight > 0)) {
    throw new RangeError(`world size must be positive finite: ${worldWidth}x${worldHeight}`);
  }
  const { width, height } = screen;
  if (!(Number.isFinite(width) && width >= 0 && Number.isFinite(height) && height >= 0)) {
    throw new RangeError(`screen size must be non-negative finite: ${width}x${height}`);
  }

  const dpr = normalizeDpr(screen.dpr);
  const scale = Math.min(width / worldWidth, height / worldHeight);
  return {
    dpr,
    pixelWidth: Math.round(width * dpr),
    pixelHeight: Math.round(height * dpr),
    scale,
    offsetX: (width - worldWidth * scale) / 2,
    offsetY: (height - worldHeight * scale) / 2,
  };
}

/** CSS 픽셀 좌표 → 논리 월드 좌표. 화면 크기가 0이면 역변환할 수 없으므로 null. */
export function screenToWorld(viewport: Viewport, cssX: number, cssY: number): { x: number; y: number } | null {
  if (!(viewport.scale > 0)) return null;
  return { x: (cssX - viewport.offsetX) / viewport.scale, y: (cssY - viewport.offsetY) / viewport.scale };
}
