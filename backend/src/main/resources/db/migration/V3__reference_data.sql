-- Reference data required by every environment (not demo content)

INSERT INTO booking_settings (id, slot_duration_minutes, min_duration_minutes, max_duration_minutes,
                              advance_booking_days, cancellation_deadline_minutes, max_active_bookings_per_user,
                              pricing_enabled, updated_at)
VALUES (1, 60, 60, 180, 14, 60, 5, FALSE, UTC_TIMESTAMP(6));

-- Facility-wide default hours: Mon-Sat 09:00-21:00, Sunday 10:00-18:00 (1 = Monday ... 7 = Sunday)
INSERT INTO operating_hours (room_id, day_of_week, open_time, close_time, closed) VALUES
    (NULL, 1, '09:00:00', '21:00:00', FALSE),
    (NULL, 2, '09:00:00', '21:00:00', FALSE),
    (NULL, 3, '09:00:00', '21:00:00', FALSE),
    (NULL, 4, '09:00:00', '21:00:00', FALSE),
    (NULL, 5, '09:00:00', '21:00:00', FALSE),
    (NULL, 6, '09:00:00', '21:00:00', FALSE),
    (NULL, 7, '10:00:00', '18:00:00', FALSE);

INSERT INTO amenities (code, name, description, category) VALUES
    ('group-table',    'Large group table',   'A shared table that seats the whole group', 'FACILITY'),
    ('ergonomic',      'Ergonomic chairs',    'Adjustable chairs for long sessions', 'FACILITY'),
    ('whiteboard',     'Whiteboard',          'Wall-mounted whiteboard', 'EQUIPMENT'),
    ('markers',        'Marker pens',         'Whiteboard markers and eraser provided', 'EQUIPMENT'),
    ('power',          'Power outlets',       'Charging points at the table', 'FACILITY'),
    ('wifi',           'Wi-Fi',               'High-speed wireless internet', 'FACILITY'),
    ('ac',             'Air conditioning',    'Climate-controlled room', 'FACILITY'),
    ('display',        'Display screen',      'Large screen with HDMI and USB-C input', 'EQUIPMENT'),
    ('quiet',          'Quiet environment',   'Acoustically treated walls', 'FACILITY'),
    ('natural-light',  'Natural light',       'Large windows with blinds', 'FACILITY'),
    ('step-free',      'Step-free access',    'Reachable without stairs', 'ACCESSIBILITY'),
    ('hearing-loop',   'Hearing loop',        'Induction loop for hearing aids', 'ACCESSIBILITY');
