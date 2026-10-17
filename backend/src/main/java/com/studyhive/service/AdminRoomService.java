package com.studyhive.service;

import com.studyhive.dto.AdminDtos.AdminRoomResponse;
import com.studyhive.dto.AdminDtos.RoomImageRequest;
import com.studyhive.dto.AdminDtos.RoomRequest;
import com.studyhive.dto.AdminDtos.RoomStatusRequest;
import com.studyhive.dto.AdminDtos.RoomStatusResponse;
import com.studyhive.entity.Amenity;
import com.studyhive.entity.Booking;
import com.studyhive.entity.BookingEventType;
import com.studyhive.entity.Room;
import com.studyhive.entity.RoomImage;
import com.studyhive.entity.RoomStatus;
import com.studyhive.entity.User;
import com.studyhive.exception.ApiException;
import com.studyhive.mapper.RoomMapper;
import com.studyhive.repository.AmenityRepository;
import com.studyhive.repository.BookingRepository;
import com.studyhive.repository.RoomRepository;
import com.studyhive.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Administrator room management. Rooms with booking history are deactivated rather than deleted. */
@Service
public class AdminRoomService {

    private static final Logger log = LoggerFactory.getLogger(AdminRoomService.class);

    private final RoomRepository rooms;
    private final AmenityRepository amenities;
    private final BookingRepository bookings;
    private final UserRepository users;
    private final ScheduleService schedule;
    private final BookingService bookingService;
    private final ImageService imageService;
    private final RoomMapper mapper;
    private final Clock clock;

    public AdminRoomService(RoomRepository rooms, AmenityRepository amenities, BookingRepository bookings,
                            UserRepository users, ScheduleService schedule, BookingService bookingService,
                            ImageService imageService, RoomMapper mapper, Clock clock) {
        this.rooms = rooms;
        this.amenities = amenities;
        this.bookings = bookings;
        this.users = users;
        this.schedule = schedule;
        this.bookingService = bookingService;
        this.imageService = imageService;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<AdminRoomResponse> list() {
        HoursResolver hours = schedule.hoursResolver();
        Map<Long, Long> upcoming = upcomingCounts();
        return rooms.findAllByOrderByRoomNumberAsc().stream()
                .map(r -> mapper.toAdmin(r, hours.hasOverride(r.getId()), upcoming.getOrDefault(r.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminRoomResponse get(Long id) {
        Room room = find(id);
        return toAdmin(room);
    }

    @Transactional
    public AdminRoomResponse create(RoomRequest req) {
        validate(req, null);
        Room room = new Room();
        apply(room, req);
        room.setStatus(req.status());
        rooms.saveAndFlush(room);
        log.info("Room {} created", room.getRoomNumber());
        return toAdmin(room);
    }

    @Transactional
    public AdminRoomResponse update(Long id, RoomRequest req) {
        Room room = rooms.findByIdForUpdate(id).orElseThrow(() -> ApiException.notFound("Room not found."));
        validate(req, room.getId());
        apply(room, req);
        room.setStatus(req.status());
        rooms.saveAndFlush(room);
        return toAdmin(room);
    }

    /**
     * Activates or deactivates a room. Deactivation stops new bookings immediately; existing future bookings are
     * kept unless the administrator explicitly asks to cancel them. The room row is locked so no booking can slip
     * in between the status change and the cancellations.
     */
    @Transactional
    public RoomStatusResponse updateStatus(Long id, RoomStatusRequest req, Long adminId) {
        Room room = rooms.findByIdForUpdate(id).orElseThrow(() -> ApiException.notFound("Room not found."));
        room.setStatus(req.status());
        List<Booking> future = bookings.findFutureConfirmedForRoom(room.getId(), LocalDateTime.now(clock));
        int cancelled = 0;
        if (req.status() == RoomStatus.INACTIVE && req.cancelFutureBookings()) {
            User admin = users.getReferenceById(adminId);
            String reason = req.reason() == null || req.reason().isBlank()
                    ? "This room is no longer available. We are sorry for the inconvenience."
                    : req.reason().trim();
            for (Booking b : future) {
                bookingService.cancel(b, admin, reason, BookingEventType.CANCELLED_BY_ADMIN);
                cancelled++;
            }
        }
        rooms.save(room);
        log.info("Room {} set to {} ({} future bookings, {} cancelled)", room.getRoomNumber(), req.status(), future.size(), cancelled);
        return new RoomStatusResponse(toAdmin(room), future.size(), cancelled);
    }

    @Transactional
    public void delete(Long id) {
        Room room = rooms.findByIdForUpdate(id).orElseThrow(() -> ApiException.notFound("Room not found."));
        if (bookings.existsByRoomId(room.getId())) {
            throw ApiException.conflict("ROOM_HAS_HISTORY",
                    "This room has booking history, so it cannot be deleted. Deactivate it instead.");
        }
        schedule.deleteRoomHours(room.getId());
        rooms.delete(room);
        log.info("Room {} deleted", room.getRoomNumber());
    }

    private Room find(Long id) {
        return rooms.findById(id).orElseThrow(() -> ApiException.notFound("Room not found."));
    }

    private AdminRoomResponse toAdmin(Room room) {
        long upcoming = upcomingCounts().getOrDefault(room.getId(), 0L);
        return mapper.toAdmin(room, schedule.hoursResolver().hasOverride(room.getId()), upcoming);
    }

    private Map<Long, Long> upcomingCounts() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : bookings.countUpcomingByRoom(LocalDateTime.now(clock))) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
    }

    private void validate(RoomRequest req, Long currentId) {
        if (req.minimumCapacity() > req.maximumCapacity()) {
            throw ApiException.invalidField("maximumCapacity", "Maximum capacity must be at least the minimum capacity.");
        }
        rooms.findByRoomNumberIgnoreCase(req.roomNumber().trim())
                .filter(existing -> !existing.getId().equals(currentId))
                .ifPresent(existing -> {
                    throw new ApiException(HttpStatus.CONFLICT, "ROOM_NUMBER_TAKEN",
                            "Another room already uses this room number.", "roomNumber");
                });
        for (RoomImageRequest image : req.images()) {
            if (image.url().startsWith(ImageService.URL_PREFIX) && !imageService.exists(image.url())) {
                throw ApiException.invalidField("images", "One of the uploaded photos no longer exists. Please upload it again.");
            }
        }
    }

    private void apply(Room room, RoomRequest req) {
        room.setRoomNumber(req.roomNumber().trim().toUpperCase());
        room.setName(req.name().trim());
        room.setDescription(req.description().trim());
        room.setLocation(blankToNull(req.location()));
        room.setAccessibilityInfo(blankToNull(req.accessibilityInfo()));
        room.setMinimumCapacity(req.minimumCapacity());
        room.setMaximumCapacity(req.maximumCapacity());
        room.setHourlyPrice(req.hourlyPrice());

        Set<Long> ids = new LinkedHashSet<>(req.amenityIds());
        List<Amenity> found = amenities.findAllById(ids);
        if (found.size() != ids.size()) {
            throw ApiException.invalidField("amenityIds", "One or more selected amenities do not exist.");
        }
        room.getAmenities().clear();
        room.getAmenities().addAll(found);

        List<RoomImage> images = new ArrayList<>();
        int order = 0;
        for (RoomImageRequest r : req.images()) {
            RoomImage image = new RoomImage();
            image.setUrl(r.url().trim());
            image.setAltText(r.altText().trim());
            image.setSortOrder(order++);
            images.add(image);
        }
        room.replaceImages(images);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
