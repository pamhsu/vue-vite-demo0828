-- Run this once in the selected ByetHost database after importing the main
-- backup. It adds server-side member sessions for protected profile and order
-- access. Do not add CREATE DATABASE or USE statements on shared hosting.

CREATE TABLE IF NOT EXISTS `member_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_sessions_token_hash` (`token_hash`),
  KEY `idx_member_sessions_member_id` (`member_id`),
  KEY `idx_member_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_member_sessions_member`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Imported login sessions are not valid deployment credentials. Invalidate
-- them so every administrator must sign in again on the production site.
DELETE FROM `admin_sessions`;
