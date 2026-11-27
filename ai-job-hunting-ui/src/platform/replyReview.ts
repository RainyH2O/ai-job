import {ElMessageBox, ElNotification} from 'element-plus';
import logger from '../logging';

export function showReplyReview(contactName: string, question: string, draft: string,
                                onConfirm: (reply: string) => void): void {
    let reviewing = false;
    let sent = false;
    const notice = ElNotification({
        type: 'warning',
        title: '待人工审阅',
        duration: 0,
        message: `${contactName}：${question}\n点击此提醒审阅并回复。`,
        onClick: async () => {
            if (reviewing || sent) return;
            reviewing = true;
            try {
                const {value} = await ElMessageBox.prompt(question, `审阅后回复 · ${contactName}`, {
                    inputType: 'textarea',
                    inputValue: draft,
                    inputPlaceholder: '核对后填写或修改回复内容',
                    inputValidator: value => !!value?.trim() || '回复不能为空',
                    confirmButtonText: '发送',
                    cancelButtonText: '暂不发送',
                    closeOnClickModal: false,
                });
                sent = true;
                notice.close();
                onConfirm(value.trim());
            } catch (action) {
                if (action !== 'cancel' && action !== 'close') {
                    logger.error('人工审阅回复失败', action);
                }
            } finally {
                reviewing = false;
            }
        },
    });
}
