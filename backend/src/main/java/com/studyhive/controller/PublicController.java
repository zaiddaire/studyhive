package com.studyhive.controller;

import com.studyhive.dto.RoomDtos.AmenityResponse;
import com.studyhive.dto.ScheduleDtos.PublicConfigResponse;
import com.studyhive.service.ImageService;
import com.studyhive.service.RoomService;
import com.studyhive.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@Tag(name = "Public")
@RestController
@RequestMapping("/api")
public class PublicController {

    private final ScheduleService scheduleService;
    private final RoomService roomService;
    private final ImageService imageService;

    public PublicController(ScheduleService scheduleService, RoomService roomService, ImageService imageService) {
        this.scheduleService = scheduleService;
        this.roomService = roomService;
        this.imageService = imageService;
    }

    @Operation(summary = "Booking rules, server date/time and time zone used by the booking UI")
    @GetMapping("/config")
    public PublicConfigResponse config() {
        return scheduleService.publicConfig();
    }

    @Operation(summary = "All amenities that rooms can offer")
    @GetMapping("/amenities")
    public List<AmenityResponse> amenities() {
        return roomService.listAmenities();
    }

    @Operation(summary = "An uploaded room photograph")
    @GetMapping("/images/{id}")
    public ResponseEntity<byte[]> image(@PathVariable String id) {
        ImageService.StoredImage image = imageService.load(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .body(image.data());
    }
}
