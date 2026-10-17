package com.studyhive.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyhive.entity.AccountStatus;
import com.studyhive.entity.Role;
import com.studyhive.entity.User;
import com.studyhive.repository.RoomRepository;
import com.studyhive.repository.UserRepository;
import com.studyhive.security.RateLimiter;
import com.studyhive.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Base class for integration tests against a real MySQL 8 database in a throwaway container (never a shared or
 * production database). Flyway builds the schema from scratch; each test starts from the reference + demo seed
 * data with the clock fixed at {@link #NOW}.
 */
@SpringBootTest(properties = {
        "app.completion-job-interval-ms=3600000",
        "app.time-zone=Asia/Kolkata",
        "app.admin-bootstrap.email=",
        "app.admin-bootstrap.password="
})
@AutoConfigureMockMvc
@Import(IntegrationTest.TestClockConfig.class)
public abstract class IntegrationTest {

    @ServiceConnection
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>(DockerImageName.parse("mysql:8.4"));

    static {
        MYSQL.start();
    }

    /** Monday 3 March 2031, 08:00 in Asia/Kolkata. Facility default hours: Mon-Sat 09-21, Sun 10-18. */
    public static final LocalDateTime NOW = LocalDateTime.of(2031, 3, 3, 8, 0);
    public static final String PASSWORD = "Password123";

    @TestConfiguration
    static class TestClockConfig {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(NOW, ZoneId.of("Asia/Kolkata"));
        }
    }

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected ObjectMapper json;
    @Autowired
    protected JdbcTemplate jdbc;
    @Autowired
    protected MutableClock clock;
    @Autowired
    protected UserRepository users;
    @Autowired
    protected RoomRepository rooms;
    @Autowired
    protected PasswordEncoder passwordEncoder;
    @Autowired
    protected RateLimiter rateLimiter;

    @BeforeEach
    void resetState() {
        clock.set(NOW);
        rateLimiter.clear();
        jdbc.update("DELETE FROM booking_events");
        jdbc.update("DELETE FROM bookings");
        jdbc.update("DELETE FROM blocked_periods");
        jdbc.update("DELETE FROM password_reset_tokens");
        jdbc.update("DELETE FROM uploaded_images");
        jdbc.update("DELETE FROM SPRING_SESSION_ATTRIBUTES");
        jdbc.update("DELETE FROM SPRING_SESSION");
        jdbc.update("DELETE FROM users");
        jdbc.update("DELETE FROM operating_hours WHERE room_id IS NOT NULL");
        jdbc.update("DELETE FROM room_amenities WHERE room_id IN (SELECT id FROM rooms WHERE room_number NOT IN ('G-101','G-102','F-201','F-202','F-203','G-103'))");
        jdbc.update("DELETE FROM room_images WHERE room_id IN (SELECT id FROM (SELECT id FROM rooms WHERE room_number NOT IN ('G-101','G-102','F-201','F-202','F-203','G-103')) t)");
        jdbc.update("DELETE FROM rooms WHERE room_number NOT IN ('G-101','G-102','F-201','F-202','F-203','G-103')");
        jdbc.update("UPDATE rooms SET status = IF(room_number = 'G-103', 'INACTIVE', 'ACTIVE')");
        jdbc.update("UPDATE booking_settings SET slot_duration_minutes = 60, min_duration_minutes = 60, max_duration_minutes = 180, "
                + "advance_booking_days = 14, cancellation_deadline_minutes = 60, max_active_bookings_per_user = 5, pricing_enabled = FALSE");
        jdbc.update("DELETE FROM operating_hours WHERE room_id IS NULL");
        for (int d = 1; d <= 7; d++) {
            jdbc.update("INSERT INTO operating_hours (room_id, day_of_week, open_time, close_time, closed) VALUES (NULL, ?, ?, ?, FALSE)",
                    d, d == 7 ? "10:00:00" : "09:00:00", d == 7 ? "18:00:00" : "21:00:00");
        }
    }

    // ---- helpers -------------------------------------------------------------------------------

    protected User createUser(String email, Role role) {
        User u = new User();
        u.setEmail(email);
        u.setFullName(role == Role.ADMIN ? "Test Admin" : "Test Student");
        u.setPasswordHash(passwordEncoder.encode(PASSWORD));
        u.setRole(role);
        u.setAccountStatus(AccountStatus.ACTIVE);
        return users.saveAndFlush(u);
    }

    protected User student(String name) {
        return createUser(name + "@example.test", Role.STUDENT);
    }

    protected User admin() {
        return createUser("admin-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test", Role.ADMIN);
    }

    protected RequestPostProcessor as(User u) {
        return user(new UserPrincipal(u.getId(), u.getEmail(), u.getRole(), null));
    }

    protected Long roomId(String roomNumber) {
        return rooms.findByRoomNumberIgnoreCase(roomNumber).orElseThrow().getId();
    }

    protected String toJson(Object value) throws Exception {
        return json.writeValueAsString(value);
    }

    protected JsonNode body(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString());
    }

    protected Map<String, Object> bookingBody(Long roomId, LocalDateTime start, LocalDateTime end, int groupSize) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("roomId", roomId);
        body.put("startTime", start.toString());
        body.put("endTime", end.toString());
        body.put("groupName", "Test Group");
        body.put("groupSize", groupSize);
        body.put("purpose", "Revision");
        return body;
    }

    protected ResultActions book(User u, Long roomId, LocalDateTime start, LocalDateTime end, int groupSize) throws Exception {
        return mvc.perform(post("/api/bookings").with(as(u)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(bookingBody(roomId, start, end, groupSize))));
    }

    /** A Tuesday inside the default booking window (NOW + 1 day). */
    protected static LocalDateTime tuesdayAt(int hour) {
        return LocalDateTime.of(2031, 3, 4, hour, 0);
    }
}
