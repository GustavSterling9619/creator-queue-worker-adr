import { ZodError } from 'zod';
import { infrai } from './infrai.js';
import { decideCreatorJob, type WorkerDecision } from './creator_workflow.js';

export type MessageLike = {
  message_id: string;
  payload: unknown;
};

export type MessageOutcome = {
  messageId: string;
  acked: boolean;
  decision?: WorkerDecision;
  reason?: string;
};

const queueName = process.env.CREATOR_QUEUE_NAME ?? 'creator-commerce-jobs';

export async function handleMessage(message: MessageLike): Promise<MessageOutcome> {
  try {
    const decision = decideCreatorJob(message.payload);
    await infrai.queue.ack(queueName, message.message_id);
    return {
      messageId: message.message_id,
      acked: true,
      decision
    };
  } catch (error) {
    if (error instanceof ZodError) {
      await infrai.queue.nack(queueName, message.message_id);
      return {
        messageId: message.message_id,
        acked: false,
        reason: 'invalid_job_payload'
      };
    }
    throw error;
  }
}

export async function consumeCreatorJobs(options?: {
  batchSize?: number;
  visibilityTimeoutSeconds?: number;
  perSecond?: number;
  cycles?: number;
}): Promise<MessageOutcome[]> {
  const batchSize = options?.batchSize ?? 3;
  const visibilityTimeoutSeconds = options?.visibilityTimeoutSeconds ?? 60;
  const perSecond = options?.perSecond ?? 2;
  const cycles = options?.cycles ?? 1;
  const spacingMs = Math.ceil(1000 / perSecond);
  const results: MessageOutcome[] = [];

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const batch = await infrai.queue.consume(queueName, batchSize, visibilityTimeoutSeconds);
    const messages = batch.messages ?? [];

    for (const message of messages) {
      const startedAt = Date.now();
      const outcome = await handleMessage(message);
      results.push(outcome);
      const elapsed = Date.now() - startedAt;
      const wait = spacingMs - elapsed;
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  return results;
}
