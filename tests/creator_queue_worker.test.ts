import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCreatorJob } from '../src/creator_workflow.js';

test('digital asset delivery stays on hold when privacyHold is true', () => {
  const input = {
    kind: 'digital_asset_delivery',
    creatorId: 'creator-44',
    orderId: 'ord-9',
    subscriberId: 'sub-8',
    assetId: 'asset-guide',
    licenseTier: 'standard',
    privacyHold: true
  };

  const decision = decideCreatorJob(input);

  assert.equal(decision.action, 'skip_delivery');
  assert.equal(
    decision.summary,
    'Hold order ord-9; subscriber requested a privacy review before asset delivery.'
  );
  assert.deepEqual(decision.writes, ['record_hold', 'notify_creator_ops']);
});
