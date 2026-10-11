package com.swetha.backend.answer;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AnswerGenerationService {
    private final AnswerGenerationProvider provider;
    private final AnswerGenerationProperties properties;

    public AnswerGenerationService(
        AnswerGenerationProvider provider,
        AnswerGenerationProperties properties
    ) {
        this.provider = provider;
        this.properties = properties;
    }

    public AnswerGenerationResponse generate(AnswerGenerationRequest request) {
        if (properties.provider() != null
            && !properties.provider().isBlank()
            && !"openai".equalsIgnoreCase(properties.provider())) {
            throw new AnswerGenerationException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "The configured answer generation provider is not supported."
            );
        }

        if (!properties.isConfigured()) {
            throw new AnswerGenerationException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Answer generation is not configured."
            );
        }

        return provider.generate(request);
    }
}
