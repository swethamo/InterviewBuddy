package com.swetha.backend.mock;

import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swetha.backend.mock.MockInterviewModels.AnswerFeedback;
import com.swetha.backend.mock.MockInterviewModels.GeneratedReview;
import com.swetha.backend.mock.MockInterviewModels.Plan;
import com.swetha.backend.mock.MockInterviewModels.QuestionDecision;
import com.swetha.backend.mock.MockInterviewModels.SubmittedAnswerFeedback;
import com.swetha.backend.mock.MockInterviewModels.Topic;
import com.swetha.backend.prep.InterviewSetupRequest;
import com.swetha.backend.prep.InterviewSetupRepository;
import com.swetha.backend.prep.InterviewSetupService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "answer.generation.provider=openai",
    "answer.generation.api-key=test-api-key",
    "answer.generation.model=test-model"
})
class MockInterviewControllerTest {
    private static final Plan PLAN = new Plan(List.of(
        new Topic("Background", "Career scope and role fit.", "introductory"),
        new Topic("Technical depth", "Explain role-relevant decisions.", "intermediate"),
        new Topic("Collaboration", "Explore working with partners.", "intermediate")
    ));

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InterviewSetupService setupService;

    @Autowired
    private InterviewSetupRepository setupRepository;

    @Autowired
    private MockInterviewRepository sessionRepository;

    @MockitoBean
    private InterviewAiProvider aiProvider;

    @BeforeEach
    void setUp() {
        sessionRepository.deleteAll();
        setupRepository.deleteAll();
        reset(aiProvider);
    }

    @Test
    void startsAndRestoresOnePersistedQuestionWithTheSavedResumeContext() throws Exception {
        UUID setupId = createSetup();
        when(aiProvider.createPlan(anyMap())).thenReturn(PLAN);
        when(aiProvider.createQuestion(anyMap())).thenReturn(
            new QuestionDecision(
                "ADVANCE",
                "Background",
                "What brings you to this role?"
            )
        );

        String response = mockMvc.perform(post("/api/mock-interviews")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                    "setupId", setupId,
                    "durationMinutes", 15
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
            .andExpect(jsonPath("$.durationMinutes").value(15))
            .andExpect(jsonPath("$.currentQuestion").value(
                "What brings you to this role?"
            ))
            .andExpect(jsonPath("$.totalTopics").value(3))
            .andExpect(jsonPath("$.conversation.length()").value(1))
            .andExpect(jsonPath("$.planJson").doesNotExist())
            .andReturn()
            .getResponse()
            .getContentAsString();
        String sessionId = objectMapper.readTree(response).get("id").asString();

        verify(aiProvider).createPlan(org.mockito.ArgumentMatchers.argThat(context ->
            "Built a payments service.".equals(context.get("resumeText"))
                && "Build payment APIs.".equals(context.get("jobDescription"))
                && "Keep examples concise.".equals(context.get("additionalInstructions"))
        ));

        mockMvc.perform(get("/api/mock-interviews/latest")
                .param("setupId", setupId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(sessionId))
            .andExpect(jsonPath("$.currentQuestion").value(
                "What brings you to this role?"
            ));

        mockMvc.perform(get("/api/mock-interviews/sessions")
                .param("setupId", setupId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].answersSubmitted").value(0))
            .andExpect(jsonPath("$[0].reviewAvailable").value(false));
    }

    @Test
    void reportsNoContentWhenASetupHasNoPreviousMockInterview() throws Exception {
        UUID setupId = createSetup();
        mockMvc.perform(get("/api/mock-interviews/latest")
                .param("setupId", setupId.toString()))
            .andExpect(status().isNoContent());
    }

    @Test
    void savesAnswerGroundedReviewAndExposesItInPastSessionSummaries() throws Exception {
        UUID setupId = createSetup();
        when(aiProvider.createPlan(anyMap())).thenReturn(PLAN);
        when(aiProvider.createQuestion(anyMap()))
            .thenReturn(new QuestionDecision("ADVANCE", "Background", "Opening?"))
            .thenReturn(new QuestionDecision(
                "ADVANCE",
                "Technical depth",
                "How did you test the service?"
            ));
        String sessionId = startSession(setupId);
        String answeredQuestionId = activeQuestionId(sessionId);
        mockMvc.perform(post("/api/mock-interviews/{id}/answers", sessionId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                    "questionId", answeredQuestionId,
                    "answer", "I added contract and failure-path tests."
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currentQuestion").value(
                "How did you test the service?"
            ));

        when(aiProvider.createReview(anyMap())).thenReturn(new GeneratedReview(
            "You gave a specific answer about testing.",
            List.of("You mentioned concrete testing approaches."),
            List.of("Explain which failure path mattered most."),
            List.of(new SubmittedAnswerFeedback(
                UUID.fromString(answeredQuestionId),
                new AnswerFeedback(
                    "The answer addresses the testing question.",
                    "The sentence is direct.",
                    "It names two kinds of testing.",
                    "The answer makes no technical claim that needs correction.",
                    "Give one example of a failure-path test and its result."
                )
            ))
        ));

        mockMvc.perform(post("/api/mock-interviews/{id}/end", sessionId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.review.summary").value(
                "You gave a specific answer about testing."
            ))
            .andExpect(jsonPath("$.review.turns[0].feedback.improvement").value(
                "Give one example of a failure-path test and its result."
            ));
        mockMvc.perform(get("/api/mock-interviews/sessions")
                .param("setupId", setupId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].reviewAvailable").value(true))
            .andExpect(jsonPath("$[0].answersSubmitted").value(1));
    }

    @Test
    void preservesSubmittedAnswersWhenQuestionGenerationFailsAndAllowsRetry() throws Exception {
        UUID setupId = createSetup();
        when(aiProvider.createPlan(anyMap())).thenReturn(PLAN);
        when(aiProvider.createQuestion(anyMap()))
            .thenReturn(new QuestionDecision("ADVANCE", "Background", "Opening question?"))
            .thenThrow(new InterviewAiException(
                HttpStatus.BAD_GATEWAY,
                "The AI provider could not complete this interview step. Please try again."
            ));
        String sessionId = startSession(setupId);
        String questionId = activeQuestionId(sessionId);

        mockMvc.perform(post("/api/mock-interviews/{id}/answers", sessionId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                    "questionId", questionId,
                    "answer", "I built a payments service."
                ))))
            .andExpect(status().isBadGateway());

        mockMvc.perform(get("/api/mock-interviews/{id}", sessionId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
            .andExpect(jsonPath("$.currentQuestion").doesNotExist())
            .andExpect(jsonPath("$.conversation[0].answer").value(
                "I built a payments service."
            ));

        doReturn(new QuestionDecision(
            "ADVANCE",
            "Technical depth",
            "How did you test the service?"
        )).when(aiProvider).createQuestion(anyMap());
        mockMvc.perform(post("/api/mock-interviews/{id}/continue", sessionId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.conversation.length()").value(2))
            .andExpect(jsonPath("$.currentTopic").value("Technical depth"));
    }

    @Test
    void capsFollowUpsAndMovesToAnUncoveredPlannedTopic() throws Exception {
        UUID setupId = createSetup();
        when(aiProvider.createPlan(anyMap())).thenReturn(PLAN);
        when(aiProvider.createQuestion(anyMap()))
            .thenReturn(new QuestionDecision("ADVANCE", "Background", "Opening?"))
            .thenReturn(new QuestionDecision("FOLLOW_UP", "Background", "A follow-up?"))
            .thenReturn(new QuestionDecision("FOLLOW_UP", "Background", "A second follow-up?"))
            .thenReturn(new QuestionDecision("FOLLOW_UP", "Background", "A third follow-up?"));
        String sessionId = startSession(setupId);

        for (int questionNumber = 0; questionNumber < 3; questionNumber += 1) {
            String questionId = activeQuestionId(sessionId);
            var result = mockMvc.perform(post("/api/mock-interviews/{id}/answers", sessionId)
                    .contentType("application/json")
                    .content(objectMapper.writeValueAsString(Map.of(
                        "questionId", questionId,
                        "answer", "A specific, relevant answer."
                    ))))
                .andReturn();
            if (questionNumber < 2) {
                org.junit.jupiter.api.Assertions.assertEquals(
                    200,
                    result.getResponse().getStatus()
                );
            } else {
                org.junit.jupiter.api.Assertions.assertEquals(
                    502,
                    result.getResponse().getStatus()
                );
            }
        }

        String response = mockMvc.perform(get("/api/mock-interviews/{id}", sessionId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.conversation.length()").value(3))
            .andExpect(jsonPath("$.conversation[2].answer").value(
                "A specific, relevant answer."
            ))
            .andReturn()
            .getResponse()
            .getContentAsString();
        String finalQuestionId = objectMapper.readTree(response)
            .get("conversation").get(2).get("id").asString();

        doReturn(new QuestionDecision(
            "ADVANCE",
            "Technical depth",
            "How did you test the service?"
        )).when(aiProvider).createQuestion(anyMap());
        mockMvc.perform(post("/api/mock-interviews/{id}/continue", sessionId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currentQuestionKind").value("MAIN"))
            .andExpect(jsonPath("$.currentTopic").value("Technical depth"))
            .andExpect(jsonPath("$.followUpsUsed").value(0));
        org.junit.jupiter.api.Assertions.assertNotNull(finalQuestionId);
    }

    @Test
    void expiresOnThePersistedDeadlineAndKeepsAnUnsubmittedDraftOutOfFeedback() throws Exception {
        UUID setupId = createSetup();
        when(aiProvider.createPlan(anyMap())).thenReturn(PLAN);
        when(aiProvider.createQuestion(anyMap())).thenReturn(
            new QuestionDecision("ADVANCE", "Background", "Opening?")
        );
        String sessionId = startSession(setupId);
        String questionId = activeQuestionId(sessionId);
        MockInterviewSession entity = sessionRepository
            .findWithTurnsById(UUID.fromString(sessionId))
            .orElseThrow();
        entity.setDeadline(Instant.now().minusSeconds(1));
        sessionRepository.saveAndFlush(entity);

        mockMvc.perform(get("/api/mock-interviews/{id}", sessionId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("EXPIRED"))
            .andExpect(jsonPath("$.currentQuestion").doesNotExist());

        mockMvc.perform(put("/api/mock-interviews/{id}/draft", sessionId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                    "questionId", questionId,
                    "answer", "A draft that was not submitted."
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.conversation[0].draftAnswer").value(
                "A draft that was not submitted."
            ))
            .andExpect(jsonPath("$.conversation[0].answer").doesNotExist());

        when(aiProvider.createReview(anyMap())).thenReturn(new GeneratedReview(
            "The interview ended before an answer was submitted.",
            List.of("You completed the setup."),
            List.of("Try answering the questions you did not reach."),
            List.of()
        ));
        mockMvc.perform(post("/api/mock-interviews/{id}/review", sessionId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.review.turns[0].answer").doesNotExist())
            .andExpect(jsonPath("$.review.turns[0].feedback").doesNotExist())
            .andExpect(jsonPath("$.review.turns[0].draftAnswer").value(
                "A draft that was not submitted."
            ))
            .andExpect(jsonPath("$.review.topicsNotReached.length()").value(2));
    }

    private UUID createSetup() {
        return setupService.create(new InterviewSetupRequest(
            "Contoso",
            "Backend Engineer",
            "technical",
            "",
            "Build payment APIs.",
            "",
            "Keep examples concise.",
            "resume.pdf",
            "Built a payments service."
        )).id();
    }

    private String startSession(UUID setupId) throws Exception {
        String response = mockMvc.perform(post("/api/mock-interviews")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                    "setupId", setupId,
                    "durationMinutes", 15
                ))))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(response).get("id").asString();
    }

    private String activeQuestionId(String sessionId) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(
                "/api/mock-interviews/{id}",
                sessionId
            ))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString())
            .get("currentQuestionId")
            .asString();
    }
}
