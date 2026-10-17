-- DEMO SEED DATA: sample rooms for demonstration and testing.
-- These are illustrative records, not real-world facilities. Exclude this location by setting
-- FLYWAY_LOCATIONS=classpath:db/migration before the first startup if you do not want sample rooms.

INSERT INTO rooms (room_number, name, description, location, accessibility_info, minimum_capacity, maximum_capacity,
                   status, hourly_price, created_at, updated_at) VALUES
    ('G-101', 'The Focus Room',
     'A calm, daylight-filled room built for deep work. A long oak table, soft acoustic panels and a single wall-mounted whiteboard keep the space distraction-free for focused revision sessions.',
     'Ground floor, east wing', 'Step-free entrance from the main corridor.', 2, 6, 'ACTIVE', NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('G-102', 'The Hive Room',
     'Our signature group room. Seats eight around a generous table with power at every seat, a large display for screen sharing and plenty of whiteboard space for problem sets.',
     'Ground floor, central atrium', 'Step-free access and hearing loop installed.', 3, 8, 'ACTIVE', NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('F-201', 'The Collaboration Studio',
     'An open, modern studio with floor-to-ceiling glass, a modular table and a presentation screen. Ideal for project teams rehearsing presentations or planning group assignments.',
     'First floor, north wing', 'Lift access available.', 4, 8, 'ACTIVE', NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('F-202', 'The Idea Lab',
     'A brainstorming space with whiteboard walls, sticky notes and markers on hand. Built for design sprints, case-study discussions and anything that starts with a blank page.',
     'First floor, south wing', NULL, 3, 7, 'ACTIVE', NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('F-203', 'The Quiet Commons',
     'A smaller, library-adjacent room for groups that prefer a hushed atmosphere. Good for reading groups, exam revision and peer tutoring.',
     'First floor, beside the reading hall', 'Lift access available.', 2, 6, 'ACTIVE', NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('G-103', 'The Seminar Nook',
     'A compact seminar-style room currently closed for refurbishment. Shown here so administrators can see how inactive rooms behave.',
     'Ground floor, west wing', NULL, 4, 8, 'INACTIVE', NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT INTO room_images (room_id, url, alt_text, sort_order)
SELECT r.id, i.url, i.alt_text, i.sort_order
FROM rooms r
JOIN (
    SELECT 'G-101' AS room_number, 'https://images.unsplash.com/photo-1517502884422-41eaead166d4' AS url, 'Bright study room with a long table and chairs' AS alt_text, 0 AS sort_order
    UNION ALL SELECT 'G-101', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173', 'Notebook and pen on a study table', 1
    UNION ALL SELECT 'G-102', 'https://images.unsplash.com/photo-1517048676732-d65bc937f952', 'Group of students working around a shared table', 0
    UNION ALL SELECT 'G-102', 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d', 'Students collaborating with laptops', 1
    UNION ALL SELECT 'F-201', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2', 'Modern glass-walled collaboration studio', 0
    UNION ALL SELECT 'F-201', 'https://images.unsplash.com/photo-1552664730-d307ca884978', 'Group planning on a wall of sticky notes', 1
    UNION ALL SELECT 'F-202', 'https://images.unsplash.com/photo-1552664730-d307ca884978', 'Brainstorming session with sticky notes on the wall', 0
    UNION ALL SELECT 'F-202', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c', 'Laptops and notes on a shared desk', 1
    UNION ALL SELECT 'F-203', 'https://images.unsplash.com/photo-1568992687947-868a62a9f521', 'Quiet study space with warm lighting', 0
    UNION ALL SELECT 'F-203', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570', 'Library shelves beside the study room', 1
    UNION ALL SELECT 'G-103', 'https://images.unsplash.com/photo-1531482615713-2afd69097998', 'Students at a seminar table', 0
) i ON i.room_number = r.room_number;

INSERT INTO room_amenities (room_id, amenity_id)
SELECT r.id, a.id
FROM rooms r
JOIN (
              SELECT 'G-101' AS room_number, 'group-table' AS code
    UNION ALL SELECT 'G-101', 'ergonomic'
    UNION ALL SELECT 'G-101', 'whiteboard'
    UNION ALL SELECT 'G-101', 'markers'
    UNION ALL SELECT 'G-101', 'power'
    UNION ALL SELECT 'G-101', 'wifi'
    UNION ALL SELECT 'G-101', 'quiet'
    UNION ALL SELECT 'G-101', 'natural-light'
    UNION ALL SELECT 'G-101', 'step-free'
    UNION ALL SELECT 'G-102', 'group-table'
    UNION ALL SELECT 'G-102', 'ergonomic'
    UNION ALL SELECT 'G-102', 'whiteboard'
    UNION ALL SELECT 'G-102', 'markers'
    UNION ALL SELECT 'G-102', 'power'
    UNION ALL SELECT 'G-102', 'wifi'
    UNION ALL SELECT 'G-102', 'ac'
    UNION ALL SELECT 'G-102', 'display'
    UNION ALL SELECT 'G-102', 'step-free'
    UNION ALL SELECT 'G-102', 'hearing-loop'
    UNION ALL SELECT 'F-201', 'group-table'
    UNION ALL SELECT 'F-201', 'power'
    UNION ALL SELECT 'F-201', 'wifi'
    UNION ALL SELECT 'F-201', 'ac'
    UNION ALL SELECT 'F-201', 'display'
    UNION ALL SELECT 'F-201', 'natural-light'
    UNION ALL SELECT 'F-201', 'step-free'
    UNION ALL SELECT 'F-202', 'group-table'
    UNION ALL SELECT 'F-202', 'whiteboard'
    UNION ALL SELECT 'F-202', 'markers'
    UNION ALL SELECT 'F-202', 'power'
    UNION ALL SELECT 'F-202', 'wifi'
    UNION ALL SELECT 'F-202', 'display'
    UNION ALL SELECT 'F-203', 'group-table'
    UNION ALL SELECT 'F-203', 'ergonomic'
    UNION ALL SELECT 'F-203', 'power'
    UNION ALL SELECT 'F-203', 'wifi'
    UNION ALL SELECT 'F-203', 'ac'
    UNION ALL SELECT 'F-203', 'quiet'
    UNION ALL SELECT 'F-203', 'step-free'
    UNION ALL SELECT 'G-103', 'group-table'
    UNION ALL SELECT 'G-103', 'whiteboard'
    UNION ALL SELECT 'G-103', 'wifi'
) m ON m.room_number = r.room_number
JOIN amenities a ON a.code = m.code;
