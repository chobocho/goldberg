import type Matter from 'matter-js';
import { FIELD, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { Editor } from '../editor/editor';
import { PRACTICE } from '../levels/practice';
import { PART_DEFS, type PartSpec, type PartType, type Vec } from '../parts/defs';
import { createPart } from '../parts/factory';
import { COLORS, drawBodies, drawFieldBackground } from '../render/renderer';
import { buildLayout, drawUi, hitTestUi, type ButtonId, type UiElement } from '../render/ui';
import { computeViewport, screenToWorld, type Viewport } from '../render/viewport';
import { GameSession } from './session';

// 터치로 새 부품을 끌 때 손가락에 가려지지 않도록 부품을 손가락 위쪽에 띄우는 거리(월드 단위)
const TOUCH_LIFT = 60;

/** 캔버스·입력·렌더 루프를 묶는 최상위 컨트롤러. 게임 규칙은 Editor/GameSession 에 위임한다. */
export class App {
  private readonly ctx: CanvasRenderingContext2D;
  private viewport: Viewport = computeViewport({ width: 0, height: 0, dpr: 1 }, WORLD_WIDTH, WORLD_HEIGHT);
  private session: GameSession;
  private layout: UiElement[];
  private slotTypes: PartType[];
  private activePointer: number | null = null;
  private lastTime: number | null = null;
  // 편집 모드 미리보기용 바디 캐시. 키는 부품 상태 문자열이라 위치/각도가 바뀐 부품만 다시 만든다.
  private previewCache = new Map<string, Matter.Body[]>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    this.ctx = ctx;
    this.slotTypes = Object.keys(PRACTICE.inventory) as PartType[];
    this.layout = buildLayout(this.slotTypes);
    this.session = new GameSession(new Editor(PRACTICE.fixed, PRACTICE.inventory));
  }

  start(): void {
    const resize = () => this.resize();
    // 폴드 기기는 접고 펼칠 때 크기가 바뀌므로 resize 와 visualViewport 변화를 모두 추적한다
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
    this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }

  private resize(): void {
    this.viewport = computeViewport(
      { width: this.canvas.clientWidth, height: this.canvas.clientHeight, dpr: window.devicePixelRatio },
      WORLD_WIDTH,
      WORLD_HEIGHT,
    );
    this.canvas.width = this.viewport.pixelWidth;
    this.canvas.height = this.viewport.pixelHeight;
  }

  private frame(now: number): void {
    const dt = this.lastTime === null ? 0 : now - this.lastTime;
    this.lastTime = now;
    this.session.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- 입력 ----

  private toWorld(e: PointerEvent): Vec | null {
    const rect = this.canvas.getBoundingClientRect();
    return screenToWorld(this.viewport, e.clientX - rect.left, e.clientY - rect.top);
  }

  private toField(p: Vec): Vec {
    return { x: p.x - FIELD.x, y: p.y - FIELD.y };
  }

  private onPointerDown(e: PointerEvent): void {
    // 두 번째 손가락은 무시한다: 드래그 도중 다른 터치가 끼어들어 상태가 꼬이는 것을 막는다
    if (this.activePointer !== null) return;
    const p = this.toWorld(e);
    if (!p) return;
    e.preventDefault();
    this.activePointer = e.pointerId;
    this.canvas.setPointerCapture?.(e.pointerId);

    const hit = hitTestUi(this.layout, p);
    if (hit?.kind === 'button') {
      this.onButton(hit.id);
      return;
    }
    if (this.session.mode !== 'edit') return;
    const editor = this.session.editor;
    if (hit?.kind === 'slot') {
      const lift = e.pointerType === 'mouse' ? 0 : -TOUCH_LIFT;
      editor.beginNew(hit.type, this.toField(p), { x: 0, y: lift });
    } else if (p.y >= FIELD.y && p.y < FIELD.y + FIELD.height) {
      editor.beginMove(this.toField(p));
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return;
    const p = this.toWorld(e);
    if (p && this.session.editor.drag) this.session.editor.dragTo(this.toField(p));
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    const p = this.toWorld(e);
    const editor = this.session.editor;
    if (!editor.drag) return;
    if (p) editor.dragTo(this.toField(p));
    editor.endDrag(p !== null && p.y >= FIELD.y + FIELD.height);
  }

  private onPointerCancel(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.session.editor.cancelDrag();
  }

  private onButton(id: ButtonId): void {
    const { session } = this;
    const editor = session.editor;
    if (id === 'run') {
      if (session.mode === 'edit') session.run();
      else session.reset();
      return;
    }
    if (session.mode !== 'edit') return;
    switch (id) {
      case 'rotateLeft':
        editor.rotateSelected(-1);
        break;
      case 'rotateRight':
        editor.rotateSelected(1);
        break;
      case 'delete':
        editor.deleteSelected();
        break;
      case 'clear':
        editor.clearPlaced();
        break;
      case 'menu':
        // 메뉴 화면은 레벨 선택 작업에서 연결한다
        break;
    }
  }

  // ---- 렌더 ----

  private previewBodies(parts: readonly PartSpec[]): Matter.Body[] {
    const next = new Map<string, Matter.Body[]>();
    const bodies: Matter.Body[] = [];
    for (const spec of parts) {
      const key = `${spec.id}|${spec.type}|${spec.x}|${spec.y}|${spec.angle}`;
      const cached = this.previewCache.get(key) ?? createPart(spec).bodies;
      next.set(key, cached);
      bodies.push(...cached);
    }
    this.previewCache = next;
    return bodies;
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const { dpr, scale, offsetX, offsetY } = this.viewport;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = dpr * scale;
    ctx.setTransform(s, 0, 0, s, dpr * offsetX, dpr * offsetY);

    const { session } = this;
    const editor = session.editor;
    ctx.save();
    ctx.translate(FIELD.x, FIELD.y);
    drawFieldBackground(ctx);
    if (session.simulation) {
      drawBodies(ctx, session.simulation.allBodies());
    } else {
      const drag = editor.drag;
      drawBodies(ctx, this.previewBodies(editor.displayParts()), {
        selectedId: editor.selectedId,
        ghostIds: drag ? new Set([drag.spec.id]) : undefined,
        invalidIds: drag && !drag.valid ? new Set([drag.spec.id]) : undefined,
        playerIds: new Set(editor.placed.map((p) => p.id)),
      });
    }
    ctx.restore();

    const selected = editor.selected();
    drawUi(ctx, this.layout, {
      title: '연습장',
      running: session.mode === 'run',
      remaining: (type) => editor.remaining(type),
      hasSelection: selected !== null,
      canRotateSelection: selected !== null && PART_DEFS[selected.type].rotatable,
      hasPlaced: editor.placed.length > 0,
    });
  }
}
