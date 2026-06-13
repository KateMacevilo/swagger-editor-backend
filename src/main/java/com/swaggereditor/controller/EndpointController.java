package com.swaggereditor.controller;

import com.swaggereditor.dto.EndpointDTO;
import com.swaggereditor.service.EndpointService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/projects/{projectId}/endpoints")
@RequiredArgsConstructor
public class EndpointController {

    private final EndpointService endpointService;

    @GetMapping
    public List<EndpointDTO> getAll(@PathVariable Long projectId) {
        return endpointService.findByProject(projectId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<EndpointDTO> getById(@PathVariable Long projectId, @PathVariable Long id) {
        try {
            return ResponseEntity.ok(endpointService.findById(id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<EndpointDTO> create(@PathVariable Long projectId,
                                               @Valid @RequestBody EndpointDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(endpointService.create(projectId, dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EndpointDTO> update(@PathVariable Long projectId,
                                               @PathVariable Long id,
                                               @Valid @RequestBody EndpointDTO dto) {
        try {
            return ResponseEntity.ok(endpointService.update(id, dto));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long projectId, @PathVariable Long id) {
        endpointService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
