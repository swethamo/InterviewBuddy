package com.swetha.backend.history;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Provides predictable interview listing and idempotent local-history imports.
public interface InterviewRepository extends JpaRepository<InterviewRecord, UUID> {
    List<InterviewRecord> findAllByOrderByCompanyAscRoleAscIdAsc();
    Optional<InterviewRecord> findByLegacyImportId(String legacyImportId);
}
