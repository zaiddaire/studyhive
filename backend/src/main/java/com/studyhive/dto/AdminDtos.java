package com.studyhive.dto;

import com.studyhive.entity.AccountStatus;
import com.studyhive.entity.BookingEventType;
import com.studyhive.entity.Role;
import com.studyhive.entity.RoomStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record RoomImageRequest(
            @NotBlank(message = "Image URL is required.")
            @Size(max = 1000)
            @Pattern(regexp = "^(https://[^\\s]+|/api/images/[0-9a-f-]{36})$",
                    message = "Use an https:// image URL or upload a photo.")
            String url,
            @NotBlank(message = "Describe the image for screen-reader users.")
            @Size(max = 200)
            String altText) {
    }

    public record RoomRequest(
            @NotBlank(message = "Room number is required.")
            @Size(max = 20)
            @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9-]*$", message = "Use letters, numbers and dashes only.")
            String roomNumber,
            @NotBlank(message = "Name is required.") @Size(max = 100) String name,
            @NotBlank(message = "Description is required.") @Size(max = 5000) String description,
            @Size(max = 150) String location,
            @Size(max = 500) String accessibilityInfo,
            @NotNull @Min(value = 1, message = "Minimum capacity must be at least 1.") @Max(50) Integer minimumCapacity,
            @NotNull @Min(1) @Max(value = 50, message = "Maximum capacity must be 50 or fewer.") Integer maximumCapacity,
            @DecimalMin(value = "0.00", message = "Price cannot be negative.")
            @DecimalMax(value = "100000.00")
            @Digits(integer = 8, fraction = 2) BigDecimal hourlyPrice,
            @NotNull RoomStatus status,
            @NotNull List<@NotNull Long> amenityIds,
            @NotNull @Size(max = 8, message = "A room can have up to 8 photos.") List<@Valid RoomImageRequest> images) {
    }

    public record RoomStatusRequest(
            @NotNull RoomStatus status,
            boolean cancelFutureBookings,
            @Size(max = 500) String reason) {
    }

    public record AdminRoomResponse(
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
            List<RoomDtos.RoomImageResponse> images,
            List<RoomDtos.AmenityResponse> amenities,
            boolean customHours,
            long upcomingBookings,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record RoomStatusResponse(AdminRoomResponse room, int futureBookings, int cancelledBookings) {
    }

    public record AdminUserResponse(
            Long id,
            String fullName,
            String email,
            Role role,
            AccountStatus accountStatus,
            Instant createdAt,
            long totalBookings) {
    }

    public record UserStatusRequest(@NotNull AccountStatus status) {
    }

    public record RoomUtilization(Long roomId, String roomNumber, String name, double bookedHours, double openHours, Double percent) {
    }

    public record DayCount(LocalDate date, long bookings) {
    }

    public record ActivityItem(
            BookingEventType type,
            Long bookingId,
            String bookingReference,
            String roomName,
            String actorName,
            String details,
            Instant createdAt) {
    }

    public record StatsResponse(
            long totalRooms,
            long activeRooms,
            long totalStudents,
            long reservationsToday,
            long upcomingReservations,
            long cancelledReservations,
            long completedReservations,
            Double utilizationPercent,
            int utilizationWindowDays,
            List<RoomUtilization> roomUtilization,
            List<DayCount> next7Days,
            List<ActivityItem> recentActivity) {
    }

    public record UploadResponse(String id, String url) {
    }
}
