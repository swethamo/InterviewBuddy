package com.swetha.backend.answer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "answer.generation.provider=openai",
    "answer.generation.api-key=test-api-key",
    "answer.generation.model=test-model"
})
class AnswerGenerationControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AnswerGenerationProvider provider;

    @Test
    void generatesStructuredAnswerAndPassesAvailableContextToProvider() throws Exception {
        when(provider.generate(any())).thenReturn(new AnswerGenerationResponse(
            "I improved the service by measuring latency and tuning the cache.",
            List.of("latency", "cache"),
            "Add the specific before-and-after outcome from your experience."
        ));

        mockMvc.perform(post("/api/answer-guidance")
                .contentType("application/json")
                .content("""
                    {
                      "company": "Example Co",
                      "role": "Platform Engineer",
                      "round": "Technical",
                      "question": "Tell me about a performance improvement.",
                      "originalAnswer": "I improved a service."
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.suggestedAnswer").value(
                "I improved the service by measuring latency and tuning the cache."
            ))
            .andExpect(jsonPath("$.relevantKeywords[0]").value("latency"))
            .andExpect(jsonPath("$.strengtheningExplanation").value(
                "Add the specific before-and-after outcome from your experience."
            ));

        verify(provider).generate(org.mockito.ArgumentMatchers.argThat(request ->
            request.company().equals("Example Co")
                && request.role().equals("Platform Engineer")
                && request.round().equals("Technical")
                && request.originalAnswer().equals("I improved a service.")
        ));
    }

    @Test
    void rejectsBlankAndOversizedQuestionsBeforeCallingProvider() throws Exception {
        mockMvc.perform(post("/api/answer-guidance")
                .contentType("application/json")
                .content("""
                    {"company":"Example Co","role":"Engineer","question":" "}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Question is required."));

        String oversizedQuestion = "q".repeat(5001);
        mockMvc.perform(post("/api/answer-guidance")
                .contentType("application/json")
                .content("""
                    {"company":"Example Co","role":"Engineer","question":"%s"}
                    """.formatted(oversizedQuestion)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(
                "Question must be at most 5,000 characters."
            ));
    }

    @Test
    void returnsProviderFailuresWithoutLeakingProviderDetails() throws Exception {
        when(provider.generate(any())).thenThrow(new AnswerGenerationException(
            HttpStatus.BAD_GATEWAY,
            "The AI provider could not generate an answer. Please try again."
        ));

        mockMvc.perform(post("/api/answer-guidance")
                .contentType("application/json")
                .content("""
                    {"company":"Example Co","role":"Engineer","question":"Why this role?"}
                    """))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.message").value(
                "The AI provider could not generate an answer. Please try again."
            ));
    }
}
