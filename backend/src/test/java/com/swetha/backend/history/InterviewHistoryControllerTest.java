package com.swetha.backend.history;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

// Exercises nested history CRUD, validation, ownership, order, and cascade behavior.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InterviewHistoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InterviewRepository interviews;

    @Autowired
    private InterviewRoundRepository rounds;

    @Autowired
    private InterviewQuestionRepository questions;

    @BeforeEach
    void clearHistory() {
        interviews.deleteAll();
    }

    @Test
    void createsAndUpdatesNestedHistoryAndPreservesOrder() throws Exception {
        String interviewId = createInterview(" Example Co ", "Developer");
        String roundId = createRound(interviewId, "Technical", "2025-03-05");

        mockMvc.perform(put("/api/interviews/{id}", interviewId)
                .contentType("application/json")
                .content(json(Map.of(
                    "company", " Example Co updated ",
                    "role", "Lead Developer",
                    "resumeText", "Built platform services."
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.company").value("Example Co updated"))
            .andExpect(jsonPath("$.resumeText").value("Built platform services."));

        mockMvc.perform(put("/api/interviews/{id}/rounds/{roundId}", interviewId, roundId)
                .contentType("application/json")
                .content(json(Map.of("name", " Technical update ", "date", "2025-03-05"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Technical update"));

        String firstQuestion = createQuestion(interviewId, roundId, "First?");
        String secondQuestion = createQuestion(interviewId, roundId, "Second?");
        mockMvc.perform(post(
                    "/api/interviews/{id}/rounds/{roundId}/questions/batch",
                    interviewId,
                    roundId
                )
                .contentType("application/json")
                .content(json(Map.of(
                    "questions",
                    java.util.List.of(Map.of("question", "Third?"))
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)));

        mockMvc.perform(put(questionPath(interviewId, roundId, firstQuestion))
                .contentType("application/json")
                .content(json(Map.of(
                    "question", " First question, updated? ",
                    "originalAnswer", "  A useful example.  "
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.question").value("First question, updated?"))
            .andExpect(jsonPath("$.originalAnswer").value("A useful example."));

        mockMvc.perform(get("/api/interviews/{id}", interviewId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.company").value("Example Co updated"))
            .andExpect(jsonPath("$.role").value("Lead Developer"))
            .andExpect(jsonPath("$.rounds", hasSize(1)))
            .andExpect(jsonPath("$.rounds[0].date").value("2025-03-05"))
            .andExpect(jsonPath("$.rounds[0].questions[0].id").value(firstQuestion))
            .andExpect(jsonPath("$.rounds[0].questions[1].id").value(secondQuestion))
            .andExpect(jsonPath("$.rounds[0].questions[2].question").value("Third?"));

        mockMvc.perform(get("/api/interviews"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void rejectsInvalidRequiredFieldsAndDates() throws Exception {
        mockMvc.perform(post("/api/interviews")
                .contentType("application/json")
                .content(json(Map.of("company", " ", "role", "Developer"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Company is required."));
        mockMvc.perform(post("/api/interviews")
                .contentType("application/json")
                .content(json(Map.of(
                    "company", "A".repeat(256),
                    "role", "Developer"
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Company must be at most 255 characters."));

        String interviewId = createInterview("Example Co", "Developer");
        mockMvc.perform(post("/api/interviews/{id}/rounds", interviewId)
                .contentType("application/json")
                .content(json(Map.of("name", "   "))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Round name is required."));

        String roundId = createRound(interviewId, "Technical", "");
        mockMvc.perform(post("/api/interviews/{id}/rounds/{roundId}/questions", interviewId, roundId)
                .contentType("application/json")
                .content(json(Map.of("question", " "))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Question text is required."));

        mockMvc.perform(post("/api/interviews/{id}/rounds", interviewId)
                .contentType("application/json")
                .content("{\"name\":\"Technical\",\"date\":\"2025-02-30\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }

    @Test
    void rejectsRoundAndQuestionIdsOwnedByDifferentParents() throws Exception {
        String firstInterviewId = createInterview("First Co", "Engineer");
        String secondInterviewId = createInterview("Second Co", "Engineer");
        String roundId = createRound(firstInterviewId, "Technical", "");
        String questionId = createQuestion(firstInterviewId, roundId, "Explain a system?");

        mockMvc.perform(put("/api/interviews/{id}/rounds/{roundId}", secondInterviewId, roundId)
                .contentType("application/json")
                .content(json(Map.of("name", "Misowned"))))
            .andExpect(status().isNotFound());

        mockMvc.perform(put(questionPath(secondInterviewId, roundId, questionId))
                .contentType("application/json")
                .content(json(Map.of("question", "Updated question?"))))
            .andExpect(status().isNotFound());
    }

    @Test
    void deletesQuestionsRoundsAndInterviewsWithChildren() throws Exception {
        String interviewId = createInterview("Example Co", "Developer");
        String roundId = createRound(interviewId, "Technical", "");
        String questionId = createQuestion(interviewId, roundId, "Question?");

        mockMvc.perform(delete(questionPath(interviewId, roundId, questionId)))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/interviews/{id}", interviewId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rounds[0].questions", hasSize(0)));

        createQuestion(interviewId, roundId, "Another?");
        mockMvc.perform(delete("/api/interviews/{id}/rounds/{roundId}", interviewId, roundId))
            .andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertEquals(0, questions.count());
        mockMvc.perform(get("/api/interviews/{id}", interviewId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rounds", hasSize(0)));

        String finalRoundId = createRound(interviewId, "Final", "");
        createQuestion(interviewId, finalRoundId, "Last question?");
        mockMvc.perform(delete("/api/interviews/{id}", interviewId))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/interviews/{id}", interviewId))
            .andExpect(status().isNotFound());
        org.junit.jupiter.api.Assertions.assertEquals(0, interviews.count());
        org.junit.jupiter.api.Assertions.assertEquals(0, rounds.count());
        org.junit.jupiter.api.Assertions.assertEquals(0, questions.count());
    }

    @Test
    void repeatedLegacyImportUsesStableImportKey() throws Exception {
        Map<String, Object> payload = Map.of(
            "company", "Legacy Co",
            "role", "Designer",
            "legacyImportId", "legacy-123",
            "rounds", java.util.List.of(Map.of(
                "name", "Screen",
                "questions", java.util.List.of(Map.of("question", "Tell me about yourself?"))
            ))
        );

        String first = createFromPayload(payload);
        String secondBody = mockMvc.perform(post("/api/interviews")
                .contentType("application/json")
                .content(json(payload)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String second = objectMapper.readTree(secondBody).get("id").asText();
        org.junit.jupiter.api.Assertions.assertEquals(first, second);
        org.junit.jupiter.api.Assertions.assertEquals(1, interviews.count());
        mockMvc.perform(get("/api/interviews/{id}", first))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rounds[0].questions[0].id").isNotEmpty());
    }

    private String createInterview(String company, String role) throws Exception {
        return createFromPayload(Map.of("company", company, "role", role));
    }

    private String createFromPayload(Map<String, Object> payload) throws Exception {
        String body = mockMvc.perform(post("/api/interviews")
                .contentType("application/json")
                .content(json(payload)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    private String createRound(String interviewId, String name, String date) throws Exception {
        Map<String, Object> payload = date.isEmpty()
            ? Map.of("name", name)
            : Map.of("name", name, "date", date);
        String body = mockMvc.perform(post("/api/interviews/{id}/rounds", interviewId)
                .contentType("application/json")
                .content(json(payload)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    private String createQuestion(String interviewId, String roundId, String text)
        throws Exception {
        String body = mockMvc.perform(post("/api/interviews/{id}/rounds/{roundId}/questions",
                    interviewId, roundId)
                .contentType("application/json")
                .content(json(Map.of("question", text))))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    private String questionPath(String interviewId, String roundId, String questionId) {
        return "/api/interviews/" + interviewId + "/rounds/" + roundId
            + "/questions/" + questionId;
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
