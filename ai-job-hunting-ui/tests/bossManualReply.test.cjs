const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(__dirname + '/../src/platform/bossPlatform.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
const types = {MSG_TEXT: 1, BOSS_OPERATION: 2, STOP: 3, AI_SERVICE_EXCEPTION: 4, REVIEW_REQUIRED: 5};
const protocol = {type: 1, messages: [{mid: '100', from: {uid: 12, name: 'HR', avatar: ''},
    to: {uid: 42}, type: 1, body: {type: 1, templateId: 1, text: 'hello'}}]};

function setup(answer, ask, aiSeatStatus = 1) {
    const sent = [];
    const resumeRequests = [];
    const reviews = [];
    const logger = {info() {}, debug() {}, trace() {}, error() {}};
    const modules = {
        axios: {get: async () => ({data: {zpData: {friendList: [], result: []}}}),
            post: async (...args) => { resumeRequests.push(args); }},
        '../webSocket/protobuf': {Message: class {constructor(data) {this.data = data;} send() {sent.push(this.data);}},
            MessageRead: class {send() {}}},
        './utils': {Tools: {window: {_PAGE: {uid: 42}}, getEndChar: () => '\u200b', getCookieValue: () => '',
            sleep: async () => {}, getRandomNumber: () => 0},
            MessageCache: class {isMessageProcessed() {return false;} markMessageAsProcessed() {}}},
        '../stores': {UserStore: () => ({user: {aiSeatStatus, preference: {}, resumeId: 'resume'}})},
        '../logging': logger,
        '../logging/record': {LogRecorder: class {error() {}}},
        '../stores/types': {JobSeekerClonedAnswerTypeEnum: types, BossOperationTypeEnum: {SEND_RESUME: 1}},
        './aiPower': {AiPower: {ask: ask || (async () => ({data: {data: answer}}))}},
        './replyReview': {showReplyReview: (...args) => {reviews.push(args);}},
        '../utils/tools': {ElMessage() {}}, 'element-plus': {ElNotification() {}}
    };
    const exports = {};
    vm.runInNewContext(compiled, {exports, require: name => {
        assert.ok(name in modules, `unexpected import ${name}`);
        return modules[name];
    }, document: {querySelectorAll: () => []}, setTimeout() {}});
    const {BossOption} = exports;
    BossOption.bossUserInfoMap.set(12, {bossId: 12, encryptBossId: 'boss', encryptJobId: 'job'});
    return {boss: new BossOption(), sent, resumeRequests, reviews};
}

test('manual text reply sends through the existing transport', async () => {
    const {boss, sent} = setup({answerTypeList: [types.MSG_TEXT], answerContent: 'reply'});
    assert.equal(await boss.handlerBossMessage(protocol, 12, 'hello', 'manual', () => true), true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to_uid, '12');
    assert.equal(sent[0].content, 'reply\u200b');
});

test('manual replies work with AI seat disabled and explicitly identify manual requests', async () => {
    let request;
    const {boss, sent} = setup(null, async (...args) => {
        request = args;
        return {data: {data: {answerTypeList: [types.MSG_TEXT], answerContent: 'reply'}}};
    }, 0);
    assert.equal(await boss.handlerBossMessage(protocol, 12, 'hello', 'manual', () => true), true);
    assert.equal(request[4], true);
    assert.equal(sent.length, 1);
});

test('automatic replies still respect the AI seat switch', async () => {
    const {boss, sent} = setup(null, async () => {throw new Error('must not call AI');}, 0);
    assert.equal(await boss.handlerBossMessage(protocol, 12, 'hello'), false);
    assert.equal(sent.length, 0);
});

test('drops an AI result when the conversation changes while awaiting it', async () => {
    let current = true;
    const {boss, sent, resumeRequests} = setup(null, async () => {
        current = false;
        return {data: {data: {answerTypeList: [types.MSG_TEXT, types.BOSS_OPERATION],
            answerContent: 'outdated', operationTypeList: [1]}}};
    });
    assert.equal(await boss.handlerBossMessage(protocol, 12, 'hello', 'manual', () => current), false);
    assert.equal(sent.length, 0);
    assert.equal(resumeRequests.length, 0);
});

test('does not send a resume without the explicit SEND_RESUME operation', async () => {
    const {boss, resumeRequests} = setup({answerTypeList: [types.BOSS_OPERATION], operationTypeList: []});
    await boss.handlerBossMessage(protocol, 12, 'hello', 'manual', () => true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(resumeRequests.length, 0);
});

test('sends a resume for an explicit SEND_RESUME operation', async () => {
    const {boss, resumeRequests} = setup({answerTypeList: [types.BOSS_OPERATION], operationTypeList: [1]});
    await boss.handlerBossMessage(protocol, 12, 'hello', 'manual', () => true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(resumeRequests.length, 1);
});

test('requires review confirmation and checks the conversation again before sending', async () => {
    let current = true;
    const {boss, reviews, sent} = setup({answerTypeList: [types.REVIEW_REQUIRED], answerContent: 'draft'});
    await boss.handlerBossMessage(protocol, 12, 'hello', 'manual', () => current);
    assert.equal(sent.length, 0);
    assert.equal(reviews.length, 1);
    current = false;
    assert.equal(await reviews[0][3]('edited reply'), false);
    assert.equal(sent.length, 0);
});
