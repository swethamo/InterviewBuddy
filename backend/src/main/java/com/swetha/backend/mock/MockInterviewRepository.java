package com.swetha.backend.mock;

import java.util.Optional;
import java.util.UUID;
import com.swetha.backend.mock.MockInterviewModels.HistorySummary;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MockInterviewRepository
    extends JpaRepository<MockInterviewSession, UUID> {
    @Query("""
        select distinct session from MockInterviewSession session
        left join fetch session.turns
        where session.id = :id
        """)
    Optional<MockInterviewSession> findWithTurnsById(@Param("id") UUID id);

    @EntityGraph(attributePaths = "turns")
    Optional<MockInterviewSession> findFirstBySetupIdOrderByStartedAtDesc(
        UUID setupId
    );

    @Query("""
        select new com.swetha.backend.mock.MockInterviewModels$HistorySummary(
            session.id,
            session.status,
            session.durationMinutes,
            session.startedAt,
            session.endedAt,
            session.company,
            session.role,
            (select count(turn.id) from MockInterviewTurn turn
                where turn.session = session and turn.answer is not null),
            (session.reviewJson is not null)
        )
        from MockInterviewSession session
        where session.setupId = :setupId
        order by session.startedAt desc
        """)
    java.util.List<HistorySummary> findHistoryBySetupId(
        @Param("setupId") UUID setupId
    );
}
