package com.studyhive.repository;

import com.studyhive.entity.BookingSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingSettingsRepository extends JpaRepository<BookingSettings, Short> {
}
