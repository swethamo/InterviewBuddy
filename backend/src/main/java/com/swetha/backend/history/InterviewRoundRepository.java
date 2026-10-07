package com.swetha.backend.history;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Provides direct lookups for round ownership checks.
public interface InterviewRoundRepository extends JpaRepository<InterviewRound, UUID> {
}
