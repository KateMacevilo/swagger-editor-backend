package com.swaggereditor;

import com.swaggereditor.dto.EndpointDTO;
import com.swaggereditor.dto.ProjectDTO;
import com.swaggereditor.service.OpenApiService;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regression tests for importing a real-world OpenAPI 3.0 spec (open-banking):
 * tags containing commas, $ref request bodies, examples and schema constraints.
 */
class ImportRoundTripTest {

    private final OpenApiService service = new OpenApiService();

    private ProjectDTO parseOpenBankingSpec() throws Exception {
        String spec = Files.readString(Path.of("src/main/resources/json-test/swagger.json"));
        return service.parseSpec(spec);
    }

    @Test
    void parsesAllEndpoints() throws Exception {
        ProjectDTO project = parseOpenBankingSpec();
        assertEquals("Open-banking", project.getTitle());
        assertEquals("https://api.priorbank.by:9344/open-banking/v1.0", project.getServerUrl());
        assertEquals(42, project.getEndpoints().size());
        assertTrue(project.getEndpoints().stream().allMatch(ep ->
                ep.getSummary() != null && !ep.getSummary().isBlank()));
    }

    @Test
    void tagWithCommasSurvivesRoundTripAsSingleTag() throws Exception {
        ProjectDTO project = parseOpenBankingSpec();
        String regenerated = service.toJson(project);

        // The open-banking spec has a tag like "Создание, получение и отзыв платежа ...".
        // It must be kept as ONE tag, not split into fragments at commas.
        long fragmentCount = project.getEndpoints().stream()
                .flatMap(ep -> (ep.getTags() != null ? ep.getTags() : List.<String>of()).stream())
                .filter(t -> t.contains(","))
                .count();
        assertTrue(fragmentCount > 0, "spec should contain at least one tag with commas");

        String fullTag = "Создание, получение и отзыв платежа по инициативе бенефициара за товары, работы, услуги (Скоро будет доступно)";
        assertTrue(regenerated.contains(fullTag), "full tag text must survive in regenerated spec");
    }

    @Test
    void refRequestBodyIsKeptAsComponentRefWithExamples() throws Exception {
        ProjectDTO project = parseOpenBankingSpec();
        EndpointDTO ep = project.getEndpoints().stream()
                .filter(e -> e.getPath().equals("/payments/requirement"))
                .findFirst()
                .orElseThrow();

        // With ref preservation the body is a reference, not an inlined schema.
        String body = ep.getRequestBodySchema();
        assertNotNull(body, "request body schema must be present");
        assertTrue(body.contains("\"$ref\""), "request body must be a component reference, got: " + body);
        assertTrue(body.contains("#/components/schemas/CreateRequirementPaymentsRequest"));

        // The referenced component must be stored in the project; nested refs stay refs.
        assertNotNull(project.getSchemas(), "components must be extracted");
        String component = project.getSchemas().get("CreateRequirementPaymentsRequest");
        assertNotNull(component, "CreateRequirementPaymentsRequest component must be stored");
        assertTrue(component.contains("#/components/schemas/RequirementRequest"),
                "nested component reference must be kept, got: " + component);

        // Components with property examples must keep them (e.g. Error400).
        assertTrue(project.getSchemas().values().stream().anyMatch(s -> s.contains("\"example\"")),
                "at least one component must keep its examples");

        String regenerated = service.toJson(project);
        assertTrue(regenerated.contains("#/components/schemas/CreateRequirementPaymentsRequest"));
        assertTrue(regenerated.contains("\"example\""), "regenerated spec must contain examples");
    }

    @Test
    void responseBodyWithParameterizedJsonContentTypeIsRead() {
        // Some specs (e.g. converted Swagger 2.0) use "application/json; charset=UTF-8"
        // as the content key — the schema must still be picked up.
        String spec = """
                {
                  "openapi": "3.0.0",
                  "info": {"title": "t", "version": "1"},
                  "paths": {
                    "/regions": {
                      "get": {
                        "summary": "s",
                        "responses": {
                          "200": {
                            "description": "OK",
                            "content": {
                              "application/json; charset=UTF-8": {
                                "schema": {"$ref": "#/components/schemas/ResponseRegion"}
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  "components": {
                    "schemas": {
                      "ResponseRegion": {
                        "type": "object",
                        "properties": {"data": {"type": "string"}},
                        "required": ["data"]
                      }
                    }
                  }
                }
                """;
        ProjectDTO project = service.parseSpec(spec);
        EndpointDTO ep = project.getEndpoints().get(0);

        String body = ep.getResponses().get(0).getBodySchema();
        assertNotNull(body, "response body schema must be read despite charset in content type");
        assertTrue(body.contains("#/components/schemas/ResponseRegion"), "got: " + body);

        assertNotNull(project.getSchemas());
        assertTrue(project.getSchemas().containsKey("ResponseRegion"));

        String regenerated = service.toJson(project);
        assertTrue(regenerated.contains("\"components\""), "regenerated spec must have components");
        assertTrue(regenerated.contains("#/components/schemas/ResponseRegion"));
    }

    @Test
    void schemaConstraintsSurviveRoundTrip() throws Exception {
        ProjectDTO project = parseOpenBankingSpec();
        String regenerated = service.toJson(project);
        assertTrue(regenerated.contains("minLength"), "minLength must survive");
        assertTrue(regenerated.contains("maxLength"), "maxLength must survive");
        assertTrue(regenerated.contains("pattern"), "pattern must survive");
        assertTrue(regenerated.contains("Создание платежа"), "Cyrillic summary must survive");
    }

    @Test
    void securitySchemeAndRequirementSurviveRoundTrip() {
        // Mirrors the SwaggerConfiguration of the original java project:
        // components.securitySchemes.default (oauth2 implicit) + security on operations/root.
        String spec = """
                {
                  "openapi": "3.0.0",
                  "info": {"title": "t", "version": "1"},
                  "paths": {
                    "/a": {
                      "get": {
                        "summary": "s",
                        "security": [{"default": []}],
                        "responses": {"200": {"description": "OK"}}
                      }
                    }
                  },
                  "security": [{"default": []}],
                  "components": {
                    "securitySchemes": {
                      "default": {
                        "type": "oauth2",
                        "flows": {
                          "implicit": {
                            "authorizationUrl": "https://test.com",
                            "scopes": {
                              "accounts": "Получение информации о счетах",
                              "payments": "Инициирование платежей"
                            }
                          }
                        }
                      }
                    }
                  }
                }
                """;
        ProjectDTO project = service.parseSpec(spec);

        assertTrue(project.getSecurityEnabled());
        assertEquals("https://test.com", project.getSecurityAuthorizationUrl());
        assertTrue(project.getSecurityScopes().containsKey("accounts"));
        assertTrue(project.getSecurityScopes().containsKey("payments"));
        assertTrue(project.getEndpoints().get(0).getSecured());

        String regenerated = service.toJson(project);
        assertTrue(regenerated.contains("securitySchemes"));
        assertTrue(regenerated.contains("https://test.com"));
        assertTrue(regenerated.contains("Инициирование платежей"));
        assertTrue(regenerated.contains("\"security\""));
    }

    @Test
    void responseHeadersSurviveRoundTrip() {
        String spec = """
                {
                  "openapi": "3.0.0",
                  "info": {"title": "t", "version": "1"},
                  "paths": {
                    "/a": {
                      "get": {
                        "summary": "s",
                        "responses": {
                          "200": {
                            "description": "OK",
                            "headers": {
                              "X-Request-Id": {"description": "Идентификатор запроса", "schema": {"type": "string"}}
                            }
                          }
                        }
                      }
                    }
                  }
                }
                """;
        ProjectDTO project = service.parseSpec(spec);
        java.util.Map<String, String> headers = project.getEndpoints().get(0).getResponses().get(0).getHeaders();
        assertTrue(headers.containsKey("X-Request-Id"));
        assertEquals("Идентификатор запроса", headers.get("X-Request-Id"));

        String regenerated = service.toJson(project);
        assertTrue(regenerated.contains("X-Request-Id"));
        assertTrue(regenerated.contains("Идентификатор запроса"));
    }

    @Test
    void nestedComponentRefsSurviveRoundTrip() throws Exception {
        // Components may reference other components (e.g. Error422.details: array of Detail422).
        ProjectDTO project = parseOpenBankingSpec();
        long nestedRefs = project.getSchemas().values().stream()
                .filter(s -> s.contains("#/components/schemas/"))
                .count();
        assertTrue(nestedRefs > 0, "at least one component must reference another via $ref");

        String regenerated = service.toJson(project);
        assertTrue(regenerated.contains("#/components/schemas/"),
                "nested component references must survive regeneration");
    }

    @Test
    void swaggerV2SpecIsConvertedToOpenApi3() {
        // Legacy Swagger 2.0 files ("swagger":"2.0") are rejected by OpenAPIV3Parser
        // and must go through SwaggerConverter first.
        String spec = """
                {
                  "swagger": "2.0",
                  "info": {"title": "ReferenceData", "version": "v1", "description": "test"},
                  "host": "api.example.com",
                  "basePath": "/ref/v1",
                  "paths": {
                    "/dicts": {
                      "get": {
                        "summary": "Get dictionaries",
                        "responses": {"200": {"description": "OK"}}
                      }
                    }
                  }
                }
                """;
        ProjectDTO project = service.parseSpec(spec);

        assertEquals("ReferenceData", project.getTitle());
        assertEquals("v1", project.getVersion());
        assertEquals(1, project.getEndpoints().size());
        EndpointDTO ep = project.getEndpoints().get(0);
        assertEquals("/dicts", ep.getPath());
        assertEquals("GET", ep.getMethod());
        assertEquals("Get dictionaries", ep.getSummary());
        assertTrue(project.getServerUrl() != null && project.getServerUrl().contains("api.example.com"),
                "host must be converted to a server URL, got: " + project.getServerUrl());

        String regenerated = service.toJson(project);
        assertTrue(regenerated.contains("\"openapi\""), "regenerated spec must be OpenAPI 3");
        assertFalse(regenerated.contains("\"swagger\""), "regenerated spec must not stay Swagger 2.0");
    }
}
