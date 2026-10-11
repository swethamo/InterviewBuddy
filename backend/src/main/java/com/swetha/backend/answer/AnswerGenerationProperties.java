package com.swetha.backend.answer;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "answer.generation")
public record AnswerGenerationProperties(
    String provider,
    String apiKey,
    String model,
    String baseUrl,
    Duration timeout
) {
    public boolean isConfigured() {
        return "openai".equalsIgnoreCase(provider)
            && apiKey != null
            && !apiKey.isBlank()
            && model != null
            && !model.isBlank();
    }
}
