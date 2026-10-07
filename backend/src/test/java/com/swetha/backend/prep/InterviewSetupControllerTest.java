package com.swetha.backend.prep;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import tools.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InterviewSetupControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoSpyBean
    private InterviewSetupRepository repository;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
    }

    @Test
    void createListReadUpdateDeleteFlow() throws Exception {
        Map<String, Object> payload = Map.of(
            "company", "Example Co",
            "role", "Senior Engineer",
            "interviewType", "technical",
            "jobDescription", "Build features for customers.",
            "instructions", "Use the STAR method.",
            "resumeText", "Led two platform migrations."
        );

        String createdJson = mockMvc.perform(post("/api/prep-setups")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(payload)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.company").value("Example Co"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        String id = objectMapper.readTree(createdJson).get("id").asText();

        mockMvc.perform(get("/api/prep-setups"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)));

        mockMvc.perform(get("/api/prep-setups/{id}", id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("Senior Engineer"))
            .andExpect(jsonPath("$.resumeText").value("Led two platform migrations."));

        Map<String, Object> updatePayload = Map.of(
            "company", "Example Co",
            "role", "Principal Engineer",
            "interviewType", "hiring-manager",
            "jobDescription", "Support product delivery.",
            "instructions", "Ask about strategy.",
            "resumeText", "Scaled an internal platform."
        );

        mockMvc.perform(put("/api/prep-setups/{id}", id)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(updatePayload)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("Principal Engineer"));

        mockMvc.perform(delete("/api/prep-setups/{id}", id))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/prep-setups"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void invalidPayloadReturnsValidationError() throws Exception {
        Map<String, Object> payload = Map.of(
            "company", "",
            "role", "Senior Engineer",
            "interviewType", "unsupported"
        );

        mockMvc.perform(post("/api/prep-setups")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(payload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Company is required."));
    }

    @Test
    void missingSetupReturnsNotFound() throws Exception {
        mockMvc.perform(get("/api/prep-setups/{id}", UUID.randomUUID()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Interview setup not found."));
    }

    @Test
    void persistenceFailureReturnsServerError() throws Exception {
        doThrow(new DataIntegrityViolationException("db failure"))
            .when(repository)
            .save(any(InterviewSetup.class));

        Map<String, Object> payload = Map.of(
            "company", "Example Co",
            "role", "Senior Engineer",
            "interviewType", "technical"
        );

        mockMvc.perform(post("/api/prep-setups")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(payload)))
            .andExpect(status().isInternalServerError());
    }
}
