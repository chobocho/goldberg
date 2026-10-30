import { PART_DEFS, type PartSpec, type Vec } from '../parts/defs';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// 이 값 이하의 침투는 "맞닿음"으로 보고 겹침에서 제외한다. 도미노를 빈틈없이 나란히 세울 수 있게 하기 위함.
export const OVERLAP_EPSILON = 0.01;

/** 부품 외곽선을 회전·평행이동한 필드 좌표 다각형 */
export function worldOutline(spec: PartSpec): Vec[] {
  return transform(spec, PART_DEFS[spec.type].outline);
}

function transform(spec: PartSpec, local: readonly Vec[]): Vec[] {
  const c = Math.cos(spec.angle);
  const s = Math.sin(spec.angle);
  return local.map((p) => ({ x: spec.x + p.x * c - p.y * s, y: spec.y + p.x * s + p.y * c }));
}

/** 배치 판정용 볼록 조각들 (조각 정의가 없으면 외곽선 하나) */
export function worldPieces(spec: PartSpec): Vec[][] {
  const def = PART_DEFS[spec.type];
  return (def.pieces ?? [def.outline]).map((piece) => transform(spec, piece));
}

export function piecesBounds(pieces: readonly (readonly Vec[])[]): Bounds {
  return polygonBounds(pieces.flat());
}

export function polygonBounds(poly: readonly Vec[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function project(poly: readonly Vec[], ax: number, ay: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * ax + p.y * ay;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** a 의 모든 변 법선 축에서 b 와 분리되는지 검사 */
function hasSeparatingAxis(a: readonly Vec[], b: readonly Vec[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = a[(i + 1) % a.length];
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const len = Math.hypot(ex, ey);
    if (len === 0) continue;
    // 단위 법선을 써야 침투 깊이를 OVERLAP_EPSILON 과 같은 단위(px)로 비교할 수 있다
    const ax = -ey / len;
    const ay = ex / len;
    const [minA, maxA] = project(a, ax, ay);
    const [minB, maxB] = project(b, ax, ay);
    if (Math.min(maxA, maxB) - Math.max(minA, minB) <= OVERLAP_EPSILON) return true;
  }
  return false;
}

/**
 * 볼록 다각형 겹침 판정 (분리축 정리, SAT).
 * O((n+m)^2) time — 부품 외곽선은 최대 16각형이라 충분히 작다. O(1) extra space.
 */
export function polygonsOverlap(a: readonly Vec[], b: readonly Vec[]): boolean {
  return !hasSeparatingAxis(a, b) && !hasSeparatingAxis(b, a);
}

/** 짝수-홀수 규칙 광선 투사. 경계 위의 점은 어느 쪽이든 될 수 있다. */
export function pointInPolygon(p: Vec, poly: readonly Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 내부면 0, 외부면 가장 가까운 변까지의 거리 */
export function distanceToPolygon(p: Vec, poly: readonly Vec[]): number {
  if (pointInPolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  }
  return best;
}
