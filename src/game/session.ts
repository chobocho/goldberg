import { STEP_MS, Simulation, advanceFixedSteps } from '../core/simulation';
import type { Editor } from '../editor/editor';

export type Mode = 'edit' | 'run';

// 느린 기기에서 한 프레임에 따라잡을 최대 스텝. 넘치면 슬로모션이 되지만 프레임이 멈추지는 않는다.
const MAX_STEPS_PER_FRAME = 5;

/** 편집 ↔ 실행 전환. 실행은 항상 편집 상태의 복사본으로 새 시뮬레이션을 만들어, 리셋 시 배치가 보존된다. */
export class GameSession {
  mode: Mode = 'edit';
  simulation: Simulation | null = null;
  result: 'none' | 'won' = 'none';
  private accumulator = 0;

  constructor(readonly editor: Editor) {}

  run(): void {
    if (this.mode === 'run') return;
    this.editor.cancelDrag();
    this.editor.select(null);
    this.simulation = new Simulation(this.editor.allParts());
    this.accumulator = 0;
    this.mode = 'run';
  }

  reset(): void {
    this.simulation = null;
    this.result = 'none';
    this.mode = 'edit';
  }

  update(frameMs: number): void {
    if (!this.simulation) return;
    const { steps, accumulatorMs } = advanceFixedSteps(this.accumulator, frameMs, STEP_MS, MAX_STEPS_PER_FRAME);
    this.accumulator = accumulatorMs;
    for (let i = 0; i < steps; i++) this.simulation.step();
    // 클리어 후에도 시뮬레이션은 계속 돌려 연쇄 반응의 여운을 보여 준다
    if (this.result === 'none' && this.simulation.isSolved()) this.result = 'won';
  }
}
