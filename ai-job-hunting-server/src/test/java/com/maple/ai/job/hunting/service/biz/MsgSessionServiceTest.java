package com.maple.ai.job.hunting.service.biz;

import com.maple.ai.job.hunting.common.HeaderContext;
import com.maple.ai.job.hunting.frame.cache.MsgSessionStopCache;
import com.maple.ai.job.hunting.frame.cache.SessionKeyIdCache;
import com.maple.ai.job.hunting.mapper.MsgSessionMapper;
import com.maple.ai.job.hunting.mapper.UserInfoMapper;
import com.maple.ai.job.hunting.model.bo.UserInfoDO;
import com.maple.ai.job.hunting.model.vo.UserInfoVO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MsgSessionServiceTest {
    @Mock
    private MsgSessionStopCache stopCache;
    @Mock
    private MsgSessionMapper sessionMapper;
    @Mock
    private UserInfoMapper userMapper;
    @Mock
    private SessionKeyIdCache sessionCache;
    @InjectMocks
    private MsgSessionService service;

    @BeforeEach
    void setUp() {
        UserInfoVO user = new UserInfoVO();
        user.setId(1L);
        HeaderContext.initHeader(user, "127.0.0.1", "/test");
    }

    @AfterEach
    void tearDown() {
        HeaderContext.clear();
    }

    @Test
    void resumingANewConversationClearsAnyStopWithoutAnException() {
        when(stopCache.set("new-job", false)).thenReturn(true);
        assertTrue(service.setMsgSessionStop("new-job", false));
        verify(stopCache).set("new-job", false);
    }

    @Test
    void manualRepliesDoNotRequireTheAiSeatSwitch() {
        assertFalse(service.msgSessionStop("job-1", true));
    }

    @Test
    void automaticRepliesStillRequireTheAiSeatSwitch() {
        UserInfoDO user = new UserInfoDO();
        user.setAiSeatStatus(0);
        when(userMapper.selectById(1L)).thenReturn(user);
        assertTrue(service.msgSessionStop("job-1"));
    }

    @Test
    void manualRepliesStillRespectConversationStops() {
        when(stopCache.get("job-1")).thenReturn(true);
        assertTrue(service.msgSessionStop("job-1", true));
    }

    @Test
    void manualRepliesStillRespectAnEmergencyStop() {
        service.setMsgSessionStop("globalJobKey", true);
        assertTrue(service.msgSessionStop("job-1", true));
    }
}
