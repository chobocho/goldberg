import { FIELD } from '../config';
import { PART_DEFS, type PartSpec, type Vec } from '../parts/defs';
import { OVERLAP_EPSILON, distanceToPolygon, piecesBounds, pointInPolygon, polygonsOverlap, worldPieces } from './geometry';

function piecesOverlap(a: readonly Vec[][], b: readonly Vec[][]): boolean {
  return a.some((pa) => b.some((pb) => polygonsOverlap(pa, pb)));
}

/** 배치 격자 (px). 손가락으로도 정렬이 쉽도록 너무 촘촘하지 않게 둔다. */
export const GRID = 10;
/** 회전 단위 15° — 24번이면 한 바퀴라 회전값이 항상 정확한 단계에 머문다 */
export const ROTATION_STEP = Math.PI / 12;
/** 얇은 부품(도미노·판자)도 손가락으로 잡을 수 있도록 외곽선 바깥으로 허용하는 거리 */
export const HIT_SLOP = 12;

export type PlacementResult =
  | { ok: true }
  | { ok: false; reason: 'out-of-bounds' }
  | { ok: false; reason: 'overlap'; otherId: string };

export function snap(v: number, grid: number): number {
  if (!(Number.isFinite(grid) && grid > 0)) throw new RangeError(`grid must be positive finite: ${grid}`);
  // + 0 으로 -0 을 0 으로 정규화한다
  return Math.round(v / grid) * grid + 0;
}

/** (-π, π] 범위로 정규화 */
export function normalizeAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r <= -Math.PI) r += Math.PI * 2;
  else if (r > Math.PI) r -= Math.PI * 2;
  return r;
}

export function rotated(spec: PartSpec, dir: 1 | -1): PartSpec | null {
  if (!PART_DEFS[spec.type].rotatable) return null;
  // 현재 각도를 단계 수로 환산한 뒤 다시 곱해 부동소수 오차가 누적되지 않게 한다
  const steps = Math.round(spec.angle / ROTATION_STEP) + dir;
  return { ...spec, angle: normalizeAngle(steps * ROTATION_STEP) };
}

export function checkPlacement(spec: PartSpec, others: readonly PartSpec[]): PlacementResult {
  const pieces = worldPieces(spec);
  const b = piecesBounds(pieces);
  if (
    b.minX < -OVERLAP_EPSILON ||
    b.minY < -OVERLAP_EPSILON ||
    b.maxX > FIELD.width + OVERLAP_EPSILON ||
    b.maxY > FIELD.height + OVERLAP_EPSILON
  ) {
    return { ok: false, reason: 'out-of-bounds' };
  }
  for (const other of others) {
    if (other.id === spec.id) continue;
    if (piecesOverlap(pieces, worldPieces(other))) return { ok: false, reason: 'overlap', otherId: other.id };
  }
  return { ok: true };
}

/** 필드 밖으로 나간 만큼 안쪽으로 밀어 넣는다. 바닥 아래로 끌면 바닥 위에 올려놓는 효과. */
export function clampIntoField(spec: PartSpec): PartSpec {
  const b = piecesBounds(worldPieces(spec));
  const dx = b.minX < 0 ? -b.minX : b.maxX > FIELD.width ? FIELD.width - b.maxX : 0;
  const dy = b.minY < 0 ? -b.minY : b.maxY > FIELD.height ? FIELD.height - b.maxY : 0;
  if (dx === 0 && dy === 0) return spec;
  return { ...spec, x: spec.x + dx, y: spec.y + dy };
}

/**
 * 1차: 손가락 아래에 실제로 있는 부품 중 맨 위(나중 것).
 * 2차: 없으면 HIT_SLOP 안에서 가장 가까운 부품. 여유 범위 때문에 바로 아래 부품을 놓치지 않도록 두 단계로 나눈다.
 */
export function hitTestParts(parts: readonly PartSpec[], p: Vec): string | null {
  const pieces = parts.map(worldPieces);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (pieces[i].some((piece) => pointInPolygon(p, piece))) return parts[i].id;
  }
  let bestId: string | null = null;
  let bestDist = HIT_SLOP;
  for (let i = parts.length - 1; i >= 0; i--) {
    const d = Math.min(...pieces[i].map((piece) => distanceToPolygon(p, piece)));
    if (d <= bestDist) {
      bestDist = d;
      bestId = parts[i].id;
    }
  }
  return bestId;
}
