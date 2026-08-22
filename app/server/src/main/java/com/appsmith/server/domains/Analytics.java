package com.appsmith.server.domains;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "analytics")
public class Analytics {
    
    @Id
    private String id;
    
    private String tenantId;
    private String eventType;
    private String action;
    private Map<String, Object> properties;
    private String userId;
    private String sessionId;
    private String ipAddress;
    private String userAgent;
    private Instant timestamp;
    private Long duration;
    private boolean success;
    private String error;
    
    // Specific fields
    private String appId;
    private String appName;
    private String workflowId;
    private String workflowName;
    private String aiProvider;
    private String aiModel;
    private Integer tokensUsed;
    private Integer costInCents;
}
