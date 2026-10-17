package com.studyhive.service;

import com.studyhive.dto.RoomDtos.SlotResponse;
import com.studyhive.dto.RoomDtos.SlotStatus;
import com.studyhive.entity.BookingSettings;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Pure function that turns hours, rules and occupied intervals into a day's slot grid. */
public final class SlotCalculator {

    public record Interval(LocalDateTime start, LocalDateTime end) {
        boolean overlaps(LocalDateTime s, LocalDateTime e) {
            return start.isBefore(e) && end.isAfter(s);
        }
    }

    private SlotCalculator() {
    }

    public static List<SlotResponse> slots(boolean roomActive,
                                           DayHours hours,
                                           BookingSettings settings,
                                           LocalDate date,
                                           LocalDateTime now,
                                           List<Interval> bookings,
                                           List<Interval> blocks) {
        List<SlotResponse> result = new ArrayList<>();
        if (hours.closed()) {
            return result;
        }
        int slot = settings.getSlotDurationMinutes();
        boolean beyondWindow = date.isAfter(now.toLocalDate().plusDays(settings.getAdvanceBookingDays()));
        for (int m = hours.openMinute(); m + slot <= hours.closeMinute(); m += slot) {
            LocalDateTime start = date.atStartOfDay().plusMinutes(m);
            LocalDateTime end = start.plusMinutes(slot);
            SlotStatus status;
            if (!roomActive) {
                status = SlotStatus.CLOSED;
            } else if (!start.isAfter(now)) {
                status = SlotStatus.PAST;
            } else if (beyondWindow) {
                status = SlotStatus.OUTSIDE_WINDOW;
            } else if (blocks.stream().anyMatch(b -> b.overlaps(start, end))) {
                status = SlotStatus.BLOCKED;
            } else if (bookings.stream().anyMatch(b -> b.overlaps(start, end))) {
                status = SlotStatus.BOOKED;
            } else {
                status = SlotStatus.AVAILABLE;
            }
            result.add(new SlotResponse(start, end, status));
        }
        return result;
    }
}
