package com.studyhive.service;

import com.studyhive.dto.BookingDtos.BookingResponse;
import com.studyhive.dto.ScheduleDtos.BlockedPeriodCreatedResponse;
import com.studyhive.dto.ScheduleDtos.BlockedPeriodRequest;
import com.studyhive.dto.ScheduleDtos.BlockedPeriodResponse;
import com.studyhive.entity.BlockedPeriod;
import com.studyhive.entity.Booking;
import com.studyhive.entity.BookingEventType;
import com.studyhive.entity.Room;
import com.studyhive.entity.User;
import com.studyhive.exception.ApiException;
import com.studyhive.mapper.BookingMapper;
import com.studyhive.repository.BlockedPeriodRepository;
import com.studyhive.repository.BookingRepository;
import com.studyhive.repository.RoomRepository;
import com.studyhive.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/** Maintenance windows, events and closures that make rooms unbookable. */
@Service
public class BlockedPeriodService {

    private final BlockedPeriodRepository blocks;
    private final RoomRepository rooms;
    private final UserRepository users;
    private final BookingRepository bookings;
    private final BookingService bookingService;
    private final BookingMapper bookingMapper;
    private final Clock clock;

    public BlockedPeriodService(BlockedPeriodRepository blocks, RoomRepository rooms, UserRepository users,
                                BookingRepository bookings, BookingService bookingService,
                                BookingMapper bookingMapper, Clock clock) {
        this.blocks = blocks;
        this.rooms = rooms;
        this.users = users;
        this.bookings = bookings;
        this.bookingService = bookingService;
        this.bookingMapper = bookingMapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<BlockedPeriodResponse> listCurrentAndUpcoming(Long roomId) {
        return blocks.findCurrentAndUpcoming(LocalDateTime.now(clock), roomId).stream().map(this::toResponse).toList();
    }

    /**
     * Creates a block. The affected room rows are locked first (all rooms, in id order, for a facility-wide
     * block) so a booking cannot be created inside the window while the block is being saved.
     */
    @Transactional
    public BlockedPeriodCreatedResponse create(BlockedPeriodRequest req, Long adminId) {
        if (!req.endTime().isAfter(req.startTime())) {
            throw ApiException.invalidField("endTime", "End must be after start.");
        }
        if (!req.endTime().isAfter(LocalDateTime.now(clock))) {
            throw ApiException.invalidField("endTime", "The blocked period must end in the future.");
        }
        if (Duration.between(req.startTime(), req.endTime()).toDays() > 366) {
            throw ApiException.invalidField("endTime", "Blocked periods can last at most one year.");
        }
        Room room = null;
        if (req.roomId() != null) {
            room = rooms.findByIdForUpdate(req.roomId()).orElseThrow(() -> ApiException.notFound("Room not found."));
        } else {
            rooms.findAllForUpdate();
        }
        User admin = users.getReferenceById(adminId);

        BlockedPeriod block = new BlockedPeriod();
        block.setRoom(room);
        block.setStartTime(req.startTime());
        block.setEndTime(req.endTime());
        block.setReason(req.reason().trim());
        block.setCreatedBy(admin);
        blocks.saveAndFlush(block);

        List<Booking> affected = bookings.findConfirmedOverlapping(req.roomId(), req.startTime(), req.endTime());
        int cancelled = 0;
        if (req.cancelAffectedBookings()) {
            String reason = "Room unavailable: " + block.getReason();
            for (Booking b : affected) {
                bookingService.cancel(b, admin, reason, BookingEventType.CANCELLED_BY_ADMIN);
                cancelled++;
            }
        }
        BookingMapper.Context ctx = bookingService.context(true);
        List<BookingResponse> affectedResponses = affected.stream().map(b -> bookingMapper.toResponse(b, ctx)).toList();
        return new BlockedPeriodCreatedResponse(toResponse(block), affectedResponses, cancelled);
    }

    @Transactional
    public void delete(Long id) {
        BlockedPeriod block = blocks.findById(id).orElseThrow(() -> ApiException.notFound("Blocked period not found."));
        blocks.delete(block);
    }

    private BlockedPeriodResponse toResponse(BlockedPeriod b) {
        Room room = b.getRoom();
        return new BlockedPeriodResponse(b.getId(), room == null ? null : room.getId(),
                room == null ? null : room.getRoomNumber(), room == null ? null : room.getName(),
                b.getStartTime(), b.getEndTime(), b.getReason(),
                b.getCreatedBy() == null ? null : b.getCreatedBy().getFullName(), b.getCreatedAt());
    }
}
