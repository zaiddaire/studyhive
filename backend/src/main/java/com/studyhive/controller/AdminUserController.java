package com.studyhive.controller;

import com.studyhive.dto.AdminDtos.AdminUserResponse;
import com.studyhive.dto.AdminDtos.StatsResponse;
import com.studyhive.dto.AdminDtos.UserStatusRequest;
import com.studyhive.dto.PageResponse;
import com.studyhive.security.UserPrincipal;
import com.studyhive.service.AdminStatsService;
import com.studyhive.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - users and statistics")
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService userService;
    private final AdminStatsService statsService;

    public AdminUserController(AdminUserService userService, AdminStatsService statsService) {
        this.userService = userService;
        this.statsService = statsService;
    }

    @Operation(summary = "Dashboard metrics computed from live data")
    @GetMapping("/stats")
    public StatsResponse stats() {
        return statsService.stats();
    }

    @GetMapping("/users")
    public PageResponse<AdminUserResponse> users(@RequestParam(required = false) @Size(max = 100) String q,
                                                 @RequestParam(defaultValue = "0") @Min(0) int page,
                                                 @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return userService.list(q, page, size);
    }

    @Operation(summary = "Suspend or reactivate an account (suspension ends its sessions)")
    @PatchMapping("/users/{id}/status")
    public AdminUserResponse updateStatus(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                                          @Valid @RequestBody UserStatusRequest body) {
        return userService.updateStatus(principal.getId(), id, body.status());
    }
}
