package com.swetha.backend.prep;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Provides database operations for interview preparation setups.
// Spring Data creates the implementation automatically.
public interface InterviewSetupRepository
        extends JpaRepository<InterviewSetup, UUID> {
}