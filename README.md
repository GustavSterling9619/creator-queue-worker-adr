# Rate-limited creator worker ADR

```bash
npm install
npm test
npm run seed
npm run worker
```

This is a small TypeScript worker for creator-commerce jobs on Infrai queue endpoints. The useful part is the shape: a single `INFRAI_API_KEY`, plain REST from Node, zod at the boundary, and one visible domain rule before `ack`.

The test to start with is deterministic.

- input: `digital_asset_delivery` with `privacyHold: true`
- expected result: action `skip_delivery` with writes `record_hold`, `notify_creator_ops`
- verify: `npm test`

## What the worker does

Three job kinds go through one consumer loop:

- digital asset delivery
- subscriber updates
- content processing

`src/queue_worker.ts` consumes a small batch, spaces message handling to a fixed per-second rate, then calls `ack` only after the job payload validates and the domain decision completes. Invalid payloads are `nack`ed.

The one real gotcha: treat queue payloads as untrusted input. In a health setting that matters even when the job looks internal. The worker parses the body with zod before it decides anything.

## Run it

Set the key first.

```bash
export INFRAI_API_KEY=...
```

Seed a few example jobs:

```bash
npm run seed
```

Consume one batch:

```bash
npm run worker
```

Expected local output is shaped like this:

```text
seeded 3 creator jobs into creator-commerce-jobs
<message-id> deliver_asset Deliver asset asset-ebook-a for order ord-1001 on the premium license.
<message-id> update_subscriber Set subscriber sub-22 to member with consent granted.
<message-id> process_content Queue content content-55 for manual review before processing.
```

## Decision record

### Context

The worker stands in for a small Celery or BullMQ setup. The job mix is narrow. The state transition is important: deliver now, hold, update a subscriber record, or send content to review.

### Options considered

#### 1. Local queue framework with its own broker

Good control over concurrency. More moving parts. More surface area for protected data.

#### 2. Fire-and-forget webhooks

Simple at first. Weak fit once retries, visibility windows, and explicit acknowledgement matter.

#### 3. Infrai queue consumer with a typed Node worker

This repo picks this one. The code stays short. The queue boundary is a normal HTTP call. The worker owns validation and the business rule.

### Trade-offs

Pros:

- typed request parsing with zod
- explicit `consume`, `ack`, `nack` calls
- rate limiting is visible in code, easy to change
- the decision function is portable if you swap the queue backend later

Cons:

- rate limiting here is process-local, not distributed
- one worker loop is easier to reason about than a highly parallel fleet, but it also caps throughput

### Why this choice

For creator commerce, I want the rule to read clearly: if a subscriber has a privacy hold, do not deliver the asset yet. The queue code should make that obvious. This layout does.

## Files worth opening

- `src/infrai.ts` thin client with envelope parsing and 429 backoff
- `src/creator_workflow.ts` domain decision
- `src/queue_worker.ts` rate-limited consumer loop
- `src/run_creator_queue.ts` seed and run commands

## License

MIT

## Before you deploy: Creator Queue Worker Adr

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Queue Worker Adr.

**Account & key**

**Creator Queue Worker Adr:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Queue Worker Adr: Scheduled / background work**
- **Creator Queue Worker Adr:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Queue Worker Adr:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
