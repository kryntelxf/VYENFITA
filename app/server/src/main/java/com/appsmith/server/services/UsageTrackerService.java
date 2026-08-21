package com.appsmith.server.services;

import com.appsmith.server.context.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class UsageTrackerService {

    @Async
    public void trackEvent(String event, String action, Map<String, Object> properties) {
        String tenant = TenantContext.getCurrentTenant() != null ? TenantContext.getCurrentTenant() : "default";
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("tenant", tenant);
        eventData.put("event", event);
        eventData.put("action", action);
        eventData.put("timestamp", Instant.now().toString());
        eventData.put("properties", properties);
        eventData.put("environment", System.getenv().getOrDefault("APP_ENV", "development"));
        
        log.info("Usage: {}", eventData);
        
        // TODO: Send to analytics service (PostHog, Mixpanel, etc.)
        // analyticsService.track(eventData);
    }

    @Async
    public void trackApplicationCreated(String appId, String appName) {
        Map<String, Object> props = new HashMap<>();
        props.put("appId", appId);
        props.put("appName", appName);
        trackEvent("application", "created", props);
    }

    @Async
    public void trackApplicationGenerated(String description) {
        Map<String, Object> props = new HashMap<>();
        props.put("description", description.substring(0, Math.min(description.length(), 100)));
        trackEvent("ai", "application_generated", props);
    }

    @Async
    public void trackWorkflowGenerated(String description) {
        Map<String, Object> props = new HashMap<>();
        props.put("description", description.substring(0, Math.min(description.length(), 100)));
        trackEvent("ai", "workflow_generated", props);
    }
  }
