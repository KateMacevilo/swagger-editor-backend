package com.swaggereditor.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.swaggereditor.dto.ApiParameterDTO;
import com.swaggereditor.dto.ApiResponseDTO;
import com.swaggereditor.dto.EndpointDTO;
import com.swaggereditor.dto.ProjectDTO;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.core.util.Yaml;
import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.headers.Header;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.*;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.*;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.converter.SwaggerConverter;
import io.swagger.v3.parser.core.models.ParseOptions;
import io.swagger.v3.parser.core.models.SwaggerParseResult;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class OpenApiService {

    private final ObjectMapper jsonMapper = new ObjectMapper();

    /** Parse a JSON or YAML OpenAPI spec into a ProjectDTO. */
    public ProjectDTO parseSpec(String specContent) {
        OpenAPIV3Parser parser = new OpenAPIV3Parser();
        ParseOptions options = new ParseOptions();
        // Keep $refs intact: component schemas go into ProjectDTO.schemas and bodies
        // reference them via {"$ref": "#/components/schemas/<name>"}. Resolving refs
        // fully would duplicate the same schema into every endpoint.
        options.setResolveFully(false);

        SwaggerParseResult result = parser.readContents(specContent, null, options);
        if (result.getOpenAPI() == null && isSwaggerV2(specContent)) {
            // Swagger 2.0 spec: the v3 parser rejects it, convert it to OpenAPI 3 first.
            result = new SwaggerConverter().readContents(specContent, null, options);
        }
        if (result.getOpenAPI() == null) {
            String errors = result.getMessages() != null ? String.join("; ", result.getMessages()) : "unknown";
            throw new IllegalArgumentException("Invalid OpenAPI spec: " + errors);
        }

        return toProjectDTO(result.getOpenAPI());
    }

    private boolean isSwaggerV2(String specContent) {
        String head = specContent != null ? specContent.substring(0, Math.min(specContent.length(), 2000)) : "";
        return head.contains("\"swagger\"") || head.contains("swagger:") || head.contains("swagger :");
    }

    /** Convert an OpenAPI object to a ProjectDTO. */
    public ProjectDTO toProjectDTO(OpenAPI openAPI) {
        ProjectDTO project = new ProjectDTO();
        project.setVersion("1.0.0");

        Info info = openAPI.getInfo();
        if (info != null) {
            project.setTitle(info.getTitle() != null ? info.getTitle() : "Imported API");
            project.setDescription(info.getDescription());
            project.setVersion(info.getVersion() != null ? info.getVersion() : "1.0.0");
            project.setTermsOfService(info.getTermsOfService());
            if (info.getContact() != null) {
                project.setContactEmail(info.getContact().getEmail());
            }
            if (info.getLicense() != null) {
                project.setLicenseName(info.getLicense().getName());
            }
        } else {
            project.setTitle("Imported API");
        }

        if (openAPI.getServers() != null && !openAPI.getServers().isEmpty()) {
            Server server = openAPI.getServers().get(0);
            project.setServerUrl(server.getUrl());
            project.setServerDescription(server.getDescription());
        }

        List<EndpointDTO> endpoints = new ArrayList<>();
        if (openAPI.getPaths() != null) {
            for (Map.Entry<String, PathItem> pathEntry : openAPI.getPaths().entrySet()) {
                endpoints.addAll(pathItemToEndpoints(pathEntry.getKey(), pathEntry.getValue()));
            }
        }
        project.setEndpoints(endpoints);
        project.setEndpointCount(endpoints.size());

        if (openAPI.getComponents() != null && openAPI.getComponents().getSchemas() != null
                && !openAPI.getComponents().getSchemas().isEmpty()) {
            Map<String, String> schemas = new LinkedHashMap<>();
            for (Map.Entry<String, Schema> entry : openAPI.getComponents().getSchemas().entrySet()) {
                schemas.put(entry.getKey(), schemaToJsonString(entry.getValue()));
            }
            project.setSchemas(schemas);
        }
        if (openAPI.getComponents() != null && openAPI.getComponents().getSecuritySchemes() != null) {
            openAPI.getComponents().getSecuritySchemes().values().stream().findFirst().ifPresent(scheme -> {
                OAuthFlow flow = scheme.getFlows() != null ? scheme.getFlows().getImplicit() : null;
                if (flow == null && scheme.getFlows() != null) {
                    // Take whichever flow is configured (authorizationCode, password, clientCredentials).
                    flow = scheme.getFlows().getAuthorizationCode() != null ? scheme.getFlows().getAuthorizationCode()
                            : scheme.getFlows().getPassword() != null ? scheme.getFlows().getPassword()
                            : scheme.getFlows().getClientCredentials();
                }
                if (flow != null) {
                    project.setSecurityAuthorizationUrl(flow.getAuthorizationUrl());
                    if (flow.getScopes() != null) {
                        project.setSecurityScopes(new LinkedHashMap<>(flow.getScopes()));
                    }
                }
            });
        }
        if (openAPI.getSecurity() != null && !openAPI.getSecurity().isEmpty()) {
            project.setSecurityEnabled(true);
        }
        return project;
    }

    /** Build OpenAPI JSON from a ProjectDTO. */
    public String toJson(ProjectDTO project) {
        try {
            return Json.pretty(buildOpenApi(project));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize to JSON", e);
        }
    }

    /** Build OpenAPI YAML from a ProjectDTO. */
    public String toYaml(ProjectDTO project) {
        try {
            return Yaml.pretty(buildOpenApi(project));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize to YAML", e);
        }
    }

    /** Determine a folder slug from the project title. */
    public String toSlug(String title) {
        if (title == null || title.isBlank()) {
            return "untitled-project";
        }
        String slug = title.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "project" : slug;
    }

    private OpenAPI buildOpenApi(ProjectDTO project) {
        OpenAPI openAPI = new OpenAPI();
        openAPI.openapi("3.0.0");

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

        if (project.getServerUrl() != null && !project.getServerUrl().isBlank()) {
            openAPI.setServers(List.of(new Server()
                    .url(project.getServerUrl())
                    .description(project.getServerDescription())));
        }

        Paths paths = new Paths();
        if (project.getEndpoints() != null) {
            for (EndpointDTO endpoint : project.getEndpoints()) {
                String path = endpoint.getPath();
                PathItem pathItem = paths.containsKey(path) ? paths.get(path) : new PathItem();
                pathItem = setOperation(pathItem, endpoint);
                paths.addPathItem(path, pathItem);
            }
        }
        openAPI.setPaths(paths);

        if (project.getSchemas() != null && !project.getSchemas().isEmpty()) {
            Components components = openAPI.getComponents() != null ? openAPI.getComponents() : new Components();
            for (Map.Entry<String, String> entry : project.getSchemas().entrySet()) {
                components.addSchemas(entry.getKey(), jsonStringToSchema(entry.getValue()));
            }
            openAPI.setComponents(components);
        }

        boolean schemeConfigured = (project.getSecurityAuthorizationUrl() != null && !project.getSecurityAuthorizationUrl().isBlank())
                || (project.getSecurityScopes() != null && !project.getSecurityScopes().isEmpty());
        if (schemeConfigured) {
            Scopes scopes = new Scopes();
            if (project.getSecurityScopes() != null) {
                project.getSecurityScopes().forEach(scopes::addString);
            }
            SecurityScheme scheme = new SecurityScheme()
                    .type(SecurityScheme.Type.OAUTH2)
                    .flows(new OAuthFlows().implicit(new OAuthFlow()
                            .authorizationUrl(project.getSecurityAuthorizationUrl())
                            .scopes(scopes)));
            Components components = openAPI.getComponents() != null ? openAPI.getComponents() : new Components();
            components.addSecuritySchemes("default", scheme);
            openAPI.setComponents(components);
        }
        if (Boolean.TRUE.equals(project.getSecurityEnabled())) {
            openAPI.setSecurity(List.of(new SecurityRequirement().addList("default")));
        }
        return openAPI;
    }

    private PathItem setOperation(PathItem pathItem, EndpointDTO endpoint) {
        Operation operation = buildOperation(endpoint);
        switch (endpoint.getMethod().toUpperCase()) {
            case "GET" -> pathItem.setGet(operation);
            case "POST" -> pathItem.setPost(operation);
            case "PUT" -> pathItem.setPut(operation);
            case "DELETE" -> pathItem.setDelete(operation);
            case "PATCH" -> pathItem.setPatch(operation);
            case "OPTIONS" -> pathItem.setOptions(operation);
            case "HEAD" -> pathItem.setHead(operation);
        }
        return pathItem;
    }

    private Operation buildOperation(EndpointDTO endpoint) {
        Operation operation = new Operation();
        if (endpoint.getSummary() != null) operation.setSummary(endpoint.getSummary());
        if (endpoint.getDescription() != null) operation.setDescription(endpoint.getDescription());
        if (endpoint.getOperationId() != null) operation.setOperationId(endpoint.getOperationId());
        if (Boolean.TRUE.equals(endpoint.getDeprecated())) operation.setDeprecated(true);
        if (Boolean.TRUE.equals(endpoint.getSecured())) {
            operation.addSecurityItem(new SecurityRequirement().addList("default"));
        }
        if (endpoint.getTags() != null && !endpoint.getTags().isEmpty()) {
            operation.setTags(endpoint.getTags());
        }

        if (endpoint.getParameters() != null && !endpoint.getParameters().isEmpty()) {
            List<Parameter> params = new ArrayList<>();
            for (ApiParameterDTO ap : endpoint.getParameters()) {
                Parameter param = new Parameter()
                        .name(ap.getName())
                        .in(ap.getParamIn())
                        .required(Boolean.TRUE.equals(ap.getRequired()))
                        .description(ap.getDescription())
                        .schema(buildSchema(ap.getType(), ap.getItemsType(), ap.getFormat()));
                if (ap.getExample() != null) param.setExample(ap.getExample());
                params.add(param);
            }
            operation.setParameters(params);
        }

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

        ApiResponses apiResponses = new ApiResponses();
        if (endpoint.getResponses() == null || endpoint.getResponses().isEmpty()) {
            apiResponses.addApiResponse("200", new ApiResponse().description("OK"));
        } else {
            for (ApiResponseDTO resp : endpoint.getResponses()) {
                ApiResponse apiResponse = new ApiResponse()
                        .description(resp.getDescription() != null ? resp.getDescription() : "");
                if (resp.getBodySchema() != null && !resp.getBodySchema().isBlank()) {
                    Schema<?> schema = jsonStringToSchema(resp.getBodySchema());
                    apiResponse.setContent(new Content().addMediaType("application/json",
                            new MediaType().schema(schema)));
                }
                if (resp.getHeaders() != null && !resp.getHeaders().isEmpty()) {
                    Map<String, Header> headers = new LinkedHashMap<>();
                    for (Map.Entry<String, String> h : resp.getHeaders().entrySet()) {
                        headers.put(h.getKey(), new Header()
                                .description(h.getValue())
                                .schema(new StringSchema()));
                    }
                    apiResponse.setHeaders(headers);
                }
                apiResponses.addApiResponse(resp.getStatusCode(), apiResponse);
            }
        }
        operation.setResponses(apiResponses);
        return operation;
    }

    private List<EndpointDTO> pathItemToEndpoints(String path, PathItem pathItem) {
        List<EndpointDTO> endpoints = new ArrayList<>();
        Map<String, Operation> operationMap = new LinkedHashMap<>();
        if (pathItem.getGet() != null) operationMap.put("GET", pathItem.getGet());
        if (pathItem.getPost() != null) operationMap.put("POST", pathItem.getPost());
        if (pathItem.getPut() != null) operationMap.put("PUT", pathItem.getPut());
        if (pathItem.getDelete() != null) operationMap.put("DELETE", pathItem.getDelete());
        if (pathItem.getPatch() != null) operationMap.put("PATCH", pathItem.getPatch());
        if (pathItem.getOptions() != null) operationMap.put("OPTIONS", pathItem.getOptions());
        if (pathItem.getHead() != null) operationMap.put("HEAD", pathItem.getHead());

        for (Map.Entry<String, Operation> entry : operationMap.entrySet()) {
            Operation operation = entry.getValue();
            EndpointDTO endpoint = new EndpointDTO();
            endpoint.setPath(path);
            endpoint.setMethod(entry.getKey());
            endpoint.setSummary(operation.getSummary());
            endpoint.setDescription(operation.getDescription());
            endpoint.setOperationId(operation.getOperationId());
            endpoint.setDeprecated(Boolean.TRUE.equals(operation.getDeprecated()));
            endpoint.setSecured(operation.getSecurity() != null && !operation.getSecurity().isEmpty());
            if (operation.getTags() != null) {
                endpoint.setTags(new ArrayList<>(operation.getTags()));
            }

            if (operation.getParameters() != null) {
                List<ApiParameterDTO> params = new ArrayList<>();
                for (Parameter param : operation.getParameters()) {
                    ApiParameterDTO ap = new ApiParameterDTO();
                    ap.setName(param.getName());
                    ap.setParamIn(param.getIn());
                    ap.setRequired(Boolean.TRUE.equals(param.getRequired()));
                    ap.setDescription(param.getDescription());
                    if (param.getSchema() != null) {
                        ap.setType(param.getSchema().getType() != null ? param.getSchema().getType() : "string");
                        ap.setFormat(param.getSchema().getFormat());
                    }
                    params.add(ap);
                }
                endpoint.setParameters(params);
            }

            if (operation.getRequestBody() != null) {
                RequestBody rb = operation.getRequestBody();
                endpoint.setRequestBodyRequired(Boolean.TRUE.equals(rb.getRequired()));
                Schema<?> schema = extractBodySchema(rb.getContent());
                if (schema != null) {
                    endpoint.setRequestBodySchema(schemaToJsonString(schema));
                }
            }

            if (operation.getResponses() != null) {
                List<ApiResponseDTO> responses = new ArrayList<>();
                for (Map.Entry<String, ApiResponse> respEntry : operation.getResponses().entrySet()) {
                    ApiResponse apiResponse = respEntry.getValue();
                    ApiResponseDTO resp = new ApiResponseDTO();
                    resp.setStatusCode(respEntry.getKey());
                    resp.setDescription(apiResponse.getDescription());
                    if (apiResponse.getHeaders() != null && !apiResponse.getHeaders().isEmpty()) {
                        Map<String, String> headers = new LinkedHashMap<>();
                        apiResponse.getHeaders().forEach((name, header) ->
                                headers.put(name, header.getDescription() != null ? header.getDescription() : ""));
                        resp.setHeaders(headers);
                    }
                    Schema<?> schema = extractBodySchema(apiResponse.getContent());
                    if (schema != null) {
                        resp.setBodySchema(schemaToJsonString(schema));
                    }
                    responses.add(resp);
                }
                endpoint.setResponses(responses);
            }

            endpoints.add(endpoint);
        }
        return endpoints;
    }

    private Schema<?> buildSchema(String type, String itemsType, String format) {
        if (type == null) type = "string";
        Schema<?> schema;
        switch (type) {
            case "integer" -> schema = new IntegerSchema();
            case "number" -> schema = new NumberSchema();
            case "boolean" -> schema = new BooleanSchema();
            case "array" -> {
                ArraySchema arr = new ArraySchema();
                arr.setItems(buildSchema(itemsType, null, null));
                return arr;
            }
            case "object" -> schema = new ObjectSchema();
            default -> schema = new StringSchema();
        }
        if (format != null) schema.setFormat(format);
        return schema;
    }

    /**
     * Pick the body schema from a content map: exactly application/json first
     * (tolerating parameters like "application/json; charset=UTF-8"), then any
     * JSON media type, then the first entry at all.
     */
    private Schema<?> extractBodySchema(Content content) {
        if (content == null || content.isEmpty()) {
            return null;
        }
        for (Map.Entry<String, MediaType> entry : content.entrySet()) {
            if ("application/json".equalsIgnoreCase(baseMediaType(entry.getKey()))) {
                return entry.getValue().getSchema();
            }
        }
        for (Map.Entry<String, MediaType> entry : content.entrySet()) {
            if (baseMediaType(entry.getKey()).toLowerCase().contains("json")) {
                return entry.getValue().getSchema();
            }
        }
        return content.values().iterator().next().getSchema();
    }

    private String baseMediaType(String mediaType) {
        int idx = mediaType.indexOf(';');
        return (idx >= 0 ? mediaType.substring(0, idx) : mediaType).trim();
    }

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
        if (map.containsKey("$ref")) {
            Schema<?> ref = new Schema<>();
            ref.set$ref((String) map.get("$ref"));
            return ref;
        }
        String type = (String) map.getOrDefault("type", "object");
        Schema<?> schema;
        switch (type) {
            case "integer" -> schema = new IntegerSchema();
            case "number" -> schema = new NumberSchema();
            case "boolean" -> schema = new BooleanSchema();
            case "string" -> schema = new StringSchema();
            case "array" -> {
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
        if (map.containsKey("default")) schema.setDefault(map.get("default"));
        if (map.containsKey("enum")) schema.setEnum((List) map.get("enum"));
        if (map.containsKey("nullable")) schema.setNullable((Boolean) map.get("nullable"));
        if (map.containsKey("minLength")) schema.setMinLength((Integer) map.get("minLength"));
        if (map.containsKey("maxLength")) schema.setMaxLength((Integer) map.get("maxLength"));
        if (map.containsKey("pattern")) schema.setPattern((String) map.get("pattern"));
        if (map.containsKey("minItems")) schema.setMinItems((Integer) map.get("minItems"));
        if (map.containsKey("maxItems")) schema.setMaxItems((Integer) map.get("maxItems"));
        if (map.containsKey("additionalProperties")) {
            Object ap = map.get("additionalProperties");
            if (ap instanceof Boolean b) {
                schema.setAdditionalProperties(b);
            } else if (ap instanceof Map) {
                schema.setAdditionalProperties(mapToSchema((Map<String, Object>) ap));
            }
        }
        if (map.containsKey("oneOf")) schema.setOneOf(mapToSchemaList((List<Object>) map.get("oneOf")));
        if (map.containsKey("anyOf")) schema.setAnyOf(mapToSchemaList((List<Object>) map.get("anyOf")));
        if (map.containsKey("allOf")) schema.setAllOf(mapToSchemaList((List<Object>) map.get("allOf")));
        if (map.containsKey("properties")) {
            Map<String, Object> props = (Map<String, Object>) map.get("properties");
            Map<String, Schema> schemaProps = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : props.entrySet()) {
                if (entry.getValue() instanceof Map) {
                    schemaProps.put(entry.getKey(), mapToSchema((Map<String, Object>) entry.getValue()));
                }
            }
            schema.setProperties(schemaProps);
            Object required = map.get("required");
            if (required instanceof List) {
                schema.setRequired((List<String>) required);
            }
        }
        return schema;
    }

    @SuppressWarnings("unchecked")
    private List<Schema> mapToSchemaList(List<Object> list) {
        List<Schema> result = new ArrayList<>();
        if (list != null) {
            for (Object o : list) {
                if (o instanceof Map) {
                    result.add(mapToSchema((Map<String, Object>) o));
                }
            }
        }
        return result;
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
        if (schema.get$ref() != null) {
            map.put("$ref", schema.get$ref());
            return map;
        }
        if (schema.getType() != null) map.put("type", schema.getType());
        if (schema.getFormat() != null) map.put("format", schema.getFormat());
        if (schema.getDescription() != null) map.put("description", schema.getDescription());
        if (schema.getExample() != null) map.put("example", schema.getExample());
        if (schema.getDefault() != null) map.put("default", schema.getDefault());
        if (schema.getEnum() != null && !schema.getEnum().isEmpty()) map.put("enum", schema.getEnum());
        if (Boolean.TRUE.equals(schema.getNullable())) map.put("nullable", true);
        if (schema.getMinLength() != null) map.put("minLength", schema.getMinLength());
        if (schema.getMaxLength() != null) map.put("maxLength", schema.getMaxLength());
        if (schema.getPattern() != null) map.put("pattern", schema.getPattern());
        if (schema.getMinItems() != null) map.put("minItems", schema.getMinItems());
        if (schema.getMaxItems() != null) map.put("maxItems", schema.getMaxItems());
        if (schema.getAdditionalProperties() != null) {
            Object ap = schema.getAdditionalProperties();
            if (ap instanceof Schema) {
                map.put("additionalProperties", schemaToMap((Schema<?>) ap));
            } else {
                map.put("additionalProperties", ap);
            }
        }
        if (schema.getOneOf() != null && !schema.getOneOf().isEmpty()) {
            map.put("oneOf", schema.getOneOf().stream().map(this::schemaToMap).toList());
        }
        if (schema.getAnyOf() != null && !schema.getAnyOf().isEmpty()) {
            map.put("anyOf", schema.getAnyOf().stream().map(this::schemaToMap).toList());
        }
        if (schema.getAllOf() != null && !schema.getAllOf().isEmpty()) {
            map.put("allOf", schema.getAllOf().stream().map(this::schemaToMap).toList());
        }
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
}
