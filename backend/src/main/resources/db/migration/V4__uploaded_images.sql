-- Room photographs uploaded by administrators. Stored in MySQL so they survive redeploys on hosts with
-- ephemeral filesystems (e.g. Railway). Uploads are limited to 2 MB each by the API.
CREATE TABLE uploaded_images (
    id            CHAR(36)     NOT NULL,
    content_type  VARCHAR(50)  NOT NULL,
    size_bytes    INT          NOT NULL,
    data          MEDIUMBLOB   NOT NULL,
    created_by    BIGINT       NULL,
    created_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_uploaded_images_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_uploaded_images_type CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp'))
) ENGINE = InnoDB;
