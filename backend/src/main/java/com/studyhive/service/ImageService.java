package com.studyhive.service;

import com.studyhive.dto.AdminDtos.UploadResponse;
import com.studyhive.entity.UploadedImage;
import com.studyhive.exception.ApiException;
import com.studyhive.repository.UploadedImageRepository;
import com.studyhive.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.UUID;
import java.util.regex.Pattern;

/** Stores administrator-uploaded room photos. The content type is derived from the file bytes, not the client. */
@Service
public class ImageService {

    public static final long MAX_BYTES = 2 * 1024 * 1024;
    public static final String URL_PREFIX = "/api/images/";
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

    public record StoredImage(String contentType, byte[] data) {
    }

    private final UploadedImageRepository images;
    private final UserRepository users;

    public ImageService(UploadedImageRepository images, UserRepository users) {
        this.images = images;
        this.users = users;
    }

    @Transactional
    public UploadResponse upload(MultipartFile file, Long adminId) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "Choose an image to upload.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
                    "Images must be 2 MB or smaller.");
        }
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("INVALID_UPLOAD", "The uploaded file could not be read.");
        }
        String type = detectType(data);
        if (type == null) {
            throw ApiException.badRequest("UNSUPPORTED_IMAGE", "Only JPEG, PNG and WebP images are supported.");
        }
        UploadedImage image = new UploadedImage();
        image.setId(UUID.randomUUID().toString());
        image.setContentType(type);
        image.setSizeBytes(data.length);
        image.setData(data);
        image.setCreatedBy(users.getReferenceById(adminId));
        images.save(image);
        return new UploadResponse(image.getId(), URL_PREFIX + image.getId());
    }

    @Transactional(readOnly = true)
    public StoredImage load(String id) {
        if (id == null || !UUID_PATTERN.matcher(id).matches()) {
            throw ApiException.notFound("Image not found.");
        }
        UploadedImage image = images.findById(id).orElseThrow(() -> ApiException.notFound("Image not found."));
        return new StoredImage(image.getContentType(), image.getData());
    }

    @Transactional(readOnly = true)
    public boolean exists(String url) {
        if (url == null || !url.startsWith(URL_PREFIX)) {
            return false;
        }
        String id = url.substring(URL_PREFIX.length());
        return UUID_PATTERN.matcher(id).matches() && images.existsById(id);
    }

    static String detectType(byte[] d) {
        if (d.length >= 3 && (d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8 && (d[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
        if (d.length >= 8 && Arrays.equals(Arrays.copyOf(d, 8), png)) {
            return "image/png";
        }
        if (d.length >= 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
                && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') {
            return "image/webp";
        }
        return null;
    }
}
