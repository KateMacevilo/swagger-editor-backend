package com.swaggereditor.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.DefaultUriBuilderFactory;

@Configuration
@EnableConfigurationProperties(GitLabProperties.class)
public class GitLabConfig {

    @Bean
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        // URLs built by GitLabService are pre-encoded (e.g. group%2Fproject).
        // The default TEMPLATE_AND_VALUES mode would re-encode the '%' itself
        // (%2F -> %252F), so GitLab receives a wrong project id and answers
        // "404 Project Not Found". VALUES_ONLY keeps the template untouched.
        DefaultUriBuilderFactory factory = new DefaultUriBuilderFactory();
        factory.setEncodingMode(DefaultUriBuilderFactory.EncodingMode.VALUES_ONLY);
        restTemplate.setUriTemplateHandler(factory);
        return restTemplate;
    }
}
