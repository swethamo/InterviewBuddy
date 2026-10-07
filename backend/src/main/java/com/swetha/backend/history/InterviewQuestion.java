package com.swetha.backend.history;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

// Stores a question in a round with optional original-answer notes.
@Entity
@Table(name = "history_questions")
public class InterviewQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private InterviewRound round;

    @Column(nullable = false, length = 5000)
    private String question;

    @Column(length = 20000)
    private String originalAnswer;

    @Column(name = "question_position", nullable = false)
    private int position;

    protected InterviewQuestion() {
    }

    public UUID getId() { return id; }
    public InterviewRound getRound() { return round; }
    public String getQuestion() { return question; }
    public String getOriginalAnswer() { return originalAnswer; }
    public int getPosition() { return position; }
    public void setRound(InterviewRound round) { this.round = round; }
    public void setQuestion(String question) { this.question = question; }
    public void setOriginalAnswer(String originalAnswer) { this.originalAnswer = originalAnswer; }
    public void setPosition(int position) { this.position = position; }
}
