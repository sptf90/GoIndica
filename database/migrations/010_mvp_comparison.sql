-- MVP v3.0: comparação anônima, apresentação, seleção/avaliação, reabertura e pontos.
-- Incremental e reversível em staging; NÃO aplicar em produção sem autorização e backup.
-- Mapeamento legado: REVEALED → OPEN com first_comparison_opened_at preenchido (DEC-02).
-- Rollback sugerido: restaurar backup verificado.

-- Remove CHECKs legados cujo nome automático varia; recria regras compatíveis no final.
DELIMITER $$
CREATE PROCEDURE goindica_drop_checks(IN p_table VARCHAR(64))
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE cname VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND CONSTRAINT_TYPE='CHECK';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO cname;
    IF done THEN LEAVE read_loop; END IF;
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` DROP CHECK `', cname, '`');
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;
END$$
DELIMITER ;
CALL goindica_drop_checks('requests');
CALL goindica_drop_checks('reward_events');
DROP PROCEDURE goindica_drop_checks;

ALTER TABLE requests
  MODIFY COLUMN status ENUM(
    'OPEN','REVEALED','EVALUATING','RESOLVED','CLOSED_NO_RESULT','CLOSED_TIMEOUT','CLOSED_EXHAUSTED','CANCELED'
  ) NOT NULL DEFAULT 'OPEN';

ALTER TABLE requests
  ADD COLUMN first_comparison_opened_at DATETIME(3) NULL AFTER responses_revealed_at,
  ADD COLUMN reopen_count INT NOT NULL DEFAULT 0 AFTER first_comparison_opened_at,
  ADD COLUMN current_round INT NOT NULL DEFAULT 0 AFTER reopen_count,
  ADD COLUMN selected_indication_id CHAR(36) NULL AFTER current_round,
  ADD COLUMN evaluation_started_at DATETIME(3) NULL AFTER selected_indication_id,
  ADD COLUMN evaluation_deadline_at DATETIME(3) NULL AFTER evaluation_started_at,
  ADD COLUMN next_choice_started_at DATETIME(3) NULL AFTER evaluation_deadline_at,
  ADD COLUMN next_choice_deadline_at DATETIME(3) NULL AFTER next_choice_started_at,
  ADD COLUMN close_reason VARCHAR(80) NULL AFTER next_choice_deadline_at;

ALTER TABLE indications
  ADD COLUMN presented_at DATETIME(3) NULL AFTER created_at,
  ADD COLUMN round_index INT NOT NULL DEFAULT 0 AFTER presented_at,
  ADD COLUMN links_json JSON NULL AFTER comment,
  ADD COLUMN manual_place_name VARCHAR(160) NULL AFTER links_json,
  ADD COLUMN manual_place_address VARCHAR(300) NULL AFTER manual_place_name,
  MODIFY COLUMN place_id CHAR(36) NULL,
  MODIFY COLUMN comment VARCHAR(500) NULL;

ALTER TABLE reward_events
  MODIFY COLUMN type VARCHAR(60) NOT NULL,
  MODIFY COLUMN points INT NOT NULL,
  MODIFY COLUMN indication_id CHAR(36) NULL;

CREATE TABLE IF NOT EXISTS indication_evaluations (
  id CHAR(36) PRIMARY KEY,
  request_id CHAR(36) NOT NULL,
  indication_id CHAR(36) NOT NULL,
  resolved_by CHAR(36) NOT NULL,
  result ENUM('VALID','INVALID') NOT NULL,
  reason_code VARCHAR(80) NULL,
  reason_note VARCHAR(500) NULL,
  round_index INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE(indication_id),
  FOREIGN KEY(request_id) REFERENCES requests(id),
  FOREIGN KEY(indication_id) REFERENCES indications(id),
  FOREIGN KEY(resolved_by) REFERENCES profiles(id),
  CHECK((result='VALID' AND reason_code IS NULL) OR (result='INVALID' AND reason_code IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_sponsorships (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  city_id INT NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NOT NULL,
  logo_path VARCHAR(300) NULL,
  display_name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY(company_id) REFERENCES companies(id),
  FOREIGN KEY(city_id) REFERENCES cities(id),
  INDEX sponsorship_city_window(city_id,active,starts_at,ends_at),
  CHECK(ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS request_update_guard;
DROP TRIGGER IF EXISTS indication_guard;
DROP TRIGGER IF EXISTS resolution_guard;
DROP TRIGGER IF EXISTS reward_guard;

SET @goindica_importing = 1;
UPDATE requests
  SET first_comparison_opened_at = COALESCE(first_comparison_opened_at, responses_revealed_at)
  WHERE responses_revealed_at IS NOT NULL AND first_comparison_opened_at IS NULL;
-- Pedidos legados REVEALED voltam a aceitar envios (DEC-02), mantendo marco de comparação.
UPDATE requests
  SET status='OPEN', responses_revealed_at=NULL, updated_at=UTC_TIMESTAMP(3)
  WHERE status='REVEALED' AND selected_indication_id IS NULL;
SET @goindica_importing = 0;

DELIMITER $$
CREATE TRIGGER indication_guard BEFORE INSERT ON indications FOR EACH ROW
BEGIN
 DECLARE v_owner CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
 DECLARE v_status VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
 DECLARE v_city INT; DECLARE v_hidden DATETIME(3); DECLARE v_place_city INT;
 IF COALESCE(@goindica_importing,0) <> 1 THEN
  SELECT requester_id,status,city_id,hidden_at INTO v_owner,v_status,v_city,v_hidden FROM requests WHERE id=NEW.request_id FOR UPDATE;
  IF v_owner IS NULL OR v_hidden IS NOT NULL OR v_status <> 'OPEN' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='RESPONSES_LOCKED'; END IF;
  IF NEW.user_id=v_owner THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SELF_INDICATION'; END IF;
  IF NEW.place_id IS NOT NULL THEN
   SELECT city_id INTO v_place_city FROM places WHERE id=NEW.place_id AND hidden_at IS NULL;
   IF v_place_city IS NULL OR v_place_city<>v_city THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_CITY'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.user_id AND blocked=FALSE) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ACCOUNT_BLOCKED'; END IF;
 END IF;
END$$
CREATE TRIGGER resolution_guard BEFORE INSERT ON request_resolutions FOR EACH ROW
BEGIN
 DECLARE v_owner CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
 DECLARE v_status VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
 DECLARE v_hidden DATETIME(3);
 IF COALESCE(@goindica_importing,0) <> 1 THEN
  SELECT requester_id,status,hidden_at INTO v_owner,v_status,v_hidden FROM requests WHERE id=NEW.request_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner<>NEW.resolved_by OR v_hidden IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NOT_ALLOWED'; END IF;
  IF v_status NOT IN ('REVEALED','EVALUATING','OPEN') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NOT_ALLOWED'; END IF;
  IF NEW.type='INDICATED_PLACE' AND NEW.place_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM indications WHERE request_id=NEW.request_id AND place_id=NEW.place_id AND hidden_at IS NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_PLACE'; END IF;
 END IF;
END$$
CREATE TRIGGER reward_guard BEFORE INSERT ON reward_events FOR EACH ROW
BEGIN
 IF COALESCE(@goindica_importing,0) <> 1 THEN
  IF NEW.type='SUCCESSFUL_INDICATION_REWARD' AND NOT EXISTS(
   SELECT 1 FROM indications i JOIN requests r ON r.id=i.request_id JOIN request_resolutions s ON s.request_id=r.id
   WHERE i.id=NEW.indication_id AND i.user_id=NEW.user_id AND i.request_id=NEW.request_id AND r.city_id=NEW.city_id
    AND s.type='INDICATED_PLACE' AND s.place_id=i.place_id AND i.hidden_at IS NULL
  ) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_REWARD'; END IF;
  IF NEW.type='VALID_INDICATION_REWARD' AND (NEW.points<>10 OR NEW.indication_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM indication_evaluations e WHERE e.indication_id=NEW.indication_id AND e.result='VALID' AND e.request_id=NEW.request_id
  )) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_REWARD'; END IF;
  IF NEW.type='EVALUATION_TIMEOUT_PENALTY' AND (NEW.points<>(-5) OR NEW.indication_id IS NOT NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_REWARD'; END IF;
 END IF;
END$$
CREATE TRIGGER request_update_guard BEFORE UPDATE ON requests FOR EACH ROW
BEGIN
 IF COALESCE(@goindica_importing,0)<>1 AND COALESCE(@goindica_anonymizing,0)<>1 THEN
  IF NEW.id<>OLD.id OR NEW.requester_id<>OLD.requester_id OR NEW.created_at<>OLD.created_at THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NOT_ALLOWED'; END IF;
  IF (NOT (NEW.description <=> OLD.description) OR NEW.city_id<>OLD.city_id OR NOT (NEW.neighborhood <=> OLD.neighborhood)) AND (OLD.status<>'OPEN' OR EXISTS(SELECT 1 FROM indications WHERE request_id=OLD.id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='EDIT_LOCKED'; END IF;
  IF NEW.status<>OLD.status AND NOT (
    (OLD.status='OPEN' AND NEW.status IN ('REVEALED','EVALUATING','CANCELED','CLOSED_NO_RESULT')) OR
    (OLD.status='REVEALED' AND NEW.status IN ('OPEN','EVALUATING','RESOLVED','CLOSED_NO_RESULT','CANCELED','CLOSED_TIMEOUT','CLOSED_EXHAUSTED')) OR
    (OLD.status='EVALUATING' AND NEW.status IN ('RESOLVED','CLOSED_NO_RESULT','CLOSED_TIMEOUT','CLOSED_EXHAUSTED','OPEN')) OR
    (OLD.status IN ('RESOLVED','CLOSED_NO_RESULT','CLOSED_TIMEOUT','CLOSED_EXHAUSTED','CANCELED') AND NEW.status=OLD.status)
  ) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_TRANSITION'; END IF;
 END IF;
END$$
DELIMITER ;

ALTER TABLE requests
  ADD CONSTRAINT requests_canceled_at_chk CHECK((status='CANCELED') = (canceled_at IS NOT NULL)),
  ADD CONSTRAINT requests_reopen_count_chk CHECK(reopen_count BETWEEN 0 AND 3),
  ADD CONSTRAINT requests_round_chk CHECK(current_round BETWEEN 0 AND 3);

ALTER TABLE reward_events
  ADD CONSTRAINT reward_points_chk CHECK(points IN (10, -5)),
  ADD CONSTRAINT reward_type_chk CHECK(type IN ('SUCCESSFUL_INDICATION_REWARD','VALID_INDICATION_REWARD','EVALUATION_TIMEOUT_PENALTY'));
