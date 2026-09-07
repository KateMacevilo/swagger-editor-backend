package com.swaggereditor.controller;

import com.swaggereditor.dto.ProjectDTO;
import com.swaggereditor.dto.ProjectSummaryDTO;
import com.swaggereditor.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public List<ProjectSummaryDTO> getAll() {
        return projectService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectDTO> getById(@PathVariable String id) {
        try {
            return ResponseEntity.ok(projectService.findById(id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<ProjectSummaryDTO> create(@Valid @RequestBody ProjectDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjectSummaryDTO> update(@PathVariable String id, @Valid @RequestBody ProjectDTO dto) {
        return ResponseEntity.ok(projectService.update(id, dto));
    }

    /** Rename a project: body {"title": "<new title>"}. Moves the file in GitLab to the new slug. */
    @PostMapping("/{id}/rename")
    public ResponseEntity<ProjectDTO> rename(@PathVariable String id, @RequestBody Map<String, String> body) {
        String title = body != null ? body.get("title") : null;
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }
        return ResponseEntity.ok(projectService.rename(id, title));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        projectService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
