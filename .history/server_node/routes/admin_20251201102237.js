const express = require("express");
const { Op } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const { auth } = require("../middleware/auth");
const {
  UserModel,
  SanPhamModel,
  SanPhamBienTheModel,
  LoaiModel,
  ThuongHieuModel,
  DonHangModel,
  DonHangChiTietModel,
  MaGiamGiaModel,
  BaiVietModel,
  DanhMucBaiVietModel,
  LienHeModel,
  DanhGiaModel,
  sequelize,
} = require("../database");
const { sendOrderStatusUpdateEmail } = require("./utils/email");
const {
  getOnlineUsersCount,
  getOnlineUsersList,
  isUserOnline,
} = require('../services/socketService');

const router = express.Router();
const constants = require('../config/constants');

/* ========================================
   USER ONLINE TRACKING (In-memory store)
   ======================================== */

/**
 * Active Users Tracking System
 * 
 * Sử dụng in-memory Map để track user đang online:
 * - Key: userId
 * - Value: lastActivityTime (timestamp)
 * 
 * User được coi là online nếu có activity trong 5 phút gần nhất.
 * Tự động cleanup user không hoạt động mỗi phút.
 */
const activeUsers = new Map(); // Map<userId, lastActivityTime>

/**
 * Track User Activity Middleware
 * 
 * Ghi nhận thời gian hoạt động cuối cùng của user mỗi khi gọi API.
 * Chỉ track nếu user đã authenticated (có req.user).
 * 
 * CHANGED: Thêm logging chi tiết để debug và đảm bảo track đúng user
 */
const trackUserActivity = (req, res, next) => {
  if (req.user && req.user.id) {
    // CHANGED: Normalize userId về string để đảm bảo consistency (UUID là CHAR(36))
    const userId = String(req.user.id);
    const userEmail = req.user.email || 'unknown';
    const wasTracked = activeUsers.has(userId);
    const previousActivity = activeUsers.get(userId);
    
    // Update activity time
    activeUsers.set(userId, Date.now());
    
    // Log để debug
    if (!wasTracked) {
      console.log(`[User Tracking Middleware] NEW user tracked: ${userEmail} (${userId})`);
      console.log(`[User Tracking Middleware] Total active users now: ${activeUsers.size}`);
    } else {
      const secondsSinceLastActivity = previousActivity ? Math.floor((Date.now() - previousActivity) / 1000) : 0;
      console.log(`[User Tracking Middleware] Activity updated for: ${userEmail} (${userId}) - Last activity: ${secondsSinceLastActivity}s ago`);
    }
  } else {
    console.warn(`[User Tracking Middleware] No user info in request:`, {
      hasUser: !!req.user,
      userId: req.user?.id,
      userEmail: req.user?.email
    });
  }
  next();
};

/**
 * Remove User from Active Tracking
 * 
 * Export function để các route khác có thể gọi khi user logout
 */
const removeUserFromTracking = (userId) => {
  if (activeUsers.has(userId)) {
    activeUsers.delete(userId);
    console.log(`[User Tracking] User removed from tracking: ${userId}`);
  }
};

/**
 * Auto Cleanup Inactive Users
 * 
 * Chạy mỗi phút để xóa các user không hoạt động quá 5 phút.
 * Giúp giải phóng memory và đảm bảo dữ liệu chính xác.
 */
setInterval(() => {
  const now = Date.now();
  const inactiveThreshold = constants.USER_TRACKING.INACTIVE_THRESHOLD;
  
  for (const [userId, lastActivity] of activeUsers.entries()) {
    // CHANGED: Normalize userId về string khi cleanup
    const userIdStr = String(userId);
    if (now - lastActivity > inactiveThreshold) {
      activeUsers.delete(userIdStr);
    }
  }
}, constants.USER_TRACKING.CLEANUP_INTERVAL);

/*  AUTH CHECK  */
const isAdmin = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Chưa đăng nhập" });
  const user = await UserModel.findByPk(req.user.id);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Không có quyền truy cập" });
  }
  next();
};

/*  DASHBOARD  */
/**
 * GET /api/admin/dashboard
 * Thống kê tổng quan dashboard
 * 
 * Query params:
 * - from_date (optional): Ngày bắt đầu (YYYY-MM-DD) - filter cho đơn hàng
 * - to_date (optional): Ngày kết thúc (YYYY-MM-DD) - filter cho đơn hàng
 * 
 * Nếu có from_date và to_date: chỉ đếm đơn hàng trong khoảng thời gian đó
 * Nếu không có: đếm tất cả đơn hàng
 */
router.get("/dashboard", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    // Đếm tổng số (không filter theo thời gian)
    const sp = await SanPhamModel.count();
    const nd = await UserModel.count();
    const bv = await BaiVietModel.count();

    // Đếm đơn hàng - có filter theo thời gian nếu có from_date và to_date
    let whereDonHang = {};
    if (from_date && to_date) {
      const startDate = new Date(from_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(to_date);
      endDate.setHours(23, 59, 59, 999);

      whereDonHang = {
        created_at: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
      };
    }

    const dh = await DonHangModel.count({ where: whereDonHang });

    res.json({
      sanpham: sp,
      donhang: dh,
      nguoidung: nd,
      baiviet: bv,
      ...(from_date && to_date && {
        period: {
          from_date,
          to_date,
        },
      }),
    });
  } catch (err) {
    console.error("Lỗi GET /api/admin/dashboard:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/*  USER  */
router.get("/users", auth, isAdmin, async (_, res) => {
  const list = await UserModel.findAll();
  res.json(list);
});

router.delete("/users/:id", auth, isAdmin, async (req, res) => {
  await UserModel.destroy({ where: { id: req.params.id } });
  res.json({ message: "Đã xóa người dùng" });
});

/*  SẢN PHẨM  */
router.post("/admin/sanpham", auth, isAdmin, async (req, res) => {
  const sp = await SanPhamModel.create({ id: uuidv4(), ...req.body });
  res.json({ message: "Thêm sản phẩm thành công", sp });
});

router.put("/admin/sanpham/:id", auth, isAdmin, async (req, res) => {
  await SanPhamModel.update(req.body, { where: { id: req.params.id } });
  res.json({ message: "Cập nhật sản phẩm thành công" });
});

router.delete("/admin/sanpham/:id", auth, isAdmin, async (req, res) => {
  await SanPhamModel.destroy({ where: { id: req.params.id } });
  res.json({ message: "Đã xóa sản phẩm" });
});


/* Biến thể  */
router.post("/admin/bienthe", auth, async (req, res) => {
  try {
    const { sanpham_id, mausac, sl_tonkho, gia } = req.body;
    const bienthe = await SanPhamBienTheModel.create({
      id: uuidv4(),
      sanpham_id,
      mausac,
      sl_tonkho,
      gia,
    });
    res.json({ message: "Thêm biến thể thành công", bienthe });
  } catch (err) {
    console.error("Lỗi POST /api/bienthe:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

router.put("/bienthe/:id", auth, async (req, res) => {
  try {
    const { mausac, sl_tonkho, gia } = req.body;
    await SanPhamBienTheModel.update(
      { mausac, sl_tonkho, gia },
      { where: { id: req.params.id } }
    );
    res.json({ message: "Cập nhật biến thể thành công" });
  } catch (err) {
    console.error("Lỗi PUT /api/bienthe/:id:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});


router.delete("/bienthe/:id", auth, async (req, res) => {
  try {
    await SanPhamBienTheModel.destroy({ where: { id: req.params.id } });
    res.json({ message: "Đã xóa biến thể" });
  } catch (err) {
    console.error("Lỗi DELETE /api/bienthe/:id:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/*  DANH MỤC  */
router.post("/danhmuc", auth, isAdmin, async (req, res) => {
  const dm = await LoaiModel.create({ id: uuidv4(), ...req.body });
  res.json({ message: "Thêm danh mục thành công", dm });
});

router.put("/danhmuc/:id", auth, isAdmin, async (req, res) => {
  await LoaiModel.update(req.body, { where: { id: req.params.id } });
  res.json({ message: "Cập nhật danh mục thành công" });
});

router.delete("/danhmuc/:id", auth, isAdmin, async (req, res) => {
  await LoaiModel.destroy({ where: { id: req.params.id } });
  res.json({ message: "Đã xóa danh mục" });
});

/*  THƯƠNG HIỆU  */
router.post("/thuonghieu", auth, isAdmin, async (req, res) => {
  const th = await ThuongHieuModel.create({ id: uuidv4(), ...req.body });
  res.json({ message: "Thêm thương hiệu thành công", th });
});

router.put("/thuonghieu/:id", auth, isAdmin, async (req, res) => {
  await ThuongHieuModel.update(req.body, { where: { id: req.params.id } });
  res.json({ message: "Cập nhật thương hiệu thành công" });
});

router.delete("/thuonghieu/:id", auth, isAdmin, async (req, res) => {
  await ThuongHieuModel.destroy({ where: { id: req.params.id } });
  res.json({ message: "Đã xóa thương hiệu" });
});

/*  ĐƠN HÀNG  */
/**
 * GET /api/admin/donhang
 * Lấy danh sách đơn hàng với filter từ-đến ngày
 * 
 * Query params:
 * - from_date (optional): Ngày bắt đầu (YYYY-MM-DD)
 * - to_date (optional): Ngày kết thúc (YYYY-MM-DD)
 * - trangthai (optional): Lọc theo trạng thái đơn hàng
 * - trangthaithanhtoan (optional): Lọc theo trạng thái thanh toán
 */
router.get("/donhang", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    const { from_date, to_date, trangthai, trangthaithanhtoan } = req.query;

    let where = {};

    // Filter theo khoảng thời gian
    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) {
        const startDate = new Date(from_date);
        startDate.setHours(0, 0, 0, 0);
        where.created_at[Op.gte] = startDate;
      }
      if (to_date) {
        const endDate = new Date(to_date);
        endDate.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = endDate;
      }
    }

    // Filter theo trạng thái
    if (trangthai) {
      where.trangthai = trangthai;
    }

    // Filter theo trạng thái thanh toán
    if (trangthaithanhtoan) {
      where.trangthaithanhtoan = trangthaithanhtoan;
    }

    const list = await DonHangModel.findAll({
      where,
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: ["id", "ho_ten", "email"],
        },
        {
          model: DonHangChiTietModel,
          as: "chitiet",
          include: [
            {
              model: SanPhamBienTheModel,
              as: "bienthe",
              include: [{ model: SanPhamModel, as: "sanpham", attributes: ["id", "code", "tensp"] }],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json(list);
  } catch (err) {
    console.error("Lỗi GET /api/admin/donhang:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/**
 * PUT /api/admin/donhang/:id
 * Cập nhật trạng thái đơn hàng (chỉ cho phép cập nhật trạng thái)
 * Gửi email thông báo khi trạng thái đơn hàng thay đổi
 */
router.put("/donhang/:id", auth, isAdmin, async (req, res) => {
  try {
    // Lấy đơn hàng cũ để so sánh trạng thái
    const donhangCu = await DonHangModel.findByPk(req.params.id, {
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: ["id", "email", "ho_ten"],
        },
      ],
    });

    if (!donhangCu) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Chỉ cho phép cập nhật trạng thái và trạng thái thanh toán
    const allowedFields = ['trangthai', 'trangthaithanhtoan'];
    const updateData = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Nếu đơn hàng bị hủy, cho phép cập nhật lý do hủy
    if (req.body.trangthai === 'cancelled' && req.body.ly_do_huy) {
      updateData.ly_do_huy = req.body.ly_do_huy;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Chỉ có thể cập nhật trạng thái (trangthai) hoặc trạng thái thanh toán (trangthaithanhtoan)" });
    }

    const trangthaiCu = donhangCu.trangthai;
    const trangthaiMoi = updateData.trangthai;
    const trangthaiThanhToanCu = donhangCu.trangthaithanhtoan;
    const trangthaiThanhToanMoi = updateData.trangthaithanhtoan;
    const trangthaiThayDoi = trangthaiMoi && trangthaiMoi !== trangthaiCu;
    const trangthaiThanhToanThayDoi = trangthaiThanhToanMoi && trangthaiThanhToanMoi !== trangthaiThanhToanCu;

    // Logic tự động cập nhật trạng thái thanh toán khi trạng thái đơn hàng thay đổi
    // Khi đơn hàng chuyển sang "returned" (trả hàng) và đã thanh toán, tự động chuyển thành "refunded" (hoàn tiền)
    if (trangthaiMoi === 'returned' && donhangCu.trangthaithanhtoan === 'paid') {
      updateData.trangthaithanhtoan = 'refunded';
      console.log(`📦 Đơn hàng trả hàng: Tự động chuyển trạng thái thanh toán từ "paid" → "refunded"`);
    }
    // Khi đơn hàng bị "cancelled" (hủy) và đã thanh toán, tự động chuyển thành "refunded" (hoàn tiền)
    else if (trangthaiMoi === 'cancelled' && donhangCu.trangthaithanhtoan === 'paid') {
      updateData.trangthaithanhtoan = 'refunded';
      console.log(`❌ Đơn hàng bị hủy: Tự động chuyển trạng thái thanh toán từ "paid" → "refunded"`);
    }

    // Nếu đơn hàng bị hủy mà không có lý do hủy, thêm lý do mặc định
    if (trangthaiMoi === 'cancelled' && !updateData.ly_do_huy && !req.body.ly_do_huy) {
      updateData.ly_do_huy = "Admin hủy đơn hàng";
    }

    // Cập nhật đơn hàng
    await DonHangModel.update(updateData, { where: { id: req.params.id } });

    // CHANGED: Xóa giỏ hàng khi trạng thái thanh toán chuyển sang "paid"
    // Điều này áp dụng cho: Banking (admin xác nhận đã nhận tiền), COD (admin xác nhận đã giao và thu tiền)
    if (trangthaiThanhToanThayDoi && trangthaiThanhToanMoi === 'paid' && trangthaiThanhToanCu !== 'paid') {
      try {
        const { deleteCartForOrder } = require("../routes/utils/cart");
        await deleteCartForOrder(donhangCu.user_id, req.params.id);
        console.log(`Cart deleted for order ${req.params.id} after admin confirmed payment status as "paid"`);
      } catch (cartError) {
        console.error('Error deleting cart after admin payment confirmation:', cartError);
        // Không throw error vì đơn hàng đã được cập nhật thành công
      }
    }

    // Gửi email thông báo khi trạng thái đơn hàng thay đổi
    if (trangthaiThayDoi && donhangCu.user && donhangCu.user.email) {
      try {
        // Lấy đơn hàng đã cập nhật với chi tiết
        const donhangMoi = await DonHangModel.findByPk(req.params.id);
        const chitiet = await DonHangChiTietModel.findAll({
          where: { donhang_id: req.params.id },
          include: [
            {
              model: SanPhamBienTheModel,
              as: "bienthe",
              include: [{ model: SanPhamModel, as: "sanpham" }],
            },
          ],
        });

        // Gửi email thông báo cập nhật trạng thái đơn hàng
        await sendOrderStatusUpdateEmail(donhangCu.user.email, {
          code: donhangMoi.code,
          trangthai: trangthaiMoi,
          trangthai_cu: trangthaiCu,
          tongtien_sau_giam: donhangMoi.tongtien_sau_giam,
          chitiet: chitiet,
        });

        console.log(`✅ Email cập nhật trạng thái đơn hàng đã được gửi đến ${donhangCu.user.email}`);
        console.log(`   - Đơn hàng: ${donhangMoi.code}`);
        console.log(`   - Trạng thái: ${trangthaiCu} → ${trangthaiMoi}`);
      } catch (emailError) {
        // Không throw error nếu gửi email thất bại, chỉ log để không ảnh hưởng đến việc cập nhật đơn hàng
        console.error("❌ Lỗi khi gửi email cập nhật trạng thái đơn hàng:", emailError);
        console.error("   - Email:", donhangCu.user.email);
        console.error("   - Order ID:", req.params.id);
      }
    } else if (trangthaiThayDoi) {
      // Nếu trạng thái thay đổi nhưng không có email user
      console.warn(`⚠️ Không thể gửi email: Đơn hàng ${req.params.id} không có email user`);
    }

    res.json({ message: "Cập nhật trạng thái đơn hàng thành công" });
  } catch (err) {
    console.error("Lỗi PUT /admin/donhang/:id:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/*  MÃ GIẢM GIÁ  */
router.get("/magiamgia", auth, isAdmin, async (_, res) => {
  const mg = await MaGiamGiaModel.findAll();
  res.json(mg);
});

router.post("/magiamgia", auth, isAdmin, async (req, res) => {
  const mg = await MaGiamGiaModel.create({ id: uuidv4(), ...req.body });
  res.json({ message: "Thêm mã giảm giá thành công", mg });
});

router.put("/magiamgia/:id", auth, isAdmin, async (req, res) => {
  await MaGiamGiaModel.update(req.body, { where: { id: req.params.id } });
  res.json({ message: "Cập nhật mã giảm giá thành công" });
});

router.delete("/magiamgia/:id", auth, isAdmin, async (req, res) => {
  await MaGiamGiaModel.destroy({ where: { id: req.params.id } });
  res.json({ message: "Đã xóa mã giảm giá" });
});

/*  BÀI VIẾT  */
router.get("/baiviet", auth, isAdmin, async (_, res) => {
  const bv = await BaiVietModel.findAll();
  res.json(bv);
});

router.post("/baiviet", auth, isAdmin, async (req, res) => {
  const bv = await BaiVietModel.create({ id: uuidv4(), ...req.body });
  res.json({ message: "Thêm bài viết thành công", bv });
});

router.put("/baiviet/:id", auth, isAdmin, async (req, res) => {
  await BaiVietModel.update(req.body, { where: { id: req.params.id } });
  res.json({ message: "Cập nhật bài viết thành công" });
});

router.delete("/baiviet/:id", auth, isAdmin, async (req, res) => {
  await BaiVietModel.destroy({ where: { id: req.params.id } });
  res.json({ message: "Đã xóa bài viết" });
});

/*  DANH MỤC BÀI VIẾT  */
router.get("/danhmucbaiviet", auth, isAdmin, async (_, res) => {
  const list = await DanhMucBaiVietModel.findAll();
  res.json(list);
});

router.post("/danhmucbaiviet", auth, isAdmin, async (req, res) => {
  const dm = await DanhMucBaiVietModel.create({ id: uuidv4(), ...req.body });
  res.json({ message: "Thêm danh mục bài viết thành công", dm });
});

/*  LIÊN HỆ  */
router.get("/lienhe", auth, isAdmin, async (_, res) => {
  const list = await LienHeModel.findAll({ order: [["created_at", "DESC"]] });
  res.json(list);
});

router.delete("/lienhe/:id", auth, isAdmin, async (req, res) => {
  await LienHeModel.destroy({ where: { id: req.params.id } });
  res.json({ message: "Đã xóa góp ý" });
});

/*  REVIEW  */
router.get("/review", auth, isAdmin, async (_, res) => {
  const rv = await DanhGiaModel.findAll();
  res.json(rv);
});

router.delete("/review/:id", auth, isAdmin, async (req, res) => {
  await DanhGiaModel.destroy({ where: { id: req.params.id } });
  res.json({ message: "Đã xóa đánh giá" });
});

/* ---------------- USER: CẬP NHẬT THÔNG TIN ---------------- */
// PUT /api/users/:id
router.put("/users/:id", auth, isAdmin, async (req, res) => {
  try {
    const { ho_ten, sdt, role, trangthai } = req.body;
    const updateData = {};
    
    if (ho_ten !== undefined) updateData.ho_ten = ho_ten;
    if (sdt !== undefined) updateData.sdt = sdt;
    if (role !== undefined) updateData.role = role;
    if (trangthai !== undefined) updateData.trangthai = trangthai;
    
    const [count] = await UserModel.update(
      updateData,
      { where: { id: req.params.id } }
    );
    if (count === 0) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.json({ message: "Cập nhật người dùng thành công" });
  } catch (err) {
    console.error("Lỗi PUT /users/:id:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/* ---------------- ADMIN: LẤY DANH SÁCH SẢN PHẨM ---------------- */
// GET /api/sanpham
router.get("/sanpham", auth, isAdmin, async (req, res) => {
  try {
    const list = await SanPhamModel.findAll({
      order: [["ngay", "DESC"]],
      include: [
        { model: LoaiModel, as: "danhmuc", attributes: ["tendm"] },
        { model: ThuongHieuModel, as: "thuonghieu", attributes: ["tenbrand"] },
      ],
    });
    res.json(list);
  } catch (err) {
    console.error("Lỗi GET /sanpham:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ---------------- ADMIN: CHI TIẾT 1 ĐƠN HÀNG ---------------- */
// GET /api/donhang/:id
router.get("/admin/donhang/:id", auth, isAdmin, async (req, res) => {
  try {
    const dh = await DonHangModel.findByPk(req.params.id, {
      include: [
        {
          association: "chitiet_donhang",
          include: ["bienthe"],
        },
      ],
    });
    if (!dh) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    res.json(dh);
  } catch (err) {
    console.error(" Lỗi GET /admin/donhang/:id:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ---------------- DANH MỤC BÀI VIẾT: CẬP NHẬT + XOÁ ---------------- */
// PUT /api/admin/danhmucbaiviet/:id
router.put("/admin/danhmucbaiviet/:id", auth, isAdmin, async (req, res) => {
  try {
    const [count] = await DanhMucBaiVietModel.update(req.body, { where: { id: req.params.id } });
    if (count === 0) return res.status(404).json({ message: "Không tìm thấy danh mục bài viết" });
    res.json({ message: "Cập nhật danh mục bài viết thành công" });
  } catch (err) {
    console.error(" Lỗi PUT /admin/danhmucbaiviet/:id:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// DELETE /api/admin/danhmucbaiviet/:id
router.delete("/admin/danhmucbaiviet/:id", auth, isAdmin, async (req, res) => {
  try {
    const count = await DanhMucBaiVietModel.destroy({ where: { id: req.params.id } });
    if (!count) return res.status(404).json({ message: "Không tìm thấy danh mục bài viết" });
    res.json({ message: "Đã xóa danh mục bài viết" });
  } catch (err) {
    console.error(" Lỗi DELETE /admin/danhmucbaiviet/:id:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ========================================
   DOANH THU (REVENUE)
   ======================================== */

/**
 * GET /api/admin/revenue/daily
 * Lấy doanh thu theo ngày
 * 
 * Query params:
 * - date (optional): Format YYYY-MM-DD, mặc định là hôm nay
 * 
 * Returns:
 * - date: Ngày được tính doanh thu
 * - tong_doanh_thu: Tổng doanh thu (VND)
 * - so_don_hang: Số lượng đơn hàng
 */
router.get("/revenue/daily", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    // Lấy ngày từ query, nếu không có thì dùng hôm nay
    const { date } = req.query; // Format: YYYY-MM-DD
    let targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Lấy tất cả đơn hàng đã thanh toán trong ngày
    const orders = await DonHangModel.findAll({
      where: {
        trangthaithanhtoan: "paid",
        [Op.or]: [
          {
            ngaythanhtoan: {
              [Op.gte]: targetDate,
              [Op.lt]: nextDate,
            },
          },
          {
            // Fallback: nếu không có ngaythanhtoan, dùng updated_at (khi đơn được đánh dấu paid)
            ngaythanhtoan: null,
            updated_at: {
              [Op.gte]: targetDate,
              [Op.lt]: nextDate,
            },
          },
        ],
      },
    });

    const tongDoanhThu = orders.reduce((sum, order) => {
      return sum + parseFloat(order.tongtien_sau_giam || 0);
    }, 0);
    const soDonHang = orders.length;

    res.json({
      date: targetDate.toISOString().split("T")[0],
      tong_doanh_thu: tongDoanhThu,
      so_don_hang: soDonHang,
    });
  } catch (err) {
    console.error("Lỗi GET /api/admin/revenue/daily:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/**
 * GET /api/admin/revenue/monthly
 * Lấy doanh thu theo tháng
 * 
 * Query params:
 * - year (optional): Năm (YYYY), mặc định là năm hiện tại
 * - month (optional): Tháng (1-12), mặc định là tháng hiện tại
 * 
 * Returns:
 * - year: Năm được tính doanh thu
 * - month: Tháng được tính doanh thu
 * - tong_doanh_thu: Tổng doanh thu (VND)
 * - so_don_hang: Số lượng đơn hàng
 */
router.get("/revenue/monthly", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    // Lấy năm và tháng từ query, nếu không có thì dùng hiện tại
    const { year, month } = req.query; // year: YYYY, month: MM (1-12)
    const now = new Date();
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth(); // month is 0-indexed

    const startDate = new Date(targetYear, targetMonth, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetYear, targetMonth + 1, 1);
    endDate.setHours(0, 0, 0, 0);

    // Lấy tất cả đơn hàng đã thanh toán trong tháng
    const orders = await DonHangModel.findAll({
      where: {
        trangthaithanhtoan: "paid",
        [Op.or]: [
          {
            ngaythanhtoan: {
              [Op.gte]: startDate,
              [Op.lt]: endDate,
            },
          },
          {
            // Fallback: nếu không có ngaythanhtoan, dùng updated_at
            ngaythanhtoan: null,
            updated_at: {
              [Op.gte]: startDate,
              [Op.lt]: endDate,
            },
          },
        ],
      },
    });

    const tongDoanhThu = orders.reduce((sum, order) => {
      return sum + parseFloat(order.tongtien_sau_giam || 0);
    }, 0);
    const soDonHang = orders.length;

    res.json({
      year: targetYear,
      month: targetMonth + 1,
      tong_doanh_thu: tongDoanhThu,
      so_don_hang: soDonHang,
    });
  } catch (err) {
    console.error("Lỗi GET /api/admin/revenue/monthly:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/**
 * GET /api/admin/revenue/range
 * Lấy doanh thu theo khoảng ngày (from-date to date)
 * 
 * Query params:
 * - from_date (required): Ngày bắt đầu (YYYY-MM-DD)
 * - to_date (required): Ngày kết thúc (YYYY-MM-DD)
 * 
 * Returns:
 * - from_date: Ngày bắt đầu
 * - to_date: Ngày kết thúc
 * - tong_doanh_thu: Tổng doanh thu trong khoảng thời gian (VND)
 * - so_don_hang: Số lượng đơn hàng
 * - orders: Danh sách đơn hàng (optional, có thể thêm query param include_orders=true)
 */
router.get("/revenue/range", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    const { from_date, to_date, include_orders } = req.query;

    // Validate required params
    if (!from_date || !to_date) {
      return res.status(400).json({
        message: "Thiếu tham số: from_date và to_date là bắt buộc (format: YYYY-MM-DD)",
      });
    }

    const startDate = new Date(from_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(to_date);
    endDate.setHours(23, 59, 59, 999);

    // Validate date range
    if (startDate > endDate) {
      return res.status(400).json({
        message: "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc",
      });
    }

    // Lấy tất cả đơn hàng đã thanh toán trong khoảng thời gian
    const orders = await DonHangModel.findAll({
      where: {
        trangthaithanhtoan: "paid",
        [Op.or]: [
          {
            ngaythanhtoan: {
              [Op.gte]: startDate,
              [Op.lte]: endDate,
            },
          },
          {
            // Fallback: nếu không có ngaythanhtoan, dùng updated_at
            ngaythanhtoan: null,
            updated_at: {
              [Op.gte]: startDate,
              [Op.lte]: endDate,
            },
          },
        ],
      },
      ...(include_orders === "true" && {
        include: [
          {
            model: UserModel,
            as: "user",
            attributes: ["id", "ho_ten", "email"],
          },
          {
            model: DonHangChiTietModel,
            as: "chitiet",
            include: [
              {
                model: SanPhamBienTheModel,
                as: "bienthe",
                include: [{ model: SanPhamModel, as: "sanpham", attributes: ["id", "code", "tensp"] }],
              },
            ],
          },
        ],
      }),
      order: [["created_at", "DESC"]],
    });

    const tongDoanhThu = orders.reduce((sum, order) => {
      return sum + parseFloat(order.tongtien_sau_giam || 0);
    }, 0);
    const soDonHang = orders.length;

    const result = {
      from_date: from_date,
      to_date: to_date,
      tong_doanh_thu: tongDoanhThu,
      so_don_hang: soDonHang,
    };

    // Chỉ trả về danh sách đơn hàng nếu có yêu cầu
    if (include_orders === "true") {
      result.orders = orders;
    }

    res.json(result);
  } catch (err) {
    console.error("Lỗi GET /api/admin/revenue/range:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/* ========================================
   SẢN PHẨM TỒN KHO
   ======================================== */

/**
 * GET /api/admin/products/low-stock
 * Lấy danh sách sản phẩm có tồn kho thấp (< 8)
 * 
 * Returns:
 * - count: Số lượng sản phẩm
 * - products: Mảng sản phẩm với thông tin đầy đủ (biến thể, sản phẩm, danh mục, thương hiệu)
 */
router.get("/products/low-stock", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    const products = await SanPhamBienTheModel.findAll({
      where: {
        sl_tonkho: {
          [Op.gt]: 0, // Lớn hơn 0
          [Op.lt]: 8, // Nhỏ hơn 8
        },
      },
      include: [
        {
          model: SanPhamModel,
          as: "sanpham",
          attributes: ["id", "code", "tensp", "thumbnail"],
          include: [
            {
              model: LoaiModel,
              as: "danhmuc",
              attributes: ["id", "tendm"],
            },
            {
              model: ThuongHieuModel,
              as: "thuonghieu",
              attributes: ["id", "tenbrand"],
            },
          ],
        },
      ],
      order: [["sl_tonkho", "ASC"]],
    });

    res.json({
      count: products.length,
      products: products,
    });
  } catch (err) {
    console.error("Lỗi GET /api/admin/products/low-stock:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/**
 * GET /api/admin/products/out-of-stock
 * Lấy danh sách sản phẩm hết hàng (tồn kho <= 0)
 * 
 * Returns:
 * - count: Số lượng sản phẩm
 * - products: Mảng sản phẩm với thông tin đầy đủ
 */
router.get("/products/out-of-stock", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    const products = await SanPhamBienTheModel.findAll({
      where: {
        sl_tonkho: {
          [Op.lte]: 0,
        },
      },
      include: [
        {
          model: SanPhamModel,
          as: "sanpham",
          attributes: ["id", "code", "tensp", "thumbnail"],
          include: [
            {
              model: LoaiModel,
              as: "danhmuc",
              attributes: ["id", "tendm"],
            },
            {
              model: ThuongHieuModel,
              as: "thuonghieu",
              attributes: ["id", "tenbrand"],
            },
          ],
        },
      ],
      order: [["sl_tonkho", "ASC"]],
    });

    res.json({
      count: products.length,
      products: products,
    });
  } catch (err) {
    console.error("Lỗi GET /api/admin/products/out-of-stock:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/* ========================================
   ĐƠN HÀNG
   ======================================== */

/**
 * GET /api/admin/orders/today
 * Lấy danh sách đơn hàng được tạo trong ngày hôm nay
 * 
 * Query params:
 * - date (optional): Ngày cụ thể (YYYY-MM-DD), mặc định là hôm nay
 * 
 * Returns:
 * - date: Ngày được lấy đơn hàng
 * - count: Số lượng đơn hàng
 * - orders: Mảng đơn hàng với thông tin user, chi tiết đơn hàng, sản phẩm
 */
router.get("/orders/today", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    // Có thể filter theo ngày cụ thể, nếu không có thì dùng hôm nay
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const orders = await DonHangModel.findAll({
      where: {
        created_at: {
          [Op.gte]: targetDate,
          [Op.lt]: nextDate,
        },
      },
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: ["id", "ho_ten", "email"],
        },
        {
          model: DonHangChiTietModel,
          as: "chitiet",
          include: [
            {
              model: SanPhamBienTheModel,
              as: "bienthe",
              include: [
                {
                  model: SanPhamModel,
                  as: "sanpham",
                  attributes: ["id", "code", "tensp"],
                },
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      date: targetDate.toISOString().split("T")[0],
      count: orders.length,
      orders: orders,
    });
  } catch (err) {
    console.error("Lỗi GET /api/admin/orders/today:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/**
 * GET /api/admin/orders/pending
 * Lấy danh sách đơn hàng đang chờ xử lý (trạng thái: pending)
 * 
 * Returns:
 * - count: Số lượng đơn hàng
 * - orders: Mảng đơn hàng với thông tin đầy đủ
 */
router.get("/orders/pending", auth, isAdmin, trackUserActivity, async (req, res) => {
  try {
    const orders = await DonHangModel.findAll({
      where: {
        trangthai: "pending",
      },
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: ["id", "ho_ten", "email"],
        },
        {
          model: DonHangChiTietModel,
          as: "chitiet",
          include: [
            {
              model: SanPhamBienTheModel,
              as: "bienthe",
              include: [
                {
                  model: SanPhamModel,
                  as: "sanpham",
                  attributes: ["id", "code", "tensp"],
                },
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      count: orders.length,
      orders: orders,
    });
  } catch (err) {
    console.error("Lỗi GET /api/admin/orders/pending:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

/* ========================================
   USER ONLINE REALTIME
   ======================================== */

// GET /api/admin/users/online - Tổng user online realtime (Sử dụng Socket.IO)
router.get("/users/online", auth, isAdmin, async (req, res) => {
  try {
    // Lấy danh sách user IDs đang online từ Socket.IO service
    const onlineUsersList = getOnlineUsersList();
    const onlineUserIds = onlineUsersList.map(item => item.userId);

    console.log(`[Socket Tracking] API called by admin: ${req.user.email} - Online users: ${onlineUserIds.length}`);

    // Get user details for online users
    let onlineUsers = [];
    if (onlineUserIds.length > 0) {
      onlineUsers = await UserModel.findAll({
        where: {
          id: {
            [Op.in]: onlineUserIds,
          },
        },
        attributes: ["id", "ho_ten", "email", "role"],
      });

      // Log users found
      console.log(`[Socket Tracking] Users found in DB: ${onlineUsers.length}`);
    }

    // Map users với thông tin socket connection
    const usersWithSocketInfo = onlineUsers.map((user) => {
      const userIdStr = String(user.id);
      const socketInfo = onlineUsersList.find(item => item.userId === userIdStr);
      return {
        ...user.toJSON(),
        id: userIdStr,
        socket_id: socketInfo?.socketId || null,
        connected_at: socketInfo ? new Date().toISOString() : null, // Socket connection time (simplified)
      };
    });

    res.json({
      total: usersWithSocketInfo.length,
      users: usersWithSocketInfo,
    });
  } catch (err) {
    console.error("Lỗi GET /api/admin/users/online:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

// GET /api/admin/users/online/clear - Clear all tracked users (for debugging)
router.delete("/users/online/clear", auth, isAdmin, async (req, res) => {
  try {
    const clearedCount = activeUsers.size;
    activeUsers.clear();
    console.log(`[User Tracking] Cleared all ${clearedCount} tracked users by admin: ${req.user.email}`);
    res.json({ 
      message: `Đã xóa ${clearedCount} user khỏi tracking`,
      cleared_count: clearedCount 
    });
  } catch (err) {
    console.error("Lỗi DELETE /api/admin/users/online/clear:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

module.exports = router;
module.exports.isAdmin = isAdmin;