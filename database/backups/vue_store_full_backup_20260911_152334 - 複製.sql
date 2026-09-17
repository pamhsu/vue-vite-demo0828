-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: vue_store
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `vue_store`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `vue_store` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `vue_store`;

--
-- Table structure for table `admin_notification_reads`
--

DROP TABLE IF EXISTS `admin_notification_reads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_notification_reads` (
  `notification_id` bigint unsigned NOT NULL,
  `admin_id` bigint unsigned NOT NULL,
  `read_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`,`admin_id`),
  KEY `fk_notification_reads_admin` (`admin_id`),
  CONSTRAINT `fk_notification_reads_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notification_reads_notification` FOREIGN KEY (`notification_id`) REFERENCES `admin_notifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_notification_reads`
--

LOCK TABLES `admin_notification_reads` WRITE;
/*!40000 ALTER TABLE `admin_notification_reads` DISABLE KEYS */;
INSERT INTO `admin_notification_reads` VALUES (1,1,'2026-09-09 07:07:41'),(96,1,'2026-09-09 07:23:45'),(111,1,'2026-09-09 07:48:34'),(251,1,'2026-09-10 01:09:55');
/*!40000 ALTER TABLE `admin_notification_reads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_notifications`
--

DROP TABLE IF EXISTS `admin_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_notifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `type` enum('new_order','pending_overdue','customer_cancelled') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_notification_order_type` (`order_id`,`type`),
  KEY `idx_admin_notifications_created_at` (`created_at`),
  CONSTRAINT `fk_admin_notifications_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=252 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_notifications`
--

LOCK TABLES `admin_notifications` WRITE;
/*!40000 ALTER TABLE `admin_notifications` DISABLE KEYS */;
INSERT INTO `admin_notifications` VALUES (1,5,'pending_overdue','訂單 #202609071434002 尚未處理','已等待超過 10 分鐘，請盡快接收訂單。','2026-09-09 06:00:27'),(96,9,'new_order','新訂單 #202609091523001','NT$1,200，等待處理。','2026-09-09 07:23:07'),(111,9,'pending_overdue','訂單 #202609091523001 尚未處理','已等待超過 10 分鐘，請盡快接收訂單。','2026-09-09 07:34:02'),(251,10,'new_order','新訂單 #202609100909001','NT$900，等待處理。','2026-09-10 01:09:13');
/*!40000 ALTER TABLE `admin_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_sessions`
--

DROP TABLE IF EXISTS `admin_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` bigint unsigned NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `fk_admin_sessions_admin` (`admin_id`),
  KEY `idx_admin_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_admin_sessions_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_sessions`
--

LOCK TABLES `admin_sessions` WRITE;
/*!40000 ALTER TABLE `admin_sessions` DISABLE KEYS */;
INSERT INTO `admin_sessions` VALUES (1,1,'af401b5e02813c5eb73ea524fb6fc58c6d74f5e30142333ea5c496364d5f5118','2026-09-17 13:19:02','2026-09-09 05:19:02'),(2,2,'a01a0543c3ffbf1d373702465ca4a7aa007c240a0e45e3f2d1c61a64c8291bb0','2026-09-17 13:20:31','2026-09-09 05:20:31'),(3,1,'37cc1b4db2a2cb6084b8c0fc83d290890d0c48f87876a7b819751c301a9a176b','2026-09-17 13:26:29','2026-09-09 05:26:29'),(4,1,'3a767b3c7828c3c6d11f44a405fed9b80da11f387563a0de9664bd1d67d814f6','2026-09-17 14:00:27','2026-09-09 06:00:27'),(5,1,'ef084f23d1d5fd0d0732b107927558393b0e65706cda459367b5a3e5832ea47b','2026-09-17 14:54:32','2026-09-09 06:54:32'),(6,1,'f7f27eb6a27b5b4c4a2e1f41be2e68688a2dff4f29c93a39a2bde99f6919c79a','2026-09-17 15:07:25','2026-09-09 07:07:25'),(7,1,'84730220f20345e85ae5e0a979fbfcad453059f6972a3b6a936cb6b30b9706d0','2026-09-17 15:20:16','2026-09-09 07:20:16'),(8,1,'d4af143fc0f5d87102eafa294a02746cbd71a7871cfea1ccf51598c6fd6781b2','2026-09-17 15:23:23','2026-09-09 07:23:23'),(9,1,'b6d3bcc002403098a6fdea62bccf7899e407bf6afc26611c3ad460480cb3c39e','2026-09-17 15:48:30','2026-09-09 07:48:30'),(10,1,'32251f2b989e034881c23d3f88aa93c4b397193b6b0a32b20ab400cfb715999a','2026-09-17 16:36:03','2026-09-09 08:36:03'),(12,1,'2bcf768ca6a303b47c7c710dc4cd89bfbc12912ac5be62fdebd96a99deae95b2','2026-09-18 09:05:10','2026-09-10 01:05:10'),(13,1,'16c330d540fe17c58a7358a743a51cb636227f9d998e3293959a31ac51eafca3','2026-09-18 09:46:15','2026-09-10 01:46:15');
/*!40000 ALTER TABLE `admin_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('superadmin','admin','sales') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'admin','最高管理員','admin@fattaamano.local','$2b$12$lkLfXPAIvsBEJ12cLElJb.tr9HR0y8JzlLPjyhH0rAlpCUMYiGWaO','superadmin','active','2026-09-10 09:46:15','2026-09-09 04:53:53','2026-09-10 01:46:15'),(2,'sale','saleABC','sale@yahoo.com.tw','$2b$12$/HKGBg4xegxa2TjfS7WNGOZdzosPG7FAU2zG.GLvigz4J8yGvIgoa','sales','active','2026-09-09 13:20:31','2026-09-09 05:19:59','2026-09-09 05:20:31');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `members`
--

DROP TABLE IF EXISTS `members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `members`
--

LOCK TABLES `members` WRITE;
/*!40000 ALTER TABLE `members` DISABLE KEYS */;
INSERT INTO `members` VALUES (1,'ppp','aaa@yahoo.com.tw','$2b$12$pL24lPyf4G2PlhkO6zLgAu151b2D2y67jOXpDu3fYy0zG7Oa1kYiq','0933123456',NULL,'active','2026-09-01 05:14:26','2026-09-01 05:14:26'),(2,'aaa','abc@yahoo.com.tw','$2b$12$jIvTbe41wkYScQnKD5.TBOfCLwoAQnrEdf2P/Hs/Nbe/ILu5Uoy8m','0911123456',NULL,'active','2026-09-01 05:31:34','2026-09-01 05:31:47'),(3,'test','test@yahoo.com.tw','$2b$12$hlkeE.1ZsyZt5DJHov6MKeNzTzLgye28eM9RygNBGjyvi2Ikm.6x6',NULL,NULL,'active','2026-09-03 04:59:19','2026-09-03 04:59:19'),(4,'test003','test003@example.com','$2b$12$Rj82D.A6KQpn.VSDyZZwleS9w1DRlKgF92gDgnJQIh9UvzqxwBF5m',NULL,NULL,'active','2026-09-03 05:58:59','2026-09-03 05:58:59'),(5,'陳','123@gmail.com','$2b$12$epbaddNTX/cZQ6q7EgAWHO8t6tSKvSf/Fw39T268H4w/KwoHvHPaa','0912345678','台中市','active','2026-09-07 06:27:59','2026-09-07 06:33:16'),(6,'許','abcd@yahoo.com.tw','$2b$12$BF5MWI.jopRf/G6h8I1if.s/WLsVsOEOS4akWJRlaHFhaXeP5BBYq',NULL,NULL,'active','2026-09-07 06:33:44','2026-09-07 06:33:44');
/*!40000 ALTER TABLE `members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `news` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `published_at` date NOT NULL,
  `status` enum('published','draft') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news`
--

LOCK TABLES `news` WRITE;
/*!40000 ALTER TABLE `news` DISABLE KEYS */;
INSERT INTO `news` VALUES (1,'新品上市：雙心XO海鮮披薩','新品上市：雙心XO海鮮披薩','/uploads/news/1788247247495-928801364.jpg','2026-09-01','published','2026-09-01 07:20:47','2026-09-01 07:20:47'),(2,'逢甲店開幕慶','逢甲店開幕慶','/uploads/news/1788247401936-129331461.jpg','2026-09-15','published','2026-09-01 07:23:21','2026-09-01 07:23:21'),(3,'超值199元活動','超值199元活動','/uploads/news/1788247440742-648125221.jpg','2026-09-30','published','2026-09-01 07:24:00','2026-09-01 07:24:00');
/*!40000 ALTER TABLE `news` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `member_id` bigint unsigned DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_type` enum('delivery','pickup') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'delivery',
  `pickup_time` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total` decimal(10,2) NOT NULL,
  `items` json NOT NULL,
  `status` enum('pending','processing','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `sub_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remark` text COLLATE utf8mb4_unicode_ci,
  `cancelled_by` enum('customer','admin') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_history` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,'202609071428001',5,'陳','09123456','台中市','delivery',NULL,580.00,'[{\"id\": 1, \"qty\": 2, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": []}]','completed','delivered',NULL,NULL,'[{\"time\": \"2026-09-07T06:28:23.511Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-07T06:28:44.108Z\", \"stage\": \"received\"}, {\"time\": \"2026-09-07T06:29:52.748Z\", \"stage\": \"preparing\"}, {\"time\": \"2026-09-07T06:29:52.748Z\", \"stage\": \"ready\"}, {\"time\": \"2026-09-07T06:29:52.748Z\", \"stage\": \"delivering\"}, {\"time\": \"2026-09-07T06:29:52.748Z\", \"stage\": \"delivered\"}]','2026-09-07 06:28:23'),(2,'202609071430001',5,'陳','0912345678','123','delivery',NULL,870.00,'[{\"id\": 1, \"qty\": 3, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": [{\"label\": \"不辣\", \"price\": 0}]}]','completed','delivered',NULL,NULL,'[{\"time\": \"2026-09-07T06:30:23.991Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-07T06:30:49.004Z\", \"stage\": \"received\"}, {\"time\": \"2026-09-07T06:30:49.004Z\", \"stage\": \"preparing\"}, {\"time\": \"2026-09-07T06:30:49.004Z\", \"stage\": \"ready\"}, {\"time\": \"2026-09-07T06:30:51.524Z\", \"stage\": \"delivering\"}, {\"time\": \"2026-09-07T06:30:52.964Z\", \"stage\": \"delivered\"}]','2026-09-07 06:30:24'),(3,'202609071431001',5,'陳','095212313','1213123','delivery',NULL,1160.00,'[{\"id\": 1, \"qty\": 1, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": []}, {\"id\": 1, \"qty\": 3, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": [{\"label\": \"不辣\", \"price\": 0}]}]','cancelled','cancelled','錯誤訂單',NULL,'[{\"time\": \"2026-09-07T06:31:12.237Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-07T06:31:20.437Z\", \"stage\": \"received\"}, {\"time\": \"2026-09-07T06:31:31.388Z\", \"stage\": \"cancelled\"}]','2026-09-07 06:31:12'),(4,'202609071434001',6,'許','0933123456','台中市100號','delivery',NULL,580.00,'[{\"id\": 1, \"qty\": 2, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": []}]','cancelled','cancelled','測試中','admin','[{\"time\": \"2026-09-07T06:34:27.550Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-07T06:34:52.224Z\", \"stage\": \"received\"}, {\"time\": \"2026-09-09T07:13:04.610Z\", \"stage\": \"cancelled\"}]','2026-09-07 06:34:27'),(5,'202609071434002',5,'陳','0912345678','台中市','delivery',NULL,880.00,'[{\"id\": 1, \"qty\": 1, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": [{\"label\": \"不辣\", \"price\": 0}]}, {\"id\": 1, \"qty\": 1, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": [{\"label\": \"加番茄醬\", \"price\": 10}]}, {\"id\": 1, \"qty\": 1, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": []}]','processing','received',NULL,NULL,'[{\"time\": \"2026-09-07T06:34:40.631Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-10T01:07:52.900Z\", \"stage\": \"received\"}]','2026-09-07 06:34:40'),(6,'202609071436001',3,'test','0911123456','台中市101號','delivery',NULL,580.00,'[{\"id\": 1, \"qty\": 2, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": []}]','completed','delivered',NULL,NULL,'[{\"time\": \"2026-09-07T06:36:53.168Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-07T06:37:04.048Z\", \"stage\": \"received\"}, {\"time\": \"2026-09-07T06:37:10.568Z\", \"stage\": \"preparing\"}, {\"time\": \"2026-09-07T06:37:10.568Z\", \"stage\": \"ready\"}, {\"time\": \"2026-09-07T06:37:10.568Z\", \"stage\": \"delivering\"}, {\"time\": \"2026-09-07T06:37:10.568Z\", \"stage\": \"delivered\"}]','2026-09-07 06:36:53'),(7,'202609081045001',6,'許','0911123456','台中市101號','delivery',NULL,2320.00,'[{\"id\": 8, \"qty\": 3, \"name\": \"松露野菇\", \"price\": \"450.00\", \"options\": []}, {\"id\": 1, \"qty\": 2, \"name\": \"經典瑪格麗特\", \"price\": \"290.00\", \"options\": [{\"label\": \"不辣\", \"price\": 0}, {\"label\": \"加番茄醬\", \"price\": 10}]}, {\"id\": 2, \"qty\": 1, \"name\": \"辣味義式香腸\", \"price\": \"320.00\", \"options\": [{\"label\": \"\", \"price\": 50}]}]','completed','delivered',NULL,NULL,'[{\"time\": \"2026-09-08T02:45:21.897Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-08T02:45:58.900Z\", \"stage\": \"received\"}, {\"time\": \"2026-09-08T02:46:03.091Z\", \"stage\": \"preparing\"}, {\"time\": \"2026-09-08T02:46:03.091Z\", \"stage\": \"ready\"}, {\"time\": \"2026-09-08T02:46:03.091Z\", \"stage\": \"delivering\"}, {\"time\": \"2026-09-08T02:46:03.091Z\", \"stage\": \"delivered\"}]','2026-09-08 02:45:21'),(8,'202609091051001',6,'許','0911123456','台中市100','delivery',NULL,2700.00,'[{\"id\": 5, \"qty\": 5, \"name\": \"四種起司\", \"price\": \"300.00\", \"options\": []}, {\"id\": 7, \"qty\": 1, \"name\": \"夏威夷風味\", \"price\": \"300.00\", \"options\": []}, {\"id\": 8, \"qty\": 2, \"name\": \"松露野菇\", \"price\": \"450.00\", \"options\": []}]','completed','delivered',NULL,NULL,'[{\"time\": \"2026-09-09T02:51:09.300Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-09T02:51:17.650Z\", \"stage\": \"received\"}, {\"time\": \"2026-09-09T02:51:21.363Z\", \"stage\": \"preparing\"}, {\"time\": \"2026-09-09T02:51:21.363Z\", \"stage\": \"ready\"}, {\"time\": \"2026-09-09T02:51:21.363Z\", \"stage\": \"delivering\"}, {\"time\": \"2026-09-09T02:51:21.363Z\", \"stage\": \"delivered\"}]','2026-09-09 02:51:09'),(9,'202609091523001',6,'許','0933123456','台中市101號','delivery',NULL,1200.00,'[{\"id\": 7, \"qty\": 1, \"name\": \"夏威夷風味\", \"price\": \"300.00\", \"options\": []}, {\"id\": 6, \"qty\": 3, \"name\": \"素食繽紛\", \"price\": \"300.00\", \"options\": []}]','processing','received',NULL,NULL,'[{\"time\": \"2026-09-09T07:23:07.796Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-10T01:07:34.716Z\", \"stage\": \"received\"}]','2026-09-09 07:23:07'),(10,'202609100909001',6,'許','0911123456','台中市100號','delivery',NULL,900.00,'[{\"id\": 8, \"qty\": 2, \"name\": \"松露野菇\", \"price\": \"450.00\", \"options\": []}]','completed','delivered',NULL,NULL,'[{\"time\": \"2026-09-10T01:09:13.437Z\", \"stage\": \"submitted\"}, {\"time\": \"2026-09-10T01:14:38.557Z\", \"stage\": \"received\"}, {\"time\": \"2026-09-10T01:14:38.557Z\", \"stage\": \"preparing\"}, {\"time\": \"2026-09-10T01:14:38.557Z\", \"stage\": \"ready\"}, {\"time\": \"2026-09-10T01:14:38.557Z\", \"stage\": \"delivering\"}, {\"time\": \"2026-09-10T01:14:38.557Z\", \"stage\": \"delivered\"}]','2026-09-10 01:09:13');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `options` json DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'經典瑪格麗特','經典口味','新鮮番茄醬、莫札瑞拉起司與羅勒葉，經典義式風味123。',290.00,'/uploads/products/1788766648187-361515563.jpg','[{\"label\": \"不辣\", \"price\": 0}, {\"label\": \"加番茄醬\", \"price\": 10}]','active',1,'2026-09-01 05:55:51','2026-09-07 07:37:28'),(2,'辣味義式香腸','經典口味','義式臘腸丁(台灣豬)Italian sausage、墨西哥辣椒jalapanos、洋蔥onion、洋菇mushroom、黑橄欖black olives,義式辣味香腸與切達起司的搭配，微辣口感令人回味。',320.00,'/uploads/products/1788764044853-638010073.png','[{\"label\": \"\", \"price\": 50}]','active',2,'2026-09-07 06:54:05','2026-09-07 07:27:40'),(3,'海鮮總匯','豪華系列','鮮蝦、魷魚、蛤蜊與花枝，滿滿海鮮一次滿足。',420.00,'/uploads/products/1788765927450-653645688.png','[]','active',3,'2026-09-07 07:25:27','2026-09-07 07:27:08'),(4,'BBQ 烤雞披薩','豪華系列','煙燻 BBQ 醬搭配嫩烤雞肉、洋蔥與青椒。',380.00,'/uploads/products/1788766017127-763677556.jpg','[]','active',4,'2026-09-07 07:26:57','2026-09-07 07:26:57'),(5,'四種起司','起司系列','莫札瑞拉、切達、帕瑪森與藍紋起司，起司控必點。',300.00,'/uploads/products/1788766433614-773507552.jpg','[]','active',5,'2026-09-07 07:33:30','2026-09-07 07:33:53'),(6,'素食繽紛','素食','新鮮時蔬搭配番茄醬與香草，清爽健康的選擇。',300.00,'/uploads/products/1788766720087-653913050.jpg','[]','active',6,'2026-09-07 07:38:40','2026-09-07 07:38:40'),(7,'夏威夷風味','經典口味','鳳梨、火腿與起司的經典組合，酸甜交織。',300.00,'/uploads/products/1788766808701-124816643.jpg','[]','active',7,'2026-09-07 07:40:08','2026-09-07 07:40:08'),(8,'松露野菇','豪華系列','黑松露醬搭配多種蘑菇與起司，奢華風味。',450.00,'/uploads/products/1788766865521-186975669.jpg','[]','active',8,'2026-09-07 07:41:05','2026-09-07 07:41:05');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'vue_store'
--

--
-- Dumping routines for database 'vue_store'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-11 15:23:34
