package com.studyhive.security;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Small in-memory fixed-window limiter used for brute-force protection on login, registration and password
 * reset. Suitable for the single-instance deployment this project targets; a multi-instance deployment should
 * move these counters to a shared store.
 */
@Component
public class RateLimiter {

    private record Window(Instant start, int count) {
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    /** Records one hit and returns true if the caller is still within {@code limit} hits per {@code window}. */
    public boolean tryAcquire(String key, int limit, Duration window) {
        Instant now = clock.instant();
        Window updated = windows.compute(key, (k, w) -> {
            if (w == null || w.start().plus(window).isBefore(now)) {
                return new Window(now, 1);
            }
            return new Window(w.start(), w.count() + 1);
        });
        return updated.count() <= limit;
    }

    /** True if the key has already reached the limit within the window (does not record a hit). */
    public boolean isBlocked(String key, int limit, Duration window) {
        Window w = windows.get(key);
        return w != null && !w.start().plus(window).isBefore(clock.instant()) && w.count() >= limit;
    }

    public void reset(String key) {
        windows.remove(key);
    }

    /** Clears all counters (used by tests). */
    public void clear() {
        windows.clear();
    }

    @Scheduled(fixedDelay = 600_000)
    void evictStale() {
        Instant cutoff = clock.instant().minus(Duration.ofHours(2));
        windows.entrySet().removeIf(e -> e.getValue().start().isBefore(cutoff));
    }
}
