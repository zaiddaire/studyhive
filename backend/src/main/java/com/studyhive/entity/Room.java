package com.studyhive.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "rooms")
public class Room extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_number", nullable = false, unique = true, length = 20)
    private String roomNumber;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(length = 150)
    private String location;

    @Column(name = "accessibility_info", length = 500)
    private String accessibilityInfo;

    @Column(name = "minimum_capacity", nullable = false)
    private int minimumCapacity;

    @Column(name = "maximum_capacity", nullable = false)
    private int maximumCapacity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoomStatus status = RoomStatus.ACTIVE;

    @Column(name = "hourly_price", precision = 10, scale = 2)
    private BigDecimal hourlyPrice;

    @BatchSize(size = 50)
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<RoomImage> images = new ArrayList<>();

    @BatchSize(size = 50)
    @ManyToMany
    @JoinTable(name = "room_amenities",
            joinColumns = @JoinColumn(name = "room_id"),
            inverseJoinColumns = @JoinColumn(name = "amenity_id"))
    private Set<Amenity> amenities = new LinkedHashSet<>();

    public boolean isActive() {
        return status == RoomStatus.ACTIVE;
    }

    public void replaceImages(List<RoomImage> newImages) {
        images.clear();
        for (RoomImage image : newImages) {
            image.setRoom(this);
            images.add(image);
        }
    }
}
