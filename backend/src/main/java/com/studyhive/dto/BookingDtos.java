package com.studyhive.dto;

import com.studyhive.entity.BookingEventType;
import com.studyhive.entity.BookingStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

public final class BookingDtos {

    private BookingDtos() {
    }

    /**
     * Start and end are facility-local wall-clock times (ISO-8601 without offset, e.g. 2026-10-20T14:00:00),
     * interpreted in the server's configured time zone.
     */
    public record CreateBookingRequest(
            @NotNull(message = "Please choose a room.")
            Long roomId,
            @NotNull(message = "Please choose a start time.")
            LocalDateTime startTime,
            @NotNull(message = "Please choose an end time.")
            LocalDateTime endTime,
            @Size(max = 100, message = "Group name must be 100 characters or fewer.")
            String groupName,
            @NotNull(message = "Group size is required.")
            @Min(value = 1, message = "Group size must be at least 1.")
            @Max(value = 50, message = "Group size must be 50 or fewer.")
            Integer groupSize,
            @Size(max = 500, message = "Purpose must be 500 characters or fewer.")
            String purpose) {
    }

    public record StudentCancelRequest(
            @Size(max = 500, message = "Reason must be 500 characters or fewer.")
            String reason) {
    }

    public record AdminCancelRequest(
            @NotBlank(message = "Please give a reason for the cancellation.")
            @Size(min = 3, max = 500, message = "Reason must be 3-500 characters.")
            String reason) {
    }

    public record BookingRoomInfo(Long id, String roomNumber, String name, String location, RoomDtos.RoomImageResponse coverImage) {
    }

    public record BookingOwnerInfo(Long id, String fullName, String email) {
    }

    public record BookingEventResponse(BookingEventType type, String actorName, String details, Instant createdAt) {
    }

    public record BookingResponse(
            Long id,
            String bookingReference,
            BookingStatus status,
            BookingRoomInfo room,
            LocalDateTime startTime,
            LocalDateTime endTime,
            /* The same instants as absolute UTC timestamps, for countdowns in any browser time zone. */
            Instant startsAt,
            Instant endsAt,
            String groupName,
            int groupSize,
            String purpose,
            BigDecimal totalPrice,
            String cancellationReason,
            Instant cancelledAt,
            Boolean cancelledByAdmin,
            Instant createdAt,
            boolean cancellable,
            LocalDateTime cancellationDeadline,
            BookingOwnerInfo owner,
            List<BookingEventResponse> history) {
    }

    public record BookingSummaryResponse(long upcomingCount, long pastCount, long cancelledCount, BookingResponse nextBooking) {
    }
}
