import type Matter from 'matter-js';
import { FIELD, GAME_TITLE, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { STEP_MS } from '../core/simulation';
import { Editor } from '../editor/editor';
import { LEVELS } from '../levels';
import { SANDBOX } from '../levels/sandbox';
import type { LevelData } from '../levels/schema';
import { PART_DEFS, type PartSpec, type PartType, type Vec } from '../parts/defs';
import { createPart } from '../parts/factory';
import { COLORS, drawBodies, drawFieldBackground } from '../render/renderer';
import {
  buildLayout,
  buildMenuLayout,
  buildWinLayout,
  drawHint,
  drawMenu,
  drawUi,
  drawWinOverlay,
  hitTestUi,
  pageCount,
  type ButtonId,
  type UiElement,
} from '../render/ui';
import { computeViewport, screenToWorld, type Viewport } from '../render/viewport';
import { browserStorage, isUnlocked, loadProgress, saveProgress } from './progress';
import { GameSession } from './session';

// 터치로 새 부품을 끌 때 손가락에 가려지지 않도록 부품을 손가락 위쪽에 띄우는 거리(월드 단위)
const TOUCH_LIFT = 60;

interface Play {
  level: LevelData;
  /** LEVELS 안의 순번. 샌드박스는 null */
  index: number | null;
  session: GameSession;
  slotTypes: PartType[];
  /** 트레이 페이지 (부품 종류가 많을 때만 의미가 있다) */
  page: number;
  layout: UiElement[];
  winLayout: UiElement[];
}

/** 캔버스·입력·렌더 루프와 화면 전환(메뉴 ↔ 플레이)을 묶는 최상위 컨트롤러. 게임 규칙은 Editor/GameSession 에 위임한다. */
export class App {
  private readonly ctx: CanvasRenderingContext2D;
  private viewport: Viewport = computeViewport({ width: 0, height: 0, dpr: 1 }, WORLD_WIDTH, WORLD_HEIGHT);
  private readonly menuLayout = buildMenuLayout(LEVELS.length);
  private readonly levelIds = LEVELS.map((l) => l.id);
  private readonly storage = browserStorage();
  private readonly cleared = loadProgress(this.storage);
  /** null 이면 메뉴 화면 */
  private play: Play | null = null;
  private activePointer: number | null = null;
  private lastTime: number | null = null;
  // 편집 모드 미리보기용 바디 캐시. 키는 부품 상태 문자열이라 위치/각도가 바뀐 부품만 다시 만든다.
  private previewCache = new Map<string, Matter.Body[]>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    this.ctx = ctx;
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

  // ---- 화면 전환 ----

  private openLevel(level: LevelData, index: number | null): void {
    const types = Object.keys(level.inventory) as PartType[];
    this.play = {
      level,
      index,
      session: new GameSession(new Editor(level.fixed, level.inventory)),
      slotTypes: types,
      page: 0,
      layout: buildLayout(types, 0),
      winLayout: buildWinLayout(index !== null && index + 1 < LEVELS.length),
    };
    this.previewCache.clear();
  }

  private openMenu(): void {
    this.play = null;
    this.previewCache.clear();
  }

  private recordWin(play: Play): void {
    if (play.index === null || play.session.result !== 'won' || this.cleared.has(play.level.id)) return;
    this.cleared.add(play.level.id);
    saveProgress(this.storage, this.cleared);
  }

  private frame(now: number): void {
    const dt = this.lastTime === null ? 0 : now - this.lastTime;
    this.lastTime = now;
    if (this.play) {
      this.play.session.update(dt);
      this.recordWin(this.play);
    }
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

    const play = this.play;
    if (!play) {
      this.onMenuTap(p);
      return;
    }
    if (this.showsWinOverlay(play)) {
      const hit = hitTestUi(play.winLayout, p);
      if (hit?.kind === 'button') {
        this.onButton(hit.id);
        return;
      }
    }
    const hit = hitTestUi(play.layout, p);
    if (hit?.kind === 'button') {
      this.onButton(hit.id);
      return;
    }
    if (play.session.mode !== 'edit') return;
    const editor = play.session.editor;
    if (hit?.kind === 'slot') {
      const lift = e.pointerType === 'mouse' ? 0 : -TOUCH_LIFT;
      editor.beginNew(hit.type, this.toField(p), { x: 0, y: lift });
    } else if (p.y >= FIELD.y && p.y < FIELD.y + FIELD.height) {
      editor.beginMove(this.toField(p));
    }
  }

  private onMenuTap(p: Vec): void {
    const hit = hitTestUi(this.menuLayout, p);
    if (hit?.kind === 'sandbox') this.openLevel(SANDBOX, null);
    else if (hit?.kind === 'level' && isUnlocked(this.levelIds, this.cleared, hit.index)) {
      this.openLevel(LEVELS[hit.index], hit.index);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer || !this.play) return;
    const p = this.toWorld(e);
    const editor = this.play.session.editor;
    if (p && editor.drag) editor.dragTo(this.toField(p));
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    if (!this.play) return;
    const p = this.toWorld(e);
    const editor = this.play.session.editor;
    if (!editor.drag) return;
    if (p) editor.dragTo(this.toField(p));
    editor.endDrag(p !== null && p.y >= FIELD.y + FIELD.height);
  }

  private onPointerCancel(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.play?.session.editor.cancelDrag();
  }

  private onButton(id: ButtonId): void {
    const play = this.play;
    if (!play) return;
    const { session } = play;
    const editor = session.editor;
    switch (id) {
      case 'menu':
      case 'winMenu':
        this.openMenu();
        return;
      case 'winNext':
        if (play.index !== null && play.index + 1 < LEVELS.length) this.openLevel(LEVELS[play.index + 1], play.index + 1);
        return;
      case 'winRetry':
        session.reset();
        return;
      case 'run':
        if (session.mode === 'edit') session.run();
        else session.reset();
        return;
      case 'pagePrev':
      case 'pageNext': {
        if (session.mode !== 'edit') return;
        // 양 끝에서 반대쪽으로 넘어가도록 순환시킨다 (버튼이 비활성화되는 상태를 없앤다)
        const count = pageCount(play.slotTypes.length);
        play.page = (play.page + (id === 'pageNext' ? 1 : -1) + count) % count;
        play.layout = buildLayout(play.slotTypes, play.page);
        return;
      }
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
    }
  }

  /** 샌드박스는 목표가 있어도 클리어 개념이 없으므로 오버레이를 띄우지 않는다 */
  private showsWinOverlay(play: Play): boolean {
    return play.index !== null && play.session.result === 'won';
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

    if (!this.play) {
      drawMenu(
        ctx,
        this.menuLayout,
        GAME_TITLE,
        LEVELS.map((level, i) => ({
          name: level.name,
          cleared: this.cleared.has(level.id),
          unlocked: isUnlocked(this.levelIds, this.cleared, i),
        })),
      );
      return;
    }
    this.drawPlay(this.play);
  }

  private drawPlay(play: Play): void {
    const { ctx } = this;
    const { session, level } = play;
    const editor = session.editor;

    ctx.save();
    ctx.translate(FIELD.x, FIELD.y);
    drawFieldBackground(ctx);
    if (session.simulation) {
      drawBodies(ctx, session.simulation.allBodies(), { achievedIds: session.simulation.achievedGoals });
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

    if (session.mode === 'edit') drawHint(ctx, level.hint);
    if (this.showsWinOverlay(play)) {
      drawWinOverlay(ctx, play.winLayout, ((session.simulation?.solvedAtStep ?? 0) * STEP_MS) / 1000);
    }

    const selected = editor.selected();
    drawUi(ctx, play.layout, {
      title: play.index === null ? level.name : `${play.index + 1}. ${level.name}`,
      running: session.mode === 'run',
      remaining: (type) => editor.remaining(type),
      hasSelection: selected !== null,
      canRotateSelection: selected !== null && PART_DEFS[selected.type].rotatable,
      hasPlaced: editor.placed.length > 0,
    });
  }
}
