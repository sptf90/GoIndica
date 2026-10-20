-- Conta empresarial: existe só para patrocinar rankings. Não tem perfil, então não pede, não
-- indica, não pontua e não aparece em busca, feed ou ranking (todas essas tabelas exigem profiles).
ALTER TABLE accounts ADD COLUMN kind ENUM('member','company') NOT NULL DEFAULT 'member';
CREATE TABLE companies (
 account_id CHAR(36) PRIMARY KEY, cnpj CHAR(14) NOT NULL UNIQUE,
 legal_name VARCHAR(160) NOT NULL, trade_name VARCHAR(160), display_name VARCHAR(80) NOT NULL,
 registration_status VARCHAR(40), city_id INT, branch ENUM('MATRIZ','FILIAL'),
 data_source ENUM('RECEITA','MANUAL') NOT NULL, data_checked_at DATETIME(3),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(account_id) REFERENCES accounts(id), FOREIGN KEY(city_id) REFERENCES cities(id),
 CHECK(cnpj REGEXP '^[0-9A-Z]{12}[0-9]{2}$'),
 CHECK(CHAR_LENGTH(TRIM(display_name)) BETWEEN 2 AND 80),
 CHECK(CHAR_LENGTH(TRIM(legal_name)) BETWEEN 2 AND 160),
 CHECK((data_source='RECEITA') = (data_checked_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Cache da consulta pública por CNPJ. Guarda só o necessário: nunca o quadro de sócios.
CREATE TABLE cnpj_lookups (
 cnpj CHAR(14) PRIMARY KEY, found BOOLEAN NOT NULL,
 legal_name VARCHAR(160), trade_name VARCHAR(160), registration_status VARCHAR(40),
 city_id INT, branch ENUM('MATRIZ','FILIAL'), fetched_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX cnpj_lookups_age(fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DELIMITER $$
CREATE TRIGGER profiles_members_only BEFORE INSERT ON profiles FOR EACH ROW
BEGIN
 IF EXISTS(SELECT 1 FROM accounts WHERE id=NEW.id AND kind='company') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NOT_ALLOWED'; END IF;
END$$
CREATE TRIGGER companies_company_accounts BEFORE INSERT ON companies FOR EACH ROW
BEGIN
 IF NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.account_id AND kind='company') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NOT_ALLOWED'; END IF;
END$$
CREATE TRIGGER accounts_kind_fixed BEFORE UPDATE ON accounts FOR EACH ROW
BEGIN
 IF NEW.kind<>OLD.kind THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NOT_ALLOWED'; END IF;
END$$
DELIMITER ;
