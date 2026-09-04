package com.swaggereditor.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.swaggereditor.dto.ErrorResponseDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;

import java.time.LocalDateTime;
import java.util.NoSuchElementException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponseDTO> handleNotFound(NoSuchElementException e) {
        log.warn("Not found: {}", e.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponseDTO> handleBadRequest(IllegalArgumentException e) {
        log.warn("Bad request: {}", e.getMessage());
        return buildResponse(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponseDTO> handleServiceUnavailable(IllegalStateException e) {
        log.warn("Service unavailable: {}", e.getMessage());
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
    }

    @ExceptionHandler(HttpClientErrorException.class)
    public ResponseEntity<ErrorResponseDTO> handleGitClientError(HttpClientErrorException e) {
        String message = extractGitMessage(e);
        log.warn("Git client error {}: {}", e.getStatusCode(), message);
        return buildResponse((HttpStatus) e.getStatusCode(), message);
    }

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<ErrorResponseDTO> handleGitUnavailable(RestClientException e) {
        log.warn("Git client communication error: {}", e.getMessage());
        return buildResponse(HttpStatus.BAD_GATEWAY,
                "Cannot communicate with GitLab: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponseDTO> handleGeneric(Exception e) {
        log.error("Unexpected error", e);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
    }

    /** GitLab errors look like {"message":"404 Project Not Found"} — show just the message, not the raw JSON. */
    private String extractGitMessage(HttpClientErrorException e) {
        String body = e.getResponseBodyAsString();
        if (body == null || body.isBlank()) {
            return e.getMessage();
        }
        try {
            JsonNode node = new ObjectMapper().readTree(body);
            JsonNode message = node.hasNonNull("message") ? node.get("message") : node.get("error");
            if (message != null && message.isTextual()) {
                return message.asText();
            }
            if (message != null) {
                return message.toString();
            }
        } catch (JsonProcessingException ignored) {
            // not a GitLab JSON error — fall through to the raw body
        }
        return body;
    }

    private ResponseEntity<ErrorResponseDTO> buildResponse(HttpStatus status, String message) {
        ErrorResponseDTO error = new ErrorResponseDTO(
                LocalDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message
        );
        return ResponseEntity.status(status).body(error);
    }
}
