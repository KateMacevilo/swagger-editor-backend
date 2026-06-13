package com.swaggereditor.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.swaggereditor.dto.ApiParameterDTO;
import com.swaggereditor.dto.ApiResponseDTO;
import com.swaggereditor.dto.EndpointDTO;
import com.swaggereditor.dto.ProjectDTO;
import com.swaggereditor.entity.*;
import com.swaggereditor.repository.EndpointRepository;
import com.swaggereditor.repository.ProjectRepository;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.core.util.Yaml;
import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.*;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.ParseOptions;
import io.swagger.v3.parser.core.models.SwaggerParseResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class OpenApiService {

    private final ProjectRepository projectRepository;
    private final EndpointRepository endpointRepository;
    private final ProjectService projectService;
    private final EndpointService endpointService;

    private final ObjectMapper jsonMapper = new ObjectMapper();

    /** Build OpenAPI 3.0 object from project + its endpoints */
    public OpenAPI buildOpenApi(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found: " + projectId));

        OpenAPI openAPI = new OpenAPI();
        openAPI.openapi("3.0.0");

        // Info
        Info info = new Info()
                .title(project.getTitle())
                .description(project.getDescription())
                .version(project.getVersion() != null ? project.getVersion() : "1.0.0");

        if (project.getTermsOfService() != null) {
            info.setTermsOfService(project.getTermsOfService());
        }
        if (project.getContactEmail() != null) {
            info.setContact(new Contact().email(project.getContactEmail()));
        }
        if (project.getLicenseName() != null) {
            info.setLicense(new License().name(project.getLicenseName()));
        }
        openAPI.setInfo(info);

        // Server
        if (project.getServerUrl() != null && !project.getServerUrl().isBlank()) {
            Server server = new Server()
                    .url(project.getServerUrl())
                    .description(project.getServerDescription());
            openAPI.setServers(List.of(server));
        }

        // Paths
        Paths paths = new Paths();
        List<Endpoint> endpoints = endpointRepository.findByProjectId(projectId);

        for (Endpoint endpoint : endpoints) {
            String path = endpoint.getPath();
            PathItem pathItem = paths.containsKey(path) ? paths.get(path) : new PathItem();

            Operation operation = buildOperation(endpoint);
            setOperationByMethod(pathItem, endpoint.getMethod(), operation);
            paths.addPathItem(path, pathItem);
        }

        openAPI.setPaths(paths);
        return openAPI;
    }

    public String toJson(Long projectId) {
        try {
            return Json.pretty(buildOpenApi(projectId));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize to JSON", e);
        }
    }

    public String toYaml(Long projectId) {
        try {
            return Yaml.pretty(buildOpenApi(projectId));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize to YAML", e);
        }
    }

    /** Import (parse) an OpenAPI spec string and persist it as a new project */
    @Transactional
    public ProjectDTO importSpec(String specContent) {
        OpenAPIV3Parser parser = new OpenAPIV3Parser();
        ParseOptions options = new ParseOptions();
        options.setResolve(true);

        SwaggerParseResult result = parser.readContents(specContent, null, options);
        if (result.getOpenAPI() == null) {
            String errors = result.getMessages() != null ? String.join("; ", result.getMessages()) : "unknown";
            throw new IllegalArgumentException("Invalid OpenAPI spec: " + errors);
        }

        OpenAPI openAPI = result.getOpenAPI();
        return persistOpenApi(openAPI);
    }

    @Transactional
    protected ProjectDTO persistOpenApi(OpenAPI openAPI) {
        // Create project
        Project project = new Project();
        Info info = openAPI.getInfo();
        if (info != null) {
            project.setTitle(info.getTitle() != null ? info.getTitle() : "Imported API");
            project.setDescription(info.getDescription());
            project.setVersion(info.getVersion() != null ? info.getVersion() : "1.0.0");
            if (info.getContact() != null) project.setContactEmail(info.getContact().getEmail());
            if (info.getLicense() != null) project.setLicenseName(info.getLicense().getName());
            project.setTermsOfService(info.getTermsOfService());
        } else {
            project.setTitle("Imported API");
        }

        if (openAPI.getServers() != null && !openAPI.getServers().isEmpty()) {
            Server server = openAPI.getServers().get(0);
            project.setServerUrl(server.getUrl());
            project.setServerDescription(server.getDescription());
        }

        project = projectRepository.save(project);

        // Parse paths
        if (openAPI.getPaths() != null) {
            for (Map.Entry<String, PathItem> pathEntry : openAPI.getPaths().entrySet()) {
                String path = pathEntry.getKey();
                PathItem pathItem = pathEntry.getValue();
                persistPathItem(project, path, pathItem);
            }
        }

        return projectService.toSummaryDTO(project);
    }

    private void persistPathItem(Project project, String path, PathItem pathItem) {
        Map<String, Operation> operationMap = new LinkedHashMap<>();
        if (pathItem.getGet() != null)     operationMap.put("GET",     pathItem.getGet());
        if (pathItem.getPost() != null)    operationMap.put("POST",    pathItem.getPost());
        if (pathItem.getPut() != null)     operationMap.put("PUT",     pathItem.getPut());
        if (pathItem.getDelete() != null)  operationMap.put("DELETE",  pathItem.getDelete());
        if (pathItem.getPatch() != null)   operationMap.put("PATCH",   pathItem.getPatch());
        if (pathItem.getOptions() != null) operationMap.put("OPTIONS", pathItem.getOptions());
        if (pathItem.getHead() != null)    operationMap.put("HEAD",    pathItem.getHead());

        for (Map.Entry<String, Operation> entry : operationMap.entrySet()) {
            String method = entry.getKey();
            Operation operation = entry.getValue();

            Endpoint endpoint = new Endpoint();
            endpoint.setProject(project);
            endpoint.setPath(path);
            endpoint.setMethod(method);
            endpoint.setSummary(operation.getSummary());
            endpoint.setDescription(operation.getDescription());
            endpoint.setOperationId(operation.getOperationId());
            endpoint.setDeprecated(Boolean.TRUE.equals(operation.getDeprecated()));

            if (operation.getTags() != null) {
                endpoint.setTags(String.join(",", operation.getTags()));
            }

            // Parameters
            if (operation.getParameters() != null) {
                for (Parameter param : operation.getParameters()) {
                    ApiParameter ap = new ApiParameter();
                    ap.setEndpoint(endpoint);
                    ap.setName(param.getName());
                    ap.setParamIn(param.getIn());
                    ap.setRequired(Boolean.TRUE.equals(param.getRequired()));
                    ap.setDescription(param.getDescription());
                    if (param.getSchema() != null) {
                        ap.setType(param.getSchema().getType() != null ? param.getSchema().getType() : "string");
                        ap.setFormat(param.getSchema().getFormat());
                    }
                    endpoint.getParameters().add(ap);
                }
            }

            // Request body
            if (operation.getRequestBody() != null) {
                RequestBody rb = operation.getRequestBody();
                endpoint.setRequestBodyRequired(Boolean.TRUE.equals(rb.getRequired()));
                if (rb.getContent() != null && rb.getContent().containsKey("application/json")) {
                    Schema<?> schema = rb.getContent().get("application/json").getSchema();
                    if (schema != null) {
                        endpoint.setRequestBodySchema(schemaToJsonString(schema));
                    }
                }
            }

            // Responses
            if (operation.getResponses() != null) {
                for (Map.Entry<String, ApiResponse> respEntry : operation.getResponses().entrySet()) {
                    ApiResponse apiResponse = respEntry.getValue();
                    com.swaggereditor.entity.ApiResponse resp = new com.swaggereditor.entity.ApiResponse();
                    resp.setEndpoint(endpoint);
                    resp.setStatusCode(respEntry.getKey());
                    resp.setDescription(apiResponse.getDescription());
                    if (apiResponse.getContent() != null && apiResponse.getContent().containsKey("application/json")) {
                        Schema<?> schema = apiResponse.getContent().get("application/json").getSchema();
                        if (schema != null) {
                            resp.setBodySchema(schemaToJsonString(schema));
                        }
                    }
                    endpoint.getResponses().add(resp);
                }
            }

            endpointRepository.save(endpoint);
        }
    }

    // ---- helpers ----

    private Operation buildOperation(Endpoint endpoint) {
        Operation operation = new Operation();

        if (endpoint.getSummary() != null)     operation.setSummary(endpoint.getSummary());
        if (endpoint.getDescription() != null) operation.setDescription(endpoint.getDescription());
        if (endpoint.getOperationId() != null) operation.setOperationId(endpoint.getOperationId());
        if (Boolean.TRUE.equals(endpoint.getDeprecated())) operation.setDeprecated(true);

        if (endpoint.getTags() != null && !endpoint.getTags().isBlank()) {
            operation.setTags(Arrays.asList(endpoint.getTags().split(",")));
        }

        // Parameters
        if (!endpoint.getParameters().isEmpty()) {
            List<Parameter> params = new ArrayList<>();
            for (ApiParameter ap : endpoint.getParameters()) {
                Parameter param = new Parameter()
                        .name(ap.getName())
                        .in(ap.getParamIn())
                        .required(ap.getRequired())
                        .description(ap.getDescription())
                        .schema(buildSchema(ap.getType(), ap.getItemsType(), ap.getFormat()));
                if (ap.getExample() != null) param.setExample(ap.getExample());
                params.add(param);
            }
            operation.setParameters(params);
        }

        // Request body (only for POST, PUT, PATCH)
        String method = endpoint.getMethod().toUpperCase();
        if ((method.equals("POST") || method.equals("PUT") || method.equals("PATCH"))
                && endpoint.getRequestBodySchema() != null && !endpoint.getRequestBodySchema().isBlank()) {

            Schema<?> bodySchema = jsonStringToSchema(endpoint.getRequestBodySchema());
            MediaType mediaType = new MediaType().schema(bodySchema);
            Content content = new Content().addMediaType("application/json", mediaType);

            RequestBody requestBody = new RequestBody()
                    .content(content)
                    .required(Boolean.TRUE.equals(endpoint.getRequestBodyRequired()));

            operation.setRequestBody(requestBody);
        }

        // Responses
        ApiResponses apiResponses = new ApiResponses();
        if (endpoint.getResponses().isEmpty()) {
            apiResponses.addApiResponse("200", new ApiResponse().description("OK"));
        } else {
            for (com.swaggereditor.entity.ApiResponse resp : endpoint.getResponses()) {
                ApiResponse apiResponse = new ApiResponse()
                        .description(resp.getDescription() != null ? resp.getDescription() : "");
                if (resp.getBodySchema() != null && !resp.getBodySchema().isBlank()) {
                    Schema<?> schema = jsonStringToSchema(resp.getBodySchema());
                    apiResponse.setContent(new Content().addMediaType("application/json",
                            new MediaType().schema(schema)));
                }
                apiResponses.addApiResponse(resp.getStatusCode(), apiResponse);
            }
        }
        operation.setResponses(apiResponses);

        return operation;
    }

    private Schema<?> buildSchema(String type, String itemsType, String format) {
        if (type == null) type = "string";
        Schema<?> schema;

        switch (type) {
            case "integer" -> schema = new IntegerSchema();
            case "number"  -> schema = new NumberSchema();
            case "boolean" -> schema = new BooleanSchema();
            case "array"   -> {
                ArraySchema arr = new ArraySchema();
                arr.setItems(buildSchema(itemsType, null, null));
                return arr;
            }
            case "object"  -> schema = new ObjectSchema();
            default        -> schema = new StringSchema();
        }

        if (format != null) schema.setFormat(format);
        return schema;
    }

    /** Convert a simple JSON schema map (from frontend) to a Swagger Schema object */
    @SuppressWarnings("unchecked")
    private Schema<?> jsonStringToSchema(String json) {
        if (json == null || json.isBlank()) return new ObjectSchema();
        try {
            Map<String, Object> map = jsonMapper.readValue(json, Map.class);
            return mapToSchema(map);
        } catch (Exception e) {
            return new ObjectSchema();
        }
    }

    @SuppressWarnings("unchecked")
    private Schema<?> mapToSchema(Map<String, Object> map) {
        if (map == null) return new ObjectSchema();

        String type = (String) map.getOrDefault("type", "object");
        Schema<?> schema;

        switch (type) {
            case "integer" -> schema = new IntegerSchema();
            case "number"  -> schema = new NumberSchema();
            case "boolean" -> schema = new BooleanSchema();
            case "string"  -> schema = new StringSchema();
            case "array"   -> {
                ArraySchema arr = new ArraySchema();
                Object items = map.get("items");
                if (items instanceof Map) {
                    arr.setItems(mapToSchema((Map<String, Object>) items));
                } else {
                    arr.setItems(new StringSchema());
                }
                return arr;
            }
            default -> schema = new ObjectSchema();
        }

        if (map.containsKey("format")) schema.setFormat((String) map.get("format"));
        if (map.containsKey("description")) schema.setDescription((String) map.get("description"));
        if (map.containsKey("example")) schema.setExample(map.get("example"));

        Object required = map.get("required");
        if (map.containsKey("properties")) {
            Map<String, Object> props = (Map<String, Object>) map.get("properties");
            Map<String, Schema> schemaProps = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : props.entrySet()) {
                if (entry.getValue() instanceof Map) {
                    schemaProps.put(entry.getKey(), mapToSchema((Map<String, Object>) entry.getValue()));
                }
            }
            schema.setProperties(schemaProps);

            // required array
            if (required instanceof List) {
                schema.setRequired((List<String>) required);
            }
        }

        return schema;
    }

    private String schemaToJsonString(Schema<?> schema) {
        try {
            return jsonMapper.writeValueAsString(schemaToMap(schema));
        } catch (Exception e) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> schemaToMap(Schema<?> schema) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (schema.getType() != null) map.put("type", schema.getType());
        if (schema.getFormat() != null) map.put("format", schema.getFormat());
        if (schema.getDescription() != null) map.put("description", schema.getDescription());
        if (schema.getExample() != null) map.put("example", schema.getExample());

        if (schema.getProperties() != null) {
            Map<String, Object> props = new LinkedHashMap<>();
            for (Map.Entry<String, Schema> entry : ((Map<String, Schema>) schema.getProperties()).entrySet()) {
                props.put(entry.getKey(), schemaToMap(entry.getValue()));
            }
            map.put("properties", props);
        }

        if (schema instanceof ArraySchema arr && arr.getItems() != null) {
            map.put("items", schemaToMap(arr.getItems()));
        }

        if (schema.getRequired() != null) {
            map.put("required", schema.getRequired());
        }

        return map;
    }

    private void setOperationByMethod(PathItem pathItem, String method, Operation operation) {
        switch (method.toUpperCase()) {
            case "GET"     -> pathItem.setGet(operation);
            case "POST"    -> pathItem.setPost(operation);
            case "PUT"     -> pathItem.setPut(operation);
            case "DELETE"  -> pathItem.setDelete(operation);
            case "PATCH"   -> pathItem.setPatch(operation);
            case "OPTIONS" -> pathItem.setOptions(operation);
            case "HEAD"    -> pathItem.setHead(operation);
        }
    }
}
