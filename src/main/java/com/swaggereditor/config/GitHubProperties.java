package com.swaggereditor.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

@ConfigurationProperties(prefix = "github")
public record GitHubProperties(
        String token,
        String owner,
        String repo,
        String branch
) {

    @ConstructorBinding
    public GitHubProperties {
        if (branch == null || branch.isBlank()) {
            branch = "main";
        }
    }

    public String branch() {
        return branch;
    }
}
