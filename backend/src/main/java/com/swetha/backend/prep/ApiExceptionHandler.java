package com.swetha.backend.prep;

import jakarta.validation.ConstraintViolationException;
import java.util.Objects;
import java.util.Comparator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import com.swetha.backend.answer.AnswerGenerationException;
import com.swetha.backend.mock.InterviewAiException;

// Keeps validation, lookup, and database failures consistent across API endpoints.
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(
        MethodArgumentNotValidException exception
    ) {
        FieldError fieldError = exception.getBindingResult().getFieldErrors().stream()
            .sorted(Comparator.comparing(FieldError::getField))
            .findFirst()
            .orElse(null);

        String message =
            fieldError != null && fieldError.getDefaultMessage() != null
                ? fieldError.getDefaultMessage()
                : "Please review the submitted values.";

        return ResponseEntity.badRequest()
            .body(new ApiError(400, "VALIDATION_ERROR", message));
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ApiError> handleUnreadableRequest(Exception exception) {
        return ResponseEntity.badRequest()
            .body(new ApiError(
                HttpStatus.BAD_REQUEST.value(),
                "INVALID_REQUEST",
                "The request body, date, or resource ID is invalid."
            ));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(
        ResponseStatusException exception
    ) {
        HttpStatusCode status = exception.getStatusCode();
        int code = status.value();
        String message = Objects.requireNonNullElse(exception.getReason(), "Request failed.");

        return ResponseEntity.status(status)
            .body(new ApiError(code, status.toString(), message));
    }

    @ExceptionHandler(AnswerGenerationException.class)
    public ResponseEntity<ApiError> handleAnswerGeneration(
        AnswerGenerationException exception
    ) {
        int status = exception.status().value();
        return ResponseEntity.status(exception.status())
            .body(new ApiError(status, exception.status().toString(), exception.getMessage()));
    }

    @ExceptionHandler(InterviewAiException.class)
    public ResponseEntity<ApiError> handleInterviewAi(
        InterviewAiException exception
    ) {
        int status = exception.status().value();
        return ResponseEntity.status(exception.status())
            .body(new ApiError(
                status,
                exception.status().toString(),
                exception.getMessage()
            ));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(
        ConstraintViolationException exception
    ) {
        String message = exception.getConstraintViolations().stream()
            .findFirst()
            .map(violation -> violation.getMessage())
            .orElse("Please review the submitted values.");

        return ResponseEntity.badRequest()
            .body(new ApiError(HttpStatus.BAD_REQUEST.value(), "VALIDATION_ERROR", message));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrityViolation(
        DataIntegrityViolationException exception
    ) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "DATABASE_ERROR",
                "The data could not be saved. Please try again."
            ));
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleConcurrentUpdate(
        OptimisticLockingFailureException exception
    ) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ApiError(
                HttpStatus.CONFLICT.value(),
                HttpStatus.CONFLICT.toString(),
                "This interview changed in another request. Refresh the session and try again."
            ));
    }

    public record ApiError(int status, String error, String message) {
    }
}
