package com.swaggereditor.service;

import com.swaggereditor.dto.ProjectDTO;
import com.swaggereditor.entity.Project;
import com.swaggereditor.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;

    public List<ProjectDTO> findAll() {
        return projectRepository.findAll().stream()
                .map(this::toSummaryDTO)
                .collect(Collectors.toList());
    }

    public ProjectDTO findById(Long id) {
        Project project = getOrThrow(id);
        return toDetailDTO(project);
    }

    @Transactional
    public ProjectDTO create(ProjectDTO dto) {
        Project project = new Project();
        applyDTO(dto, project);
        return toSummaryDTO(projectRepository.save(project));
    }

    @Transactional
    public ProjectDTO update(Long id, ProjectDTO dto) {
        Project project = getOrThrow(id);
        applyDTO(dto, project);
        return toSummaryDTO(projectRepository.save(project));
    }

    @Transactional
    public void delete(Long id) {
        projectRepository.deleteById(id);
    }

    private void applyDTO(ProjectDTO dto, Project project) {
        project.setTitle(dto.getTitle());
        project.setDescription(dto.getDescription());
        project.setVersion(dto.getVersion() != null ? dto.getVersion() : "1.0.0");
        project.setTermsOfService(dto.getTermsOfService());
        project.setContactEmail(dto.getContactEmail());
        project.setLicenseName(dto.getLicenseName());
        project.setServerUrl(dto.getServerUrl());
        project.setServerDescription(dto.getServerDescription());
    }

    public ProjectDTO toSummaryDTO(Project project) {
        ProjectDTO dto = new ProjectDTO();
        dto.setId(project.getId());
        dto.setTitle(project.getTitle());
        dto.setDescription(project.getDescription());
        dto.setVersion(project.getVersion());
        dto.setTermsOfService(project.getTermsOfService());
        dto.setContactEmail(project.getContactEmail());
        dto.setLicenseName(project.getLicenseName());
        dto.setServerUrl(project.getServerUrl());
        dto.setServerDescription(project.getServerDescription());
        dto.setCreatedAt(project.getCreatedAt());
        dto.setUpdatedAt(project.getUpdatedAt());
        dto.setEndpointCount(project.getEndpoints().size());
        return dto;
    }

    private ProjectDTO toDetailDTO(Project project) {
        ProjectDTO dto = toSummaryDTO(project);
        return dto;
    }

    private Project getOrThrow(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Project not found: " + id));
    }
}
