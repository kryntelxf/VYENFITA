package com.appsmith.server.controllers;

import com.appsmith.server.domains.AIResponse;
import com.appsmith.server.services.AIService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AIController {

    private final AIService aiService;

    @PostMapping("/generate-application")
    public Mono<AIResponse> generateApplication(
            @RequestBody Map<String, Object> request) {
        String description = (String) request.get("description");
        Map<String, Object> context = (Map<String, Object>) request.get("context");
        
        return Mono.just(aiService.generateApplication(description, context));
    }

    @PostMapping("/generate-workflow")
    public Mono<AIResponse> generateWorkflow(
            @RequestBody Map<String, String> request) {
        String description = request.get("description");
        return Mono.just(aiService.generateWorkflow(description));
    }

    @PostMapping("/chat")
    public Mono<AIResponse> chat(
            @RequestBody Map<String, Object> request) {
        String message = (String) request.get("message");
        String systemPrompt = (String) request.get("systemPrompt");
        return Mono.just(aiService.chat(message, systemPrompt));
    }

    @GetMapping("/health")
    public Mono<Map<String, Object>> health() {
        boolean healthy = aiService.healthCheck();
        return Mono.just(Map.of(
            "status", healthy ? "ok" : "unavailable",
            "enabled", true
        ));
    }
}
