package com.swetha.backend;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// Exposes an endpoint to check that the backend responds.
@RestController
public class HealthController {

    // Returns JSON for GET requests to /api/health.
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of(
            "status", "ok",
            "message", "Interview Buddy backend is running"
        );
    }
}