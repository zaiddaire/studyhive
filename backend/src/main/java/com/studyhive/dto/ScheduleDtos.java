package com.studyhive.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public final class ScheduleDtos {

    private ScheduleDtos() {
    }

    public record BookingSettingsRequest(
            @NotNull @Min(15) @Max(120) Integer slotDurationMinutes,
            @NotNull @Min(15) @Max(720) Integer minDurationMinutes,
            @NotNull @Min(15) @Max(720) Integer maxDurationMinutes,
            @NotNull @Min(1) @Max(365) Integer advanceBookingDays,
            @NotNull @Min(0) @Max(10080) Integer cancellationDeadlineMinutes,
            @NotNull @Min(1) @Max(50) Integer maxActiveBookingsPerUser,
            @NotNull Boolean pricingEnabled) {
    }

    public record BookingSettingsResponse(
            int slotDurationMinutes,
            int minDurationMinutes,
            int maxDurationMinutes,
            int advanceBookingDays,
            int cancellationDeadlineMinutes,
            int maxActiveBookingsPerUser,
            boolean pricingEnabled,
            Instant updatedAt) {
    }

    /** Public, non-sensitive configuration the frontend needs to render booking controls. */
    public record PublicConfigResponse(
            String timeZone,
            LocalDate today,
            LocalDateTime serverTime,
            int slotDurationMinutes,
            int minDurationMinutes,
            int maxDurationMinutes,
            int advanceBookingDays,
            int cancellationDeadlineMinutes,
            int maxActiveBookingsPerUser,
            boolean pricingEnabled,
            boolean passwordResetEmailEnabled,
            List<RoomDtos.DayHoursResponse> defaultHours) {
    }

    public record DayHoursRequest(
            @NotNull @Min(1) @Max(7) Integer dayOfWeek,
            boolean closed,
            LocalTime openTime,
            LocalTime closeTime) {
    }

    public record WeeklyHoursRequest(
            @NotNull @Size(min = 7, max = 7, message = "Provide hours for all seven days.") @Valid List<DayHoursRequest> days) {
    }

    public record RoomHoursRequest(
            boolean useDefault,
            @Valid List<DayHoursRequest> days) {
    }

    public record RoomHoursResponse(boolean usesDefault, List<RoomDtos.DayHoursResponse> days) {
    }

    public record BlockedPeriodRequest(
            Long roomId,
            @NotNull(message = "Start is required.") LocalDateTime startTime,
            @NotNull(message = "End is required.") LocalDateTime endTime,
            @NotBlank(message = "Reason is required.") @Size(max = 255) String reason,
            boolean cancelAffectedBookings) {
    }

    public record BlockedPeriodResponse(
            Long id,
            Long roomId,
            String roomNumber,
            String roomName,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String reason,
            String createdByName,
            Instant createdAt) {
    }

    public record BlockedPeriodCreatedResponse(
            BlockedPeriodResponse block,
            List<BookingDtos.BookingResponse> affectedBookings,
            int cancelledCount) {
    }
}
