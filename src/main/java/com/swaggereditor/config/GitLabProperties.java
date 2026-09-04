package com.swaggereditor.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

@ConfigurationProperties(prefix = "gitlab")
public record GitLabProperties(
        String token,
        String project,
        String branch,
        String url
) {

    @ConstructorBinding
    public GitLabProperties {
        if (branch == null || branch.isBlank()) {
            branch = "main";
        }
        if (url == null || url.isBlank()) {
            url = "https://gitlab.com";
        }
        url = url.trim().replaceAll("/+$", "");
    }

    public String branch() {
        return branch;
    }

    public String url() {
        return url;
    }
}
