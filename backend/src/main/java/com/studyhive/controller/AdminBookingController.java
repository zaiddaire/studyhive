package com.studyhive.controller;

import com.studyhive.dto.BookingDtos.AdminCancelRequest;
import com.studyhive.dto.BookingDtos.BookingResponse;
import com.studyhive.dto.PageResponse;
import com.studyhive.entity.BookingStatus;
import com.studyhive.security.UserPrincipal;
import com.studyhive.service.BookingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Locale;

@Tag(name = "Admin - bookings")
@RestController
@RequestMapping("/api/admin/bookings")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBookingController {

    private final BookingService bookingService;

    public AdminBookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @GetMapping
    public PageResponse<BookingResponse> search(
            @RequestParam(required = false) @Size(max = 20) String reference,
            @RequestParam(required = false) Long roomId,
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) @Size(max = 100) String student,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "start_desc") String sort,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        BookingService.AdminSort s = switch (sort.toLowerCase(Locale.ROOT)) {
            case "start_asc" -> BookingService.AdminSort.START_ASC;
            case "created_desc" -> BookingService.AdminSort.CREATED_DESC;
            default -> BookingService.AdminSort.START_DESC;
        };
        return bookingService.adminSearch(new BookingService.AdminSearch(reference, roomId, status, student, from, to, s, page, size));
    }

    @GetMapping("/{id}")
    public BookingResponse get(@PathVariable Long id) {
        return bookingService.getForAdmin(id);
    }

    @PostMapping("/{id}/cancel")
    public BookingResponse cancel(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                                  @Valid @RequestBody AdminCancelRequest body) {
        return bookingService.cancelAsAdmin(principal.getId(), id, body.reason());
    }
}
