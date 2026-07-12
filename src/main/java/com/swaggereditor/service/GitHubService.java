package com.swaggereditor.service;

import com.swaggereditor.config.GitHubProperties;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
public class GitHubService {

    private static final String API_BASE = "https://api.github.com";
    private static final Logger log = LoggerFactory.getLogger(GitHubService.class);

    private final GitHubProperties properties;
    private final RestTemplate restTemplate;

    public void validateConfig() {
        if (properties.token() == null || properties.token().isBlank()
                || effectiveOwner() == null || effectiveOwner().isBlank()
                || effectiveRepo() == null || effectiveRepo().isBlank()) {
            throw new IllegalStateException(
                    "GitHub integration is not configured. Set github.token, github.owner and github.repo in application.properties (owner and repo must be plain names, not URLs).");
        }
    }

    /** List directory entries at the given path. Returns empty list for missing or non-dir paths. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listDirectory(String path) {
        validateConfig();
        String url = contentsUrl(path);
        try {
            ResponseEntity<List> response = executeGitHubRequest(url, HttpMethod.GET, null, List.class);
            List<?> body = response.getBody();
            if (body == null) return Collections.emptyList();
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object item : body) {
                if (item instanceof Map) {
                    result.add((Map<String, Object>) item);
                }
            }
            return result;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.warn("GitHub directory not found: {}", url);
                return Collections.emptyList();
            }
            throw e;
        }
    }

    /** Read a file's raw decoded content via GitHub's raw CDN. */
    public String readFile(String path) {
        validateConfig();
        String url = rawUrl(path);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "token " + properties.token());
        headers.set("User-Agent", "swagger-editor-backend");
        HttpEntity<?> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            log.debug("GitHub raw {} -> {}", url, response.getStatusCode());
            return response.getBody();
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.debug("GitHub raw 404 (expected): {} -> {}", url, e.getResponseBodyAsString());
            } else {
                log.warn("GitHub raw error: {} -> {} {}", url, e.getStatusCode(), e.getResponseBodyAsString());
            }
            throw e;
        } catch (ResourceAccessException e) {
            log.error("GitHub raw network error: {} -> {}", url, e.getMessage());
            throw new IllegalStateException("Cannot reach GitHub raw URL at " + url + ". Check network and GitHub config.", e);
        }
    }

    /** Write or update a file. Returns the response body from GitHub. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> writeFile(String path, String content, String message) {
        validateConfig();
        String encoded = Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8));
        String existingSha = fetchFileSha(path);
        boolean updating = existingSha != null;

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        body.put("content", encoded);
        body.put("branch", properties.branch());
        if (updating) {
            body.put("sha", existingSha);
        }

        String url = contentsUrl(path);
        ResponseEntity<Map> response = executeGitHubRequest(url, HttpMethod.PUT, body, Map.class);
        log.info("GitHub file {} {}: {}", updating ? "updated" : "created", path, url);
        return response.getBody();
    }

    /** Delete a file. Returns true if deleted. */
    public boolean deleteFile(String path, String message) {
        validateConfig();
        String sha = fetchFileSha(path);
        if (sha == null) {
            log.warn("Cannot delete {}: file not found in GitHub", path);
            return false;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        body.put("sha", sha);
        body.put("branch", properties.branch());
        executeGitHubRequest(contentsUrl(path), HttpMethod.DELETE, body, Map.class);
        log.info("GitHub file deleted: {}", path);
        return true;
    }

    private String fetchFileSha(String path) {
        try {
            String url = contentsUrl(path) + "?ref=" + properties.branch();
            ResponseEntity<Map> response = executeGitHubRequest(url, HttpMethod.GET, null, Map.class);
            Map<String, Object> body = response.getBody();
            return body != null ? (String) body.get("sha") : null;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                return null;
            }
            throw e;
        }
    }

    private String contentsUrl(String path) {
        String normalized = path != null ? path.replaceAll("^/+", "") : "";
        return API_BASE + "/repos/" + effectiveOwner() + "/" + effectiveRepo()
                + "/contents/" + normalized;
    }

    private String rawUrl(String path) {
        String normalized = path != null ? path.replaceAll("^/+", "") : "";
        return "https://raw.githubusercontent.com/" + effectiveOwner() + "/" + effectiveRepo()
                + "/" + properties.branch() + "/" + normalized;
    }

    private String effectiveOwner() {
        String owner = properties.owner();
        if (owner == null) return null;
        owner = owner.trim();
        if (owner.startsWith("https://github.com/")) {
            owner = owner.substring("https://github.com/".length());
        } else if (owner.startsWith("http://github.com/")) {
            owner = owner.substring("http://github.com/".length());
        }
        return owner.replaceAll("/+$", "");
    }

    private String effectiveRepo() {
        String repo = properties.repo();
        if (repo == null) return null;
        return repo.trim().replaceAll("\\.git$", "");
    }

    private <T> ResponseEntity<T> executeGitHubRequest(String url, HttpMethod method, Object body, Class<T> responseType) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(properties.token());
        headers.set("Accept", "application/vnd.github+json");
        headers.set("X-GitHub-Api-Version", "2022-11-28");
        headers.set("User-Agent", "swagger-editor-backend");
        if (body != null) {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }

        HttpEntity<?> entity = body != null
                ? new HttpEntity<>(body, headers)
                : new HttpEntity<>(headers);

        try {
            ResponseEntity<T> response = restTemplate.exchange(url, method, entity, responseType);
            log.debug("GitHub {} {} -> {}", method, url, response.getStatusCode());
            return response;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.debug("GitHub 404 (expected): {} {} -> {}", method, url, e.getResponseBodyAsString());
            } else {
                log.warn("GitHub API error: {} {} -> {} {}", method, url, e.getStatusCode(), e.getResponseBodyAsString());
            }
            throw e;
        } catch (ResourceAccessException e) {
            log.error("GitHub network error: {} {} -> {}", method, url, e.getMessage());
            throw new IllegalStateException("Cannot reach GitHub API at " + url + ". Check network and GitHub config.", e);
        }
    }
}
