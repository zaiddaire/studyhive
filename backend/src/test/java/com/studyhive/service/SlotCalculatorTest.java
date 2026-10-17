package com.studyhive.service;

import com.studyhive.dto.RoomDtos.SlotResponse;
import com.studyhive.dto.RoomDtos.SlotStatus;
import com.studyhive.service.SlotCalculator.Interval;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SlotCalculatorTest {

    private final DayHours hours = new DayHours(false, LocalTime.of(9, 0), LocalTime.of(13, 0));
    private final LocalDate tuesday = LocalDate.of(2031, 3, 4);

    private List<SlotStatus> statuses(List<SlotResponse> slots) {
        return slots.stream().map(SlotResponse::status).toList();
    }

    @Test
    void marksBookedBlockedAndAvailableSlots() {
        List<Interval> bookings = List.of(new Interval(tuesday.atTime(10, 0), tuesday.atTime(11, 0)));
        List<Interval> blocks = List.of(new Interval(tuesday.atTime(12, 30), tuesday.atTime(14, 0)));
        List<SlotResponse> slots = SlotCalculator.slots(true, hours, BookingRulesTest.settings(), tuesday,
                LocalDateTime.of(2031, 3, 3, 8, 0), bookings, blocks);
        assertThat(statuses(slots)).containsExactly(
                SlotStatus.AVAILABLE, SlotStatus.BOOKED, SlotStatus.AVAILABLE, SlotStatus.BLOCKED);
        assertThat(slots.get(0).start()).isEqualTo(tuesday.atTime(9, 0));
        assertThat(slots.get(3).end()).isEqualTo(tuesday.atTime(13, 0));
    }

    @Test
    void slotsThatHaveStartedArePast() {
        List<SlotResponse> slots = SlotCalculator.slots(true, hours, BookingRulesTest.settings(), tuesday,
                tuesday.atTime(10, 15), List.of(), List.of());
        assertThat(statuses(slots)).containsExactly(SlotStatus.PAST, SlotStatus.PAST, SlotStatus.AVAILABLE, SlotStatus.AVAILABLE);
    }

    @Test
    void closedDaysAndInactiveRooms() {
        assertThat(SlotCalculator.slots(true, DayHours.closedDay(), BookingRulesTest.settings(), tuesday,
                LocalDateTime.of(2031, 3, 3, 8, 0), List.of(), List.of())).isEmpty();
        assertThat(statuses(SlotCalculator.slots(false, hours, BookingRulesTest.settings(), tuesday,
                LocalDateTime.of(2031, 3, 3, 8, 0), List.of(), List.of()))).containsOnly(SlotStatus.CLOSED);
    }

    @Test
    void datesBeyondTheAdvanceWindowAreOutsideWindow() {
        assertThat(statuses(SlotCalculator.slots(true, hours, BookingRulesTest.settings(), tuesday.plusDays(30),
                LocalDateTime.of(2031, 3, 3, 8, 0), List.of(), List.of()))).containsOnly(SlotStatus.OUTSIDE_WINDOW);
    }

    @Test
    void partialTrailingSlotIsDropped() {
        DayHours odd = new DayHours(false, LocalTime.of(9, 0), LocalTime.of(11, 30));
        assertThat(SlotCalculator.slots(true, odd, BookingRulesTest.settings(), tuesday,
                LocalDateTime.of(2031, 3, 3, 8, 0), List.of(), List.of())).hasSize(2);
    }
}
