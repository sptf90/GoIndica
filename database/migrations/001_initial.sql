-- MySQL 8 / MariaDB 10.6+, UTF-8, UTC. Credentials never enter browser bundles.
CREATE TABLE users (
 id CHAR(36) PRIMARY KEY, email VARCHAR(254) UNIQUE, password_hash VARCHAR(255),
 email_confirmed_at DATETIME(3), deleted_at DATETIME(3), last_sign_in_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE accounts (
 id CHAR(36) PRIMARY KEY, blocked BOOLEAN NOT NULL DEFAULT FALSE, is_admin BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY (id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, purpose ENUM('access','recovery') NOT NULL DEFAULT 'access',
 expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX sessions_user(user_id), INDEX sessions_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE auth_tokens (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL,
 purpose ENUM('email','recovery','email_change') NOT NULL, new_email VARCHAR(254), expires_at DATETIME(3) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX tokens_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE cities (
 id INT PRIMARY KEY, name VARCHAR(160) NOT NULL, normalized_name VARCHAR(160) NOT NULL,
 state_name VARCHAR(80) NOT NULL, state_code CHAR(2) NOT NULL,
 country_name VARCHAR(80) NOT NULL DEFAULT 'Brasil', country_code CHAR(2) NOT NULL DEFAULT 'BR',
 slug VARCHAR(190) NOT NULL UNIQUE, UNIQUE(normalized_name,state_code,country_code), INDEX cities_name(name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE profiles (
 id CHAR(36) PRIMARY KEY, username VARCHAR(24) NOT NULL UNIQUE, display_name VARCHAR(60) NOT NULL,
 avatar_url VARCHAR(512), home_city_id INT NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(id) REFERENCES accounts(id), FOREIGN KEY(home_city_id) REFERENCES cities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE requests (
 id CHAR(36) PRIMARY KEY, requester_id CHAR(36) NOT NULL, description VARCHAR(300) NOT NULL,
 city_id INT NOT NULL, neighborhood VARCHAR(100),
 status ENUM('OPEN','REVEALED','RESOLVED','CLOSED_NO_RESULT','CANCELED') NOT NULL DEFAULT 'OPEN',
 indication_count INT NOT NULL DEFAULT 0, responses_revealed_at DATETIME(3), canceled_at DATETIME(3), hidden_at DATETIME(3),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 has_photo BOOLEAN NOT NULL DEFAULT FALSE, photo_updated_at DATETIME(3), wanting_count INT NOT NULL DEFAULT 0,
 reconfirmation_count INT NOT NULL DEFAULT 0, last_reconfirmed_at DATETIME(3),
 FOREIGN KEY(requester_id) REFERENCES profiles(id), FOREIGN KEY(city_id) REFERENCES cities(id),
 INDEX requests_feed(city_id,status,hidden_at,created_at,id), INDEX requests_author(requester_id,created_at),
 FULLTEXT INDEX requests_search(description),
 CHECK(indication_count >= 0), CHECK(wanting_count >= 0), CHECK(reconfirmation_count >= 0),
 CHECK(CHAR_LENGTH(TRIM(description)) BETWEEN 3 AND 300),
 CHECK((status IN ('REVEALED','RESOLVED','CLOSED_NO_RESULT') AND responses_revealed_at IS NOT NULL) OR status IN ('OPEN','CANCELED')),
 CHECK(status <> 'OPEN' OR responses_revealed_at IS NULL), CHECK((status='CANCELED') = (canceled_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE places (
 id CHAR(36) PRIMARY KEY, city_id INT NOT NULL, name VARCHAR(160) NOT NULL,
 address VARCHAR(300) NOT NULL, normalized_name VARCHAR(160) NOT NULL,
 created_by CHAR(36), hidden_at DATETIME(3), last_verified_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(city_id) REFERENCES cities(id), FOREIGN KEY(created_by) REFERENCES accounts(id),
 UNIQUE(city_id,normalized_name,address), INDEX places_search(city_id,normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE indications (
 id CHAR(36) PRIMARY KEY, request_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL, place_id CHAR(36) NOT NULL,
 comment VARCHAR(300), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), hidden_at DATETIME(3),
 UNIQUE(request_id,user_id), FOREIGN KEY(request_id) REFERENCES requests(id), FOREIGN KEY(user_id) REFERENCES profiles(id),
 FOREIGN KEY(place_id) REFERENCES places(id), INDEX indications_user(user_id,created_at), INDEX indications_place(request_id,place_id,hidden_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE request_resolutions (
 id CHAR(36) PRIMARY KEY, request_id CHAR(36) NOT NULL UNIQUE,
 type ENUM('INDICATED_PLACE','OTHER_PLACE','NOT_FOUND') NOT NULL, place_id CHAR(36), resolved_by CHAR(36) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(request_id) REFERENCES requests(id),
 FOREIGN KEY(place_id) REFERENCES places(id), FOREIGN KEY(resolved_by) REFERENCES profiles(id),
 CHECK((type='INDICATED_PLACE' AND place_id IS NOT NULL) OR (type<>'INDICATED_PLACE' AND place_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE reward_events (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, request_id CHAR(36) NOT NULL, indication_id CHAR(36) NOT NULL,
 city_id INT NOT NULL, type VARCHAR(40) NOT NULL DEFAULT 'SUCCESSFUL_INDICATION_REWARD', points INT NOT NULL DEFAULT 10,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE(indication_id,type), UNIQUE(user_id,request_id,type),
 FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(request_id) REFERENCES requests(id), FOREIGN KEY(indication_id) REFERENCES indications(id),
 FOREIGN KEY(city_id) REFERENCES cities(id), INDEX rewards_city(city_id,user_id,created_at), INDEX rewards_user(user_id,created_at),
 CHECK(points=10), CHECK(type='SUCCESSFUL_INDICATION_REWARD')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE reports (
 id CHAR(36) PRIMARY KEY, reporter_id CHAR(36) NOT NULL, target_type ENUM('REQUEST','INDICATION') NOT NULL,
 target_id CHAR(36) NOT NULL, reason VARCHAR(500) NOT NULL, status ENUM('OPEN','REVIEWED') NOT NULL DEFAULT 'OPEN',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), reviewed_by CHAR(36), reviewed_at DATETIME(3), decision_note VARCHAR(500),
 FOREIGN KEY(reporter_id) REFERENCES profiles(id), FOREIGN KEY(reviewed_by) REFERENCES profiles(id), UNIQUE(reporter_id,target_type,target_id),
 INDEX reports_open(status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE audit_logs (
 id CHAR(36) PRIMARY KEY, actor_id CHAR(36), event_type VARCHAR(80) NOT NULL, entity_type VARCHAR(40) NOT NULL, entity_id CHAR(36),
 metadata JSON NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(actor_id) REFERENCES accounts(id),
 INDEX audit_created(created_at), INDEX audit_actor_event(actor_id,event_type,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE rate_limits (
 actor_id VARCHAR(190) NOT NULL, bucket VARCHAR(60) NOT NULL, window_start DATETIME(3) NOT NULL,
 hits INT NOT NULL, PRIMARY KEY(actor_id,bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE analytics (
 day DATE NOT NULL, event VARCHAR(40) NOT NULL, hits BIGINT NOT NULL DEFAULT 1, PRIMARY KEY(day,event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE user_preferences (
 user_id CHAR(36) PRIMARY KEY, email_reminders BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(user_id) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE followed_cities (
 user_id CHAR(36) NOT NULL, city_id INT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_id,city_id), FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(city_id) REFERENCES cities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE request_interests (
 user_id CHAR(36) NOT NULL, request_id CHAR(36) NOT NULL, saved BOOLEAN NOT NULL DEFAULT FALSE,
 following BOOLEAN NOT NULL DEFAULT FALSE, wanted BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(user_id,request_id),
 FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(request_id) REFERENCES requests(id), INDEX interests_followers(request_id,following)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE notifications (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, request_id CHAR(36) NOT NULL, kind VARCHAR(40) NOT NULL,
 dedupe_key VARCHAR(190) NOT NULL UNIQUE, read_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(request_id) REFERENCES requests(id), INDEX notifications_inbox(user_id,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE support_requests (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, kind ENUM('CLOSE_ACCOUNT','DATA_HELP') NOT NULL, reason VARCHAR(500) NOT NULL,
 status ENUM('OPEN','PROCESSING','COMPLETED','DECLINED') NOT NULL DEFAULT 'OPEN', reviewer_id CHAR(36), decision_note VARCHAR(500),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), reviewed_at DATETIME(3),
 pending_kind VARCHAR(20) GENERATED ALWAYS AS (CASE WHEN status IN ('OPEN','PROCESSING') THEN kind ELSE NULL END) STORED,
 UNIQUE(user_id,pending_kind), FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(reviewer_id) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE search_events (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, city_id INT NOT NULL, request_id CHAR(36),
 kind ENUM('MATCHED','NO_RESULT','CLICKED','USEFUL') NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 useful_request CHAR(36),
 UNIQUE(user_id,useful_request), FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(city_id) REFERENCES cities(id),
 FOREIGN KEY(request_id) REFERENCES requests(id), INDEX search_metrics(city_id,created_at,kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE email_jobs (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, request_id CHAR(36) NOT NULL, week VARCHAR(10) NOT NULL,
 status ENUM('PENDING','PROCESSING','SENT','CANCELED') NOT NULL DEFAULT 'PENDING', attempts INT NOT NULL DEFAULT 0,
 worker_id CHAR(36), lease_until DATETIME(3), first_attempt_at DATETIME(3),
 next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), sent_at DATETIME(3),
 UNIQUE(user_id,request_id,week), FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(request_id) REFERENCES requests(id), INDEX email_pending(status,next_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE request_photos (
 request_id CHAR(36) PRIMARY KEY, jpeg MEDIUMBLOB NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(request_id) REFERENCES requests(id), CHECK(OCTET_LENGTH(jpeg) BETWEEN 4 AND 524288)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE request_reconfirmations (
 user_id CHAR(36) NOT NULL, request_id CHAR(36) NOT NULL, confirmed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_id,request_id), FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(request_id) REFERENCES requests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE topic_alerts (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, city_id INT NOT NULL, term VARCHAR(80) NOT NULL,
 normalized_term VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE(user_id,city_id,normalized_term), FOREIGN KEY(user_id) REFERENCES profiles(id), FOREIGN KEY(city_id) REFERENCES cities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Immutable accounting/audit records, enforced below the application layer.
CREATE TRIGGER rewards_no_update BEFORE UPDATE ON reward_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_LEDGER';
CREATE TRIGGER rewards_no_delete BEFORE DELETE ON reward_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_LEDGER';
CREATE TRIGGER resolutions_no_update BEFORE UPDATE ON request_resolutions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_LEDGER';
CREATE TRIGGER resolutions_no_delete BEFORE DELETE ON request_resolutions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_LEDGER';
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_LEDGER';
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_LEDGER';

CREATE TRIGGER search_useful_insert BEFORE INSERT ON search_events FOR EACH ROW SET NEW.useful_request=IF(NEW.kind='USEFUL',NEW.request_id,NULL);
CREATE TRIGGER search_useful_update BEFORE UPDATE ON search_events FOR EACH ROW SET NEW.useful_request=IF(NEW.kind='USEFUL',NEW.request_id,NULL);
