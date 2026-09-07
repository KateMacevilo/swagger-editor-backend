package com.swaggereditor.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class ApiResponseDTO {
    private String id;

    @NotBlank(message = "Status code is required")
    private String statusCode;

    private String description;
    private String bodySchema;
    /** Response headers: name -> description. Serialized as components-less Header objects (type: string). */
    private Map<String, String> headers;
}
