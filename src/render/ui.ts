import type Matter from 'matter-js';
import { FIELD, TOP_BAR_HEIGHT, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { PART_DEFS, type PartType, type Vec } from '../parts/defs';
import { createPart } from '../parts/factory';
import { COLORS, drawBodies } from './renderer';

/**
 * 최소 터치 크기(월드 단위). 폴드 커버 화면 배율(약 0.76)에서 약 44 CSS px 로,
 * 모바일 접근성 권장 최소 터치 영역을 만족한다.
 */
export const MIN_TOUCH_TARGET = 58;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ButtonId =
  | 'menu'
  | 'run'
  | 'rotateLeft'
  | 'rotateRight'
  | 'delete'
  | 'clear'
  | 'winRetry'
  | 'winNext'
  | 'winMenu';

export type UiElement = { kind: 'slot'; type: PartType; rect: Rect } | { kind: 'button'; id: ButtonId; rect: Rect };
export type MenuElement = { kind: 'level'; index: number; rect: Rect } | { kind: 'sandbox'; rect: Rect };

// 메뉴: 타이틀 아래 레벨 목록, 맨 아래 샌드박스. 레벨이 늘면 행 간격을 줄여 한 화면에 담는다.
const MENU_LIST_TOP = 230;
const MENU_LIST_BOTTOM = 940;
const MENU_ROW_MAX_PITCH = 96;
const MENU_ROW_GAP = 14;
const MENU_BUTTON = { x: 60, w: WORLD_WIDTH - 120 };
const SANDBOX_RECT: Rect = { x: MENU_BUTTON.x, y: 960, w: MENU_BUTTON.w, h: 76 };

export function buildMenuLayout(levelCount: number): MenuElement[] {
  const elements: MenuElement[] = [];
  if (levelCount > 0) {
    const pitch = Math.min(MENU_ROW_MAX_PITCH, (MENU_LIST_BOTTOM - MENU_LIST_TOP) / levelCount);
    for (let i = 0; i < levelCount; i++) {
      elements.push({
        kind: 'level',
        index: i,
        rect: { x: MENU_BUTTON.x, y: MENU_LIST_TOP + i * pitch, w: MENU_BUTTON.w, h: pitch - MENU_ROW_GAP },
      });
    }
  }
  elements.push({ kind: 'sandbox', rect: SANDBOX_RECT });
  return elements;
}

// 클리어 오버레이: 필드 상단 패널. 실행 결과(연쇄 반응)를 가리지 않도록 위쪽에 작게 띄운다.
const WIN_PANEL: Rect = { x: (WORLD_WIDTH - 360) / 2, y: FIELD.y + 30, w: 360, h: 200 };

export function buildWinLayout(hasNext: boolean): UiElement[] {
  const w = 160;
  const h = 64;
  const gap = 16;
  const x0 = WIN_PANEL.x + (WIN_PANEL.w - (w * 2 + gap)) / 2;
  const y = WIN_PANEL.y + WIN_PANEL.h - h - 18;
  return [
    { kind: 'button', id: 'winRetry', rect: { x: x0, y, w, h } },
    { kind: 'button', id: hasNext ? 'winNext' : 'winMenu', rect: { x: x0 + w + gap, y, w, h } },
  ];
}

const MARGIN = 8;
const SLOT_GAP = 6;
const SLOT_MAX_WIDTH = 96;
const TRAY_TOP = FIELD.y + FIELD.height;
const SLOT_ROW = { y: TRAY_TOP + 8, h: 76 };
const BUTTON_ROW = { y: TRAY_TOP + 92, h: 64 };

export function buildLayout(slotTypes: readonly PartType[]): UiElement[] {
  const elements: UiElement[] = [
    { kind: 'button', id: 'menu', rect: { x: MARGIN, y: 7, w: 58, h: 58 } },
    { kind: 'button', id: 'run', rect: { x: WORLD_WIDTH - MARGIN - 150, y: 7, w: 150, h: 58 } },
  ];

  // 슬롯은 가운데 정렬. 종류가 많아지면 폭을 줄여 한 줄에 담는다.
  const n = slotTypes.length;
  if (n > 0) {
    const avail = WORLD_WIDTH - MARGIN * 2;
    const w = Math.min(SLOT_MAX_WIDTH, (avail - SLOT_GAP * (n - 1)) / n);
    const total = w * n + SLOT_GAP * (n - 1);
    const startX = (WORLD_WIDTH - total) / 2;
    slotTypes.forEach((type, i) => {
      elements.push({ kind: 'slot', type, rect: { x: startX + i * (w + SLOT_GAP), y: SLOT_ROW.y, w, h: SLOT_ROW.h } });
    });
  }

  const buttons: ButtonId[] = ['rotateLeft', 'rotateRight', 'delete', 'clear'];
  const bw = (WORLD_WIDTH - MARGIN * 2 - MARGIN * (buttons.length - 1)) / buttons.length;
  buttons.forEach((id, i) => {
    elements.push({ kind: 'button', id, rect: { x: MARGIN + i * (bw + MARGIN), y: BUTTON_ROW.y, w: bw, h: BUTTON_ROW.h } });
  });
  return elements;
}

/** 반열린 구간 [x, x+w) — 이웃 요소가 맞닿아도 한 점이 두 요소에 동시에 속하지 않는다 */
export function hitTestUi<T extends { rect: Rect }>(layout: readonly T[], p: Vec): T | null {
  for (const e of layout) {
    const r = e.rect;
    if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return e;
  }
  return null;
}

export interface UiState {
  title: string;
  running: boolean;
  remaining: (type: PartType) => number;
  hasSelection: boolean;
  canRotateSelection: boolean;
  hasPlaced: boolean;
}

const BUTTON_LABELS: Record<Exclude<ButtonId, 'run'>, string> = {
  menu: '☰',
  rotateLeft: '⟲ 회전',
  rotateRight: '⟳ 회전',
  delete: '삭제',
  clear: '비우기',
  winRetry: '↺ 다시',
  winNext: '다음 ▶',
  winMenu: '☰ 메뉴',
};

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(r.x + radius, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, radius);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, radius);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, radius);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, radius);
  ctx.closePath();
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  options: { enabled?: boolean; primary?: boolean; fontSize?: number } = {},
): void {
  const { enabled = true, primary = false, fontSize = 22 } = options;
  roundRect(ctx, rect, 12);
  ctx.fillStyle = primary ? COLORS.gold : '#262c3a';
  ctx.globalAlpha = enabled ? 1 : 0.35;
  ctx.fill();
  ctx.fillStyle = primary ? '#1b1f2a' : COLORS.text;
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.globalAlpha = 1;
}

// 트레이 아이콘용 바디는 타입별로 한 번만 만든다 (매 프레임 생성 방지)
const iconBodies = new Map<PartType, Matter.Body[]>();
function iconFor(type: PartType): Matter.Body[] {
  let bodies = iconBodies.get(type);
  if (!bodies) {
    bodies = createPart({ id: `icon-${type}`, type, x: 0, y: 0, angle: 0 }).bodies;
    iconBodies.set(type, bodies);
  }
  return bodies;
}

function drawSlot(ctx: CanvasRenderingContext2D, type: PartType, rect: Rect, remaining: number, enabled: boolean): void {
  roundRect(ctx, rect, 12);
  ctx.fillStyle = '#212735';
  ctx.fill();
  ctx.globalAlpha = enabled && remaining > 0 ? 1 : 0.35;

  const def = PART_DEFS[type];
  const iconArea = { w: rect.w - 14, h: rect.h - 30 };
  const scale = Math.min(1, iconArea.w / def.width, iconArea.h / def.height);
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + 6 + iconArea.h / 2);
  ctx.scale(scale, scale);
  drawBodies(ctx, iconFor(type));
  ctx.restore();

  ctx.globalAlpha = enabled && remaining > 0 ? 1 : 0.35;
  ctx.fillStyle = COLORS.text;
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const count = remaining === Infinity ? '∞' : `×${remaining}`;
  ctx.fillText(`${def.label} ${count}`, rect.x + rect.w / 2, rect.y + rect.h - 7);
  ctx.globalAlpha = 1;
}

export function drawUi(ctx: CanvasRenderingContext2D, layout: readonly UiElement[], state: UiState): void {
  // 상단 바
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WORLD_WIDTH, TOP_BAR_HEIGHT);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.title, (MARGIN + 58 + (WORLD_WIDTH - MARGIN - 150)) / 2, TOP_BAR_HEIGHT / 2);

  // 하단 트레이
  ctx.fillStyle = '#161a23';
  ctx.fillRect(0, TRAY_TOP, WORLD_WIDTH, WORLD_HEIGHT - TRAY_TOP);

  const editable = !state.running;
  for (const e of layout) {
    if (e.kind === 'slot') {
      drawSlot(ctx, e.type, e.rect, state.remaining(e.type), editable);
      continue;
    }
    switch (e.id) {
      case 'run':
        drawButton(ctx, e.rect, state.running ? '■ 리셋' : '▶ 실행', { primary: !state.running });
        break;
      case 'menu':
        drawButton(ctx, e.rect, BUTTON_LABELS.menu, { fontSize: 28 });
        break;
      case 'rotateLeft':
      case 'rotateRight':
        drawButton(ctx, e.rect, BUTTON_LABELS[e.id], { enabled: editable && state.canRotateSelection, fontSize: 20 });
        break;
      case 'delete':
        drawButton(ctx, e.rect, BUTTON_LABELS.delete, { enabled: editable && state.hasSelection, fontSize: 20 });
        break;
      case 'clear':
        drawButton(ctx, e.rect, BUTTON_LABELS.clear, { enabled: editable && state.hasPlaced, fontSize: 20 });
        break;
      default:
        break;
    }
  }
}

/** 편집 모드에서 필드 상단에 레벨 힌트를 한 줄로 보여 준다 */
export function drawHint(ctx: CanvasRenderingContext2D, hint: string): void {
  if (!hint) return;
  ctx.fillStyle = 'rgba(17,20,28,0.7)';
  ctx.fillRect(0, FIELD.y, WORLD_WIDTH, 36);
  ctx.fillStyle = COLORS.subtext;
  ctx.font = '17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(hint, WORLD_WIDTH / 2, FIELD.y + 18, WORLD_WIDTH - 24);
}

export function drawWinOverlay(ctx: CanvasRenderingContext2D, layout: readonly UiElement[], seconds: number): void {
  roundRect(ctx, WIN_PANEL, 18);
  ctx.fillStyle = 'rgba(17,20,28,0.92)';
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('성공!', WORLD_WIDTH / 2, WIN_PANEL.y + 44);
  ctx.fillStyle = COLORS.text;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(`${seconds.toFixed(1)}초 만에 작동`, WORLD_WIDTH / 2, WIN_PANEL.y + 88);
  for (const e of layout) {
    if (e.kind !== 'button' || e.id === 'run') continue;
    drawButton(ctx, e.rect, BUTTON_LABELS[e.id], { primary: e.id === 'winNext', fontSize: 21 });
  }
}

export interface MenuLevelState {
  name: string;
  cleared: boolean;
  unlocked: boolean;
}

export function drawMenu(
  ctx: CanvasRenderingContext2D,
  layout: readonly MenuElement[],
  title: string,
  levels: readonly MenuLevelState[],
): void {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText(title, WORLD_WIDTH / 2, 120);
  ctx.fillStyle = COLORS.subtext;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('부품을 놓아 연쇄 반응을 완성하세요', WORLD_WIDTH / 2, 175);

  for (const e of layout) {
    if (e.kind === 'sandbox') {
      drawButton(ctx, e.rect, '🛠 샌드박스', { fontSize: 24 });
      continue;
    }
    const level = levels[e.index];
    if (!level) continue;
    const mark = level.cleared ? ' ✓' : level.unlocked ? '' : ' 🔒';
    drawButton(ctx, e.rect, `${e.index + 1}. ${level.name}${mark}`, {
      enabled: level.unlocked,
      primary: level.unlocked && !level.cleared,
      fontSize: 24,
    });
  }
}
