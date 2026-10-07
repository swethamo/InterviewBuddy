package com.swetha.backend.history;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// Stores one ordered round belonging to an interview and owns its questions.
@Entity
@Table(name = "history_rounds")
public class InterviewRound {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private InterviewRecord interview;

    @Column(nullable = false, length = 255)
    private String name;

    private LocalDate date;

    @OneToMany(mappedBy = "round", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<InterviewQuestion> questions = new ArrayList<>();

    @Column(name = "round_position", nullable = false)
    private int position;

    protected InterviewRound() {
    }

    public UUID getId() { return id; }
    public InterviewRecord getInterview() { return interview; }
    public String getName() { return name; }
    public LocalDate getDate() { return date; }
    public List<InterviewQuestion> getQuestions() { return questions; }
    public int getPosition() { return position; }
    public void setInterview(InterviewRecord interview) { this.interview = interview; }
    public void setName(String name) { this.name = name; }
    public void setDate(LocalDate date) { this.date = date; }
    public void setPosition(int position) { this.position = position; }

    public void addQuestion(InterviewQuestion question) {
        question.setPosition(questions.size());
        questions.add(question);
        question.setRound(this);
    }

    public void removeQuestion(InterviewQuestion question) {
        if (questions.remove(question)) {
            for (int index = 0; index < questions.size(); index++) {
                questions.get(index).setPosition(index);
            }
        }
    }
}
