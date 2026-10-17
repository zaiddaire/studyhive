package com.studyhive.mapper;

import com.studyhive.dto.BookingDtos.BookingEventResponse;
import com.studyhive.dto.BookingDtos.BookingOwnerInfo;
import com.studyhive.dto.BookingDtos.BookingResponse;
import com.studyhive.dto.BookingDtos.BookingRoomInfo;
import com.studyhive.entity.Booking;
import com.studyhive.entity.BookingEvent;
import com.studyhive.entity.BookingSettings;
import com.studyhive.entity.BookingStatus;
import com.studyhive.entity.Role;
import com.studyhive.entity.Room;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Component
public class BookingMapper {

    /** Everything needed to compute viewer-dependent fields such as "can this be cancelled right now". */
    public record Context(BookingSettings settings, LocalDateTime now, ZoneId zone, boolean adminView) {
    }

    private final RoomMapper roomMapper;

    public BookingMapper(RoomMapper roomMapper) {
        this.roomMapper = roomMapper;
    }

    public BookingResponse toResponse(Booking b, Context ctx) {
        return toResponse(b, ctx, null);
    }

    public BookingResponse toResponse(Booking b, Context ctx, List<BookingEvent> history) {
        Room room = b.getRoom();
        BookingRoomInfo roomInfo = new BookingRoomInfo(room.getId(), room.getRoomNumber(), room.getName(),
                room.getLocation(), roomMapper.cover(room));
        LocalDateTime deadline = b.getStartTime().minusMinutes(ctx.settings().getCancellationDeadlineMinutes());
        boolean cancellable = b.getStatus() == BookingStatus.CONFIRMED && (ctx.adminView()
                ? b.getEndTime().isAfter(ctx.now())
                : ctx.now().isBefore(deadline));
        Boolean cancelledByAdmin = b.getStatus() == BookingStatus.CANCELLED && b.getCancelledBy() != null
                ? b.getCancelledBy().getRole() == Role.ADMIN && !b.getCancelledBy().getId().equals(b.getUser().getId())
                : null;
        BookingOwnerInfo owner = ctx.adminView()
                ? new BookingOwnerInfo(b.getUser().getId(), b.getUser().getFullName(), b.getUser().getEmail())
                : null;
        List<BookingEventResponse> events = history == null ? null : history.stream()
                .map(e -> new BookingEventResponse(e.getEventType(),
                        e.getActor() == null ? null : e.getActor().getFullName(), e.getDetails(), e.getCreatedAt()))
                .toList();
        return new BookingResponse(b.getId(), b.getBookingReference(), b.getStatus(), roomInfo,
                b.getStartTime(), b.getEndTime(),
                b.getStartTime().atZone(ctx.zone()).toInstant(), b.getEndTime().atZone(ctx.zone()).toInstant(),
                b.getGroupName(), b.getGroupSize(), b.getPurpose(), b.getTotalPrice(), b.getCancellationReason(),
                b.getCancelledAt(), cancelledByAdmin, b.getCreatedAt(), cancellable,
                b.getStatus() == BookingStatus.CONFIRMED ? deadline : null, owner, events);
    }
}
