package com.swetha.backend.answer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AnswerGenerationServiceTest {
    @Test
    void reportsMissingProviderConfigurationClearly() {
        AnswerGenerationProvider provider = mock(AnswerGenerationProvider.class);
        AnswerGenerationService service = new AnswerGenerationService(
            provider,
            new AnswerGenerationProperties("", "", "test-model", "", Duration.ofSeconds(2))
        );

        AnswerGenerationException exception = assertThrows(
            AnswerGenerationException.class,
            () -> service.generate(new AnswerGenerationRequest(
                "Example Co", "Engineer", null, "Why this role?",
                null, null, null, null
            ))
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.status());
        assertEquals("Answer generation is not configured.", exception.getMessage());
        verifyNoInteractions(provider);
    }
}
