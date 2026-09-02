package com.swaggereditor.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class EndpointDTO {
    private String id;
    private String projectId;

    @NotBlank(message = "Path is required")
    private String path;

    @NotBlank(message = "HTTP method is required")
    private String method;

    private String summary;
    private String description;
    /** Tag names as a list. A single tag may itself contain commas, so joining/splitting on "," would corrupt it. */
    private List<String> tags;
    private String operationId;
    private Boolean deprecated = false;

    private String requestBodySchema;
    private Boolean requestBodyRequired = false;

    private List<ApiParameterDTO> parameters;
    private List<ApiResponseDTO> responses;
}
