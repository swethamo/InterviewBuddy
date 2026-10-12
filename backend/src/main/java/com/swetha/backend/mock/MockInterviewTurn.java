package com.swetha.backend.mock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mock_interview_turns")
public class MockInterviewTurn {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private MockInterviewSession session;

    @Column(nullable = false)
    private int sequence;

    @Column(nullable = false, length = 255)
    private String topic;

    @Column(nullable = false, length = 5000)
    private String question;

    @Column(nullable = false, length = 16)
    private String kind;

    @Column(length = 20000)
    private String answer;

    @Column(length = 20000)
    private String draftAnswer;

    @Column
    private Instant answeredAt;

    @Column(nullable = false)
    private boolean skipped;

    protected MockInterviewTurn() {
    }

    public MockInterviewTurn(String topic, String question, String kind) {
        this.topic = topic;
        this.question = question;
        this.kind = kind;
    }

    public UUID getId() { return id; }
    public MockInterviewSession getSession() { return session; }
    public int getSequence() { return sequence; }
    public String getTopic() { return topic; }
    public String getQuestion() { return question; }
    public String getKind() { return kind; }
    public String getAnswer() { return answer; }
    public String getDraftAnswer() { return draftAnswer; }
    public Instant getAnsweredAt() { return answeredAt; }
    public boolean isSkipped() { return skipped; }

    void setSession(MockInterviewSession session) { this.session = session; }
    void setSequence(int sequence) { this.sequence = sequence; }
    public void setAnswer(String answer) { this.answer = answer; }
    public void setDraftAnswer(String draftAnswer) { this.draftAnswer = draftAnswer; }
    public void setAnsweredAt(Instant answeredAt) { this.answeredAt = answeredAt; }
    public void setSkipped(boolean skipped) { this.skipped = skipped; }
}
