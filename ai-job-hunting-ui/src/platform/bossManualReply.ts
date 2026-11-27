import axios from 'axios';
import {BossOption} from './bossPlatform';
import {AiPower} from './aiPower';
import {TampermonkeyApi, Tools} from './utils';
import {protobufType, TechwolfChatProtocol} from '../webSocket/protobuf';
import {canReplyToConversation, ChatConversation, getLoadedConversations, isIncomingTextMessage, isSameLastMessage, ManualReplyQueue} from './manualReply';

const storageKey = 'manualReplyProcessed';
const queue = new ManualReplyQueue(TampermonkeyApi.GmGetValue(storageKey, {}),
    processed => TampermonkeyApi.GmSetValue(storageKey, processed));

export function getSelectedConversation(): ChatConversation | undefined {
    const element = document.querySelector('.friend-content.selected')?.closest('.friend-content-warp');
    return (element as any)?.__vue__?.$props?.source;
}

function currentMessage(source: ChatConversation): TechwolfChatProtocol | undefined {
    const elements = Array.from(document.querySelectorAll('.chat-conversation .message-item'));
    for (const element of elements.reverse()) {
        const message = (element as any).__vue__?.$props?.message;
        if (!message || String(message.mid) !== String(source.lastMsgId)) continue;
        return {type: 1, messages: [{
            from: {uid: message.fromId, name: message.fromName, avatar: message.fromAvatar},
            to: {uid: message.toId, name: '', avatar: ''},
            mid: String(message.mid), type: message.type,
            body: {type: message.bodyType, templateId: message.templateId, text: message.text}
        }]};
    }
}

async function loadLastMessage(source: ChatConversation): Promise<TechwolfChatProtocol> {
    const current = currentMessage(source);
    if (current) return current;
    const response = await axios.get('https://www.zhipin.com/wapi/zpchat/message/refresh', {
        params: {messageId: source.lastMsgId},
        headers: {Zp_token: Tools.getCookieValue('bst')}, timeout: 15000
    });
    const payload = response.data?.zpData?.msg;
    if (response.data?.code !== 0 || !payload) throw new Error('无法读取最后一条完整消息');
    const bytes = typeof payload === 'string'
        ? Uint8Array.from(atob(payload), character => character.charCodeAt(0)) : Uint8Array.from(payload);
    return protobufType.decode(bytes) as unknown as TechwolfChatProtocol;
}

export async function replyToConversation(source: ChatConversation): Promise<'processed' | 'skipped'> {
    const original = {...source};
    return queue.run(original, async () => {
        const canReply = () => isSameLastMessage(original,
            getLoadedConversations(document).find(item => String(item.uid) === String(original.uid)));
        if (!canReply()) return false;
        const protocol = await loadLastMessage(original);
        const message = protocol.messages.find(item => String(item.mid) === String(original.lastMsgId));
        if (!message || !isIncomingTextMessage(message, original, Tools.window._PAGE.uid)) return false;
        if (!canReply()) return false;
        const boss = new BossOption();
        const info = await boss.getBossUserInfoByBossId(Number(original.uid));
        if (!info || !canReply()) return false;
        await AiPower.updateAskStatus(BossOption.buildJobKey(info), false);
        return boss.handlerBossMessage({type: protocol.type, messages: [message]}, Number(original.uid),
            message.body.text, 'transport=manual;lastIsSelf=false;senderVerified=true', canReply);
    });
}

export function getPendingConversations(): ChatConversation[] {
    return getLoadedConversations(document).filter(canReplyToConversation).map(source => ({...source}));
}
