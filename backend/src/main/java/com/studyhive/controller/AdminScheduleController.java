package com.studyhive.controller;

import com.studyhive.dto.RoomDtos.DayHoursResponse;
import com.studyhive.dto.ScheduleDtos.BlockedPeriodCreatedResponse;
import com.studyhive.dto.ScheduleDtos.BlockedPeriodRequest;
import com.studyhive.dto.ScheduleDtos.BlockedPeriodResponse;
import com.studyhive.dto.ScheduleDtos.BookingSettingsRequest;
import com.studyhive.dto.ScheduleDtos.BookingSettingsResponse;
import com.studyhive.dto.ScheduleDtos.WeeklyHoursRequest;
import com.studyhive.security.UserPrincipal;
import com.studyhive.service.BlockedPeriodService;
import com.studyhive.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Admin - schedule")
@RestController
@RequestMapping("/api/admin/schedule")
@PreAuthorize("hasRole('ADMIN')")
public class AdminScheduleController {

    private final ScheduleService scheduleService;
    private final BlockedPeriodService blockedPeriodService;

    public AdminScheduleController(ScheduleService scheduleService, BlockedPeriodService blockedPeriodService) {
        this.scheduleService = scheduleService;
        this.blockedPeriodService = blockedPeriodService;
    }

    @GetMapping("/settings")
    public BookingSettingsResponse settings() {
        return scheduleService.settingsResponse();
    }

    @Operation(summary = "Slot length, duration limits, advance window, cancellation deadline, per-student limit, pricing")
    @PutMapping("/settings")
    public BookingSettingsResponse updateSettings(@Valid @RequestBody BookingSettingsRequest body) {
        return scheduleService.updateSettings(body);
    }

    @Operation(summary = "Facility-wide default weekly hours")
    @GetMapping("/hours")
    public List<DayHoursResponse> hours() {
        return scheduleService.defaultHours();
    }

    @PutMapping("/hours")
    public List<DayHoursResponse> updateHours(@Valid @RequestBody WeeklyHoursRequest body) {
        return scheduleService.updateDefaultHours(body.days());
    }

    @Operation(summary = "Current and upcoming maintenance/event blocks")
    @GetMapping("/blocks")
    public List<BlockedPeriodResponse> blocks(@RequestParam(required = false) Long roomId) {
        return blockedPeriodService.listCurrentAndUpcoming(roomId);
    }

    @Operation(summary = "Block a room (or all rooms) for a period; optionally cancel overlapping bookings")
    @PostMapping("/blocks")
    @ResponseStatus(HttpStatus.CREATED)
    public BlockedPeriodCreatedResponse createBlock(@AuthenticationPrincipal UserPrincipal principal,
                                                    @Valid @RequestBody BlockedPeriodRequest body) {
        return blockedPeriodService.create(body, principal.getId());
    }

    @DeleteMapping("/blocks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBlock(@PathVariable Long id) {
        blockedPeriodService.delete(id);
    }
}
