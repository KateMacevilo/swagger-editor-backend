package com.swaggereditor.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApiResponseDTO {
    private String id;

    @NotBlank(message = "Status code is required")
    private String statusCode;

    private String description;
    private String bodySchema;
}
