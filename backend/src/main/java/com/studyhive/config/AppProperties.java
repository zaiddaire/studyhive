package com.studyhive.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String timeZone,
        String frontendOrigins,
        String publicBaseUrl,
        long maxRequestBytes,
        Security security,
        Mail mail,
        AdminBootstrap adminBootstrap) {

    public ZoneId zoneId() {
        return ZoneId.of(timeZone == null || timeZone.isBlank() ? "Asia/Kolkata" : timeZone);
    }

    public List<String> allowedOrigins() {
        if (frontendOrigins == null) {
            return List.of();
        }
        return Arrays.stream(frontendOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !s.equals("*"))
                .toList();
    }

    public record Security(int maxLoginAttempts, int lockoutMinutes, boolean csrfCookieSecure, String csrfCookieSameSite) {
    }

    public record Mail(boolean enabled, String from) {
    }

    public record AdminBootstrap(String email, String password, String fullName) {
    }
}
