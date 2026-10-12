package com.swetha.backend.mock;

import static com.swetha.backend.mock.MockInterviewModels.*;
import static com.swetha.backend.mock.MockInterviewRequests.*;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mock-interviews")
public class MockInterviewController {
    private final MockInterviewService service;

    public MockInterviewController(MockInterviewService service) {
        this.service = service;
    }

    @GetMapping("/availability")
    public Availability availability() {
        return service.availability();
    }

    @GetMapping("/latest")
    public ResponseEntity<Session> latest(@RequestParam UUID setupId) {
        Session session = service.latest(setupId);
        return session == null
            ? ResponseEntity.noContent().build()
            : ResponseEntity.ok(session);
    }

    @GetMapping("/sessions")
    public java.util.List<HistorySummary> history(@RequestParam UUID setupId) {
        return service.history(setupId);
    }

    @PostMapping
    public Session start(@Valid @RequestBody Start request) {
        return service.start(request.setupId(), request.durationMinutes());
    }

    @GetMapping("/{sessionId}")
    public Session get(@PathVariable UUID sessionId) {
        return service.get(sessionId);
    }

    @PutMapping("/{sessionId}/draft")
    public Session saveDraft(
        @PathVariable UUID sessionId,
        @Valid @RequestBody Answer request
    ) {
        return service.saveDraft(
            sessionId,
            request.questionId(),
            request.answer()
        );
    }

    @PostMapping("/{sessionId}/answers")
    public Session answer(
        @PathVariable UUID sessionId,
        @Valid @RequestBody Answer request
    ) {
        return service.answer(
            sessionId,
            request.questionId(),
            request.answer()
        );
    }

    @PostMapping("/{sessionId}/skip")
    public Session skip(
        @PathVariable UUID sessionId,
        @Valid @RequestBody Skip request
    ) {
        return service.skip(sessionId, request.questionId());
    }

    @PostMapping("/{sessionId}/continue")
    public Session continueInterview(@PathVariable UUID sessionId) {
        return service.continueInterview(sessionId);
    }

    @PostMapping("/{sessionId}/end")
    public Session end(@PathVariable UUID sessionId) {
        return service.end(sessionId);
    }

    @PostMapping("/{sessionId}/review")
    public Session review(@PathVariable UUID sessionId) {
        return service.review(sessionId);
    }
}
