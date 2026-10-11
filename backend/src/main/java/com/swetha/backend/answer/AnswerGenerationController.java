package com.swetha.backend.answer;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/answer-guidance")
public class AnswerGenerationController {
    private final AnswerGenerationService service;

    public AnswerGenerationController(AnswerGenerationService service) {
        this.service = service;
    }

    @PostMapping
    public AnswerGenerationResponse generate(
        @Valid @RequestBody AnswerGenerationRequest request
    ) {
        return service.generate(request);
    }
}
