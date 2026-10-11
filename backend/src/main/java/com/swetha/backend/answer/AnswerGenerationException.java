package com.swetha.backend.answer;

import org.springframework.http.HttpStatus;

public class AnswerGenerationException extends RuntimeException {
    private final HttpStatus status;

    public AnswerGenerationException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
