package com.studyhive.controller;

import com.studyhive.dto.PageResponse;
import com.studyhive.dto.RoomDtos.DayAvailabilityResponse;
import com.studyhive.dto.RoomDtos.RoomDetail;
import com.studyhive.dto.RoomDtos.RoomSummary;
import com.studyhive.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;

@Tag(name = "Rooms")
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @Operation(summary = "Search active rooms",
            description = "Filters by text, group size and amenities. With a date, each room reports availability "
                    + "computed from persisted bookings and blocked periods; add startTime (HH:mm) and duration "
                    + "(minutes) to check an exact window.")
    @GetMapping
    public PageResponse<RoomSummary> search(
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(required = false) @Min(1) @Max(50) Integer groupSize,
            @RequestParam(required = false) List<String> amenities,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(pattern = "HH:mm") LocalTime startTime,
            @RequestParam(required = false) @Min(15) @Max(720) Integer duration,
            @RequestParam(defaultValue = "false") boolean availableOnly,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(50) int size) {
        RoomService.Sort sortOrder = switch (sort.toLowerCase(Locale.ROOT)) {
            case "capacity" -> RoomService.Sort.CAPACITY;
            case "capacity_desc" -> RoomService.Sort.CAPACITY_DESC;
            case "room_number" -> RoomService.Sort.ROOM_NUMBER;
            default -> RoomService.Sort.NAME;
        };
        return roomService.search(new RoomService.SearchCriteria(q, groupSize,
                amenities == null ? null : new HashSet<>(amenities), date, startTime, duration, availableOnly,
                sortOrder, page, size));
    }

    @Operation(summary = "Room details, amenities, weekly hours and booking rules")
    @GetMapping("/{id}")
    public RoomDetail detail(@PathVariable Long id) {
        return roomService.detail(id);
    }

    @Operation(summary = "Slot-by-slot availability for one date")
    @GetMapping("/{id}/availability")
    public DayAvailabilityResponse availability(@PathVariable Long id,
                                                @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return roomService.availability(id, date);
    }
}
