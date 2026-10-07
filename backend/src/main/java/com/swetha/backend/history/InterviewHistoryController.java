package com.swetha.backend.history;

import static com.swetha.backend.history.InterviewRequests.*;
import static com.swetha.backend.history.InterviewResponses.*;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Exposes nested interview history CRUD routes using request and response DTOs.
@RestController
@Validated
@RequestMapping("/api/interviews")
public class InterviewHistoryController {

    private final InterviewHistoryService service;

    public InterviewHistoryController(InterviewHistoryService service) {
        this.service = service;
    }

    @GetMapping
    public List<Interview> findAll() {
        return service.findAll();
    }

    @GetMapping("/{interviewId}")
    public Interview findInterview(@PathVariable UUID interviewId) {
        return service.findInterview(interviewId);
    }

    @PostMapping
    public ResponseEntity<Interview> create(
        @Valid @RequestBody InterviewCreate request
    ) {
        InterviewHistoryService.CreateResult result = service.create(request);
        URI location = URI.create("/api/interviews/" + result.interview().id());
        return ResponseEntity.status(result.created() ? 201 : 200)
            .location(location)
            .body(result.interview());
    }

    @PutMapping("/{interviewId}")
    public Interview update(
        @PathVariable UUID interviewId,
        @Valid @RequestBody InterviewUpdate request
    ) {
        return service.update(interviewId, request);
    }

    @DeleteMapping("/{interviewId}")
    public ResponseEntity<Void> delete(@PathVariable UUID interviewId) {
        service.delete(interviewId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{interviewId}/rounds")
    public ResponseEntity<Round> createRound(
        @PathVariable UUID interviewId,
        @Valid @RequestBody RoundCreate request
    ) {
        Round round = service.createRound(interviewId, request);
        return ResponseEntity.created(URI.create(
            "/api/interviews/" + interviewId + "/rounds/" + round.id()
        )).body(round);
    }

    @PutMapping("/{interviewId}/rounds/{roundId}")
    public Round updateRound(
        @PathVariable UUID interviewId,
        @PathVariable UUID roundId,
        @Valid @RequestBody RoundUpdate request
    ) {
        return service.updateRound(interviewId, roundId, request);
    }

    @DeleteMapping("/{interviewId}/rounds/{roundId}")
    public ResponseEntity<Void> deleteRound(
        @PathVariable UUID interviewId,
        @PathVariable UUID roundId
    ) {
        service.deleteRound(interviewId, roundId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{interviewId}/rounds/{roundId}/questions")
    public ResponseEntity<Question> createQuestion(
        @PathVariable UUID interviewId,
        @PathVariable UUID roundId,
        @Valid @RequestBody QuestionCreate request
    ) {
        Question question = service.createQuestion(interviewId, roundId, request);
        return ResponseEntity.created(URI.create(
            "/api/interviews/" + interviewId + "/rounds/" + roundId
                + "/questions/" + question.id()
        )).body(question);
    }

    @PostMapping("/{interviewId}/rounds/{roundId}/questions/batch")
    public List<Question> createQuestions(
        @PathVariable UUID interviewId,
        @PathVariable UUID roundId,
        @Valid @RequestBody QuestionBatch request
    ) {
        return service.createQuestions(interviewId, roundId, request);
    }

    @PutMapping("/{interviewId}/rounds/{roundId}/questions/{questionId}")
    public Question updateQuestion(
        @PathVariable UUID interviewId,
        @PathVariable UUID roundId,
        @PathVariable UUID questionId,
        @Valid @RequestBody QuestionUpdate request
    ) {
        return service.updateQuestion(interviewId, roundId, questionId, request);
    }

    @DeleteMapping("/{interviewId}/rounds/{roundId}/questions/{questionId}")
    public ResponseEntity<Void> deleteQuestion(
        @PathVariable UUID interviewId,
        @PathVariable UUID roundId,
        @PathVariable UUID questionId
    ) {
        service.deleteQuestion(interviewId, roundId, questionId);
        return ResponseEntity.noContent().build();
    }
}
