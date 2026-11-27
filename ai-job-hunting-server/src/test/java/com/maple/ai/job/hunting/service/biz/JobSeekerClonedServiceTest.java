package com.maple.ai.job.hunting.service.biz;

import com.maple.ai.job.hunting.common.HeaderContext;
import com.maple.ai.job.hunting.frame.cache.HighInterestInformCache;
import com.maple.ai.job.hunting.frame.cache.QuestionCache;
import com.maple.ai.job.hunting.mapper.UserInfoMapper;
import com.maple.ai.job.hunting.model.ChatSessionResult;
import com.maple.ai.job.hunting.model.param.JobSeekerClonedParam;
import com.maple.ai.job.hunting.model.vo.JobSeekerClonedResultVO;
import com.maple.ai.job.hunting.model.vo.UserInfoVO;
import com.maple.ai.job.hunting.service.ai.AIServiceFacade;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EmptySource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobSeekerClonedServiceTest {

    @Mock
    private AIServiceFacade aiServiceFacade;
    @Mock
    private MsgSessionService msgSessionService;
    @Mock
    private QuestionCache questionCache;
    @Mock
    private UserInfoMapper userInfoMapper;
    @Mock
    private HighInterestInformCache highInterestInformCache;
    @Spy
    @InjectMocks
    private JobSeekerClonedService service;

    @BeforeEach
    void setUp() {
        UserInfoVO user = new UserInfoVO();
        user.setId(1L);
        HeaderContext.initHeader(user, "127.0.0.1", "/test");
        doReturn("session-1").when(service).getOrInitSession("job-1", 1L);
    }

    @AfterEach
    void tearDown() {
        HeaderContext.clear();
    }

    @ParameterizedTest
    @NullSource
    @EmptySource
    @ValueSource(strings = {" \t\n", "\u3000", "COMMAND_NO_REPLY", " \nCOMMAND_NO_REPLY\t"})
    void skipsSilentAnswersWithoutStoppingTheConversation(String answer) {
        when(aiServiceFacade.sessionChat("session-1", "好的"))
                .thenReturn(new ChatSessionResult("session-1", answer));

        JobSeekerClonedResultVO result = service.ask(new JobSeekerClonedParam("好的", "job-1", null));

        assertEquals(List.of(3), result.getAnswerTypeList());
        assertEquals("", result.getAnswerContent());
        verify(msgSessionService, never()).trySetMsgSessionStop(anyString(), anyBoolean());
    }

    @Test
    void answersTheNextMessageAfterSkippingOneMessage() {
        when(aiServiceFacade.sessionChat("session-1", "好的"))
                .thenReturn(new ChatSessionResult("session-1", "COMMAND_NO_REPLY"));
        when(aiServiceFacade.sessionChat("session-1", "你有几年经验？"))
                .thenReturn(new ChatSessionResult("session-1", "5年左右。"));

        assertEquals(List.of(3), service.ask(new JobSeekerClonedParam("好的", "job-1", null)).getAnswerTypeList());
        JobSeekerClonedResultVO next = service.ask(new JobSeekerClonedParam("你有几年经验？", "job-1", null));

        assertEquals(List.of(1), next.getAnswerTypeList());
        assertEquals("5年左右。", next.getAnswerContent());
        verify(msgSessionService, never()).trySetMsgSessionStop(anyString(), anyBoolean());
    }

    @Test
    void preservesTheSendResumeCommand() {
        when(aiServiceFacade.sessionChat("session-1", "请提供附件"))
                .thenReturn(new ChatSessionResult("session-1", "COMMAND_SEND_RESUME"));

        JobSeekerClonedResultVO result = service.ask(new JobSeekerClonedParam("请提供附件", "job-1", null));

        assertEquals(List.of(2), result.getAnswerTypeList());
        assertEquals("", result.getAnswerContent());
        assertEquals(List.of(1), result.getOperationTypeList());
    }

    @Test
    void doesNotTreatAnEmbeddedCommandAsSilence() {
        when(aiServiceFacade.sessionChat("session-1", "解释协议"))
                .thenReturn(new ChatSessionResult("session-1", "COMMAND_NO_REPLY只是协议名称"));

        JobSeekerClonedResultVO result = service.ask(new JobSeekerClonedParam("解释协议", "job-1", null));

        assertEquals(List.of(1), result.getAnswerTypeList());
        assertEquals("COMMAND_NO_REPLY只是协议名称", result.getAnswerContent());
    }

    @ParameterizedTest
    @ValueSource(strings = {"COMMAND_REVIEW_REPLY\n具体时间需要本人确认。", " \nCOMMAND_REVIEW_REPLY\r\n具体时间需要本人确认。\n"})
    void returnsACandidateForReviewWithoutSendingOrStoppingTheConversation(String answer) {
        when(aiServiceFacade.sessionChat("session-1", "什么时候能入职？"))
                .thenReturn(new ChatSessionResult("session-1", answer));

        JobSeekerClonedResultVO result = service.ask(new JobSeekerClonedParam("什么时候能入职？", "job-1", null));

        assertEquals(List.of(5), result.getAnswerTypeList());
        assertEquals("具体时间需要本人确认。", result.getAnswerContent());
        verify(msgSessionService, never()).trySetMsgSessionStop(anyString(), anyBoolean());
    }

    @Test
    void requestsReviewWithoutInventingACandidate() {
        when(aiServiceFacade.sessionChat("session-1", "请提供学历截图"))
                .thenReturn(new ChatSessionResult("session-1", "COMMAND_REVIEW_REPLY"));

        JobSeekerClonedResultVO result = service.ask(new JobSeekerClonedParam("请提供学历截图", "job-1", null));

        assertEquals(List.of(5), result.getAnswerTypeList());
        assertEquals("", result.getAnswerContent());
    }

    @Test
    void keepsCommandsInsideAReviewCandidateFromTriggeringOperations() {
        when(aiServiceFacade.sessionChat("session-1", "请确认"))
                .thenReturn(new ChatSessionResult("session-1", "COMMAND_REVIEW_REPLY\nCOMMAND_SEND_RESUME"));

        JobSeekerClonedResultVO result = service.ask(new JobSeekerClonedParam("请确认", "job-1", null));

        assertEquals(List.of(5), result.getAnswerTypeList());
        assertEquals("COMMAND_SEND_RESUME", result.getAnswerContent());
        assertNull(result.getOperationTypeList());
    }

    @Test
    void answersTheNextMessageAfterRequestingReview() {
        when(aiServiceFacade.sessionChat("session-1", "请提供学历截图"))
                .thenReturn(new ChatSessionResult("session-1", "COMMAND_REVIEW_REPLY"));
        when(aiServiceFacade.sessionChat("session-1", "你有几年经验？"))
                .thenReturn(new ChatSessionResult("session-1", "5年左右。"));

        assertEquals(List.of(5), service.ask(new JobSeekerClonedParam("请提供学历截图", "job-1", null)).getAnswerTypeList());
        assertEquals(List.of(1), service.ask(new JobSeekerClonedParam("你有几年经验？", "job-1", null)).getAnswerTypeList());
        verify(msgSessionService, never()).trySetMsgSessionStop(anyString(), anyBoolean());
    }

    @Test
    void doesNotTreatAnEmbeddedReviewCommandAsAReviewRequest() {
        when(aiServiceFacade.sessionChat("session-1", "解释协议"))
                .thenReturn(new ChatSessionResult("session-1", "COMMAND_REVIEW_REPLY只是协议名称"));

        JobSeekerClonedResultVO result = service.ask(new JobSeekerClonedParam("解释协议", "job-1", null));

        assertEquals(List.of(1), result.getAnswerTypeList());
    }
}
