package com.swaggereditor.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "api_responses")
@Getter @Setter @NoArgsConstructor
public class ApiResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "endpoint_id", nullable = false)
    private Endpoint endpoint;

    @Column(name = "status_code", nullable = false)
    private String statusCode;

    private String description;

    // Response body schema stored as JSON string
    @Column(name = "body_schema", columnDefinition = "TEXT")
    private String bodySchema;
}
