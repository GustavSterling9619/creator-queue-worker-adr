import { infrai } from './infrai.js';
import { consumeCreatorJobs } from './queue_worker.js';

const queueName = process.env.CREATOR_QUEUE_NAME ?? 'creator-commerce-jobs';

async function seed(): Promise<void> {
  await infrai.queue.create(queueName);

  const jobs = [
    {
      kind: 'digital_asset_delivery',
      creatorId: 'creator-7',
      orderId: 'ord-1001',
      subscriberId: 'sub-22',
      assetId: 'asset-ebook-a',
      licenseTier: 'premium',
      privacyHold: false,
      requestId: 'seed-asset-1'
    },
    {
      kind: 'subscriber_update',
      creatorId: 'creator-7',
      subscriberId: 'sub-22',
      consent: 'granted',
      plan: 'member',
      requestId: 'seed-subscriber-1'
    },
    {
      kind: 'content_processing',
      creatorId: 'creator-7',
      contentId: 'content-55',
      sourceFormat: 'video',
      containsSensitiveHealthContext: true,
      requestId: 'seed-content-1'
    }
  ];

  for (const job of jobs) {
    await infrai.queue.publish(queueName, job);
  }

  console.log(`seeded ${jobs.length} creator jobs into ${queueName}`);
}

async function worker(): Promise<void> {
  const outcomes = await consumeCreatorJobs({
    batchSize: 3,
    visibilityTimeoutSeconds: 60,
    perSecond: 2,
    cycles: 1
  });

  for (const outcome of outcomes) {
    if (outcome.acked && outcome.decision) {
      console.log(`${outcome.messageId} ${outcome.decision.action} ${outcome.decision.summary}`);
    } else {
      console.log(`${outcome.messageId} rejected ${outcome.reason}`);
    }
  }
}

const command = process.argv[2];

if (command === 'seed') {
  seed();
} else if (command === 'worker') {
  worker();
} else {
  console.log('usage: npm run seed | npm run worker');
}
