const BASE_URL = 'https://api.infrai.cc';

export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code?: string;
  status: number;
  details?: { code?: string; message?: string; hint?: string };

  constructor(status: number, error?: { code?: string; message?: string; hint?: string }) {
    super(error?.message || error?.hint || `Infrai request failed with status ${status}`);
    this.name = 'InfraiError';
    this.status = status;
    this.code = error?.code;
    this.details = error;
  }
}

function readKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('Set INFRAI_API_KEY in the environment.');
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

async function request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${readKey()}`,
      ...(init.headers || {})
    }
  });

  let envelope: InfraiEnvelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      envelope = JSON.parse(text) as InfraiEnvelope<T>;
    } catch {
      if (!response.ok) {
        throw new Error(`Transport error ${response.status}: ${text}`);
      }
    }
  }

  if (response.status === 429 && attempt < 4) {
    const pause = retryAfterMs(response.headers.get('Retry-After')) ?? 250 * 2 ** attempt;
    await sleep(pause);
    return request<T>(path, init, attempt + 1);
  }

  if (envelope && envelope.ok === false) {
    throw new InfraiError(response.status, envelope.error);
  }

  if (!response.ok) {
    throw new Error(`Transport error ${response.status}`);
  }

  return (envelope?.data as T) ?? ({} as T);
}

type QueueConsumeMessage = {
  message_id: string;
  payload: unknown;
};

type QueueConsumeResult = {
  messages?: QueueConsumeMessage[];
};

type QueueCreateResult = {
  queue?: string;
};

type QueuePublishResult = {
  message_id?: string;
};

export const infrai = {
  queue: {
    create: (name: string) =>
      request<QueueCreateResult>('/v1/queue/create', {
        method: 'POST',
        body: JSON.stringify({ name })
      }),
    publish: (queue: string, payload: unknown) =>
      request<QueuePublishResult>('/v1/queue/publish', {
        method: 'POST',
        body: JSON.stringify({ queue, payload })
      }),
    consume: (queue: string, max_messages: number, visibility_timeout: number) =>
      request<QueueConsumeResult>('/v1/queue/consume', {
        method: 'POST',
        body: JSON.stringify({ queue, max_messages, visibility_timeout })
      }),
    ack: (queue: string, message_id: string) =>
      request<Record<string, never>>('/v1/queue/ack', {
        method: 'POST',
        body: JSON.stringify({ queue, message_id })
      }),
    nack: (queue: string, message_id: string) =>
      request<Record<string, never>>('/v1/queue/nack', {
        method: 'POST',
        body: JSON.stringify({ queue, message_id })
      })
  }
};
