package com.swaggereditor.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApiParameterDTO {
    private String id;

    @NotBlank(message = "Parameter name is required")
    private String name;

    @NotBlank(message = "Parameter location (in) is required")
    private String paramIn;

    private String type = "string";
    private String itemsType;
    private Boolean required = false;
    private String description;
    private String example;
    private String defaultValue;
    private String format;
    /** Numeric bounds: minimum / maximum value (integer/number parameters). */
    private String minValue;
    private String maxValue;
    /** Decimal precision in "total,fraction" form, e.g. "18,2" (number parameters). */
    private String precision;
}
