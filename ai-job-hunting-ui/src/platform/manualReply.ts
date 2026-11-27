export const manualReplyMode = true;

export interface ChatConversation {
    uid: number | string;
    friendSource: number;
    encryptBossId: string;
    encryptJobId: string;
    lastMsgId: number | string;
    lastMsgClientId?: number;
    lastIsSelf?: boolean;
    groupId?: number;
}

export function canReplyToConversation(source?: ChatConversation): source is ChatConversation {
    return !!source && Number(source.uid) > 0 && source.friendSource === 0 && !source.groupId
        && !!source.encryptBossId && !!source.encryptJobId && Number(source.lastMsgId) > 0
        && source.lastIsSelf === false && !source.lastMsgClientId;
}

export function getLoadedConversations(document: Document): ChatConversation[] {
    const sources = new Map<string, ChatConversation>();
    const add = (source: ChatConversation) => {
        if (source?.uid && source.encryptBossId && source.encryptJobId && !source.groupId) {
            sources.set(String(source.uid), source);
        }
    };
    document.querySelectorAll('.friend-content-warp').forEach(element => {
        let vue = (element as any).__vue__;
        for (let depth = 0; vue && depth < 4; depth++, vue = vue.$parent) {
            add(vue.$props?.source);
            vue.$props?.dataSources?.forEach(add);
        }
    });
    return Array.from(sources.values());
}

export function isSameLastMessage(original: ChatConversation, current?: ChatConversation): boolean {
    return canReplyToConversation(current) && String(original.uid) === String(current.uid)
        && original.encryptJobId === current.encryptJobId
        && String(original.lastMsgId) === String(current.lastMsgId);
}

export function isIncomingTextMessage(message: any, source: ChatConversation, selfUid: number | string): boolean {
    return !!message && String(message.mid) === String(source.lastMsgId)
        && String(message.from?.uid) === String(source.uid)
        && String(message.to?.uid) === String(selfUid)
        && String(message.from?.uid) !== String(selfUid)
        && message.type === 1 && message.body?.type === 1 && !!message.body.text?.trim();
}

export class ManualReplyQueue {
    private readonly pending = new Set<string>();
    private readonly processed: Record<string, string>;
    private readonly save: (processed: Record<string, string>) => void;

    constructor(processed: Record<string, string>, save = (_: Record<string, string>) => {}) {
        this.processed = processed;
        this.save = save;
    }

    async run(source: ChatConversation, action: () => Promise<boolean>): Promise<'processed' | 'skipped'> {
        const key = `${source.uid}:${source.encryptJobId}`;
        const messageId = String(source.lastMsgId);
        if (!canReplyToConversation(source) || this.pending.has(key) || this.processed[key] === messageId) {
            return 'skipped';
        }
        this.pending.add(key);
        try {
            if (!await action()) return 'skipped';
            this.processed[key] = messageId;
            this.save(this.processed);
            return 'processed';
        } finally {
            this.pending.delete(key);
        }
    }
}
