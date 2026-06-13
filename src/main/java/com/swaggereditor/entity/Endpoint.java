package com.swaggereditor.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "endpoints")
@Getter @Setter @NoArgsConstructor
public class Endpoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false)
    private String path;

    @Column(nullable = false)
    private String method;

    private String summary;
    private String description;
    private String tags;
    private String operationId;
    private Boolean deprecated = false;

    // Request body stored as JSON string (schema definition)
    @Column(name = "request_body_schema", columnDefinition = "TEXT")
    private String requestBodySchema;

    @Column(name = "request_body_required")
    private Boolean requestBodyRequired = false;

    @OneToMany(mappedBy = "endpoint", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<ApiParameter> parameters = new ArrayList<>();

    @OneToMany(mappedBy = "endpoint", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<ApiResponse> responses = new ArrayList<>();
}
