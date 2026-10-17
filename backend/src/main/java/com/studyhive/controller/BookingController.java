package com.studyhive.controller;

import com.studyhive.dto.BookingDtos.BookingResponse;
import com.studyhive.dto.BookingDtos.BookingSummaryResponse;
import com.studyhive.dto.BookingDtos.CreateBookingRequest;
import com.studyhive.dto.BookingDtos.StudentCancelRequest;
import com.studyhive.dto.PageResponse;
import com.studyhive.security.UserPrincipal;
import com.studyhive.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

@Tag(name = "Student bookings")
@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @Operation(summary = "Reserve a whole room for a group",
            description = "Send a unique Idempotency-Key header per booking attempt; retries with the same key return "
                    + "the original booking (200) instead of creating a duplicate. Overlaps return 409.")
    @PostMapping
    public ResponseEntity<BookingResponse> create(@AuthenticationPrincipal UserPrincipal principal,
                                                  @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                                  @Valid @RequestBody CreateBookingRequest body) {
        BookingService.CreationResult result = bookingService.create(principal.getId(), body, idempotencyKey);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.booking());
    }

    @Operation(summary = "The signed-in student's bookings")
    @GetMapping("/my")
    public PageResponse<BookingResponse> mine(@AuthenticationPrincipal UserPrincipal principal,
                                              @RequestParam(defaultValue = "upcoming") String scope,
                                              @RequestParam(defaultValue = "0") @Min(0) int page,
                                              @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size) {
        BookingService.Scope s = switch (scope.toLowerCase(Locale.ROOT)) {
            case "past" -> BookingService.Scope.PAST;
            case "cancelled" -> BookingService.Scope.CANCELLED;
            default -> BookingService.Scope.UPCOMING;
        };
        return bookingService.myBookings(principal.getId(), s, page, size);
    }

    @Operation(summary = "Counts and next booking for the dashboard")
    @GetMapping("/my/summary")
    public BookingSummaryResponse summary(@AuthenticationPrincipal UserPrincipal principal) {
        return bookingService.mySummary(principal.getId());
    }

    @Operation(summary = "One booking (owner or administrator only)")
    @GetMapping("/{id}")
    public BookingResponse get(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        return bookingService.getForViewer(principal, id);
    }

    @Operation(summary = "Cancel your own booking before the cancellation deadline")
    @PostMapping("/{id}/cancel")
    public BookingResponse cancel(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                                  @Valid @RequestBody(required = false) StudentCancelRequest body) {
        return bookingService.cancelAsStudent(principal.getId(), id, body == null ? null : body.reason());
    }
}
