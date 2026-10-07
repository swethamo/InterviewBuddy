package com.swetha.backend.prep;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Receives setup API requests and delegates application logic to the service.
@RestController
@RequestMapping("/api/prep-setups")
public class InterviewSetupController {

    private final InterviewSetupService service;

    // Spring supplies the service through constructor injection.
    public InterviewSetupController(InterviewSetupService service) {
        this.service = service;
    }

    // Returns all saved setups.
    @GetMapping
    public List<InterviewSetupResponse> findAll() {
        return service.findAll();
    }

    // Reads the setup identified by the UUID in the URL.
    @GetMapping("/{id}")
    public InterviewSetupResponse findById(@PathVariable UUID id) {
        return service.findById(id);
    }

    // Validates incoming JSON and creates a setup.
    // Returns 201 Created with the new resource's URL.
    @PostMapping
    public ResponseEntity<InterviewSetupResponse> create(
        @Valid @RequestBody InterviewSetupRequest request
    ) {
        InterviewSetupResponse response = service.create(request);
        URI location = URI.create("/api/prep-setups/" + response.id());

        return ResponseEntity.created(location).body(response);
    }

    // Replaces the editable fields of an existing setup.
    @PutMapping("/{id}")
    public InterviewSetupResponse update(
        @PathVariable UUID id,
        @Valid @RequestBody InterviewSetupRequest request
    ) {
        return service.update(id, request);
    }

    // Deletes a setup and returns 204 No Content.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}