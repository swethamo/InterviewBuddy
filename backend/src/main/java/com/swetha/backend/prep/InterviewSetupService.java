package com.swetha.backend.prep;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

// Handles setup CRUD, input normalization, and application rules.
@Service
@Transactional(readOnly = true)
public class InterviewSetupService {

    private final InterviewSetupRepository repository;

    // Spring injects the repository through this constructor.
    public InterviewSetupService(InterviewSetupRepository repository) {
        this.repository = repository;
    }

    // Returns all saved setups as API response objects.
    public List<InterviewSetupResponse> findAll() {
        return repository.findAll()
            .stream()
            .map(InterviewSetupResponse::from)
            .toList();
    }

    // Returns one setup, or reports that it does not exist.
    public InterviewSetupResponse findById(UUID id) {
        return InterviewSetupResponse.from(requireSetup(id));
    }

    // Creates a new setup; the persistence layer generates its ID.
    @Transactional
    public InterviewSetupResponse create(InterviewSetupRequest request) {
        InterviewSetup setup = new InterviewSetup();
        applyRequest(setup, request);

        return InterviewSetupResponse.from(repository.save(setup));
    }

    private static final java.util.Set<String> SUPPORTED_INTERVIEW_TYPES =
        java.util.Set.of(
            "recruiter-call",
            "hiring-manager",
            "technical",
            "behavioral",
            "live-coding",
            "assessment",
            "other"
        );

    // Replaces the editable fields of an existing setup.
    @Transactional
    public InterviewSetupResponse update(
        UUID id,
        InterviewSetupRequest request
    ) {
        InterviewSetup setup = requireSetup(id);
        applyRequest(setup, request);

        return InterviewSetupResponse.from(repository.save(setup));
    }

    // Deletes an existing setup, returning 404 for an unknown ID.
    @Transactional
    public void delete(UUID id) {
        InterviewSetup setup = requireSetup(id);
        repository.delete(setup);
    }

    // Centralizes the lookup used by read, update, and delete operations.
    private InterviewSetup requireSetup(UUID id) {
        return repository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Interview setup not found."
            ));
    }

    // Normalizes input and validates context before changing the entity.
    private void applyRequest(
        InterviewSetup setup,
        InterviewSetupRequest request
    ) {
        String company = clean(request.company());
        String role = clean(request.role());
        String interviewType = clean(request.interviewType());
        String otherType = clean(request.interviewTypeOther());
        String jobDescriptionUrl = clean(request.jobDescriptionUrl());

        validateRequiredField(company, "Company is required.");
        validateRequiredField(role, "Role is required.");
        validateInterviewType(interviewType);
        validateJobDescriptionUrl(jobDescriptionUrl);

        if (!"other".equals(interviewType)) {
            otherType = "";
        }

        // Copy the validated and normalized fields into the entity.
        setup.setCompany(company);
        setup.setRole(role);
        setup.setInterviewType(interviewType);
        setup.setInterviewTypeOther(otherType);
        setup.setJobDescription(clean(request.jobDescription()));
        setup.setJobDescriptionUrl(jobDescriptionUrl);
        setup.setInstructions(clean(request.instructions()));
        setup.setResumeFileName(clean(request.resumeFileName()));
        setup.setResumeText(clean(request.resumeText()));
    }

    // Treat omitted optional strings as empty and remove surrounding whitespace.
    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private void validateRequiredField(String value, String message) {
        if (value.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private void validateInterviewType(String value) {
        if (!SUPPORTED_INTERVIEW_TYPES.contains(value)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Choose a supported interview type."
            );
        }
    }

    // Accept an empty link or an absolute HTTP/HTTPS URL with a host.
    // This checks URL structure; it does not fetch the page.
    private void validateJobDescriptionUrl(String value) {
        if (value.isEmpty()) {
            return;
        }

        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();

            boolean allowedScheme =
                "http".equalsIgnoreCase(scheme) ||
                "https".equalsIgnoreCase(scheme);

            if (!allowedScheme ||
                uri.getHost() == null ||
                uri.getUserInfo() != null) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Job description link must be an HTTP or HTTPS URL without embedded credentials."
                );
            }
        } catch (URISyntaxException exception) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Job description link is invalid."
            );
        }
    }
}