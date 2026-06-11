import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyWebhookSecret,
  mapUpdateToAction,
  buildDedupeKey,
  normalizeTargets,
  decisionToStatus,
  weekendDecisionToStatus
} from './socialBot.mjs';

test('verifies webhook secret', () => {
  assert.equal(verifyWebhookSecret('s', 's'), true);
  assert.equal(verifyWebhookSecret('x', 's'), false);
  assert.equal(verifyWebhookSecret('s', undefined), false);
});

test('maps a facebook link to enqueue', () => {
  const a = mapUpdateToAction({ message: { chat: { id: 1 }, from: { id: 2 }, text: 'https://facebook.com/reel/3' } });
  assert.equal(a.kind, 'enqueue');
  assert.equal(a.chatId, 1);
  assert.equal(a.userId, 2);
  assert.equal(a.url, 'https://facebook.com/reel/3');
});

test('maps plain text to caption', () => {
  const a = mapUpdateToAction({ message: { chat: { id: 1 }, from: { id: 2 }, text: 'описание #bg' } });
  assert.equal(a.kind, 'caption');
  assert.equal(a.text, 'описание #bg');
});

test('maps toggle callback', () => {
  const a = mapUpdateToAction({ callback_query: { id: 'c', message: { chat: { id: 1 } }, from: { id: 2 }, data: 'job:J:toggle:tiktok' } });
  assert.equal(a.kind, 'toggle');
  assert.equal(a.jobId, 'J');
  assert.equal(a.network, 'tiktok');
});

test('maps decision callback', () => {
  const a = mapUpdateToAction({ callback_query: { id: 'c', message: { chat: { id: 1 } }, from: { id: 2 }, data: 'job:J:publish_now' } });
  assert.equal(a.kind, 'decision');
  assert.equal(a.decision, 'publish_now');
});

test('buildDedupeKey is stable and chat-scoped', () => {
  assert.equal(buildDedupeKey(1, 'u'), buildDedupeKey(1, 'u'));
  assert.notEqual(buildDedupeKey(1, 'u'), buildDedupeKey(2, 'u'));
});

test('normalizeTargets filters and dedupes', () => {
  assert.deepEqual(normalizeTargets(['tiktok', 'x', 'tiktok', 'instagram']), ['tiktok', 'instagram']);
});

test('decisionToStatus maps known decisions', () => {
  assert.equal(decisionToStatus('publish_now'), 'publishing');
  assert.equal(decisionToStatus('schedule'), 'scheduled');
  assert.equal(decisionToStatus('cancel'), 'cancelled');
  assert.equal(decisionToStatus('nope'), null);
});

test("maps wpost publish_now callback to weekend-decision", () => {
  const action = mapUpdateToAction({
    callback_query: { id: "cq1", from: { id: 7 }, message: { chat: { id: 7 } }, data: "wpost:abc-123:publish_now" },
  });
  assert.equal(action.kind, "weekend-decision");
  assert.equal(action.postId, "abc-123");
  assert.equal(action.decision, "publish_now");
});

test("weekendDecisionToStatus maps decisions", () => {
  assert.equal(weekendDecisionToStatus("publish_now"), "publishing");
  assert.equal(weekendDecisionToStatus("schedule"), "scheduled");
  assert.equal(weekendDecisionToStatus("cancel"), "cancelled");
  assert.equal(weekendDecisionToStatus("regenerate"), null);
});
