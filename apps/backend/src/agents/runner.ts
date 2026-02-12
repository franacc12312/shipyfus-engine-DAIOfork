import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { db } from '../services/db.js';
import { parseStreamLine, extractTextFromEvent, getEventType, type ClaudeStreamEvent } from './parser.js';
import { COMPLETION_PROMISE } from '@daio/shared';

export interface RunOnceOptions {
  runId: string;
  stage: string;
  cwd: string;
  maxBudgetUsd?: number;
  iteration?: number;
  agentId?: string;
  onEvent?: (event: ClaudeStreamEvent) => void;
}

export interface RunLoopOptions extends RunOnceOptions {
  maxIterations: number;
  completionPromise?: string;
}

interface LogEntry {
  run_id: string;
  stage: string;
  iteration: number;
  event_type: string;
  content: string;
  raw_event: Record<string, unknown>;
  agent_id: string | null;
}

const LOG_BATCH_SIZE = 20;
const LOG_FLUSH_INTERVAL_MS = 200;

export class AgentRunner {
  private activeProcesses = new Map<string, ChildProcess>();
  private logBuffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;

  constructor() {
    this.startFlushTimer();
  }

  async runOnce(prompt: string, options: RunOnceOptions): Promise<{ text: string; json: unknown | null; cost: number }> {
    const { runId, stage, cwd, maxBudgetUsd = 5, iteration = 0, agentId, onEvent } = options;

    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence',
      '--max-budget-usd', String(maxBudgetUsd),
      '--dangerously-skip-permissions',
      prompt,
    ];

    return new Promise((resolve, reject) => {
      const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      this.activeProcesses.set(stage, child);

      let accumulatedText = '';
      let totalCost = 0;

      const rl = createInterface({ input: child.stdout! });
      rl.on('line', (line) => {
        const event = parseStreamLine(line);
        if (!event) return;

        onEvent?.(event);

        const eventType = getEventType(event);
        const content = extractTextFromEvent(event);

        if (event.type === 'assistant') {
          accumulatedText += content;
        }

        if (event.type === 'result') {
          totalCost = event.total_cost_usd || 0;
          if (event.result) {
            accumulatedText += '\n' + event.result;
          }
        }

        // Skip logging "result" events — their text duplicates what was
        // already streamed via "assistant" events. Cost/duration metadata
        // is captured by the runner's return value instead.
        if (event.type !== 'result' && content.trim()) {
          this.bufferLog({
            run_id: runId,
            stage,
            iteration,
            event_type: eventType,
            content: content.slice(0, 10000),
            raw_event: event as unknown as Record<string, unknown>,
            agent_id: agentId || null,
          });
        }
      });

      let stderrOutput = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });

      child.on('close', async (code) => {
        this.activeProcesses.delete(stage);
        await this.flushLogs();

        if (code !== 0 && code !== null) {
          reject(new Error(`Claude process exited with code ${code}: ${stderrOutput.slice(0, 500)}`));
          return;
        }

        const json = this.extractJsonFromText(accumulatedText);
        resolve({ text: accumulatedText, json, cost: totalCost });
      });

      child.on('error', (err) => {
        this.activeProcesses.delete(stage);
        reject(err);
      });
    });
  }

  async runLoop(prompt: string, options: RunLoopOptions): Promise<{ text: string; json: unknown | null; cost: number; iterations: number; completed: boolean }> {
    const { maxIterations, completionPromise = COMPLETION_PROMISE, ...onceOptions } = options;

    let iteration = 0;
    let totalCost = 0;
    let lastResult: { text: string; json: unknown | null; cost: number } = { text: '', json: null, cost: 0 };
    let completed = false;

    while (iteration < maxIterations) {
      iteration++;

      // Update iteration in DB
      await db
        .from('run_stages')
        .update({ iteration })
        .eq('run_id', onceOptions.runId)
        .eq('stage', onceOptions.stage);

      lastResult = await this.runOnce(prompt, {
        ...onceOptions,
        iteration,
      });

      totalCost += lastResult.cost;

      // Check for completion promise
      if (this.containsCompletionPromise(lastResult.text, completionPromise)) {
        completed = true;
        break;
      }
    }

    return {
      text: lastResult.text,
      json: lastResult.json,
      cost: totalCost,
      iterations: iteration,
      completed,
    };
  }

  kill(stage: string): boolean {
    const proc = this.activeProcesses.get(stage);
    if (proc) {
      proc.kill('SIGTERM');
      this.activeProcesses.delete(stage);
      return true;
    }
    return false;
  }

  killAll(): void {
    for (const [stage, proc] of this.activeProcesses) {
      proc.kill('SIGTERM');
      this.activeProcesses.delete(stage);
    }
  }

  async destroy(): Promise<void> {
    this.killAll();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushLogs();
  }

  extractJsonFromText(text: string): unknown | null {
    // Find the last ```json ... ``` block
    const matches = text.match(/```json\s*([\s\S]*?)```/g);
    if (!matches || matches.length === 0) return null;

    const lastMatch = matches[matches.length - 1];
    const jsonStr = lastMatch.replace(/```json\s*/, '').replace(/```$/, '').trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  containsCompletionPromise(text: string, promise: string): boolean {
    return text.includes(`<promise>${promise}</promise>`);
  }

  private bufferLog(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length >= LOG_BATCH_SIZE) {
      void this.flushLogs();
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.isFlushing || this.logBuffer.length === 0) return;

    this.isFlushing = true;
    const batch = this.logBuffer.splice(0, this.logBuffer.length);

    try {
      const { error } = await db.from('logs').insert(batch);
      if (error) {
        console.error('Failed to flush logs:', error.message);
        // Don't re-add failed logs to avoid infinite loops
      }
    } catch (err) {
      console.error('Error flushing logs:', err);
    } finally {
      this.isFlushing = false;
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flushLogs();
    }, LOG_FLUSH_INTERVAL_MS);
  }
}
