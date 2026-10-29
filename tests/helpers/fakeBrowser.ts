import { WORLD_HEIGHT, WORLD_WIDTH } from '../../src/config';
import { computeViewport } from '../../src/render/viewport';

type Handler = (event: unknown) => void;

/** 2D 컨텍스트 대역: 모든 메서드는 no-op, fillText 문자열만 기록한다 */
function fakeContext(onText: (text: string) => void): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = {};
  const noop = () => undefined;
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'fillText') return (text: string) => onText(String(text));
      if (key === 'measureText') return (text: string) => ({ width: String(text).length * 10 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop: noop });
      return noop;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/**
 * 번들 스크립트가 쓰는 최소한의 브라우저 API 대역.
 * 핸들러/프레임 콜백에서 발생한 예외는 삼키지 않고 errors 에 모아 테스트가 검사한다.
 */
export class FakeBrowser {
  readonly errors: unknown[] = [];
  /** 마지막 프레임에 그려진 텍스트 */
  texts = new Set<string>();
  readonly storage = new Map<string, string>();
  private readonly canvasHandlers = new Map<string, Handler[]>();
  private readonly windowHandlers = new Map<string, Handler[]>();
  private rafQueue: ((t: number) => void)[] = [];
  private now = 1000;
  private readonly canvas: Record<string, unknown>;

  constructor(
    private width: number,
    private height: number,
    private readonly dpr: number,
  ) {
    const on = (map: Map<string, Handler[]>) => (type: string, handler: Handler) => {
      map.set(type, [...(map.get(type) ?? []), handler]);
    };
    this.canvas = {
      width: 0,
      height: 0,
      style: {},
      getContext: () => fakeContext((text) => this.texts.add(text)),
      addEventListener: on(this.canvasHandlers),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: this.width, height: this.height }),
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
    };
    Object.defineProperty(this.canvas, 'clientWidth', { get: () => this.width });
    Object.defineProperty(this.canvas, 'clientHeight', { get: () => this.height });
    this.windowOn = on(this.windowHandlers);
  }

  private readonly windowOn: (type: string, handler: Handler) => void;

  globals(): Record<string, unknown> {
    const storage = this.storage;
    const window: Record<string, unknown> = {
      devicePixelRatio: this.dpr,
      addEventListener: this.windowOn,
      visualViewport: { addEventListener: this.windowOn },
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, String(v)),
        removeItem: (k: string) => void storage.delete(k),
      },
    };
    const document = {
      getElementById: (id: string) => (id === 'game' ? this.canvas : null),
      addEventListener: this.windowOn,
    };
    Object.assign(window, {
      window,
      document,
      performance: { now: () => this.now },
      requestAnimationFrame: (cb: (t: number) => void) => this.rafQueue.push(cb),
      console,
      structuredClone,
    });
    return window;
  }

  private guard(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.errors.push(error);
    }
  }

  frames(n: number, msPerFrame = 1000 / 60): void {
    for (let i = 0; i < n; i++) {
      this.now += msPerFrame;
      const queue = this.rafQueue;
      this.rafQueue = [];
      this.texts = new Set();
      for (const cb of queue) this.guard(() => cb(this.now));
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const h of this.windowHandlers.get('resize') ?? []) this.guard(() => h({}));
  }

  /** 논리 월드 좌표를 현재 화면 크기 기준 CSS 좌표로 바꾼다 */
  toScreen(x: number, y: number): { clientX: number; clientY: number } {
    const v = computeViewport({ width: this.width, height: this.height, dpr: this.dpr }, WORLD_WIDTH, WORLD_HEIGHT);
    return { clientX: v.offsetX + x * v.scale, clientY: v.offsetY + y * v.scale };
  }

  pointer(type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', x: number, y: number, pointerId = 1): void {
    const event = {
      ...this.toScreen(x, y),
      pointerId,
      pointerType: 'touch',
      button: 0,
      preventDefault: () => undefined,
    };
    for (const h of this.canvasHandlers.get(type) ?? []) this.guard(() => h(event));
  }

  /** 월드 좌표 기준 탭 */
  tap(x: number, y: number): void {
    this.pointer('pointerdown', x, y);
    this.pointer('pointerup', x, y);
  }

  /** 월드 좌표 기준 드래그 (중간 이동 이벤트 포함) */
  drag(from: { x: number; y: number }, to: { x: number; y: number }, steps = 5): void {
    this.pointer('pointerdown', from.x, from.y);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.pointer('pointermove', from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    }
    this.pointer('pointerup', to.x, to.y);
  }
}
