package com.swaggereditor.repository;

import com.swaggereditor.entity.Endpoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EndpointRepository extends JpaRepository<Endpoint, Long> {
    List<Endpoint> findByProjectId(Long projectId);
    void deleteByProjectId(Long projectId);
}
