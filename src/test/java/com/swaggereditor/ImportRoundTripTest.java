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
    void refRequestBodyIsResolvedAndExamplesKept() throws Exception {
        ProjectDTO project = parseOpenBankingSpec();
        EndpointDTO ep = project.getEndpoints().stream()
                .filter(e -> e.getPath().equals("/payments/requirement"))
                .findFirst()
                .orElseThrow();

        String body = ep.getRequestBodySchema();
        assertNotNull(body, "request body schema must be present");
        assertNotEquals("{}", body, "$ref request body must be resolved, not empty");
        assertTrue(body.contains("\"example\""), "property examples must be kept in request body schema");

        String regenerated = service.toJson(project);
        assertTrue(regenerated.contains("\"example\""), "regenerated spec must contain examples");
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
}
