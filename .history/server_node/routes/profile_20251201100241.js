// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require("express");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { UserModel, DonHangModel, YeuThichModel, DiaChiModel } = require("../database");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const multer = require("multer");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// CHANGED: Sử dụng auth middleware từ middleware/auth.js thay vì tự định nghĩa
const { auth } = require("../middleware/auth");

const router = express.Router();

// Cấu hình multer cho upload avatar
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/avatar/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif)"));
    }
  },
});

// GET /api/profile - Lấy thông tin profile
router.get("/", auth, async (req, res) => {
  try {
    // CHANGED: Sử dụng req.user.id thay vì req.userId (từ auth middleware mới)
    const user = await UserModel.findByPk(req.user.id, {
      attributes: [
        "id",
        "email",
        "ho_ten",
        "sdt",
        "ngaysinh",
        "gioitinh",
        "role",
        "avatar",
        "created_at",
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    // Đếm số đơn hàng
    const orderCount = await DonHangModel.count({
      where: { user_id: req.user.id },
    });

    // Đếm số sản phẩm yêu thích
    const wishlistCount = await YeuThichModel.count({
      where: { user_id: req.user.id },
    });

    // Đếm số địa chỉ
    const addressCount = await DiaChiModel.count({
      where: { user_id: req.user.id },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        ho_ten: user.ho_ten,
        sdt: user.sdt,
        ngaysinh: user.ngaysinh,
        gioitinh: user.gioitinh,
        role: user.role,
        avatar: user.avatar,
        created_at: user.created_at,
      },
      stats: {
        orderCount,
        wishlistCount,
        addressCount,
      },
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/profile - Cập nhật thông tin profile
router.put("/", auth, async (req, res) => {
  try {
    const { ho_ten, sdt, ngaysinh, gioitinh } = req.body;

    // CHANGED: Sử dụng req.user.id thay vì req.userId
    const user = await UserModel.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    // Cập nhật thông tin
    await user.update({
      ho_ten: ho_ten !== undefined ? ho_ten : user.ho_ten,
      sdt: sdt !== undefined ? sdt : user.sdt,
      ngaysinh: ngaysinh !== undefined ? ngaysinh : user.ngaysinh,
      gioitinh: gioitinh !== undefined ? gioitinh : user.gioitinh,
      updated_at: new Date(),
    });

    res.json({
      message: "Cập nhật thông tin thành công",
      user: {
        id: user.id,
        email: user.email,
        ho_ten: user.ho_ten,
        sdt: user.sdt,
        ngaysinh: user.ngaysinh,
        gioitinh: user.gioitinh,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/profile/avatar - Upload avatar
router.post("/avatar", auth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    // CHANGED: Sử dụng req.user.id thay vì req.userId
    const user = await UserModel.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    // Cập nhật avatar path
    const avatarPath = `/uploads/avatar/${req.file.filename}`;
    await user.update({
      avatar: avatarPath,
      updated_at: new Date(),
    });

    res.json({
      message: "Upload avatar thành công",
      avatar: avatarPath,
    });
  } catch (err) {
    console.error("Error uploading avatar:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

