package com.appsmith.server.repositories;

import com.appsmith.server.domains.Analytics;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AnalyticsRepository extends MongoRepository<Analytics, String> {
    
    List<Analytics> findByTenantIdAndTimestampBetween(String tenantId, Instant start, Instant end);
    
    List<Analytics> findByTenantIdAndEventType(String tenantId, String eventType);
    
    @Query("{ 'tenantId': ?0, 'eventType': 'ai', 'timestamp': { $gte: ?1, $lte: ?2 } }")
    List<Analytics> findAIUsage(String tenantId, Instant start, Instant end);
    
    long countByTenantIdAndEventTypeAndTimestampBetween(String tenantId, String eventType, Instant start, Instant end);
  }
