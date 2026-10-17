package com.studyhive.repository;

import com.studyhive.entity.Role;
import com.studyhive.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRole(Role role);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select u from User u
            where (:q is null or lower(u.fullName) like lower(concat('%', :q, '%')) escape '\\'
                              or lower(u.email) like lower(concat('%', :q, '%')) escape '\\')
            """)
    Page<User> search(@Param("q") String q, Pageable pageable);
}
