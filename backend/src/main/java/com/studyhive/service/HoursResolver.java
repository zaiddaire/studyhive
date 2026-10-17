package com.studyhive.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Map;

/**
 * Snapshot of the facility default schedule plus per-room overrides. A room that has its own rows uses them
 * for every weekday; otherwise the facility default applies.
 */
public record HoursResolver(Map<Integer, DayHours> defaults, Map<Long, Map<Integer, DayHours>> overrides) {

    public DayHours forRoom(Long roomId, DayOfWeek day) {
        Map<Integer, DayHours> roomHours = overrides.get(roomId);
        Map<Integer, DayHours> source = roomHours != null ? roomHours : defaults;
        return source.getOrDefault(day.getValue(), DayHours.closedDay());
    }

    public DayHours forRoom(Long roomId, LocalDate date) {
        return forRoom(roomId, date.getDayOfWeek());
    }

    public boolean hasOverride(Long roomId) {
        return overrides.containsKey(roomId);
    }
}
