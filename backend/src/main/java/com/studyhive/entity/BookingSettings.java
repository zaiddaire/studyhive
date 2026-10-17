package com.studyhive.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "booking_settings")
public class BookingSettings {

    public static final short SINGLETON_ID = 1;

    @Id
    @Column(columnDefinition = "TINYINT")
    private Short id = SINGLETON_ID;

    @Column(name = "slot_duration_minutes", nullable = false)
    private int slotDurationMinutes;

    @Column(name = "min_duration_minutes", nullable = false)
    private int minDurationMinutes;

    @Column(name = "max_duration_minutes", nullable = false)
    private int maxDurationMinutes;

    @Column(name = "advance_booking_days", nullable = false)
    private int advanceBookingDays;

    @Column(name = "cancellation_deadline_minutes", nullable = false)
    private int cancellationDeadlineMinutes;

    @Column(name = "max_active_bookings_per_user", nullable = false)
    private int maxActiveBookingsPerUser;

    @Column(name = "pricing_enabled", nullable = false)
    private boolean pricingEnabled;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
