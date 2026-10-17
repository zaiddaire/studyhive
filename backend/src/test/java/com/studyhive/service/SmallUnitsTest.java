package com.studyhive.service;

import com.studyhive.repository.BookingRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class SmallUnitsTest {

    @Test
    void bookingReferencesAreReadableAndRetryOnCollision() {
        BookingRepository repo = Mockito.mock(BookingRepository.class);
        when(repo.existsByBookingReference(anyString())).thenReturn(true, true, false);
        BookingReferenceGenerator generator = new BookingReferenceGenerator(repo);
        String ref = generator.next();
        assertThat(ref).matches("SH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}");
        Mockito.verify(repo, Mockito.times(3)).existsByBookingReference(anyString());

        Set<String> many = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            many.add(generator.randomReference());
        }
        assertThat(many.size()).isGreaterThan(995);
    }

    @Test
    void imageTypeIsDetectedFromBytesNotFileName() {
        assertThat(ImageService.detectType(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0})).isEqualTo("image/jpeg");
        assertThat(ImageService.detectType(new byte[]{(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'})).isEqualTo("image/png");
        assertThat(ImageService.detectType("RIFF0000WEBPVP8 ".getBytes())).isEqualTo("image/webp");
        assertThat(ImageService.detectType("<svg onload=alert(1)>".getBytes())).isNull();
        assertThat(ImageService.detectType(new byte[0])).isNull();
    }

    @Test
    void likePatternsAreEscaped() {
        assertThat(BookingService.escapeLike("50%_off\\")).isEqualTo("50\\%\\_off\\\\");
    }

    @Test
    void utilisationOverlapIsClippedToTheWindow() {
        LocalDateTime d = LocalDateTime.of(2031, 3, 4, 0, 0);
        assertThat(AdminStatsService.overlapMinutes(d.withHour(9), d.withHour(12), d.withHour(10), d.withHour(11))).isEqualTo(60);
        assertThat(AdminStatsService.overlapMinutes(d.withHour(9), d.withHour(10), d.withHour(11), d.withHour(12))).isZero();
    }

    @Test
    void resetTokensAreHashedDeterministically() {
        assertThat(PasswordResetService.sha256("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
