package com.swaggereditor.service;

import com.swaggereditor.config.GitLabProperties;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.UnknownContentTypeException;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
public class GitLabService {

    private static final Logger log = LoggerFactory.getLogger(GitLabService.class);
    private static final int TREE_PER_PAGE = 100;

    private final GitLabProperties properties;
    private final RestTemplate restTemplate;

    public void validateConfig() {
        if (properties.token() == null || properties.token().isBlank()
                || effectiveProject() == null || effectiveProject().isBlank()) {
            throw new IllegalStateException(
                    "GitLab integration is not configured. Set gitlab.token and gitlab.project in application.properties (project must be the plain namespace path, e.g. my-group/my-project, not a URL).");
        }
    }

    /**
     * List directory entries at the given path. Returns empty list for missing or non-dir paths.
     * Entry types are normalized to "dir"/"file" so callers stay provider-agnostic.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listDirectory(String path) {
        validateConfig();
        String url = apiBase() + "/repository/tree?path=" + encode(path != null ? path : "")
                + "&ref=" + encode(properties.branch()) + "&per_page=" + TREE_PER_PAGE;
        try {
            ResponseEntity<List> response = executeGitLabRequest(url, HttpMethod.GET, null, List.class);
            List<?> body = response.getBody();
            if (body == null) return Collections.emptyList();
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object item : body) {
                if (item instanceof Map) {
                    Map<String, Object> entry = new HashMap<>((Map<String, Object>) item);
                    // GitLab uses "tree"/"blob"; normalize to "dir"/"file".
                    entry.put("type", "tree".equals(entry.get("type")) ? "dir" : "file");
                    result.add(entry);
                }
            }
            return result;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                // GitLab answers "404 Project Not Found" when the path is wrong OR the
                // token's user has no access to a private project.
                log.warn("GitLab directory not found: {} (check gitlab.project path and that the token has access)", url);
                return Collections.emptyList();
            }
            throw e;
        }
    }

    /** Read a file's raw decoded content from the repository. */
    public String readFile(String path) {
        validateConfig();
        String url = apiBase() + "/repository/files/" + encode(normalizePath(path)) + "/raw?ref=" + encode(properties.branch());

        try {
            // Read bytes and decode as UTF-8 explicitly: RestTemplate's String converter
            // falls back to ISO-8859-1 when the response has no charset, which corrupts
            // non-ASCII text (e.g. Cyrillic summaries).
            ResponseEntity<byte[]> response = executeGitLabRequest(url, HttpMethod.GET, null, byte[].class);
            log.debug("GitLab raw {} -> {}", url, response.getStatusCode());
            byte[] body = response.getBody();
            return body != null ? new String(body, StandardCharsets.UTF_8) : null;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.debug("GitLab raw 404 (expected): {} -> {}", url, e.getResponseBodyAsString());
            } else {
                log.warn("GitLab raw error: {} -> {} {}", url, e.getStatusCode(), e.getResponseBodyAsString());
            }
            throw e;
        }
    }

    /** Create or update a file in a single commit. Returns the commit response body. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> writeFile(String path, String content, String message) {
        validateConfig();
        boolean updating = fileExists(path);
        Map<String, Object> action = new LinkedHashMap<>();
        action.put("action", updating ? "update" : "create");
        action.put("file_path", normalizePath(path));
        action.put("content", content);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("branch", properties.branch());
        body.put("commit_message", message);
        body.put("actions", List.of(action));

        ResponseEntity<Map> response = executeGitLabRequest(apiBase() + "/repository/commits", HttpMethod.POST, body, Map.class);
        log.info("GitLab file {} {} on branch {}", updating ? "updated" : "created", path, properties.branch());
        return response.getBody();
    }

    /** Delete a file in a single commit. Returns true if the file existed and was deleted. */
    public boolean deleteFile(String path, String message) {
        validateConfig();
        if (!fileExists(path)) {
            log.warn("Cannot delete {}: file not found in GitLab", path);
            return false;
        }
        Map<String, Object> action = new LinkedHashMap<>();
        action.put("action", "delete");
        action.put("file_path", normalizePath(path));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("branch", properties.branch());
        body.put("commit_message", message);
        body.put("actions", List.of(action));

        executeGitLabRequest(apiBase() + "/repository/commits", HttpMethod.POST, body, Map.class);
        log.info("GitLab file deleted: {}", path);
        return true;
    }

    private boolean fileExists(String path) {
        try {
            String url = apiBase() + "/repository/files/" + encode(normalizePath(path)) + "?ref=" + encode(properties.branch());
            executeGitLabRequest(url, HttpMethod.GET, null, Map.class);
            return true;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                return false;
            }
            throw e;
        }
    }

    private String apiBase() {
        return properties.url() + "/api/v4/projects/" + encode(effectiveProject());
    }

    private String effectiveProject() {
        String project = properties.project();
        if (project == null) return null;
        project = project.trim();
        for (String prefix : List.of("https://", "http://")) {
            if (project.startsWith(prefix)) {
                // Strip scheme and host: https://gitlab.com/group/project(.git) -> group/project
                int slashAfterHost = project.indexOf('/', prefix.length());
                if (slashAfterHost >= 0) {
                    project = project.substring(slashAfterHost + 1);
                }
                break;
            }
        }
        return project.replaceAll("\\.git$", "").replaceAll("/+$", "");
    }

    private String normalizePath(String path) {
        return path != null ? path.replaceAll("^/+", "") : "";
    }

    private String encode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** JSON endpoints must answer JSON; a text/html body means an SSO/proxy page, not GitLab API data. */
    private void assertJsonIfExpected(String url, HttpMethod method, Class<?> responseType, ResponseEntity<?> response) {
        boolean expectsJson = Map.class.equals(responseType) || List.class.equals(responseType);
        if (!expectsJson) return;
        MediaType contentType = response.getHeaders().getContentType();
        if (contentType == null || !contentType.includes(MediaType.APPLICATION_JSON)) {
            log.warn("GitLab {} {} returned non-JSON Content-Type: {}", method, url, contentType);
            throw new IllegalStateException(
                    "GitLab answered with " + contentType + " instead of JSON for " + method + " " + url
                            + " (usually an SSO login page or a reverse-proxy error page). "
                            + "Check gitlab.url and that GITLAB_TOKEN is valid.");
        }
    }

    private <T> ResponseEntity<T> executeGitLabRequest(String url, HttpMethod method, Object body, Class<T> responseType) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("PRIVATE-TOKEN", properties.token());
        headers.set("User-Agent", "swagger-editor-backend");
        if (body != null) {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }

        HttpEntity<?> entity = body != null
                ? new HttpEntity<>(body, headers)
                : new HttpEntity<>(headers);

        try {
            ResponseEntity<T> response = restTemplate.exchange(url, method, entity, responseType);
            assertJsonIfExpected(url, method, responseType, response);
            log.debug("GitLab {} {} -> {}", method, url, response.getStatusCode());
            return response;
        } catch (UnknownContentTypeException e) {
            // e.g. GitLab behind SSO/reverse proxy answered an HTML login/error page
            log.warn("GitLab {} {} returned an unexpected content type: {}", method, url, e.getContentType());
            throw new IllegalStateException(
                    "GitLab answered with " + e.getContentType() + " instead of JSON (usually an SSO login page "
                            + "or a reverse-proxy error page). Check gitlab.url and that GITLAB_TOKEN is valid.", e);
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.debug("GitLab 404 (expected): {} {} -> {}", method, url, e.getResponseBodyAsString());
            } else {
                log.warn("GitLab API error: {} {} -> {} {}", method, url, e.getStatusCode(), e.getResponseBodyAsString());
            }
            throw e;
        } catch (ResourceAccessException e) {
            log.error("GitLab network error: {} {} -> {}", method, url, e.getMessage());
            throw new IllegalStateException("Cannot reach GitLab API at " + url + ". Check network and gitlab.url config.", e);
        }
    }
}
