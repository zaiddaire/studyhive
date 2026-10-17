package com.studyhive.entity;

import java.util.EnumSet;
import java.util.Set;

public enum BookingStatus {
    CONFIRMED,
    CANCELLED,
    COMPLETED;

    /** Statuses that occupy a room and therefore count toward overlap conflicts. */
    public static final Set<BookingStatus> BLOCKING = EnumSet.of(CONFIRMED, COMPLETED);
}
