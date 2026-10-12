package com.swetha.backend.mock;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "mock_interview_sessions")
public class MockInterviewSession {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private long version;

    @Column(nullable = false)
    private UUID setupId;

    @Column(nullable = false, length = 255)
    private String company;

    @Column(nullable = false, length = 255)
    private String role;

    @Column(nullable = false, length = 255)
    private String interviewType;

    @Column(length = 255)
    private String interviewTypeOther;

    @Column(length = 20000)
    private String jobDescription;

    @Column(length = 2048)
    private String jobDescriptionUrl;

    @Column(length = 10000)
    private String instructions;

    @Column(length = 30000)
    private String resumeText;

    @Column(nullable = false)
    private int durationMinutes;

    @Column(nullable = false)
    private Instant startedAt;

    @Column(nullable = false)
    private Instant deadline;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(length = 36)
    private String currentTurnId;

    @Column(nullable = false, columnDefinition = "clob")
    private String planJson;

    @Column(nullable = false, columnDefinition = "clob")
    private String coveredTopicsJson;

    @Column(columnDefinition = "clob")
    private String reviewJson;

    @Column
    private Instant endedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequence ASC")
    private List<MockInterviewTurn> turns = new ArrayList<>();

    protected MockInterviewSession() {
    }

    public UUID getId() { return id; }
    public UUID getSetupId() { return setupId; }
    public String getCompany() { return company; }
    public String getRole() { return role; }
    public String getInterviewType() { return interviewType; }
    public String getInterviewTypeOther() { return interviewTypeOther; }
    public String getJobDescription() { return jobDescription; }
    public String getJobDescriptionUrl() { return jobDescriptionUrl; }
    public String getInstructions() { return instructions; }
    public String getResumeText() { return resumeText; }
    public int getDurationMinutes() { return durationMinutes; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getDeadline() { return deadline; }
    public String getStatus() { return status; }
    public String getCurrentTurnId() { return currentTurnId; }
    public String getPlanJson() { return planJson; }
    public String getCoveredTopicsJson() { return coveredTopicsJson; }
    public String getReviewJson() { return reviewJson; }
    public Instant getEndedAt() { return endedAt; }
    public List<MockInterviewTurn> getTurns() { return turns; }

    public void setSetupId(UUID setupId) { this.setupId = setupId; }
    public void setCompany(String company) { this.company = company; }
    public void setRole(String role) { this.role = role; }
    public void setInterviewType(String interviewType) { this.interviewType = interviewType; }
    public void setInterviewTypeOther(String interviewTypeOther) { this.interviewTypeOther = interviewTypeOther; }
    public void setJobDescription(String jobDescription) { this.jobDescription = jobDescription; }
    public void setJobDescriptionUrl(String jobDescriptionUrl) { this.jobDescriptionUrl = jobDescriptionUrl; }
    public void setInstructions(String instructions) { this.instructions = instructions; }
    public void setResumeText(String resumeText) { this.resumeText = resumeText; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public void setDeadline(Instant deadline) { this.deadline = deadline; }
    public void setStatus(String status) { this.status = status; }
    public void setCurrentTurnId(String currentTurnId) { this.currentTurnId = currentTurnId; }
    public void setPlanJson(String planJson) { this.planJson = planJson; }
    public void setCoveredTopicsJson(String coveredTopicsJson) { this.coveredTopicsJson = coveredTopicsJson; }
    public void setReviewJson(String reviewJson) { this.reviewJson = reviewJson; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }

    public void addTurn(MockInterviewTurn turn) {
        turn.setSequence(turns.size());
        turns.add(turn);
        turn.setSession(this);
    }
}
