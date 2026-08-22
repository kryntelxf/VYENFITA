package com.appsmith.server.services;

import com.appsmith.server.context.TenantContext;
import com.appsmith.server.domains.Analytics;
import com.appsmith.server.repositories.AnalyticsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VYENFITAAnalyticsService {

    private final AnalyticsRepository analyticsRepository;

    @Async
    public void track(Analytics analytics) {
        try {
            String tenantId = TenantContext.getCurrentTenant();
            if (tenantId == null) tenantId = "default";
            analytics.setTenantId(tenantId);
            analytics.setTimestamp(Instant.now());
            analyticsRepository.save(analytics);
            log.debug("Analytics tracked: {}", analytics.getEventType());
        } catch (Exception e) {
            log.error("Failed to track analytics: {}", e.getMessage());
        }
    }

    // ========== DASHBOARD QUERIES ==========

    public DashboardData getDashboardData(String tenantId, String period) {
        Instant end = Instant.now();
        Instant start = getStartDate(period);

        List<Analytics> allEvents = analyticsRepository
            .findByTenantIdAndTimestampBetween(tenantId, start, end);

        return DashboardData.builder()
            .totalUsers(getTotalUsers(tenantId, start, end))
            .totalApps(getTotalApps(tenantId, start, end))
            .totalAIRequests(getTotalAIRequests(tenantId, start, end))
            .totalTokensUsed(getTotalTokensUsed(tenantId, start, end))
            .aiUsageByDay(getAIUsageByDay(allEvents))
            .topApps(getTopApps(allEvents))
            .recentActivity(getRecentActivity(allEvents))
            .build();
    }

    public Map<String, Object> getAIUsageStats(String tenantId, String period) {
        Instant end = Instant.now();
        Instant start = getStartDate(period);

        List<Analytics> aiEvents = analyticsRepository
            .findByTenantIdAndEventType(tenantId, "ai")
            .stream()
            .filter(e -> e.getTimestamp().isAfter(start) && e.getTimestamp().isBefore(end))
            .collect(Collectors.toList());

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRequests", aiEvents.size());
        stats.put("totalTokens", aiEvents.stream().mapToInt(Analytics::getTokensUsed).sum());
        stats.put("totalCost", aiEvents.stream().mapToDouble(a -> a.getCostInCents() != null ? a.getCostInCents() : 0).sum() / 100.0);
        stats.put("avgTokens", aiEvents.stream().mapToInt(Analytics::getTokensUsed).average().orElse(0));
        stats.put("byProvider", aiEvents.stream()
            .collect(Collectors.groupingBy(Analytics::getAiProvider, Collectors.counting())));

        return stats;
    }

    public Map<String, Object> getRevenueStats(String tenantId) {
        // TODO: Integrate with payment system
        return Map.of(
            "totalRevenue", 0.0,
            "subscriptions", 0,
            "trialUsers", 0,
            "paidUsers", 0
        );
    }

    // ========== HELPER METHODS ==========

    private Instant getStartDate(String period) {
        return switch (period) {
            case "day" -> Instant.now().minus(1, ChronoUnit.DAYS);
            case "week" -> Instant.now().minus(7, ChronoUnit.DAYS);
            case "month" -> Instant.now().minus(30, ChronoUnit.DAYS);
            default -> Instant.now().minus(7, ChronoUnit.DAYS);
        };
    }

    private long getTotalUsers(String tenantId, Instant start, Instant end) {
        // TODO: Query user collection
        return analyticsRepository
            .countByTenantIdAndEventTypeAndTimestampBetween(tenantId, "user_login", start, end);
    }

    private long getTotalApps(String tenantId, Instant start, Instant end) {
        return analyticsRepository
            .countByTenantIdAndEventTypeAndTimestampBetween(tenantId, "application_created", start, end);
    }

    private long getTotalAIRequests(String tenantId, Instant start, Instant end) {
        return analyticsRepository
            .countByTenantIdAndEventTypeAndTimestampBetween(tenantId, "ai", start, end);
    }

    private int getTotalTokensUsed(String tenantId, Instant start, Instant end) {
        List<Analytics> aiEvents = analyticsRepository
            .findByTenantIdAndEventType(tenantId, "ai")
            .stream()
            .filter(e -> e.getTimestamp().isAfter(start) && e.getTimestamp().isBefore(end))
            .collect(Collectors.toList());
        return aiEvents.stream().mapToInt(Analytics::getTokensUsed).sum();
    }

    private List<Map<String, Object>> getAIUsageByDay(List<Analytics> events) {
        // TODO: Implement grouping by day
        return List.of();
    }

    private List<Map<String, Object>> getTopApps(List<Analytics> events) {
        // TODO: Implement top apps
        return List.of();
    }

    private List<Map<String, Object>> getRecentActivity(List<Analytics> events) {
        return events.stream()
            .limit(10)
            .map(e -> Map.of(
                "event", e.getEventType(),
                "action", e.getAction(),
                "timestamp", e.getTimestamp()
            ))
            .collect(Collectors.toList());
    }

    // ========== DTO ==========

    @lombok.Builder
    @lombok.Data
    public static class DashboardData {
        private long totalUsers;
        private long totalApps;
        private long totalAIRequests;
        private int totalTokensUsed;
        private List<Map<String, Object>> aiUsageByDay;
        private List<Map<String, Object>> topApps;
        private List<Map<String, Object>> recentActivity;
    }
  }
