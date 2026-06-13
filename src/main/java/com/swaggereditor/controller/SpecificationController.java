package com.swaggereditor.controller;

import com.swaggereditor.dto.ProjectDTO;
import com.swaggereditor.service.OpenApiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/projects/{projectId}/spec")
@RequiredArgsConstructor
public class SpecificationController {

    private final OpenApiService openApiService;

    /** Live preview — returns current spec as JSON object (for swagger-ui-react) */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getSpecJson(@PathVariable Long projectId) {
        String json = openApiService.toJson(projectId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(json);
    }

    /** Download as JSON file */
    @GetMapping(value = "/download/json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> downloadJson(@PathVariable Long projectId) {
        byte[] content = openApiService.toJson(projectId).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"openapi.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(content);
    }

    /** Download as YAML file */
    @GetMapping(value = "/download/yaml")
    public ResponseEntity<byte[]> downloadYaml(@PathVariable Long projectId) {
        byte[] content = openApiService.toYaml(projectId).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"openapi.yaml\"")
                .contentType(MediaType.parseMediaType("application/x-yaml"))
                .body(content);
    }
}

// Separate controller for import (no projectId in path)
