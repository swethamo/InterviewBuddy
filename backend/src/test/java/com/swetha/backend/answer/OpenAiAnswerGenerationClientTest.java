package com.swetha.backend.answer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

class OpenAiAnswerGenerationClientTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void parsesStructuredResponsesApiOutput() throws Exception {
        startServer(200, """
            {
              "output": [{
                "type": "message",
                "content": [{
                  "type": "output_text",
                  "text": "{\\"suggestedAnswer\\":\\"I would measure the issue first.\\",\\"relevantKeywords\\":[\\"measurement\\"],\\"strengtheningExplanation\\":\\"Add your measured outcome.\\"}"
                }]
              }]
            }
            """);

        AnswerGenerationResponse response = createClient().generate(request("I checked logs."));

        assertEquals("I would measure the issue first.", response.suggestedAnswer());
        assertEquals(java.util.List.of("measurement"), response.relevantKeywords());
        assertEquals("Add your measured outcome.", response.strengtheningExplanation());
    }

    @Test
    void rejectsMalformedStructuredOutput() throws Exception {
        startServer(200, """
            {
              "output": [{
                "type": "message",
                "content": [{
                  "type": "output_text",
                  "text": "{\\"suggestedAnswer\\":\\"\\",\\"relevantKeywords\\":[],\\"strengtheningExplanation\\":null}"
                }]
              }]
            }
            """);

        AnswerGenerationException exception = assertThrows(
            AnswerGenerationException.class,
            () -> createClient().generate(request(null))
        );

        assertEquals(HttpStatus.BAD_GATEWAY, exception.status());
        assertEquals(
            "The AI provider returned an invalid response. Please try again.",
            exception.getMessage()
        );
    }

    @Test
    void surfacesProviderRateLimitsAsRetryableErrors() throws Exception {
        startServer(429, "{\"error\":\"rate limited\"}");

        AnswerGenerationException exception = assertThrows(
            AnswerGenerationException.class,
            () -> createClient().generate(request(null))
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.status());
        assertEquals(
            "The AI provider is rate limiting requests. Please try again shortly.",
            exception.getMessage()
        );
    }

    private void startServer(int status, String responseBody) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/responses", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, body.length);
            try (var response = exchange.getResponseBody()) {
                response.write(body);
            }
        });
        server.start();
    }

    private OpenAiAnswerGenerationClient createClient() {
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1";
        AnswerGenerationProperties properties = new AnswerGenerationProperties(
            "openai",
            "test-api-key",
            "test-model",
            baseUrl,
            Duration.ofSeconds(3)
        );
        return new OpenAiAnswerGenerationClient(properties, new ObjectMapper());
    }

    private static AnswerGenerationRequest request(String originalAnswer) {
        return new AnswerGenerationRequest(
            "Example Co",
            "Engineer",
            "Technical",
            "How do you investigate latency?",
            null,
            null,
            null,
            originalAnswer
        );
    }
}
