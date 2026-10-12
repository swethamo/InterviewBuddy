package com.swetha.backend.mock;

import org.springframework.http.HttpStatus;

public class InterviewAiException extends RuntimeException {
    private final HttpStatus status;

    public InterviewAiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
