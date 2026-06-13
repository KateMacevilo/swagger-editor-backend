package com.swaggereditor.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ProjectDTO {
    private Long id;

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
}
