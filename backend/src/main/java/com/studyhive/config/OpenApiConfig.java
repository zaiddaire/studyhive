package com.studyhive.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI studyHiveOpenApi() {
        return new OpenAPI().info(new Info()
                .title("StudyHive API")
                .version("1.0.0")
                .description("Group study room booking platform. Authentication uses an HTTP-only session cookie; "
                        + "state-changing requests must send the X-XSRF-TOKEN header with the value of the XSRF-TOKEN cookie."));
    }
}
