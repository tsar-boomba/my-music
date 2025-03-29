DROP TRIGGER update_users;
CREATE TRIGGER update_users
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users
    SET updated_at = CURRENT_TIMESTAMP
    WHERE username = OLD.username;
END;

DROP TRIGGER update_songs;
CREATE TRIGGER update_songs
AFTER UPDATE ON songs
FOR EACH ROW
BEGIN
    UPDATE songs
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
END;

DROP TRIGGER update_storage_backends;
CREATE TRIGGER update_storage_backends
AFTER UPDATE ON storage_backends
FOR EACH ROW
BEGIN
    UPDATE storage_backends
    SET updated_at = CURRENT_TIMESTAMP
    WHERE name = OLD.name;
END;

DROP TRIGGER update_sources;
CREATE TRIGGER update_sources
AFTER UPDATE ON sources
FOR EACH ROW
BEGIN
    UPDATE sources
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
END;

DROP TRIGGER update_albums;
CREATE TRIGGER update_albums
AFTER UPDATE ON albums
FOR EACH ROW
BEGIN
    UPDATE albums
    SET updated_at = CURRENT_TIMESTAMP
    WHERE title = OLD.title;
END;

DROP TRIGGER update_artists;
CREATE TRIGGER update_artists
AFTER UPDATE ON artists
FOR EACH ROW
BEGIN
    UPDATE artists
    SET updated_at = CURRENT_TIMESTAMP
    WHERE name = OLD.name;
END;
