package com.studyhive.service;

import com.studyhive.entity.BookingSettings;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class BookingRulesTest {

    private final BookingRules rules = new BookingRules();
    private final DayHours nineToNine = new DayHours(false, LocalTime.of(9, 0), LocalTime.of(21, 0));
    private final LocalDateTime now = LocalDateTime.of(2031, 3, 3, 8, 0);

    static BookingSettings settings() {
        BookingSettings s = new BookingSettings();
        s.setSlotDurationMinutes(60);
        s.setMinDurationMinutes(60);
        s.setMaxDurationMinutes(180);
        s.setAdvanceBookingDays(14);
        s.setCancellationDeadlineMinutes(60);
        s.setMaxActiveBookingsPerUser(5);
        return s;
    }

    private Optional<String> check(String start, String end) {
        return rules.checkWindow(true, nineToNine, settings(), LocalDateTime.parse(start), LocalDateTime.parse(end), now)
                .map(BookingRules.RuleViolation::code);
    }

    @Test
    void acceptsAlignedWindowInsideHours() {
        assertThat(check("2031-03-04T10:00", "2031-03-04T12:00")).isEmpty();
        assertThat(check("2031-03-04T09:00", "2031-03-04T10:00")).isEmpty();
        assertThat(check("2031-03-04T18:00", "2031-03-04T21:00")).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({
            "2031-03-04T12:00, 2031-03-04T11:00, INVALID_TIME_RANGE",
            "2031-03-04T12:00, 2031-03-04T12:00, INVALID_TIME_RANGE",
            "2031-03-04T20:00, 2031-03-05T10:00, INVALID_TIME_RANGE",
            "2031-03-02T10:00, 2031-03-02T11:00, IN_PAST",
            "2031-03-03T08:00, 2031-03-03T09:00, IN_PAST",
            "2031-03-18T10:00, 2031-03-18T11:00, TOO_FAR_AHEAD",
            "2031-03-04T08:00, 2031-03-04T09:00, OUTSIDE_OPERATING_HOURS",
            "2031-03-04T20:00, 2031-03-04T22:00, OUTSIDE_OPERATING_HOURS",
            "2031-03-04T10:30, 2031-03-04T11:30, MISALIGNED_TIME",
            "2031-03-04T10:00, 2031-03-04T10:30, MISALIGNED_TIME",
            "2031-03-04T10:00, 2031-03-04T14:00, DURATION_TOO_LONG"
    })
    void rejectsInvalidWindows(String start, String end, String expected) {
        assertThat(check(start, end)).contains(expected);
    }

    @Test
    void lastDayOfAdvanceWindowIsAllowed() {
        assertThat(check("2031-03-17T10:00", "2031-03-17T11:00")).isEmpty();
    }

    @Test
    void inactiveRoomsAndClosedDaysAreRejected() {
        LocalDateTime start = LocalDateTime.parse("2031-03-04T10:00");
        assertThat(rules.checkWindow(false, nineToNine, settings(), start, start.plusHours(1), now))
                .map(BookingRules.RuleViolation::code).contains("ROOM_INACTIVE");
        assertThat(rules.checkWindow(true, DayHours.closedDay(), settings(), start, start.plusHours(1), now))
                .map(BookingRules.RuleViolation::code).contains("ROOM_CLOSED");
    }

    @Test
    void alignmentFollowsOpeningTimeAndSlotLength() {
        BookingSettings half = settings();
        half.setSlotDurationMinutes(30);
        half.setMinDurationMinutes(30);
        DayHours fromHalfPast = new DayHours(false, LocalTime.of(9, 30), LocalTime.of(17, 0));
        LocalDateTime start = LocalDateTime.parse("2031-03-04T10:30");
        assertThat(rules.checkWindow(true, fromHalfPast, half, start, start.plusMinutes(30), now)).isEmpty();
        assertThat(rules.checkWindow(true, fromHalfPast, half, start.plusMinutes(15), start.plusMinutes(45), now))
                .map(BookingRules.RuleViolation::code).contains("MISALIGNED_TIME");
    }

    @Test
    void formatsDurations() {
        assertThat(BookingRules.formatMinutes(60)).isEqualTo("1 hour");
        assertThat(BookingRules.formatMinutes(180)).isEqualTo("3 hours");
        assertThat(BookingRules.formatMinutes(30)).isEqualTo("30 minutes");
        assertThat(BookingRules.formatMinutes(90)).isEqualTo("1 h 30 min");
    }
}
