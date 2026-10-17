package com.studyhive;

import com.fasterxml.jackson.databind.JsonNode;
import com.studyhive.entity.User;
import com.studyhive.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminIntegrationTest extends IntegrationTest {

    private Map<String, Object> roomBody(String number, int min, int max) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("roomNumber", number);
        body.put("name", "The Test Room");
        body.put("description", "A room created by a test.");
        body.put("location", "Second floor");
        body.put("minimumCapacity", min);
        body.put("maximumCapacity", max);
        body.put("status", "ACTIVE");
        body.put("amenityIds", List.of(jdbc.queryForObject("SELECT id FROM amenities WHERE code = 'wifi'", Long.class)));
        body.put("images", List.of(Map.of("url", "https://images.unsplash.com/photo-1517502884422-41eaead166d4", "altText", "Room")));
        return body;
    }

    @Test
    void studentsCannotReachAdminEndpoints() throws Exception {
        User s = student("nosy");
        mvc.perform(get("/api/admin/stats").with(as(s))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/bookings").with(as(s))).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/rooms").with(as(s)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(roomBody("Z-1", 2, 6)))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void adminCreatesUpdatesAndValidatesRooms() throws Exception {
        User admin = admin();
        MvcResult created = mvc.perform(post("/api/admin/rooms").with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(roomBody("s-301", 3, 7))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomNumber").value("S-301"))
                .andReturn();
        long id = body(created).get("id").asLong();

        mvc.perform(post("/api/admin/rooms").with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(roomBody("S-301", 3, 7))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROOM_NUMBER_TAKEN"));
        mvc.perform(post("/api/admin/rooms").with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(roomBody("S-302", 8, 4))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("maximumCapacity"));
        Map<String, Object> badImage = roomBody("S-303", 2, 4);
        badImage.put("images", List.of(Map.of("url", "javascript:alert(1)", "altText", "x")));
        mvc.perform(post("/api/admin/rooms").with(as(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(toJson(badImage))).andExpect(status().isBadRequest());

        Map<String, Object> update = roomBody("S-301", 2, 8);
        update.put("name", "Renamed Room");
        mvc.perform(put("/api/admin/rooms/{id}", id).with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed Room"))
                .andExpect(jsonPath("$.maximumCapacity").value(8));

        // Never booked: may be deleted.
        mvc.perform(delete("/api/admin/rooms/{id}", id).with(as(admin)).with(csrf())).andExpect(status().isNoContent());
    }

    @Test
    void roomsWithHistoryAreDeactivatedNotDeleted() throws Exception {
        User admin = admin();
        Long hive = roomId("G-102");
        book(student("hist"), hive, tuesdayAt(10), tuesdayAt(11), 4).andExpect(status().isCreated());

        mvc.perform(delete("/api/admin/rooms/{id}", hive).with(as(admin)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROOM_HAS_HISTORY"));

        // Deactivate but keep existing bookings.
        mvc.perform(patch("/api/admin/rooms/{id}/status", hive).with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\",\"cancelFutureBookings\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.futureBookings").value(1))
                .andExpect(jsonPath("$.cancelledBookings").value(0));
        assertThat(jdbc.queryForObject("SELECT status FROM bookings WHERE room_id = ?", String.class, hive)).isEqualTo("CONFIRMED");
        book(student("after"), hive, tuesdayAt(14), tuesdayAt(15), 4).andExpect(jsonPath("$.code").value("ROOM_INACTIVE"));

        // Deactivate and cancel future bookings.
        mvc.perform(patch("/api/admin/rooms/{id}/status", hive).with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"INACTIVE\",\"cancelFutureBookings\":true,\"reason\":\"Flooding\"}"))
                .andExpect(jsonPath("$.cancelledBookings").value(1));
        assertThat(jdbc.queryForObject("SELECT cancellation_reason FROM bookings WHERE room_id = ?", String.class, hive)).isEqualTo("Flooding");
    }

    @Test
    void blockedPeriodCanCancelAffectedBookings() throws Exception {
        User admin = admin();
        Long hive = roomId("G-102");
        book(student("affected"), hive, tuesdayAt(10), tuesdayAt(11), 4).andExpect(status().isCreated());

        Map<String, Object> block = new LinkedHashMap<>();
        block.put("roomId", hive);
        block.put("startTime", tuesdayAt(9).toString());
        block.put("endTime", tuesdayAt(13).toString());
        block.put("reason", "Projector repair");
        block.put("cancelAffectedBookings", true);
        mvc.perform(post("/api/admin/schedule/blocks").with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(block)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.affectedBookings.length()").value(1))
                .andExpect(jsonPath("$.cancelledCount").value(1));

        mvc.perform(get("/api/admin/schedule/blocks").with(as(admin)))
                .andExpect(jsonPath("$[0].reason").value("Projector repair"));
    }

    @Test
    void roomSpecificHoursOverrideTheDefault() throws Exception {
        User admin = admin();
        Long focus = roomId("G-101");
        List<Map<String, Object>> days = new ArrayList<>();
        for (int d = 1; d <= 7; d++) {
            Map<String, Object> day = new LinkedHashMap<>();
            day.put("dayOfWeek", d);
            day.put("closed", d == 2); // closed on Tuesdays
            day.put("openTime", d == 2 ? null : "08:00");
            day.put("closeTime", d == 2 ? null : "12:00");
            days.add(day);
        }
        mvc.perform(put("/api/admin/rooms/{id}/hours", focus).with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("useDefault", false, "days", days))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usesDefault").value(false));

        book(student("tue"), focus, tuesdayAt(10), tuesdayAt(11), 3)
                .andExpect(jsonPath("$.code").value("ROOM_CLOSED"));
        // Other rooms still follow the default schedule.
        book(student("other"), roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 3).andExpect(status().isCreated());
    }

    @Test
    void settingsAreValidated() throws Exception {
        User admin = admin();
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("slotDurationMinutes", 30);
        settings.put("minDurationMinutes", 45);
        settings.put("maxDurationMinutes", 120);
        settings.put("advanceBookingDays", 7);
        settings.put("cancellationDeadlineMinutes", 30);
        settings.put("maxActiveBookingsPerUser", 3);
        settings.put("pricingEnabled", false);
        mvc.perform(put("/api/admin/schedule/settings").with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(settings)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("minDurationMinutes"));
        settings.put("minDurationMinutes", 30);
        mvc.perform(put("/api/admin/schedule/settings").with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(settings)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slotDurationMinutes").value(30));
        // Half-hour slots are now bookable.
        book(student("half"), roomId("G-102"), tuesdayAt(10).plusMinutes(30), tuesdayAt(11), 4).andExpect(status().isCreated());
    }

    @Test
    void adminCancelsWithReasonAndSearchesBookings() throws Exception {
        User admin = admin();
        long id = body(book(student("searchme"), roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 4).andReturn()).get("id").asLong();
        String reference = jdbc.queryForObject("SELECT booking_reference FROM bookings WHERE id = ?", String.class, id);

        mvc.perform(get("/api/admin/bookings").with(as(admin)).param("reference", reference.substring(3)))
                .andExpect(jsonPath("$.content[0].id").value(id));
        mvc.perform(get("/api/admin/bookings").with(as(admin)).param("student", "searchme"))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/admin/bookings").with(as(admin)).param("status", "CANCELLED"))
                .andExpect(jsonPath("$.totalElements").value(0));

        mvc.perform(post("/api/admin/bookings/{id}/cancel", id).with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/bookings/{id}/cancel", id).with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Double booked by mistake\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledByAdmin").value(true));
    }

    @Test
    void statsAreComputedFromData() throws Exception {
        User admin = admin();
        User s = student("stats");
        book(s, roomId("G-102"), tuesdayAt(10), tuesdayAt(12), 4).andExpect(status().isCreated());
        long cancelId = body(book(s, roomId("F-201"), tuesdayAt(14), tuesdayAt(15), 4).andReturn()).get("id").asLong();
        mvc.perform(post("/api/bookings/{id}/cancel", cancelId).with(as(s)).with(csrf())).andExpect(status().isOk());

        JsonNode stats = body(mvc.perform(get("/api/admin/stats").with(as(admin))).andExpect(status().isOk()).andReturn());
        assertThat(stats.get("totalRooms").asLong()).isEqualTo(6);
        assertThat(stats.get("activeRooms").asLong()).isEqualTo(5);
        assertThat(stats.get("totalStudents").asLong()).isEqualTo(1);
        assertThat(stats.get("upcomingReservations").asLong()).isEqualTo(1);
        assertThat(stats.get("cancelledReservations").asLong()).isEqualTo(1);
        assertThat(stats.get("next7Days").get(1).get("bookings").asLong()).isEqualTo(1);
        assertThat(stats.get("recentActivity").get(0).get("type").asText()).isEqualTo("CANCELLED_BY_STUDENT");
    }

    @Test
    void userManagementNeverExposesPasswordsAndSuspensionEndsSessions() throws Exception {
        User admin = admin();
        student("member");
        MvcResult login = mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", "member@example.test", "password", PASSWORD)))).andReturn();
        Cookie session = login.getResponse().getCookie("STUDYHIVE_SESSION");
        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isOk());

        MvcResult list = mvc.perform(get("/api/admin/users").with(as(admin)).param("q", "member")).andReturn();
        String raw = list.getResponse().getContentAsString();
        assertThat(raw).doesNotContain("password").doesNotContain("$2a$");
        long memberId = body(list).get("content").get(0).get("id").asLong();

        mvc.perform(patch("/api/admin/users/{id}/status", memberId).with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"SUSPENDED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("SUSPENDED"));
        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isUnauthorized());

        mvc.perform(patch("/api/admin/users/{id}/status", admin.getId()).with(as(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"SUSPENDED\"}"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void imageUploadChecksFileContent() throws Exception {
        User admin = admin();
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0, 0, 0};
        MvcResult uploaded = mvc.perform(multipart("/api/admin/uploads/images")
                        .file(new MockMultipartFile("file", "room.png", "image/png", png)).with(as(admin)).with(csrf()))
                .andExpect(status().isCreated()).andReturn();
        String url = body(uploaded).get("url").asText();
        mvc.perform(get(url)).andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().contentType("image/png"));

        mvc.perform(multipart("/api/admin/uploads/images")
                        .file(new MockMultipartFile("file", "evil.png", "image/png", "<script>".getBytes())).with(as(admin)).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_IMAGE"));
    }
}
