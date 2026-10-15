DELIMITER $$
CREATE TRIGGER indication_guard BEFORE INSERT ON indications FOR EACH ROW
BEGIN
 DECLARE v_owner CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; DECLARE v_status VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; DECLARE v_city INT; DECLARE v_hidden DATETIME(3); DECLARE v_place_city INT;
 IF COALESCE(@goindica_importing,0) <> 1 THEN
  SELECT requester_id,status,city_id,hidden_at INTO v_owner,v_status,v_city,v_hidden FROM requests WHERE id=NEW.request_id FOR UPDATE;
  IF v_owner IS NULL OR v_hidden IS NOT NULL OR v_status <> 'OPEN' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='RESPONSES_LOCKED'; END IF;
  IF NEW.user_id=v_owner THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SELF_INDICATION'; END IF;
  SELECT city_id INTO v_place_city FROM places WHERE id=NEW.place_id AND hidden_at IS NULL;
  IF v_place_city IS NULL OR v_place_city<>v_city THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_CITY'; END IF;
  IF NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.user_id AND blocked=FALSE) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ACCOUNT_BLOCKED'; END IF;
 END IF;
END$$
CREATE TRIGGER resolution_guard BEFORE INSERT ON request_resolutions FOR EACH ROW
BEGIN
 DECLARE v_owner CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; DECLARE v_status VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; DECLARE v_hidden DATETIME(3);
 IF COALESCE(@goindica_importing,0) <> 1 THEN
  SELECT requester_id,status,hidden_at INTO v_owner,v_status,v_hidden FROM requests WHERE id=NEW.request_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner<>NEW.resolved_by OR v_status<>'REVEALED' OR v_hidden IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NOT_ALLOWED'; END IF;
  IF NEW.type='INDICATED_PLACE' AND NOT EXISTS(SELECT 1 FROM indications WHERE request_id=NEW.request_id AND place_id=NEW.place_id AND hidden_at IS NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_PLACE'; END IF;
 END IF;
END$$
CREATE TRIGGER reward_guard BEFORE INSERT ON reward_events FOR EACH ROW
BEGIN
 IF COALESCE(@goindica_importing,0) <> 1 AND NOT EXISTS(
  SELECT 1 FROM indications i JOIN requests r ON r.id=i.request_id JOIN request_resolutions s ON s.request_id=r.id
  WHERE i.id=NEW.indication_id AND i.user_id=NEW.user_id AND i.request_id=NEW.request_id AND r.city_id=NEW.city_id
   AND s.type='INDICATED_PLACE' AND s.place_id=i.place_id AND i.hidden_at IS NULL
 ) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_REWARD'; END IF;
END$$
CREATE TRIGGER request_update_guard BEFORE UPDATE ON requests FOR EACH ROW
BEGIN
 IF COALESCE(@goindica_importing,0)<>1 AND COALESCE(@goindica_anonymizing,0)<>1 THEN
  IF NEW.id<>OLD.id OR NEW.requester_id<>OLD.requester_id OR NEW.created_at<>OLD.created_at THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NOT_ALLOWED'; END IF;
  IF (NOT (NEW.description <=> OLD.description) OR NEW.city_id<>OLD.city_id OR NOT (NEW.neighborhood <=> OLD.neighborhood)) AND (OLD.status<>'OPEN' OR EXISTS(SELECT 1 FROM indications WHERE request_id=OLD.id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='EDIT_LOCKED'; END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='OPEN' AND NEW.status IN ('REVEALED','CANCELED')) OR (OLD.status='REVEALED' AND NEW.status IN ('RESOLVED','CLOSED_NO_RESULT','CANCELED'))) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_TRANSITION'; END IF;
 END IF;
END$$
DELIMITER ;
