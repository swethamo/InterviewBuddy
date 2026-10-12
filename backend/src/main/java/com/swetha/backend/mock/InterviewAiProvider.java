package com.swetha.backend.mock;

import com.swetha.backend.mock.MockInterviewModels.GeneratedReview;
import com.swetha.backend.mock.MockInterviewModels.Plan;
import com.swetha.backend.mock.MockInterviewModels.QuestionDecision;
import java.util.List;
import java.util.Map;

public interface InterviewAiProvider {
    Plan createPlan(Map<String, Object> context);
    QuestionDecision createQuestion(Map<String, Object> context);
    GeneratedReview createReview(Map<String, Object> context);
}
