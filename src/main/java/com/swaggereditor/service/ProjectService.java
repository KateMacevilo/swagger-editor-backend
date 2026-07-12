package com.swaggereditor.service;

import com.swaggereditor.dto.ProjectDTO;
import com.swaggereditor.dto.ProjectSummaryDTO;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);

    private final GitHubService gitHubService;
    private final OpenApiService openApiService;

    public List<ProjectSummaryDTO> findAll() {
        List<Map<String, Object>> entries = gitHubService.listDirectory("");
        if (entries.isEmpty()) {
            return Collections.emptyList();
        }

        int poolSize = Math.min(entries.size(), 10);
        ExecutorService executor = Executors.newFixedThreadPool(poolSize);
        List<Future<ProjectSummaryDTO>> futures = new ArrayList<>();

        for (Map<String, Object> entry : entries) {
            if (!"dir".equals(entry.get("type"))) {
                continue;
            }
            String name = (String) entry.get("name");
            Callable<ProjectSummaryDTO> task = () -> loadProjectSummary(name);
            futures.add(executor.submit(task));
        }

        List<ProjectSummaryDTO> projects = new ArrayList<>();
        for (Future<ProjectSummaryDTO> future : futures) {
            try {
                ProjectSummaryDTO project = future.get();
                if (project != null) {
                    projects.add(project);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Project loading interrupted");
            } catch (ExecutionException e) {
                Throwable cause = e.getCause();
                log.warn("Could not load project: {}", cause != null ? cause.getMessage() : e.getMessage());
            }
        }

        executor.shutdown();
        projects.sort(Comparator.comparing(ProjectSummaryDTO::getTitle, String.CASE_INSENSITIVE_ORDER));
        return projects;
    }

    private ProjectSummaryDTO loadProjectSummary(String name) {
        String filePath = name + "/openapi.json";
        try {
            String content = gitHubService.readFile(filePath);
            ProjectDTO project = openApiService.parseSpec(content);
            return new ProjectSummaryDTO(
                    name,
                    project.getTitle() != null ? project.getTitle() : name,
                    project.getVersion(),
                    filePath,
                    project.getEndpointCount()
            );
        } catch (Exception e) {
            log.warn("Could not load project from {}: {}", filePath, e.getMessage());
            return null;
        }
    }

    public ProjectDTO findById(String projectId) {
        String filePath = projectId + "/openapi.json";
        String content;
        try {
            content = gitHubService.readFile(filePath);
        } catch (HttpClientErrorException.NotFound e) {
            throw new NoSuchElementException("Project not found: " + projectId);
        }
        ProjectDTO project = openApiService.parseSpec(content);
        project.setId(projectId);
        project.setGithubFilePath(filePath);
        return project;
    }

    public ProjectSummaryDTO create(ProjectDTO dto) {
        String slug = openApiService.toSlug(dto.getTitle());
        String filePath = slug + "/openapi.json";
        if (dto.getVersion() == null || dto.getVersion().isBlank()) {
            dto.setVersion("1.0.0");
        }
        if (dto.getEndpoints() == null) {
            dto.setEndpoints(List.of());
        }
        String json = openApiService.toJson(dto);
        gitHubService.writeFile(filePath, json, "Create project \"" + dto.getTitle() + "\"");
        return new ProjectSummaryDTO(slug, dto.getTitle(), dto.getVersion(), filePath, dto.getEndpoints().size());
    }

    public ProjectSummaryDTO update(String projectId, ProjectDTO dto) {
        String filePath = projectId + "/openapi.json";
        dto.setEndpoints(dto.getEndpoints() != null ? dto.getEndpoints() : List.of());
        String json = openApiService.toJson(dto);
        gitHubService.writeFile(filePath, json, "Update project \"" + dto.getTitle() + "\"");
        return new ProjectSummaryDTO(projectId, dto.getTitle(), dto.getVersion(), filePath, dto.getEndpoints().size());
    }

    public void delete(String projectId) {
        String filePath = projectId + "/openapi.json";
        gitHubService.deleteFile(filePath, "Delete project " + projectId);
    }

    public ProjectSummaryDTO importSpec(String specContent) {
        ProjectDTO project = openApiService.parseSpec(specContent);
        String slug = openApiService.toSlug(project.getTitle());
        String filePath = slug + "/openapi.json";
        String json = openApiService.toJson(project);
        gitHubService.writeFile(filePath, json, "Import project \"" + project.getTitle() + "\"");
        return new ProjectSummaryDTO(slug, project.getTitle(), project.getVersion(), filePath, project.getEndpointCount());
    }
}
