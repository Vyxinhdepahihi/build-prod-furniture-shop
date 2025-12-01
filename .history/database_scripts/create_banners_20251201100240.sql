-- Script tạo bảng banners

USE shopnoithat;

-- Tạo bảng banners
CREATE TABLE IF NOT EXISTS banners (
  id INT(11) NOT NULL AUTO_INCREMENT,
  tieude VARCHAR(255) DEFAULT NULL,
  mota TEXT,
  url VARCHAR(500) DEFAULT NULL,
  linksp VARCHAR(500) DEFAULT NULL,
  thutu INT(11) DEFAULT 1,
  anhien TINYINT(4) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_thutu (thutu),
  INDEX idx_anhien (anhien)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kiểm tra đã tạo thành công
SELECT 'Checking if table was created...' as Status;
SHOW TABLES LIKE 'banners';

-- Xem cấu trúc bảng
SELECT 'Table structure:' as Info;
DESCRIBE banners;

SELECT '✅ Table banners created successfully!' as Result;





