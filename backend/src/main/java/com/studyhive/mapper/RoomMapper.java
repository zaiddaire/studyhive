package com.studyhive.mapper;

import com.studyhive.dto.AdminDtos.AdminRoomResponse;
import com.studyhive.dto.RoomDtos.AmenityResponse;
import com.studyhive.dto.RoomDtos.AvailabilitySummary;
import com.studyhive.dto.RoomDtos.BookingRulesResponse;
import com.studyhive.dto.RoomDtos.DayHoursResponse;
import com.studyhive.dto.RoomDtos.RoomDetail;
import com.studyhive.dto.RoomDtos.RoomImageResponse;
import com.studyhive.dto.RoomDtos.RoomSummary;
import com.studyhive.entity.Amenity;
import com.studyhive.entity.BookingSettings;
import com.studyhive.entity.Room;
import com.studyhive.entity.RoomImage;
import com.studyhive.service.DayHours;
import com.studyhive.service.HoursResolver;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.IntStream;

@Component
public class RoomMapper {

    private static final Comparator<Amenity> AMENITY_ORDER =
            Comparator.comparing(Amenity::getCategory).thenComparing(Amenity::getName);

    public AmenityResponse toAmenity(Amenity a) {
        return new AmenityResponse(a.getId(), a.getCode(), a.getName(), a.getDescription(), a.getCategory());
    }

    public RoomImageResponse toImage(RoomImage image) {
        return new RoomImageResponse(image.getUrl(), image.getAltText());
    }

    public RoomImageResponse cover(Room room) {
        return room.getImages().isEmpty() ? null : toImage(room.getImages().get(0));
    }

    public List<AmenityResponse> amenities(Room room) {
        return room.getAmenities().stream().sorted(AMENITY_ORDER).map(this::toAmenity).toList();
    }

    public RoomSummary toSummary(Room room, boolean pricingEnabled, AvailabilitySummary availability) {
        return new RoomSummary(room.getId(), room.getRoomNumber(), room.getName(), summarize(room.getDescription()),
                room.getLocation(), room.getMinimumCapacity(), room.getMaximumCapacity(), room.getStatus(),
                pricingEnabled ? room.getHourlyPrice() : null, cover(room), amenities(room), availability);
    }

    public RoomDetail toDetail(Room room, BookingSettings settings, HoursResolver hours, ZoneId zone) {
        return new RoomDetail(room.getId(), room.getRoomNumber(), room.getName(), room.getDescription(),
                room.getLocation(), room.getAccessibilityInfo(), room.getMinimumCapacity(), room.getMaximumCapacity(),
                room.getStatus(), settings.isPricingEnabled() ? room.getHourlyPrice() : null,
                room.getImages().stream().map(this::toImage).toList(), amenities(room),
                weeklyHours(room.getId(), hours), toRules(settings, zone));
    }

    public AdminRoomResponse toAdmin(Room room, boolean customHours, long upcomingBookings) {
        return new AdminRoomResponse(room.getId(), room.getRoomNumber(), room.getName(), room.getDescription(),
                room.getLocation(), room.getAccessibilityInfo(), room.getMinimumCapacity(), room.getMaximumCapacity(),
                room.getStatus(), room.getHourlyPrice(), room.getImages().stream().map(this::toImage).toList(),
                amenities(room), customHours, upcomingBookings, room.getCreatedAt(), room.getUpdatedAt());
    }

    public List<DayHoursResponse> weeklyHours(Long roomId, HoursResolver hours) {
        return IntStream.rangeClosed(1, 7)
                .mapToObj(d -> toDayHours(d, hours.forRoom(roomId, DayOfWeek.of(d))))
                .toList();
    }

    public DayHoursResponse toDayHours(int dayOfWeek, DayHours h) {
        String name = DayOfWeek.of(dayOfWeek).getDisplayName(TextStyle.FULL, Locale.ENGLISH);
        return new DayHoursResponse(dayOfWeek, name, h.closed(), h.closed() ? null : h.open(), h.closed() ? null : h.close());
    }

    public BookingRulesResponse toRules(BookingSettings s, ZoneId zone) {
        return new BookingRulesResponse(s.getSlotDurationMinutes(), s.getMinDurationMinutes(), s.getMaxDurationMinutes(),
                s.getAdvanceBookingDays(), s.getCancellationDeadlineMinutes(), s.getMaxActiveBookingsPerUser(),
                s.isPricingEnabled(), zone.getId());
    }

    static String summarize(String description) {
        if (description == null) {
            return "";
        }
        String text = description.strip();
        int sentenceEnd = text.indexOf(". ");
        if (sentenceEnd > 0 && sentenceEnd < 180) {
            return text.substring(0, sentenceEnd + 1);
        }
        return text.length() <= 180 ? text : text.substring(0, 177).strip() + "...";
    }
}
