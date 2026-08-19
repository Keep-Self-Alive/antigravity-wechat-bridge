/**
 * Session Orchestrator — Enterprise Adaptive Session State Machine.
 * Implements:
 * 1. 500ms Sliding Window Input Debounce & Semantic Fusion (prevents fragment spam)
 * 2. Preemptive Phase Interrupt (instantly replaces outdated planning)
 * 3. Inline Steer Channel (injects intervention to unfreeze hanging steps)
 * 4. Message Idempotency Cache (prevents duplicate execution on network retry)
 */

export enum SessionPhase {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
}

export interface ActiveExecution {
  turnId: string;
  userId: string;
  cascadeId: string;
  prompt: string;
  abortController: AbortController;
  startedAt: number;
}

export class SessionOrchestrator {
  private userPhases = new Map<string, SessionPhase>();
  private activeExecutions = new Map<string, ActiveExecution>();
  private inputBuffers = new Map<string, { texts: string[]; timer: NodeJS.Timeout | null }>();
  private processedMsgFingerprints = new Set<string>();

  /**
   * Idempotency check: returns true if message is unique and safe to process.
   */
  public checkAndMarkIdempotent(msgId: string, timestamp: number): boolean {
    const key = `${msgId}:${Math.floor(timestamp / 10000)}`;
    if (this.processedMsgFingerprints.has(key)) {
      return false;
    }
    this.processedMsgFingerprints.add(key);
    // Auto-clean old fingerprints after 60s
    setTimeout(() => this.processedMsgFingerprints.delete(key), 60000);
    return true;
  }

  public getPhase(userId: string): SessionPhase {
    return this.userPhases.get(userId) || SessionPhase.IDLE;
  }

  public setPhase(userId: string, phase: SessionPhase) {
    this.userPhases.set(userId, phase);
  }

  public registerActiveExecution(exec: ActiveExecution) {
    this.activeExecutions.set(exec.userId, exec);
    this.setPhase(exec.userId, SessionPhase.PLANNING);
  }

  public clearActiveExecution(userId: string) {
    this.activeExecutions.delete(userId);
    this.setPhase(userId, SessionPhase.IDLE);
  }

  public getActiveExecution(userId: string): ActiveExecution | undefined {
    return this.activeExecutions.get(userId);
  }

  /**
   * Ingests a new message with 500ms sliding window aggregation.
   */
  public ingestMessage(
    userId: string,
    rawText: string,
    onFusedReady: (fusedText: string, shouldPreempt: boolean, shouldSteer: boolean) => Promise<void>
  ): void {
    let buf = this.inputBuffers.get(userId);
    if (!buf) {
      buf = { texts: [], timer: null };
      this.inputBuffers.set(userId, buf);
    }

    buf.texts.push(rawText);

    if (buf.timer) {
      clearTimeout(buf.timer);
    }

    buf.timer = setTimeout(async () => {
      const texts = buf!.texts;
      buf!.texts = [];
      buf!.timer = null;

      const fusedText = texts.join('\n');
      const currentPhase = this.getPhase(userId);

      const shouldPreempt = currentPhase === SessionPhase.PLANNING;
      const shouldSteer = currentPhase === SessionPhase.EXECUTING;

      if (shouldPreempt) {
        // Abort previous uncompleted planning
        const active = this.getActiveExecution(userId);
        if (active) {
          console.log(`⚡ [Orchestrator] 触发抢占替换：终止未结思考 [${active.turnId.slice(0, 8)}]`);
          active.abortController.abort();
        }
      }

      await onFusedReady(fusedText, shouldPreempt, shouldSteer);
    }, 500);
  }
}
