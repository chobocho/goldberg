import { describe, expect, it } from 'vitest';
import { MAX_DPR, computeViewport, screenToWorld } from '../src/render/viewport';

const W = 540;
const H = 1080;

describe('computeViewport', () => {
  // 정상 케이스
  it('화면과 월드가 같으면 배율 1, 여백 0', () => {
    const v = computeViewport({ width: W, height: H, dpr: 1 }, W, H);
    expect(v.scale).toBe(1);
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBe(0);
    expect(v.pixelWidth).toBe(W);
    expect(v.pixelHeight).toBe(H);
  });

  it('폴드 커버 세로(412x960, dpr 2.625)는 폭 기준으로 맞추고 위아래 여백을 균등 분배한다', () => {
    const v = computeViewport({ width: 412, height: 960, dpr: 2.625 }, W, H);
    expect(v.scale).toBeCloseTo(412 / W, 10);
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBeCloseTo((960 - H * (412 / W)) / 2, 10);
    expect(v.pixelWidth).toBe(Math.round(412 * 2.625));
    expect(v.pixelHeight).toBe(Math.round(960 * 2.625));
  });

  it('가로 화면은 높이 기준으로 맞추고 좌우 여백을 균등 분배한다', () => {
    const v = computeViewport({ width: 960, height: 412, dpr: 1 }, W, H);
    expect(v.scale).toBeCloseTo(412 / H, 10);
    expect(v.offsetY).toBe(0);
    expect(v.offsetX).toBeCloseTo((960 - W * (412 / H)) / 2, 10);
  });

  // 엣지 케이스
  it(`dpr은 성능을 위해 ${MAX_DPR}로 상한을 둔다`, () => {
    const v = computeViewport({ width: 100, height: 200, dpr: 4 }, W, H);
    expect(v.dpr).toBe(MAX_DPR);
    expect(v.pixelWidth).toBe(100 * MAX_DPR);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('비정상 dpr(%s)은 1로 취급한다', (dpr) => {
    const v = computeViewport({ width: 100, height: 200, dpr }, W, H);
    expect(v.dpr).toBe(1);
    expect(v.pixelWidth).toBe(100);
  });

  it('화면 크기 0(최소화 등)은 배율 0, 픽셀 0으로 NaN 없이 처리한다', () => {
    const v = computeViewport({ width: 0, height: 0, dpr: 2 }, W, H);
    expect(v.scale).toBe(0);
    expect(v.pixelWidth).toBe(0);
    expect(v.pixelHeight).toBe(0);
    expect(Number.isNaN(v.offsetX) || Number.isNaN(v.offsetY)).toBe(false);
  });

  it('소수 CSS 크기도 정수 픽셀 크기로 반올림한다', () => {
    const v = computeViewport({ width: 411.43, height: 914.29, dpr: 2.625 }, W, H);
    expect(Number.isInteger(v.pixelWidth)).toBe(true);
    expect(Number.isInteger(v.pixelHeight)).toBe(true);
  });

  it.each([
    [-1, 100],
    [100, -1],
    [Number.NaN, 100],
    [100, Number.POSITIVE_INFINITY],
  ])('음수/비유한 화면 크기(%s, %s)는 RangeError', (width, height) => {
    expect(() => computeViewport({ width, height, dpr: 1 }, W, H)).toThrow(RangeError);
  });

  it.each([
    [0, H],
    [W, 0],
    [-W, H],
    [Number.NaN, H],
  ])('0 이하/비유한 월드 크기(%s, %s)는 RangeError', (ww, wh) => {
    expect(() => computeViewport({ width: 100, height: 100, dpr: 1 }, ww, wh)).toThrow(RangeError);
  });
});

describe('screenToWorld', () => {
  it('레터박스 여백과 배율을 역변환한다', () => {
    const v = computeViewport({ width: 412, height: 960, dpr: 2.625 }, W, H);
    const world = screenToWorld(v, v.offsetX + 270 * v.scale, v.offsetY + 540 * v.scale)!;
    expect(world.x).toBeCloseTo(270, 9);
    expect(world.y).toBeCloseTo(540, 9);
  });

  it('여백 영역은 월드 밖 좌표(음수 등)로 그대로 변환한다', () => {
    const v = computeViewport({ width: 412, height: 960, dpr: 1 }, W, H);
    expect(screenToWorld(v, 0, 0)!.y).toBeLessThan(0);
  });

  it('배율 0(화면 크기 0)이면 null', () => {
    const v = computeViewport({ width: 0, height: 0, dpr: 1 }, W, H);
    expect(screenToWorld(v, 10, 10)).toBeNull();
  });
});
