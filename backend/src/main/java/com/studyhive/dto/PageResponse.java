package com.studyhive.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(page.getContent().stream().map(mapper).toList(),
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }

    /** Pages an already-filtered in-memory list. */
    public static <T> PageResponse<T> ofList(List<T> all, int page, int size) {
        int total = all.size();
        int from = Math.min(page * size, total);
        int to = Math.min(from + size, total);
        int totalPages = size == 0 ? 0 : (int) Math.ceil((double) total / size);
        return new PageResponse<>(all.subList(from, to), page, size, total, totalPages);
    }
}
