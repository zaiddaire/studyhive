package com.studyhive.service;

import java.time.LocalTime;

/** Effective opening hours of one room on one weekday. */
public record DayHours(boolean closed, LocalTime open, LocalTime close) {

    public static DayHours closedDay() {
        return new DayHours(true, null, null);
    }

    public int openMinute() {
        return open.getHour() * 60 + open.getMinute();
    }

    public int closeMinute() {
        return close.getHour() * 60 + close.getMinute();
    }
}
