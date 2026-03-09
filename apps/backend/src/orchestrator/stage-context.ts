import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NoopApprovalService } from '@daio/approval';
import type { ArtifactStore, StageContext, StageId, StageLogMetadata, StageLogger } from '@daio/pipeline-core';
import type { AgentRunner } from '../agents/runner.js';

function formatLogMessage(message: string, metadata?: StageLogMetadata): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return message;
  }

  return `${message} ${JSON.stringify(metadata)}`;
}

function createArtifactStore(productDir: string): ArtifactStore {
  return {
    async readText(relativePath: string): Promise<string> {
      return readFile(resolve(productDir, relativePath), 'utf8');
    },
    async writeText(relativePath: string, content: string): Promise<void> {
      const filePath = resolve(productDir, relativePath);
      mkdirSync(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf8');
    },
    async exists(relativePath: string): Promise<boolean> {
      return existsSync(resolve(productDir, relativePath));
    },
    resolve(relativePath: string): string {
      return resolve(productDir, relativePath);
    },
  };
}

function createLogger(log: (content: string) => Promise<void>): StageLogger {
  return {
    info(message: string, metadata?: StageLogMetadata): Promise<void> {
      return log(formatLogMessage(message, metadata));
    },
    warn(message: string, metadata?: StageLogMetadata): Promise<void> {
      return log(formatLogMessage(`WARNING: ${message}`, metadata));
    },
    error(message: string, metadata?: StageLogMetadata): Promise<void> {
      return log(formatLogMessage(`ERROR: ${message}`, metadata));
    },
  };
}

export function createStageContext(params: {
  runId: string;
  stage: StageId;
  productDir: string;
  runner: AgentRunner;
  log: (content: string) => Promise<void>;
}): StageContext {
  return {
    runId: params.runId,
    stage: params.stage,
    productDir: params.productDir,
    runner: {
      runOnce(prompt, options) {
        return params.runner.runOnce(prompt, options);
      },
      runLoop(prompt, options) {
        return params.runner.runLoop(prompt, options);
      },
    },
    logger: createLogger(params.log),
    artifacts: createArtifactStore(params.productDir),
    approvals: new NoopApprovalService(),
    now: () => new Date().toISOString(),
  };
}
