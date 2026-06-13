package com.swaggereditor.service;

import com.swaggereditor.dto.ApiParameterDTO;
import com.swaggereditor.dto.ApiResponseDTO;
import com.swaggereditor.dto.EndpointDTO;
import com.swaggereditor.entity.ApiParameter;
import com.swaggereditor.entity.ApiResponse;
import com.swaggereditor.entity.Endpoint;
import com.swaggereditor.entity.Project;
import com.swaggereditor.repository.EndpointRepository;
import com.swaggereditor.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EndpointService {

    private final EndpointRepository endpointRepository;
    private final ProjectRepository projectRepository;

    public List<EndpointDTO> findByProject(Long projectId) {
        return endpointRepository.findByProjectId(projectId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public EndpointDTO findById(Long id) {
        return toDTO(getOrThrow(id));
    }

    @Transactional
    public EndpointDTO create(Long projectId, EndpointDTO dto) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found: " + projectId));

        Endpoint endpoint = new Endpoint();
        endpoint.setProject(project);
        applyDTO(dto, endpoint);
        syncCollections(dto, endpoint);

        return toDTO(endpointRepository.save(endpoint));
    }

    @Transactional
    public EndpointDTO update(Long id, EndpointDTO dto) {
        Endpoint endpoint = getOrThrow(id);
        applyDTO(dto, endpoint);

        endpoint.getParameters().clear();
        endpoint.getResponses().clear();
        syncCollections(dto, endpoint);

        return toDTO(endpointRepository.save(endpoint));
    }

    @Transactional
    public void delete(Long id) {
        endpointRepository.deleteById(id);
    }

    private void applyDTO(EndpointDTO dto, Endpoint endpoint) {
        endpoint.setPath(dto.getPath());
        endpoint.setMethod(dto.getMethod().toUpperCase());
        endpoint.setSummary(dto.getSummary());
        endpoint.setDescription(dto.getDescription());
        endpoint.setTags(dto.getTags());
        endpoint.setOperationId(dto.getOperationId());
        endpoint.setDeprecated(dto.getDeprecated() != null && dto.getDeprecated());
        endpoint.setRequestBodySchema(dto.getRequestBodySchema());
        endpoint.setRequestBodyRequired(dto.getRequestBodyRequired() != null && dto.getRequestBodyRequired());
    }

    private void syncCollections(EndpointDTO dto, Endpoint endpoint) {
        if (dto.getParameters() != null) {
            for (ApiParameterDTO paramDTO : dto.getParameters()) {
                ApiParameter param = new ApiParameter();
                param.setEndpoint(endpoint);
                param.setName(paramDTO.getName());
                param.setParamIn(paramDTO.getParamIn());
                param.setType(paramDTO.getType() != null ? paramDTO.getType() : "string");
                param.setItemsType(paramDTO.getItemsType());
                param.setRequired(paramDTO.getRequired() != null && paramDTO.getRequired());
                param.setDescription(paramDTO.getDescription());
                param.setExample(paramDTO.getExample());
                param.setDefaultValue(paramDTO.getDefaultValue());
                param.setFormat(paramDTO.getFormat());
                endpoint.getParameters().add(param);
            }
        }

        if (dto.getResponses() != null) {
            for (ApiResponseDTO respDTO : dto.getResponses()) {
                ApiResponse resp = new ApiResponse();
                resp.setEndpoint(endpoint);
                resp.setStatusCode(respDTO.getStatusCode());
                resp.setDescription(respDTO.getDescription());
                resp.setBodySchema(respDTO.getBodySchema());
                endpoint.getResponses().add(resp);
            }
        }
    }

    public EndpointDTO toDTO(Endpoint endpoint) {
        EndpointDTO dto = new EndpointDTO();
        dto.setId(endpoint.getId());
        dto.setProjectId(endpoint.getProject().getId());
        dto.setPath(endpoint.getPath());
        dto.setMethod(endpoint.getMethod());
        dto.setSummary(endpoint.getSummary());
        dto.setDescription(endpoint.getDescription());
        dto.setTags(endpoint.getTags());
        dto.setOperationId(endpoint.getOperationId());
        dto.setDeprecated(endpoint.getDeprecated());
        dto.setRequestBodySchema(endpoint.getRequestBodySchema());
        dto.setRequestBodyRequired(endpoint.getRequestBodyRequired());

        dto.setParameters(endpoint.getParameters().stream()
                .map(this::paramToDTO)
                .collect(Collectors.toList()));

        dto.setResponses(endpoint.getResponses().stream()
                .map(this::responseToDTO)
                .collect(Collectors.toList()));

        return dto;
    }

    private ApiParameterDTO paramToDTO(ApiParameter p) {
        ApiParameterDTO dto = new ApiParameterDTO();
        dto.setId(p.getId());
        dto.setName(p.getName());
        dto.setParamIn(p.getParamIn());
        dto.setType(p.getType());
        dto.setItemsType(p.getItemsType());
        dto.setRequired(p.getRequired());
        dto.setDescription(p.getDescription());
        dto.setExample(p.getExample());
        dto.setDefaultValue(p.getDefaultValue());
        dto.setFormat(p.getFormat());
        return dto;
    }

    private ApiResponseDTO responseToDTO(ApiResponse r) {
        ApiResponseDTO dto = new ApiResponseDTO();
        dto.setId(r.getId());
        dto.setStatusCode(r.getStatusCode());
        dto.setDescription(r.getDescription());
        dto.setBodySchema(r.getBodySchema());
        return dto;
    }

    private Endpoint getOrThrow(Long id) {
        return endpointRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Endpoint not found: " + id));
    }
}
