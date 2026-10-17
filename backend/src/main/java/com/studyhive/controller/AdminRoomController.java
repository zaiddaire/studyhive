package com.studyhive.controller;

import com.studyhive.dto.AdminDtos.AdminRoomResponse;
import com.studyhive.dto.AdminDtos.RoomRequest;
import com.studyhive.dto.AdminDtos.RoomStatusRequest;
import com.studyhive.dto.AdminDtos.RoomStatusResponse;
import com.studyhive.dto.AdminDtos.UploadResponse;
import com.studyhive.dto.ScheduleDtos.RoomHoursRequest;
import com.studyhive.dto.ScheduleDtos.RoomHoursResponse;
import com.studyhive.security.UserPrincipal;
import com.studyhive.service.AdminRoomService;
import com.studyhive.service.ImageService;
import com.studyhive.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "Admin - rooms")
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminRoomController {

    private final AdminRoomService roomService;
    private final ScheduleService scheduleService;
    private final ImageService imageService;

    public AdminRoomController(AdminRoomService roomService, ScheduleService scheduleService, ImageService imageService) {
        this.roomService = roomService;
        this.scheduleService = scheduleService;
        this.imageService = imageService;
    }

    @GetMapping("/rooms")
    public List<AdminRoomResponse> list() {
        return roomService.list();
    }

    @GetMapping("/rooms/{id}")
    public AdminRoomResponse get(@PathVariable Long id) {
        return roomService.get(id);
    }

    @PostMapping("/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminRoomResponse create(@Valid @RequestBody RoomRequest body) {
        return roomService.create(body);
    }

    @PutMapping("/rooms/{id}")
    public AdminRoomResponse update(@PathVariable Long id, @Valid @RequestBody RoomRequest body) {
        return roomService.update(id, body);
    }

    @Operation(summary = "Activate or deactivate a room, optionally cancelling its future bookings")
    @PatchMapping("/rooms/{id}/status")
    public RoomStatusResponse updateStatus(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                                           @Valid @RequestBody RoomStatusRequest body) {
        return roomService.updateStatus(id, body, principal.getId());
    }

    @Operation(summary = "Delete a room that has never been booked (otherwise deactivate it)")
    @DeleteMapping("/rooms/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        roomService.delete(id);
    }

    @GetMapping("/rooms/{id}/hours")
    public RoomHoursResponse hours(@PathVariable Long id) {
        return scheduleService.roomHours(id);
    }

    @Operation(summary = "Give a room its own weekly hours, or revert it to the facility default")
    @PutMapping("/rooms/{id}/hours")
    public RoomHoursResponse updateHours(@PathVariable Long id, @Valid @RequestBody RoomHoursRequest body) {
        return scheduleService.updateRoomHours(id, body);
    }

    @Operation(summary = "Upload a room photograph (JPEG, PNG or WebP, max 2 MB)")
    @PostMapping(value = "/uploads/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse upload(@AuthenticationPrincipal UserPrincipal principal, @RequestParam("file") MultipartFile file) {
        return imageService.upload(file, principal.getId());
    }
}
