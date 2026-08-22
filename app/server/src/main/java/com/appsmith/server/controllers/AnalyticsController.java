package com.appsmith.server.controllers;

import com.appsmith.server.context.TenantContext;
import com.appsmith.server.services.AnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard(
            @RequestParam(required = false) String period) {
        String tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) tenantId = "default";
        period = period != null ? period : "week";
        
        var data = analyticsService.getDashboardData(tenantId, period);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", data,
            "tenant", tenantId,
            "period", period
        ));
    }

    @GetMapping("/ai-usage")
    public ResponseEntity<Map<String, Object>> getAIUsage(
            @RequestParam(required = false) String period) {
        String tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) tenantId = "default";
        period = period != null ? period : "week";
        
        var stats = analyticsService.getAIUsageStats(tenantId, period);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", stats,
            "tenant", tenantId,
            "period", period
        ));
    }

    @GetMapping("/revenue")
    public ResponseEntity<Map<String, Object>> getRevenue() {
        String tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) tenantId = "default";
        
        var stats = analyticsService.getRevenueStats(tenantId);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", stats,
            "tenant", tenantId
        ));
    }
                                                     }
