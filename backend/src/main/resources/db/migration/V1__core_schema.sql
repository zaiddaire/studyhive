-- StudyHive core schema (MySQL 8)
-- Reservation times (bookings.start_time/end_time, blocked periods) are facility-local wall-clock
-- times in APP_TIME_ZONE. Audit timestamps (created_at/updated_at) are stored in UTC.

CREATE TABLE users (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(254) NOT NULL,
    password_hash   VARCHAR(100) NOT NULL,
    role            VARCHAR(20)  NOT NULL,
    account_status  VARCHAR(20)  NOT NULL,
    created_at      DATETIME(6)  NOT NULL,
    updated_at      DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('STUDENT', 'ADMIN')),
    CONSTRAINT ck_users_status CHECK (account_status IN ('ACTIVE', 'SUSPENDED'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE rooms (
    id                  BIGINT        NOT NULL AUTO_INCREMENT,
    room_number         VARCHAR(20)   NOT NULL,
    name                VARCHAR(100)  NOT NULL,
    description         TEXT          NOT NULL,
    location            VARCHAR(150)  NULL,
    accessibility_info  VARCHAR(500)  NULL,
    minimum_capacity    INT           NOT NULL,
    maximum_capacity    INT           NOT NULL,
    status              VARCHAR(20)   NOT NULL,
    hourly_price        DECIMAL(10,2) NULL,
    created_at          DATETIME(6)   NOT NULL,
    updated_at          DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_rooms_number UNIQUE (room_number),
    CONSTRAINT ck_rooms_capacity CHECK (minimum_capacity >= 1 AND maximum_capacity >= minimum_capacity AND maximum_capacity <= 50),
    CONSTRAINT ck_rooms_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_rooms_price CHECK (hourly_price IS NULL OR hourly_price >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX ix_rooms_status ON rooms (status);

CREATE TABLE room_images (
    id          BIGINT        NOT NULL AUTO_INCREMENT,
    room_id     BIGINT        NOT NULL,
    url         VARCHAR(1000) NOT NULL,
    alt_text    VARCHAR(200)  NOT NULL,
    sort_order  INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_room_images_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX ix_room_images_room ON room_images (room_id, sort_order);

CREATE TABLE amenities (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    code        VARCHAR(50)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    category    VARCHAR(20)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_amenities_code UNIQUE (code),
    CONSTRAINT uq_amenities_name UNIQUE (name),
    CONSTRAINT ck_amenities_category CHECK (category IN ('FACILITY', 'EQUIPMENT', 'ACCESSIBILITY'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE room_amenities (
    room_id     BIGINT NOT NULL,
    amenity_id  BIGINT NOT NULL,
    PRIMARY KEY (room_id, amenity_id),
    CONSTRAINT fk_room_amenities_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_room_amenities_amenity FOREIGN KEY (amenity_id) REFERENCES amenities (id) ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX ix_room_amenities_amenity ON room_amenities (amenity_id);

CREATE TABLE bookings (
    id                   BIGINT        NOT NULL AUTO_INCREMENT,
    booking_reference    VARCHAR(20)   NOT NULL,
    user_id              BIGINT        NOT NULL,
    room_id              BIGINT        NOT NULL,
    group_name           VARCHAR(100)  NULL,
    group_size           INT           NOT NULL,
    purpose              VARCHAR(500)  NULL,
    start_time           DATETIME      NOT NULL,
    end_time             DATETIME      NOT NULL,
    status               VARCHAR(20)   NOT NULL,
    total_price          DECIMAL(10,2) NULL,
    cancellation_reason  VARCHAR(500)  NULL,
    cancelled_at         DATETIME(6)   NULL,
    cancelled_by         BIGINT        NULL,
    idempotency_key      VARCHAR(64)   NULL,
    created_at           DATETIME(6)   NOT NULL,
    updated_at           DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_bookings_reference UNIQUE (booking_reference),
    CONSTRAINT uq_bookings_idempotency UNIQUE (user_id, idempotency_key),
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_bookings_range CHECK (end_time > start_time),
    CONSTRAINT ck_bookings_group CHECK (group_size >= 1),
    CONSTRAINT ck_bookings_status CHECK (status IN ('CONFIRMED', 'CANCELLED', 'COMPLETED'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Availability / overlap checks: room + status + time range
CREATE INDEX ix_bookings_room_status_time ON bookings (room_id, status, start_time, end_time);
-- "My bookings" queries
CREATE INDEX ix_bookings_user_start ON bookings (user_id, start_time);
-- Date-range and status filters (admin, stats)
CREATE INDEX ix_bookings_start ON bookings (start_time);
CREATE INDEX ix_bookings_status_start ON bookings (status, start_time);

CREATE TABLE booking_events (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    booking_id     BIGINT       NOT NULL,
    event_type     VARCHAR(30)  NOT NULL,
    actor_user_id  BIGINT       NULL,
    details        VARCHAR(500) NULL,
    created_at     DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_booking_events_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_events_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX ix_booking_events_booking ON booking_events (booking_id, created_at);
CREATE INDEX ix_booking_events_created ON booking_events (created_at);

-- Weekly operating hours. room_id NULL = facility-wide default; a room with its own rows overrides the default.
CREATE TABLE operating_hours (
    id           BIGINT   NOT NULL AUTO_INCREMENT,
    room_id      BIGINT   NULL,
    scope_key    BIGINT   AS (COALESCE(room_id, 0)) STORED,
    day_of_week  TINYINT  NOT NULL,
    open_time    TIME     NULL,
    close_time   TIME     NULL,
    closed       BOOLEAN  NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT uq_operating_hours_scope_day UNIQUE (scope_key, day_of_week),
    -- RESTRICT: MySQL forbids CASCADE on a base column of a stored generated column; rows are removed by the service.
    CONSTRAINT fk_operating_hours_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE RESTRICT,
    CONSTRAINT ck_operating_hours_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_operating_hours_times CHECK (closed = TRUE OR (open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time))
) ENGINE = InnoDB;

-- Maintenance windows, events and closures. room_id NULL = applies to every room.
CREATE TABLE blocked_periods (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    room_id     BIGINT       NULL,
    start_time  DATETIME     NOT NULL,
    end_time    DATETIME     NOT NULL,
    reason      VARCHAR(255) NOT NULL,
    created_by  BIGINT       NULL,
    created_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_blocked_periods_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_blocked_periods_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_blocked_periods_range CHECK (end_time > start_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX ix_blocked_periods_time ON blocked_periods (start_time, end_time);
CREATE INDEX ix_blocked_periods_room ON blocked_periods (room_id, start_time);

-- Single-row booking configuration
CREATE TABLE booking_settings (
    id                             TINYINT     NOT NULL,
    slot_duration_minutes          INT         NOT NULL,
    min_duration_minutes           INT         NOT NULL,
    max_duration_minutes           INT         NOT NULL,
    advance_booking_days           INT         NOT NULL,
    cancellation_deadline_minutes  INT         NOT NULL,
    max_active_bookings_per_user   INT         NOT NULL,
    pricing_enabled                BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at                     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_booking_settings_singleton CHECK (id = 1),
    CONSTRAINT ck_booking_settings_slot CHECK (slot_duration_minutes IN (15, 30, 60, 90, 120)),
    CONSTRAINT ck_booking_settings_durations CHECK (min_duration_minutes >= slot_duration_minutes AND max_duration_minutes >= min_duration_minutes),
    CONSTRAINT ck_booking_settings_limits CHECK (advance_booking_days BETWEEN 1 AND 365 AND cancellation_deadline_minutes >= 0 AND max_active_bookings_per_user >= 1)
) ENGINE = InnoDB;

CREATE TABLE password_reset_tokens (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    user_id     BIGINT      NOT NULL,
    token_hash  CHAR(64)    NOT NULL,
    expires_at  DATETIME(6) NOT NULL,
    used_at     DATETIME(6) NULL,
    created_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_password_reset_token UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE INDEX ix_password_reset_user ON password_reset_tokens (user_id);
