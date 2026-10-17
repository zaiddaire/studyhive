package com.studyhive;

import com.fasterxml.jackson.databind.JsonNode;
import com.studyhive.entity.User;
import com.studyhive.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BookingIntegrationTest extends IntegrationTest {

    @Test
    void studentBooksWholeRoomForGroup() throws Exception {
        User asha = student("asha");
        MvcResult result = book(asha, roomId("G-102"), tuesdayAt(10), tuesdayAt(12), 6)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.room.roomNumber").value("G-102"))
                .andExpect(jsonPath("$.groupSize").value(6))
                .andExpect(jsonPath("$.cancellable").value(true))
                .andReturn();
        String reference = body(result).get("bookingReference").asText();
        assertThat(reference).matches("SH-[2-9A-Z]{6}");

        Integer persisted = jdbc.queryForObject("SELECT COUNT(*) FROM bookings WHERE booking_reference = ?", Integer.class, reference);
        assertThat(persisted).isEqualTo(1);

        mvc.perform(get("/api/bookings/my").with(as(asha)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].bookingReference").value(reference));
    }

    @Test
    void overlappingBookingForSameRoomIsRejectedWith409() throws Exception {
        Long room = roomId("G-102");
        book(student("first"), room, tuesdayAt(10), tuesdayAt(12), 4).andExpect(status().isCreated());

        book(student("second"), room, tuesdayAt(11), tuesdayAt(13), 4)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SLOT_TAKEN"));
        // Touching (back-to-back) bookings do not overlap.
        book(student("third"), room, tuesdayAt(12), tuesdayAt(13), 4).andExpect(status().isCreated());
    }

    @Test
    void differentRoomsCanBeBookedForTheSamePeriod() throws Exception {
        book(student("a"), roomId("G-102"), tuesdayAt(14), tuesdayAt(16), 5).andExpect(status().isCreated());
        book(student("b"), roomId("F-201"), tuesdayAt(14), tuesdayAt(16), 5).andExpect(status().isCreated());
    }

    @Test
    void groupSizeMustFitRoomCapacity() throws Exception {
        book(student("big"), roomId("G-101"), tuesdayAt(10), tuesdayAt(11), 9)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GROUP_SIZE_OUT_OF_RANGE"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("groupSize"));
        book(student("small"), roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 1)
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void bookingsInThePastAreRejected() throws Exception {
        LocalDateTime yesterday = NOW.minusDays(1).withHour(10);
        book(student("past"), roomId("G-102"), yesterday, yesterday.plusHours(1), 4)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("IN_PAST"));
    }

    @Test
    void timeRangeAndHoursAreValidated() throws Exception {
        User u = student("range");
        Long room = roomId("G-102");
        book(u, room, tuesdayAt(12), tuesdayAt(11), 4)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_TIME_RANGE"));
        book(u, room, tuesdayAt(20), tuesdayAt(22), 4)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("OUTSIDE_OPERATING_HOURS"));
        book(u, room, tuesdayAt(10).plusMinutes(30), tuesdayAt(11).plusMinutes(30), 4)
                .andExpect(jsonPath("$.code").value("MISALIGNED_TIME"));
        book(u, room, tuesdayAt(9), tuesdayAt(13), 4)
                .andExpect(jsonPath("$.code").value("DURATION_TOO_LONG"));
        book(u, room, NOW.plusDays(15).withHour(10), NOW.plusDays(15).withHour(11), 4)
                .andExpect(jsonPath("$.code").value("TOO_FAR_AHEAD"));
    }

    @Test
    void missingOrMalformedDatesAreRejected() throws Exception {
        User u = student("dates");
        mvc.perform(post("/api/bookings").with(as(u)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("roomId", roomId("G-102"), "groupSize", 4))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(post("/api/bookings").with(as(u)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\":1,\"startTime\":\"not-a-date\",\"endTime\":\"2031-03-04T11:00\",\"groupSize\":4}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void inactiveRoomsCannotBeBooked() throws Exception {
        book(student("closed"), roomId("G-103"), tuesdayAt(10), tuesdayAt(11), 5)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROOM_INACTIVE"));
    }

    @Test
    void blockedPeriodsPreventBookings() throws Exception {
        Long room = roomId("G-102");
        jdbc.update("INSERT INTO blocked_periods (room_id, start_time, end_time, reason, created_at) VALUES (?, ?, ?, 'Maintenance', NOW(6))",
                room, tuesdayAt(13), tuesdayAt(15));
        book(student("blocked"), room, tuesdayAt(14), tuesdayAt(16), 4)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROOM_BLOCKED"));
        // A facility-wide block (room_id NULL) applies to every room.
        jdbc.update("INSERT INTO blocked_periods (room_id, start_time, end_time, reason, created_at) VALUES (NULL, ?, ?, 'Exam week', NOW(6))",
                tuesdayAt(17), tuesdayAt(18));
        book(student("global"), roomId("F-201"), tuesdayAt(17), tuesdayAt(18), 4)
                .andExpect(jsonPath("$.code").value("ROOM_BLOCKED"));
    }

    @Test
    void cancellationFreesTheSlot() throws Exception {
        User owner = student("owner");
        Long room = roomId("G-102");
        long id = body(book(owner, room, tuesdayAt(10), tuesdayAt(11), 4).andReturn()).get("id").asLong();

        mvc.perform(post("/api/bookings/{id}/cancel", id).with(as(owner)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Plans changed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationReason").value("Plans changed"));

        book(student("next"), room, tuesdayAt(10), tuesdayAt(11), 4).andExpect(status().isCreated());
    }

    @Test
    void studentsCannotSeeOrCancelOtherStudentsBookings() throws Exception {
        User owner = student("mine");
        User other = student("theirs");
        long id = body(book(owner, roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 4).andReturn()).get("id").asLong();

        mvc.perform(get("/api/bookings/{id}", id).with(as(other))).andExpect(status().isNotFound());
        mvc.perform(post("/api/bookings/{id}/cancel", id).with(as(other)).with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/bookings/{id}", id).with(as(owner))).andExpect(status().isOk())
                .andExpect(jsonPath("$.owner").doesNotExist());

        Integer stillConfirmed = jdbc.queryForObject("SELECT COUNT(*) FROM bookings WHERE id = ? AND status = 'CONFIRMED'", Integer.class, id);
        assertThat(stillConfirmed).isEqualTo(1);
    }

    @Test
    void administratorsCanViewAnyBookingWithOwnerDetails() throws Exception {
        User owner = student("viewed");
        long id = body(book(owner, roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 4).andReturn()).get("id").asLong();
        mvc.perform(get("/api/bookings/{id}", id).with(as(admin())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owner.email").value("viewed@example.test"))
                .andExpect(jsonPath("$.history[0].type").value("CREATED"));
    }

    @Test
    void cancellationDeadlineIsEnforced() throws Exception {
        User owner = student("late");
        long id = body(book(owner, roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 4).andReturn()).get("id").asLong();
        clock.set(tuesdayAt(9).plusMinutes(30)); // 30 minutes before start; deadline is 60 minutes
        mvc.perform(post("/api/bookings/{id}/cancel", id).with(as(owner)).with(csrf()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("CANCELLATION_DEADLINE_PASSED"));
    }

    @Test
    void duplicateSubmissionWithSameIdempotencyKeyReturnsOriginalBooking() throws Exception {
        User u = student("double");
        String body = toJson(bookingBody(roomId("G-102"), tuesdayAt(15), tuesdayAt(16), 4));
        MvcResult first = mvc.perform(post("/api/bookings").with(as(u)).with(csrf()).header("Idempotency-Key", "attempt-123456")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        MvcResult second = mvc.perform(post("/api/bookings").with(as(u)).with(csrf()).header("Idempotency-Key", "attempt-123456")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        assertThat(body(second).get("bookingReference")).isEqualTo(body(first).get("bookingReference"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM bookings", Integer.class)).isEqualTo(1);
    }

    @Test
    void studentCannotHoldOverlappingBookingsOrExceedActiveLimit() throws Exception {
        User u = student("busy");
        book(u, roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 4).andExpect(status().isCreated());
        book(u, roomId("F-201"), tuesdayAt(10), tuesdayAt(11), 4)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_DOUBLE_BOOKED"));

        jdbc.update("UPDATE booking_settings SET max_active_bookings_per_user = 2");
        book(u, roomId("G-102"), tuesdayAt(12), tuesdayAt(13), 4).andExpect(status().isCreated());
        book(u, roomId("G-102"), tuesdayAt(14), tuesdayAt(15), 4)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ACTIVE_BOOKINGS"));
    }

    @Test
    void dashboardSummaryReflectsPersistedBookings() throws Exception {
        User u = student("summary");
        book(u, roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 4).andExpect(status().isCreated());
        long id = body(book(u, roomId("F-201"), tuesdayAt(14), tuesdayAt(15), 4).andReturn()).get("id").asLong();
        mvc.perform(post("/api/bookings/{id}/cancel", id).with(as(u)).with(csrf())).andExpect(status().isOk());

        JsonNode summary = body(mvc.perform(get("/api/bookings/my/summary").with(as(u))).andExpect(status().isOk()).andReturn());
        assertThat(summary.get("upcomingCount").asLong()).isEqualTo(1);
        assertThat(summary.get("cancelledCount").asLong()).isEqualTo(1);
        assertThat(summary.get("nextBooking").get("room").get("roomNumber").asText()).isEqualTo("G-102");
    }
}
