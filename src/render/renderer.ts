import type Matter from 'matter-js';
import { FIELD } from '../config';
import { FAN_HALF_WIDTH, FAN_RANGE } from '../core/simulation';
import type { PartType } from '../parts/defs';
import { partTag, type PartRole } from '../parts/factory';

export const COLORS = {
  background: '#11141c',
  field: '#1b1f2a',
  grid: 'rgba(255,255,255,0.04)',
  ground: '#2b3242',
  gold: '#f2c14e',
  text: '#e8ebf2',
  subtext: '#8a93a8',
  danger: '#e85d4a',
  ok: '#5cc98a',
} as const;

interface PartStyle {
  fill: string;
  stroke: string;
}

const PART_STYLES: Record<PartType, PartStyle> = {
  ball: { fill: '#e85d4a', stroke: '#9c3426' },
  heavyBall: { fill: '#8d96a8', stroke: '#4b5263' },
  plank: { fill: '#b07a45', stroke: '#6e4a26' },
  domino: { fill: '#f2efe6', stroke: '#545a66' },
  seesaw: { fill: '#c98a4b', stroke: '#6e4a26' },
  spring: { fill: '#3fb6a8', stroke: '#1f6f66' },
  wall: { fill: '#566173', stroke: '#2f3644' },
  basket: { fill: '#d9a441', stroke: '#7d5b1b' },
  bell: { fill: '#f2c14e', stroke: '#a8801f' },
  conveyor: { fill: '#3a4152', stroke: '#1f2430' },
  fan: { fill: '#7fb8e6', stroke: '#3a6d96' },
};

const BASE_STYLE: PartStyle = { fill: '#6b4a2b', stroke: '#3d2a18' };

export interface DrawOptions {
  /** 선택된 부품 id (외곽선 강조) */
  selectedId?: string | null;
  /** 반투명으로 그릴 부품 id (배치 미리보기) */
  ghostIds?: ReadonlySet<string>;
  /** 배치 불가 표시할 부품 id */
  invalidIds?: ReadonlySet<string>;
  /** 플레이어가 배치한 부품 id (고정 부품과 구분 표시) */
  playerIds?: ReadonlySet<string>;
  /** 달성한 목표 부품 id (금색으로 강조) */
  achievedIds?: ReadonlySet<string>;
}

export function drawFieldBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.field;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // 40px 격자: 배치 감을 잡기 위한 보조선 (스냅 간격의 배수)
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 40; x < FIELD.width; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD.height);
  }
  for (let y = 40; y < FIELD.height; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
  }
  ctx.stroke();
  // 바닥선은 편집 모드(경계 바디 없음)에서도 보여야 하므로 배경에서 그린다
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, FIELD.height - 2, FIELD.width, 4);
}

function tracePolygon(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
  const v = body.vertices;
  ctx.beginPath();
  ctx.moveTo(v[0].x, v[0].y);
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
  ctx.closePath();
}

function drawBall(ctx: CanvasRenderingContext2D, body: Matter.Body, style: PartStyle): void {
  const r = body.circleRadius ?? 10;
  const { x, y } = body.position;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();
  // 회전이 보이도록 하이라이트와 표식선을 함께 그린다
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(body.angle) * r * 0.8, y + Math.sin(body.angle) * r * 0.8);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();
}

function drawBell(ctx: CanvasRenderingContext2D, body: Matter.Body, style: PartStyle): void {
  const r = body.circleRadius ?? 20;
  const { x, y } = body.position;
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.7);
  ctx.quadraticCurveTo(x - r * 0.8, y - r * 1.1, x, y - r);
  ctx.quadraticCurveTo(x + r * 0.8, y - r * 1.1, x + r, y + r * 0.7);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y + r * 0.8, r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = style.stroke;
  ctx.fill();
}

function drawSpring(ctx: CanvasRenderingContext2D, body: Matter.Body, style: PartStyle): void {
  tracePolygon(ctx, body);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();
  // 패드 윗면에 지그재그 무늬로 탄성 부품임을 표시
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const px = -28 + i * 7;
    const py = i % 2 === 0 ? -3 : 3;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#d6fff9';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawConveyor(ctx: CanvasRenderingContext2D, body: Matter.Body, style: PartStyle): void {
  tracePolygon(ctx, body);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();
  // 벨트 진행 방향(로컬 +x)을 쉐브론으로 표시하고, 양 끝에 롤러를 그린다
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -54; x <= 54; x += 27) {
    ctx.moveTo(x - 4, -4);
    ctx.lineTo(x + 2, 0);
    ctx.lineTo(x - 4, 4);
  }
  ctx.stroke();
  ctx.fillStyle = '#8a93a8';
  for (const x of [-72, 72]) {
    ctx.beginPath();
    ctx.arc(x, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFan(ctx: CanvasRenderingContext2D, body: Matter.Body, style: PartStyle): void {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  // 바람 범위(로컬 +x 방향 직사각형)를 옅게 보여 준다
  ctx.fillStyle = 'rgba(127,184,230,0.08)';
  ctx.fillRect(22, -FAN_HALF_WIDTH, FAN_RANGE, FAN_HALF_WIDTH * 2);
  ctx.strokeStyle = 'rgba(127,184,230,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const y of [-18, 0, 18]) {
    ctx.moveTo(34, y);
    ctx.lineTo(70, y);
  }
  ctx.stroke();
  // 본체와 날개
  ctx.fillStyle = '#2f3644';
  ctx.fillRect(-22, -22, 44, 44);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(-22, -22, 44, 44);
  ctx.fillStyle = style.fill;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.ellipse(0, -9, 5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawPartBody(ctx: CanvasRenderingContext2D, body: Matter.Body, type: PartType, role: PartRole): void {
  if (role === 'sensor') return;
  const style = role === 'base' ? BASE_STYLE : PART_STYLES[type];
  if (type === 'ball' || type === 'heavyBall') return drawBall(ctx, body, style);
  if (type === 'bell') return drawBell(ctx, body, style);
  if (type === 'spring') return drawSpring(ctx, body, style);
  if (type === 'conveyor') return drawConveyor(ctx, body, style);
  if (type === 'fan') return drawFan(ctx, body, style);
  tracePolygon(ctx, body);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();
}

function traceOutline(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
  if (body.circleRadius) {
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.circleRadius + 4, 0, Math.PI * 2);
  } else {
    tracePolygon(ctx, body);
  }
}

/** 필드 로컬 좌표계(원점 = 필드 좌상단)가 설정된 상태에서 호출한다 */
export function drawBodies(ctx: CanvasRenderingContext2D, bodies: readonly Matter.Body[], options: DrawOptions = {}): void {
  for (const body of bodies) {
    const tag = partTag(body);
    // 경계(바닥·벽) 바디는 배경에서 그리므로 건너뛴다
    if (!tag) continue;
    const ghost = options.ghostIds?.has(tag.id) ?? false;
    ctx.globalAlpha = ghost ? 0.55 : 1;
    const achieved = options.achievedIds?.has(tag.id) ?? false;
    // 달성한 바구니는 안쪽(센서 영역)을 금빛으로 채우고, 종은 바깥에 빛 테두리를 두른다
    if (achieved && tag.role === 'sensor') {
      tracePolygon(ctx, body);
      ctx.fillStyle = 'rgba(242,193,78,0.45)';
      ctx.fill();
    }
    drawPartBody(ctx, body, tag.type, tag.role);
    if (achieved && tag.type === 'bell') {
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, (body.circleRadius ?? 20) + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(242,193,78,0.8)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    if (tag.role === 'sensor') continue;
    const invalid = options.invalidIds?.has(tag.id);
    const selected = options.selectedId === tag.id;
    if (invalid || selected) {
      traceOutline(ctx, body);
      ctx.lineWidth = 3;
      ctx.setLineDash(selected && !invalid ? [6, 4] : []);
      ctx.strokeStyle = invalid ? COLORS.danger : COLORS.gold;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (options.playerIds?.has(tag.id)) {
      // 플레이어가 놓은 부품은 금색 점 표시로 고정 부품과 구분한다
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.gold;
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
