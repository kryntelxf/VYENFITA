package com.appsmith.server.domains;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIResponse {
    private boolean success;
    private String error;
    private JsonNode data;
    private String provider;
    private Long elapsed;
}
