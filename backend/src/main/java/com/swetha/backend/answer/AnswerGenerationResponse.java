package com.swetha.backend.answer;

import java.util.List;

public record AnswerGenerationResponse(
    String suggestedAnswer,
    List<String> relevantKeywords,
    String strengtheningExplanation
) {
}
