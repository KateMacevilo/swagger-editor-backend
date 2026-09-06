package com.swaggereditor.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class ProjectDTO {
    private String id;

    @NotBlank(message = "Title is required")
    private String title;

    private String description;
    private String version;
    private String termsOfService;
    private String contactEmail;
    private String licenseName;
    private String serverUrl;
    private String serverDescription;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<EndpointDTO> endpoints;
    private int endpointCount;

    /** Named component schemas (OpenAPI components.schemas): name -> JSON schema string.
     *  Request/response bodies reference them via {"$ref": "#/components/schemas/<name>"}
     *  instead of duplicating the schema inline in every endpoint. */
    private Map<String, String> schemas;

    /** OAuth2 security (components.securitySchemes.default, implicit flow).
     *  When enabled, the generated spec requires the "default" scheme globally;
     *  individual endpoints opt in/out via EndpointDTO.secured. */
    private Boolean securityEnabled = false;
    private String securityAuthorizationUrl;
    private Map<String, String> securityScopes;

    private String gitLabFilePath;
    private String gitLabLastCommitSha;
    private LocalDateTime gitLabLastPublishedAt;
}
