package com.appsmith.server.services;

import com.appsmith.server.domains.AIRequest;
import com.appsmith.server.domains.AIResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AIService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${appsmith.ai.service.url:http://localhost:3001}")
    private String aiServiceUrl;

    @Value("${appsmith.ai.api.key:vyenfita-default-key}")
    private String aiApiKey;

    @Value("${appsmith.ai.enabled:false}")
    private boolean aiEnabled;

    /**
     * Generate application from description
     */
    public AIResponse generateApplication(String description, Map<String, Object> context) {
        if (!aiEnabled) {
            log.warn("AI service is disabled");
            return AIResponse.builder()
                .success(false)
                .error("AI service is disabled")
                .build();
        }

        try {
            String url = aiServiceUrl + "/api/v1/ai/generate-application";
            
            Map<String, Object> request = new HashMap<>();
            request.put("description", description);
            request.put("context", context);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + aiApiKey);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<JsonNode> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                JsonNode.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode data = response.getBody().get("data");
                if (data != null) {
                    return AIResponse.builder()
                        .success(true)
                        .data(data)
                        .build();
                }
            }

            return AIResponse.builder()
                .success(false)
                .error("Failed to generate application")
                .build();

        } catch (HttpClientErrorException e) {
            log.error("AI service error: {}", e.getResponseBodyAsString());
            return AIResponse.builder()
                .success(false)
                .error("AI service error: " + e.getMessage())
                .build();
        } catch (Exception e) {
            log.error("Error calling AI service", e);
            return AIResponse.builder()
                .success(false)
                .error("Error: " + e.getMessage())
                .build();
        }
    }

    /**
     * Generate workflow from description
     */
    public AIResponse generateWorkflow(String description) {
        if (!aiEnabled) {
            log.warn("AI service is disabled");
            return AIResponse.builder()
                .success(false)
                .error("AI service is disabled")
                .build();
        }

        try {
            String url = aiServiceUrl + "/api/v1/ai/generate-workflow";
            
            Map<String, String> request = new HashMap<>();
            request.put("description", description);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + aiApiKey);

            HttpEntity<Map<String, String>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<JsonNode> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                JsonNode.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode data = response.getBody().get("data");
                if (data != null) {
                    return AIResponse.builder()
                        .success(true)
                        .data(data)
                        .build();
                }
            }

            return AIResponse.builder()
                .success(false)
                .error("Failed to generate workflow")
                .build();

        } catch (HttpClientErrorException e) {
            log.error("AI service error: {}", e.getResponseBodyAsString());
            return AIResponse.builder()
                .success(false)
                .error("AI service error: " + e.getMessage())
                .build();
        } catch (Exception e) {
            log.error("Error calling AI service", e);
            return AIResponse.builder()
                .success(false)
                .error("Error: " + e.getMessage())
                .build();
        }
    }

    /**
     * Chat with AI
     */
    public AIResponse chat(String userMessage, String systemPrompt) {
        if (!aiEnabled) {
            log.warn("AI service is disabled");
            return AIResponse.builder()
                .success(false)
                .error("AI service is disabled")
                .build();
        }

        try {
            String url = aiServiceUrl + "/api/v1/ai/chat";
            
            Map<String, Object> request = new HashMap<>();
            request.put("messages", new Object[]{
                Map.of("role", "system", "content", systemPrompt != null ? systemPrompt : "You are a helpful assistant"),
                Map.of("role", "user", "content", userMessage)
            });

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + aiApiKey);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<JsonNode> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                JsonNode.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode data = response.getBody().get("data");
                if (data != null) {
                    return AIResponse.builder()
                        .success(true)
                        .data(data)
                        .build();
                }
            }

            return AIResponse.builder()
                .success(false)
                .error("Failed to get chat response")
                .build();

        } catch (HttpClientErrorException e) {
            log.error("AI service error: {}", e.getResponseBodyAsString());
            return AIResponse.builder()
                .success(false)
                .error("AI service error: " + e.getMessage())
                .build();
        } catch (Exception e) {
            log.error("Error calling AI service", e);
            return AIResponse.builder()
                .success(false)
                .error("Error: " + e.getMessage())
                .build();
        }
    }

    /**
     * Check if AI service is healthy
     */
    public boolean healthCheck() {
        if (!aiEnabled) {
            return false;
        }

        try {
            String url = aiServiceUrl + "/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("AI service health check failed: {}", e.getMessage());
            return false;
        }
    }
              }
