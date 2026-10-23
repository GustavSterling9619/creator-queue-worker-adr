import { creatorCommerceJobSchema, type CreatorCommerceJob } from './creator_job_types.js';

export type WorkerDecision = {
  action: 'deliver_asset' | 'skip_delivery' | 'update_subscriber' | 'process_content';
  summary: string;
  writes: string[];
};

type CreatorJobOfKind<K extends CreatorCommerceJob['kind']> = Extract<CreatorCommerceJob, { kind?: K }>;

export function decideCreatorJob(input: unknown): WorkerDecision {
  const job = creatorCommerceJobSchema.parse(input);

  switch (job.kind) {
    case 'digital_asset_delivery':
      return decideAssetDelivery(job);
    case 'subscriber_update':
      return decideSubscriberUpdate(job);
    case 'content_processing':
      return decideContentProcessing(job);
  }
}

function decideAssetDelivery(job: CreatorJobOfKind<'digital_asset_delivery'>): WorkerDecision {
  if (job.privacyHold) {
    return {
      action: 'skip_delivery',
      summary: `Hold order ${job.orderId}; subscriber requested a privacy review before asset delivery.`,
      writes: ['record_hold', 'notify_creator_ops']
    };
  }

  return {
    action: 'deliver_asset',
    summary: `Deliver asset ${job.assetId} for order ${job.orderId} on the ${job.licenseTier} license.`,
    writes: ['create_download_grant', 'send_receipt']
  };
}

function decideSubscriberUpdate(job: CreatorJobOfKind<'subscriber_update'>): WorkerDecision {
  return {
    action: 'update_subscriber',
    summary: `Set subscriber ${job.subscriberId} to ${job.plan} with consent ${job.consent}.`,
    writes: ['update_membership_projection']
  };
}

function decideContentProcessing(job: CreatorJobOfKind<'content_processing'>): WorkerDecision {
  const writes = job.containsSensitiveHealthContext
    ? ['queue_manual_review']
    : ['transcode_content', 'refresh_catalog'];

  return {
    action: 'process_content',
    summary: job.containsSensitiveHealthContext
      ? `Queue content ${job.contentId} for manual review before processing.`
      : `Process content ${job.contentId} from ${job.sourceFormat}.`,
    writes
  };
}
