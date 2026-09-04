package com.swaggereditor.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectSummaryDTO {

    private String id;
    private String title;
    private String version;
    private String gitLabFilePath;
    private int endpointCount;
}
