package com.swetha.backend.answer;

public interface AnswerGenerationProvider {
    AnswerGenerationResponse generate(AnswerGenerationRequest request);
}
