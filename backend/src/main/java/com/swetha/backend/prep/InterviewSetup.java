package com.swetha.backend.prep;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

// Maps an interview preparation setup to a database row.
@Entity
@Table(name = "interview_setups")
public class InterviewSetup {

    // The database record's unique identifier, generated when first saved.
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Core interview details.
    @Column(nullable = false)
    private String company;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private String interviewType;

    // Additional description when the interview type is "other".
    private String interviewTypeOther;

    // Longer text fields need more space than a default string column.
    @Column(length = 20000)
    private String jobDescription;

    @Column(length = 2048)
    private String jobDescriptionUrl;

    @Column(length = 10000)
    private String instructions;

    // Stores resume metadata and text; it does not store an uploaded file.
    private String resumeFileName;

    @Column(length = 30000)
    private String resumeText;

    // JPA requires a no-argument constructor to create entity instances.
    protected InterviewSetup() {
    }

    // Getters expose the entity's current values.
    public UUID getId() {
        return id;
    }

    public String getCompany() {
        return company;
    }

    public String getRole() {
        return role;
    }

    public String getInterviewType() {
        return interviewType;
    }

    public String getInterviewTypeOther() {
        return interviewTypeOther;
    }

    public String getJobDescription() {
        return jobDescription;
    }

    public String getJobDescriptionUrl() {
        return jobDescriptionUrl;
    }

    public String getInstructions() {
        return instructions;
    }

    public String getResumeFileName() {
        return resumeFileName;
    }

    public String getResumeText() {
        return resumeText;
    }

    // Setters allow the service to populate or update editable fields.
    public void setCompany(String company) {
        this.company = company;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public void setInterviewType(String interviewType) {
        this.interviewType = interviewType;
    }

    public void setInterviewTypeOther(String interviewTypeOther) {
        this.interviewTypeOther = interviewTypeOther;
    }

    public void setJobDescription(String jobDescription) {
        this.jobDescription = jobDescription;
    }

    public void setJobDescriptionUrl(String jobDescriptionUrl) {
        this.jobDescriptionUrl = jobDescriptionUrl;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public void setResumeFileName(String resumeFileName) {
        this.resumeFileName = resumeFileName;
    }

    public void setResumeText(String resumeText) {
        this.resumeText = resumeText;
    }
}