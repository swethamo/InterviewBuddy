package com.swetha.backend.history;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// Stores an interview history record and owns its ordered rounds.
@Entity
@Table(
    name = "history_interviews",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_history_legacy_import_id",
        columnNames = "legacy_import_id"
    )
)
public class InterviewRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String company;

    @Column(nullable = false, length = 255)
    private String role;

    @Column(length = 30000)
    private String resumeText;

    @Column(name = "legacy_import_id", length = 255)
    private String legacyImportId;

    @OneToMany(mappedBy = "interview", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<InterviewRound> rounds = new ArrayList<>();

    protected InterviewRecord() {
    }

    public UUID getId() { return id; }
    public String getCompany() { return company; }
    public String getRole() { return role; }
    public String getResumeText() { return resumeText; }
    public String getLegacyImportId() { return legacyImportId; }
    public List<InterviewRound> getRounds() { return rounds; }
    public void setCompany(String company) { this.company = company; }
    public void setRole(String role) { this.role = role; }
    public void setResumeText(String resumeText) { this.resumeText = resumeText; }
    public void setLegacyImportId(String legacyImportId) { this.legacyImportId = legacyImportId; }

    public void addRound(InterviewRound round) {
        round.setPosition(rounds.size());
        rounds.add(round);
        round.setInterview(this);
    }

    public void removeRound(InterviewRound round) {
        if (rounds.remove(round)) {
            for (int index = 0; index < rounds.size(); index++) {
                rounds.get(index).setPosition(index);
            }
        }
    }
}
