package com.swaggereditor.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "api_parameters")
@Getter @Setter @NoArgsConstructor
public class ApiParameter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "endpoint_id", nullable = false)
    private Endpoint endpoint;

    @Column(nullable = false)
    private String name;

    /** query | path | header | cookie */
    @Column(name = "param_in", nullable = false)
    private String paramIn;

    /** string | integer | number | boolean | array | object */
    private String type = "string";

    /** For array type: items type */
    private String itemsType;

    @Column(nullable = false)
    private Boolean required = false;

    private String description;

    private String example;

    @Column(name = "default_value")
    private String defaultValue;

    /** Additional format: int32, int64, float, double, date, date-time, uuid */
    private String format;
}
