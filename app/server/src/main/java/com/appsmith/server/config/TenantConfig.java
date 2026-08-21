package com.appsmith.server.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;

@Configuration
public class TenantConfig {

    @Bean
    public MongoDatabaseFactory mongoDatabaseFactory() {
        // Support multi-tenant with database-per-tenant
        return new SimpleMongoClientDatabaseFactory(
            System.getenv().getOrDefault("APPSMITH_DB_URL", "mongodb://localhost:27017")
        );
    }

    @Bean
    public MongoTemplate mongoTemplate(MongoDatabaseFactory mongoDatabaseFactory) {
        return new MongoTemplate(mongoDatabaseFactory);
    }
}
