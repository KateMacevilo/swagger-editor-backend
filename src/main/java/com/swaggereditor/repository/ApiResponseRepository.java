package com.swaggereditor.repository;

import com.swaggereditor.entity.ApiResponse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApiResponseRepository extends JpaRepository<ApiResponse, Long> {
    List<ApiResponse> findByEndpointId(Long endpointId);
    void deleteByEndpointId(Long endpointId);
}
