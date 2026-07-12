package com.swaggereditor.controller;

import com.swaggereditor.dto.ProjectDTO;
import com.swaggereditor.service.OpenApiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/spec")
@RequiredArgsConstructor
public class SpecificationController {

    private final OpenApiService openApiService;

    @PostMapping(value = "/json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> toJson(@RequestBody ProjectDTO project) {
        return ResponseEntity.ok(openApiService.toJson(project));
    }

    @PostMapping(value = "/yaml", produces = "application/x-yaml")
    public ResponseEntity<String> toYaml(@RequestBody ProjectDTO project) {
        return ResponseEntity.ok(openApiService.toYaml(project));
    }
}
