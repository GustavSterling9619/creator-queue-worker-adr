import { z } from 'zod';

const assetDeliveryJob = z.object({
  kind: z.literal('digital_asset_delivery'),
  creatorId: z.string().min(1),
  orderId: z.string().min(1),
  subscriberId: z.string().min(1),
  assetId: z.string().min(1),
  licenseTier: z.enum(['standard', 'premium']),
  privacyHold: z.boolean().default(false)
});

const subscriberUpdateJob = z.object({
  kind: z.literal('subscriber_update'),
  creatorId: z.string().min(1),
  subscriberId: z.string().min(1),
  consent: z.enum(['granted', 'revoked']),
  plan: z.enum(['free', 'member'])
});

const contentProcessingJob = z.object({
  kind: z.literal('content_processing'),
  creatorId: z.string().min(1),
  contentId: z.string().min(1),
  sourceFormat: z.enum(['video', 'audio', 'image']),
  containsSensitiveHealthContext: z.boolean().default(false)
});

export const creatorCommerceJobSchema = z.discriminatedUnion('kind', [
  assetDeliveryJob,
  subscriberUpdateJob,
  contentProcessingJob
]);

export type CreatorCommerceJob = z.infer<typeof creatorCommerceJobSchema>;
