import { describe, expect, it } from 'vitest';
import {
  distanceToPolygon,
  pointInPolygon,
  polygonBounds,
  polygonsOverlap,
  worldOutline,
} from '../src/editor/geometry';
import type { Vec } from '../src/parts/defs';

const square = (cx: number, cy: number, half: number): Vec[] => [
  { x: cx - half, y: cy - half },
  { x: cx + half, y: cy - half },
  { x: cx + half, y: cy + half },
  { x: cx - half, y: cy + half },
];

const diamond = (cx: number, cy: number, r: number): Vec[] => [
  { x: cx, y: cy - r },
  { x: cx + r, y: cy },
  { x: cx, y: cy + r },
  { x: cx - r, y: cy },
];

describe('worldOutline', () => {
  it('각도 0 이면 로컬 외곽선을 평행이동만 한다', () => {
    const b = polygonBounds(worldOutline({ id: 'p', type: 'plank', x: 100, y: 50, angle: 0 }));
    expect(b).toEqual({ minX: 20, maxX: 180, minY: 43, maxY: 57 });
  });

  it('90도 회전하면 가로/세로 범위가 바뀐다', () => {
    const b = polygonBounds(worldOutline({ id: 'p', type: 'plank', x: 100, y: 100, angle: Math.PI / 2 }));
    expect(b.minX).toBeCloseTo(93, 6);
    expect(b.maxX).toBeCloseTo(107, 6);
    expect(b.minY).toBeCloseTo(20, 6);
    expect(b.maxY).toBeCloseTo(180, 6);
  });
});

describe('polygonsOverlap (SAT)', () => {
  it('겹치는 사각형은 true', () => {
    expect(polygonsOverlap(square(0, 0, 10), square(15, 0, 10))).toBe(true);
  });

  it('떨어진 사각형은 false', () => {
    expect(polygonsOverlap(square(0, 0, 10), square(30, 0, 10))).toBe(false);
  });

  it('변이 맞닿기만 하면 겹침이 아니다 (나란히 붙여 놓기 허용)', () => {
    expect(polygonsOverlap(square(0, 0, 10), square(20, 0, 10))).toBe(false);
  });

  it('한쪽이 다른 쪽을 완전히 포함하면 true', () => {
    expect(polygonsOverlap(square(0, 0, 50), square(5, 5, 5))).toBe(true);
  });

  it('바운딩 박스는 겹치지만 실제로는 떨어진 회전 도형은 false', () => {
    // 마름모의 꼭짓점 사이 빈 공간에 작은 사각형이 있는 경우: 대각선 축에서 분리된다
    expect(polygonsOverlap(diamond(0, 0, 20), square(16, 16, 5))).toBe(false);
  });
});

describe('pointInPolygon / distanceToPolygon', () => {
  const sq = square(0, 0, 10);

  it('내부 점은 true, 외부 점은 false', () => {
    expect(pointInPolygon({ x: 1, y: 2 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 11, y: 0 }, sq)).toBe(false);
  });

  it('내부 점까지 거리는 0', () => {
    expect(distanceToPolygon({ x: 0, y: 0 }, sq)).toBe(0);
  });

  it('외부 점은 가장 가까운 변까지 거리', () => {
    expect(distanceToPolygon({ x: 15, y: 0 }, sq)).toBeCloseTo(5, 9);
    expect(distanceToPolygon({ x: 13, y: 14 }, sq)).toBeCloseTo(5, 9);
  });
});
