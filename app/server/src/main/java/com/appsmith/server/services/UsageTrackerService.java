package com.appsmith.server.services;

import com.appsmith.server.context.TenantContext;
import com.appsmith.server.domains.Analytics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class UsageTrackerService {

    private final AnalyticsService analyticsService;

    @Async
    public void trackEvent(String event, String action, Map<String, Object> properties) {
        String tenant = TenantContext.getCurrentTenant() != null ? TenantContext.getCurrentTenant() : "default";
        
        Analytics analytics = Analytics.builder()
            .tenantId(tenant)
            .eventType(event)
            .action(action)
            .properties(properties)
            .timestamp(java.time.Instant.now())
            .success(true)
            .build();
        
        analyticsService.track(analytics);
    }

    @Async
    public void trackApplicationCreated(String appId, String appName) {
        Map<String, Object> props = new HashMap<>();
        props.put("appId", appId);
        props.put("appName", appName);
        trackEvent("application", "created", props);
    }

    @Async
    public void trackApplicationGenerated(String description, String provider, String model, int tokensUsed) {
        Map<String, Object> props = new HashMap<>();
        props.put("description", description.substring(0, Math.min(description.length(), 100)));
        props.put("provider", provider);
        props.put("model", model);
        props.put("tokensUsed", tokensUsed);
        trackEvent("ai", "application_generated", props);
    }

    @Async
    public void trackWorkflowGenerated(String description, String provider, String model, int tokensUsed) {
        Map<String, Object> props = new HashMap<>();
        props.put("description", description.substring(0, Math.min(description.length(), 100)));
        props.put("provider", provider);
        props.put("model", model);
        props.put("tokensUsed", tokensUsed);
        trackEvent("ai", "workflow_generated", props);
    }

    @Async
    public void trackUserLogin(String userId) {
        Map<String, Object> props = new HashMap<>();
        props.put("userId", userId);
        trackEvent("user", "login", props);
    }

    @Async
    public void trackUserSignup(String userId) {
        Map<String, Object> props = new HashMap<>();
        props.put("userId", userId);
        trackEvent("user", "signup", props);
    }

    @Async
    public void trackPayment(String userId, String plan, double amount) {
        Map<String, Object> props = new HashMap<>();
        props.put("userId", userId);
        props.put("plan", plan);
        props.put("amount", amount);
        trackEvent("payment", "completed", props);
    }
            }
