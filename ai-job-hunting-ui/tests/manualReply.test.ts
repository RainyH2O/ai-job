import assert from 'node:assert/strict';
import test from 'node:test';
import {canReplyToConversation, getLoadedConversations, isIncomingTextMessage, isSameLastMessage, ManualReplyQueue} from '../src/platform/manualReply.ts';

const conversation = (overrides = {}) => ({uid: 12, friendSource: 0, encryptBossId: 'boss',
    encryptJobId: 'job', lastMsgId: 100, lastMsgClientId: 0, lastIsSelf: false, ...overrides});

test('only accepts a known incoming last message from a direct conversation', () => {
    assert.equal(canReplyToConversation(conversation()), true);
    for (const overrides of [{lastIsSelf: true}, {lastIsSelf: undefined}, {lastMsgId: 0},
        {uid: 0}, {groupId: 9}, {encryptJobId: ''}, {lastMsgClientId: 101}, {friendSource: 1}]) {
        assert.equal(canReplyToConversation(conversation(overrides)), false);
    }
});

test('reads the complete virtual list and deduplicates pinned visible conversations', () => {
    const list = [conversation(), conversation({uid: 13})];
    const vue = {$props: {source: list[0]}, $parent: {$props: {dataSources: list}}};
    const document = {querySelectorAll: () => [{__vue__: vue}]} as any;
    assert.deepEqual(getLoadedConversations(document), list);
});

test('invalidates an AI reply after a new incoming message or a manual reply', () => {
    const initial = conversation();
    assert.equal(isSameLastMessage(initial, conversation({uid: '12', lastMsgId: '100'})), true);
    assert.equal(isSameLastMessage(initial, conversation({lastMsgId: 101})), false);
    assert.equal(isSameLastMessage(initial, conversation({lastIsSelf: true})), false);
    assert.equal(isSameLastMessage(initial, undefined), false);
});

test('blocks simultaneous requests and repeated successful processing of the same message', async () => {
    const queue = new ManualReplyQueue({});
    let release;
    const first = queue.run(conversation(), () => new Promise<boolean>(resolve => { release = resolve; }));
    assert.equal(await queue.run(conversation(), async () => { throw Error('must not run'); }), 'skipped');
    release(true);
    assert.equal(await first, 'processed');
    assert.equal(await queue.run(conversation(), async () => { throw Error('must not run'); }), 'skipped');
    assert.equal(await queue.run(conversation({lastMsgId: 101}), async () => true), 'processed');
});

test('allows retry after a failed request or an invalidated result', async () => {
    const queue = new ManualReplyQueue({});
    await assert.rejects(queue.run(conversation(), async () => { throw Error('offline'); }), /offline/);
    assert.equal(await queue.run(conversation(), async () => false), 'skipped');
    assert.equal(await queue.run(conversation(), async () => true), 'processed');
});

test('validates both parties and message identity and rejects resume receipts and system messages', () => {
    const message = {mid: '100', from: {uid: '12'}, to: {uid: 42}, type: 1, body: {type: 1, text: 'hello'}};
    assert.equal(isIncomingTextMessage(message, conversation(), '42'), true);
    for (const changes of [{mid: 99}, {from: {uid: 42}}, {to: {uid: 99}}, {type: 4},
        {body: {type: 12, text: 'resume received'}}, {body: {type: 1, text: ''}}]) {
        assert.equal(isIncomingTextMessage({...message, ...changes}, conversation(), 42), false);
    }
});

test('retains processed message IDs across page reloads', async () => {
    let persisted = {};
    const queue = new ManualReplyQueue({}, data => { persisted = {...data}; });
    assert.equal(await queue.run(conversation(), async () => true), 'processed');
    const reloaded = new ManualReplyQueue(persisted);
    assert.equal(await reloaded.run(conversation(), async () => { throw Error('must not run'); }), 'skipped');
});
