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

    private final GitLabService gitLabService;
    private final OpenApiService openApiService;

    /**
     * In-memory snapshot of the project list. findAll() costs N+1 GitLab API calls,
     * so it is cached and invalidated on every write that goes through this service.
     * Single-deployment assumption: with multiple replicas the cache would need
     * to be shared (or disabled), otherwise replicas would serve stale lists.
     */
    private static final long LIST_CACHE_TTL_MS = 120_000;
    private static final int LIST_LOAD_POOL_SIZE = 16;

    private final Object listCacheLock = new Object();
    private volatile List<ProjectSummaryDTO> listCache;
    private volatile long listCacheAt;

    public List<ProjectSummaryDTO> findAll() {
        List<ProjectSummaryDTO> cached = listCache;
        if (cached != null && System.currentTimeMillis() - listCacheAt < LIST_CACHE_TTL_MS) {
            return cached;
        }
        synchronized (listCacheLock) {
            if (listCache != null && System.currentTimeMillis() - listCacheAt < LIST_CACHE_TTL_MS) {
                return listCache;
            }
            List<ProjectSummaryDTO> fresh = Collections.unmodifiableList(loadAll());
            listCache = fresh;
            listCacheAt = System.currentTimeMillis();
            return fresh;
        }
    }

    /** Drop the cached project list after any write — the next findAll() reloads it. */
    private void invalidateListCache() {
        listCache = null;
    }

    private List<ProjectSummaryDTO> loadAll() {
        List<Map<String, Object>> entries = gitLabService.listDirectory("");
        if (entries.isEmpty()) {
            return Collections.emptyList();
        }

        int poolSize = Math.min(entries.size(), LIST_LOAD_POOL_SIZE);
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
            String content = gitLabService.readFile(filePath);
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
            content = gitLabService.readFile(filePath);
        } catch (HttpClientErrorException.NotFound e) {
            throw new NoSuchElementException("Project not found: " + projectId);
        }
        ProjectDTO project = openApiService.parseSpec(content);
        project.setId(projectId);
        project.setGitLabFilePath(filePath);
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
        gitLabService.writeFile(filePath, json, "Create project \"" + dto.getTitle() + "\"");
        invalidateListCache();
        return new ProjectSummaryDTO(slug, dto.getTitle(), dto.getVersion(), filePath, dto.getEndpoints().size());
    }

    public ProjectSummaryDTO update(String projectId, ProjectDTO dto) {
        String filePath = projectId + "/openapi.json";
        dto.setEndpoints(dto.getEndpoints() != null ? dto.getEndpoints() : List.of());
        String json = openApiService.toJson(dto);
        gitLabService.writeFile(filePath, json, "Update project \"" + dto.getTitle() + "\"");
        invalidateListCache();
        return new ProjectSummaryDTO(projectId, dto.getTitle(), dto.getVersion(), filePath, dto.getEndpoints().size());
    }

    public void delete(String projectId) {
        String filePath = projectId + "/openapi.json";
        gitLabService.deleteFile(filePath, "Delete project " + projectId);
        invalidateListCache();
    }

    /** Rename a project: moves {oldId}/openapi.json to the slug of the new title. */
    public ProjectDTO rename(String projectId, String newTitle) {
        ProjectDTO project = findById(projectId);
        String newId = openApiService.toSlug(newTitle);
        if (newId.equals(projectId)) {
            project.setTitle(newTitle);
            return project;
        }
        String oldPath = projectId + "/openapi.json";
        String newPath = newId + "/openapi.json";
        if (gitLabService.pathExists(newPath)) {
            throw new IllegalArgumentException("Project \"" + newId + "\" already exists");
        }
        String content = gitLabService.readFile(oldPath);
        gitLabService.renameFile(oldPath, newPath, content,
                "Rename project \"" + project.getTitle() + "\" -> \"" + newTitle + "\"");
        invalidateListCache();
        project.setId(newId);
        project.setTitle(newTitle);
        project.setGitLabFilePath(newPath);
        return project;
    }

    public ProjectSummaryDTO importSpec(String specContent) {
        ProjectDTO project = openApiService.parseSpec(specContent);
        String slug = openApiService.toSlug(project.getTitle());
        String filePath = slug + "/openapi.json";
        String json = openApiService.toJson(project);
        gitLabService.writeFile(filePath, json, "Import project \"" + project.getTitle() + "\"");
        invalidateListCache();
        return new ProjectSummaryDTO(slug, project.getTitle(), project.getVersion(), filePath, project.getEndpointCount());
    }
}
