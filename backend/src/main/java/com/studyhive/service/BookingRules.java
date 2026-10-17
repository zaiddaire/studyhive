package com.studyhive.service;

import com.studyhive.entity.BookingSettings;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.Locale;
import java.util.Optional;

/**
 * Time-window rules that do not need the database: ranges, past/future limits, operating hours, slot alignment
 * and duration limits. Data-dependent rules (capacity, blocks, overlaps) live in {@link BookingService}.
 */
@Component
public class BookingRules {

    public record RuleViolation(HttpStatus status, String code, String message) {
    }

    public Optional<RuleViolation> checkWindow(boolean roomActive,
                                               DayHours hours,
                                               BookingSettings settings,
                                               LocalDateTime start,
                                               LocalDateTime end,
                                               LocalDateTime now) {
        if (!end.isAfter(start)) {
            return bad("INVALID_TIME_RANGE", "End time must be after start time.");
        }
        if (!start.toLocalDate().equals(end.toLocalDate())) {
            return bad("INVALID_TIME_RANGE", "A booking must start and end on the same day.");
        }
        if (!start.isAfter(now)) {
            return rule("IN_PAST", "This time has already passed. Please choose a future slot.");
        }
        if (start.toLocalDate().isAfter(now.toLocalDate().plusDays(settings.getAdvanceBookingDays()))) {
            return rule("TOO_FAR_AHEAD", "Rooms can be booked up to " + settings.getAdvanceBookingDays() + " days in advance.");
        }
        if (!roomActive) {
            return rule("ROOM_INACTIVE", "This room is not accepting bookings right now.");
        }
        if (hours.closed()) {
            String day = start.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
            return rule("ROOM_CLOSED", "The room is closed on " + day + "s.");
        }
        int startMinute = start.getHour() * 60 + start.getMinute();
        int endMinute = end.getHour() * 60 + end.getMinute();
        if (startMinute < hours.openMinute() || endMinute > hours.closeMinute()) {
            return rule("OUTSIDE_OPERATING_HOURS",
                    "Bookings on this day must be between " + hours.open() + " and " + hours.close() + ".");
        }
        int slot = settings.getSlotDurationMinutes();
        long duration = Duration.between(start, end).toMinutes();
        boolean wholeMinutes = start.getSecond() == 0 && start.getNano() == 0 && end.getSecond() == 0 && end.getNano() == 0;
        if (!wholeMinutes || (startMinute - hours.openMinute()) % slot != 0 || duration % slot != 0) {
            return rule("MISALIGNED_TIME",
                    "Bookings must start and end on the " + slot + "-minute slot boundaries shown in the calendar.");
        }
        if (duration < settings.getMinDurationMinutes()) {
            return rule("DURATION_TOO_SHORT", "Bookings must last at least " + formatMinutes(settings.getMinDurationMinutes()) + ".");
        }
        if (duration > settings.getMaxDurationMinutes()) {
            return rule("DURATION_TOO_LONG", "Bookings can last at most " + formatMinutes(settings.getMaxDurationMinutes()) + ".");
        }
        return Optional.empty();
    }

    public static String formatMinutes(int minutes) {
        if (minutes % 60 == 0) {
            int h = minutes / 60;
            return h + (h == 1 ? " hour" : " hours");
        }
        if (minutes < 60) {
            return minutes + " minutes";
        }
        return (minutes / 60) + " h " + (minutes % 60) + " min";
    }

    private static Optional<RuleViolation> bad(String code, String message) {
        return Optional.of(new RuleViolation(HttpStatus.BAD_REQUEST, code, message));
    }

    private static Optional<RuleViolation> rule(String code, String message) {
        return Optional.of(new RuleViolation(HttpStatus.UNPROCESSABLE_ENTITY, code, message));
    }
}
