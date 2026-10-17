package com.studyhive;

import com.studyhive.support.IntegrationTest;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MigrationIntegrationTest extends IntegrationTest {

    @Autowired
    private Flyway flyway;

    @Test
    void allMigrationsAppliedOnAFreshDatabase() {
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().applied()).extracting(i -> i.getVersion().getVersion())
                .contains("1", "2", "3", "4", "100");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM amenities", Integer.class)).isEqualTo(12);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM booking_settings", Integer.class)).isEqualTo(1);
    }

    @Test
    void databaseConstraintsGuardDataIntegrity() {
        Long room = roomId("G-102");
        // End before start is rejected by a CHECK constraint even if the service layer were bypassed.
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO bookings (booking_reference, user_id, room_id, group_size, start_time, end_time, status, created_at, updated_at)
                VALUES ('SH-TEST01', ?, ?, 4, '2031-03-04 12:00:00', '2031-03-04 11:00:00', 'CONFIRMED', NOW(6), NOW(6))
                """, student("constraint").getId(), room))
                // MySQL's CHECK error (3819) is not in Spring's JDBC translation table, so assert on the constraint.
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("ck_bookings_range");
        // Orphans are impossible: a booking must reference an existing user.
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO bookings (booking_reference, user_id, room_id, group_size, start_time, end_time, status, created_at, updated_at)
                VALUES ('SH-TEST02', 987654, ?, 4, '2031-03-04 10:00:00', '2031-03-04 11:00:00', 'CONFIRMED', NOW(6), NOW(6))
                """, room)).isInstanceOf(DataIntegrityViolationException.class);
        // Room capacity rules.
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO rooms (room_number, name, description, minimum_capacity, maximum_capacity, status, created_at, updated_at)
                VALUES ('BAD-1', 'Bad', 'x', 9, 3, 'ACTIVE', NOW(6), NOW(6))
                """)).isInstanceOf(DataAccessException.class).hasMessageContaining("ck_rooms_capacity");
    }
}
