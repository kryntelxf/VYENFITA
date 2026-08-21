package com.appsmith.server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "appsmith.features")
public class FeatureFlagConfig {
    
    private Map<String, Boolean> flags = new HashMap<>();
    
    public boolean isEnabled(String feature) {
        return flags.getOrDefault(feature, false);
    }
    
    public boolean isEnterpriseFeature(String feature) {
        return switch (feature) {
            case "sso",
                 "audit_logs",
                 "advanced_rbac",
                 "ai_premium_models" -> true;
            default -> false;
        };
    }
  }
