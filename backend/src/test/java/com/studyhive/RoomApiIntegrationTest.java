package com.studyhive;

import com.fasterxml.jackson.databind.JsonNode;
import com.studyhive.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RoomApiIntegrationTest extends IntegrationTest {

    private List<String> roomNumbers(JsonNode page) {
        List<String> numbers = new ArrayList<>();
        page.get("content").forEach(r -> numbers.add(r.get("roomNumber").asText()));
        return numbers;
    }

    @Test
    void listsOnlyActiveRoomsWithoutAvailabilityWhenNoDateGiven() throws Exception {
        JsonNode page = body(mvc.perform(get("/api/rooms")).andExpect(status().isOk()).andReturn());
        assertThat(roomNumbers(page)).containsExactlyInAnyOrder("G-101", "G-102", "F-201", "F-202", "F-203");
        assertThat(page.get("content").get(0).has("availability")).isFalse();
        assertThat(page.get("content").get(0).has("hourlyPrice")).isFalse();
    }

    @Test
    void filtersByGroupSizeAmenitiesAndText() throws Exception {
        assertThat(roomNumbers(body(mvc.perform(get("/api/rooms").param("groupSize", "8")).andReturn())))
                .containsExactlyInAnyOrder("G-102", "F-201");
        assertThat(roomNumbers(body(mvc.perform(get("/api/rooms").param("amenities", "display", "whiteboard")).andReturn())))
                .containsExactlyInAnyOrder("G-102", "F-202");
        assertThat(roomNumbers(body(mvc.perform(get("/api/rooms").param("q", "idea")).andReturn())))
                .containsExactly("F-202");
        assertThat(roomNumbers(body(mvc.perform(get("/api/rooms").param("q", "f-20")).andReturn())))
                .containsExactlyInAnyOrder("F-201", "F-202", "F-203");
    }

    @Test
    void sortsAndPaginates() throws Exception {
        JsonNode page = body(mvc.perform(get("/api/rooms").param("sort", "capacity_desc").param("size", "2")).andReturn());
        assertThat(page.get("totalElements").asInt()).isEqualTo(5);
        assertThat(page.get("totalPages").asInt()).isEqualTo(3);
        assertThat(page.get("content").get(0).get("maximumCapacity").asInt()).isEqualTo(8);
    }

    @Test
    void availabilityReflectsPersistedBookingsAndBlocks() throws Exception {
        Long hive = roomId("G-102");
        book(student("avail"), hive, tuesdayAt(10), tuesdayAt(12), 4);
        jdbc.update("INSERT INTO blocked_periods (room_id, start_time, end_time, reason, created_at) VALUES (?, ?, ?, 'Cleaning', NOW(6))",
                hive, tuesdayAt(15), tuesdayAt(16));

        JsonNode day = body(mvc.perform(get("/api/rooms/{id}/availability", hive).param("date", "2031-03-04"))
                .andExpect(status().isOk()).andReturn());
        assertThat(day.get("open").asBoolean()).isTrue();
        assertThat(day.get("slots")).hasSize(12); // 09:00-21:00 in 60-minute slots
        JsonNode slots = day.get("slots");
        assertThat(slots.get(0).get("status").asText()).isEqualTo("AVAILABLE"); // 09-10
        assertThat(slots.get(1).get("status").asText()).isEqualTo("BOOKED");    // 10-11
        assertThat(slots.get(2).get("status").asText()).isEqualTo("BOOKED");    // 11-12
        assertThat(slots.get(6).get("status").asText()).isEqualTo("BLOCKED");   // 15-16
    }

    @Test
    void pastAndClosedDaysAreReported() throws Exception {
        Long hive = roomId("G-102");
        JsonNode past = body(mvc.perform(get("/api/rooms/{id}/availability", hive).param("date", "2031-03-01")).andReturn());
        past.get("slots").forEach(s -> assertThat(s.get("status").asText()).isEqualTo("PAST"));

        JsonNode inactive = body(mvc.perform(get("/api/rooms/{id}/availability", roomId("G-103")).param("date", "2031-03-04")).andReturn());
        assertThat(inactive.get("roomActive").asBoolean()).isFalse();
        inactive.get("slots").forEach(s -> assertThat(s.get("status").asText()).isEqualTo("CLOSED"));
    }

    @Test
    void exactWindowSearchExcludesBookedRoomsWhenAvailableOnly() throws Exception {
        book(student("taken"), roomId("G-102"), tuesdayAt(10), tuesdayAt(12), 4);
        JsonNode all = body(mvc.perform(get("/api/rooms").param("date", "2031-03-04").param("startTime", "10:00")
                .param("duration", "60")).andReturn());
        JsonNode hive = null;
        for (JsonNode r : all.get("content")) {
            if (r.get("roomNumber").asText().equals("G-102")) {
                hive = r;
            }
        }
        assertThat(hive).isNotNull();
        assertThat(hive.get("availability").get("status").asText()).isEqualTo("UNAVAILABLE");

        JsonNode free = body(mvc.perform(get("/api/rooms").param("date", "2031-03-04").param("startTime", "10:00")
                .param("duration", "60").param("availableOnly", "true")).andReturn());
        assertThat(roomNumbers(free)).doesNotContain("G-102").hasSize(4);
    }

    @Test
    void dateOnlySearchCountsFreeSlots() throws Exception {
        book(student("count"), roomId("G-101"), tuesdayAt(10), tuesdayAt(13), 4);
        JsonNode page = body(mvc.perform(get("/api/rooms").param("date", "2031-03-04").param("q", "G-101")).andReturn());
        JsonNode availability = page.get("content").get(0).get("availability");
        assertThat(availability.get("freeSlots").asInt()).isEqualTo(9);
        assertThat(availability.get("totalSlots").asInt()).isEqualTo(12);
    }

    @Test
    void invalidParametersAreRejected() throws Exception {
        mvc.perform(get("/api/rooms").param("startTime", "10:00")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("date"));
        mvc.perform(get("/api/rooms").param("date", "not-a-date")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/rooms").param("groupSize", "0")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/rooms/{id}/availability", roomId("G-102"))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/rooms/999999")).andExpect(status().isNotFound());
    }

    @Test
    void detailIncludesAmenitiesHoursAndRules() throws Exception {
        mvc.perform(get("/api/rooms/{id}", roomId("G-102")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("The Hive Room"))
                .andExpect(jsonPath("$.weeklyHours.length()").value(7))
                .andExpect(jsonPath("$.weeklyHours[6].openTime").value("10:00:00"))
                .andExpect(jsonPath("$.rules.slotDurationMinutes").value(60))
                .andExpect(jsonPath("$.rules.timeZone").value("Asia/Kolkata"))
                .andExpect(jsonPath("$.amenities[?(@.code == 'hearing-loop')]").exists());
    }

    @Test
    void publicConfigUsesServerClockAndZone() throws Exception {
        mvc.perform(get("/api/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.today").value("2031-03-03"))
                .andExpect(jsonPath("$.timeZone").value("Asia/Kolkata"))
                .andExpect(jsonPath("$.passwordResetEmailEnabled").value(false))
                .andExpect(jsonPath("$.defaultHours.length()").value(7))
                .andExpect(jsonPath("$.defaultHours[0].openTime").value("09:00:00"));
    }
}
