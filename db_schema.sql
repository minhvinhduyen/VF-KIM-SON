-- --------------------------------------------------------
-- FILE CẤU TRÚC CƠ SỞ DỮ LIỆU MYSQL (DÀNH CHO INET CPANEL)
-- Bạn hãy import file này trong phpMyAdmin của từng cơ sở để tạo bảng.
-- --------------------------------------------------------

-- 1. Bảng lưu trữ Nhân viên / Người dùng (users)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `password` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lưu ý: Tạo tài khoản nhân viên thông qua giao diện Quản lý nhân viên trên web.
-- KHÔNG insert tài khoản mặc định vào đây để tránh trùng lặp giữa các cơ sở.

-- 2. Bảng lưu trữ Khoang sửa chữa (bays)
CREATE TABLE IF NOT EXISTS `bays` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `technician` VARCHAR(100) NULL,
  `supportsLift` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. Bảng lưu trữ Phương tiện / Xe (vehicles)
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` VARCHAR(50) NOT NULL,
  `licensePlate` VARCHAR(20) NOT NULL,
  `customerName` VARCHAR(100) NOT NULL,
  `customerPhone` VARCHAR(20) NULL,
  `carModel` VARCHAR(50) NOT NULL,
  `vin` VARCHAR(50) NULL,
  `color` VARCHAR(50) NULL,
  `purchaseDate` DATETIME NULL,
  `uio` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_license_plate` (`licensePlate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. Bảng lưu trữ Công việc / Lịch sửa chữa (jobs)
CREATE TABLE IF NOT EXISTS `jobs` (
  `id` VARCHAR(50) NOT NULL,
  `licensePlate` VARCHAR(20) NOT NULL,
  `customerName` VARCHAR(100) NOT NULL,
  `customerPhone` VARCHAR(20) NULL,
  `carModel` VARCHAR(50) NOT NULL,
  `vin` VARCHAR(50) NULL,
  `jobType` VARCHAR(50) NOT NULL,
  `advisorName` VARCHAR(100) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `plannedStartTime` DATETIME NOT NULL,
  `plannedEndTime` DATETIME NOT NULL,
  `actualStartTime` DATETIME NULL,
  `actualEndTime` DATETIME NULL,
  `actualExitTime` DATETIME NULL,
  `actualArrivalTime` DATETIME NULL,
  `bayId` VARCHAR(50) NULL,
  `technician` VARCHAR(100) NULL,
  `useLift` TINYINT(1) DEFAULT 0,
  `isAppointment` TINYINT(1) DEFAULT 0,
  `appointmentCreatedAt` DATETIME NULL,
  `appointmentTime` DATETIME NULL,
  `isWaitingCustomer` TINYINT(1) DEFAULT 0,
  `bodyShopStage` VARCHAR(50) NULL,
  `stageHistory` TEXT NULL, -- Lưu trữ mảng JSON string lịch sử đổi giai đoạn Đồng sơn
  `laborCost` DECIMAL(15, 2) NULL,
  `km` INT NULL,
  `continuationOfJobId` VARCHAR(50) NULL,
  `jsonData` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_bay_id` (`bayId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
