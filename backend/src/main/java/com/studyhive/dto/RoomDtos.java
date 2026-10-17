package com.studyhive.dto;

import com.studyhive.entity.AmenityCategory;
import com.studyhive.entity.RoomStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public final class RoomDtos {

    private RoomDtos() {
    }

    public record AmenityResponse(Long id, String code, String name, String description, AmenityCategory category) {
    }

    public record RoomImageResponse(String url, String altText) {
    }

    public enum AvailabilityStatus { AVAILABLE, UNAVAILABLE }

    /**
     * Availability of a room for the search criteria. With an exact time window it reflects that window;
     * with only a date it reports how many slots are still free that day. Always computed from persisted data.
     */
    public record AvailabilitySummary(AvailabilityStatus status, String message, Integer freeSlots, Integer totalSlots) {
    }

    public record RoomSummary(
            Long id,
            String roomNumber,
            String name,
            String summary,
            String location,
            int minimumCapacity,
            int maximumCapacity,
            RoomStatus status,
            BigDecimal hourlyPrice,
            RoomImageResponse coverImage,
            List<AmenityResponse> amenities,
            AvailabilitySummary availability) {
    }

    public record DayHoursResponse(int dayOfWeek, String dayName, boolean closed, LocalTime openTime, LocalTime closeTime) {
    }

    public record BookingRulesResponse(
            int slotDurationMinutes,
            int minDurationMinutes,
            int maxDurationMinutes,
            int advanceBookingDays,
            int cancellationDeadlineMinutes,
            int maxActiveBookingsPerUser,
            boolean pricingEnabled,
            String timeZone) {
    }

    public record RoomDetail(
            Long id,
            String roomNumber,
            String name,
            String description,
            String location,
            String accessibilityInfo,
            int minimumCapacity,
            int maximumCapacity,
            RoomStatus status,
            BigDecimal hourlyPrice,
            List<RoomImageResponse> images,
            List<AmenityResponse> amenities,
            List<DayHoursResponse> weeklyHours,
            BookingRulesResponse rules) {
    }

    public enum SlotStatus { AVAILABLE, BOOKED, BLOCKED, PAST, OUTSIDE_WINDOW, CLOSED }

    public record SlotResponse(LocalDateTime start, LocalDateTime end, SlotStatus status) {
    }

    public record DayAvailabilityResponse(
            Long roomId,
            LocalDate date,
            boolean roomActive,
            boolean open,
            LocalTime openTime,
            LocalTime closeTime,
            String message,
            int slotDurationMinutes,
            List<SlotResponse> slots) {
    }
}
