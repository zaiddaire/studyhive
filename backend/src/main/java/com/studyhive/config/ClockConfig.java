package com.studyhive.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * The server's clock is the single source of "now". It is pinned to the facility time zone
 * (APP_TIME_ZONE, default Asia/Kolkata) so that booking rules never depend on the client's clock.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock(AppProperties properties) {
        return Clock.system(properties.zoneId());
    }
}
