package com.swetha.backend.history;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Provides direct lookups for question ownership checks.
public interface InterviewQuestionRepository extends JpaRepository<InterviewQuestion, UUID> {
}
