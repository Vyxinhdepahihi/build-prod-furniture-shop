const { v4: uuidv4 } = require("uuid");
const { DonHangModel, DonHangChiTietModel, GioHangModel, SanPhamBienTheModel } = require("../../database");

/**
 * Helper function: Tạo đơn hàng từ Payment Intent metadata
 * Sử dụng khi thanh toán Stripe thành công và đơn hàng chưa được tạo
 * 
 * @param {Object} metadata - Metadata từ Payment Intent (từ Stripe)
 * @param {string} paymentIntentId - ID của Payment Intent
 * @returns {Promise<Object>} Đơn hàng đã tạo
 */
async function createOrderFromMetadata(metadata, paymentIntentId) {
  // Parse thông tin từ metadata
  const userId = metadata.user_id;
  const diachichitiet = metadata.diachichitiet;
  const phuong_xa = metadata.phuong_xa || '';
  const quan_huyen = metadata.quan_huyen;
  const tinh_thanh = metadata.tinh_thanh;
  const hoten = metadata.hoten;
  const sdt = metadata.sdt;
  const note = metadata.note || '';
  const magiamgia_id = metadata.magiamgia_id === 'null' ? null : metadata.magiamgia_id;
  const magiamgia_code = metadata.magiamgia_code === 'null' ? null : metadata.magiamgia_code;
  const tongtien = Number(metadata.tongtien || 0);
  const giamgia = Number(metadata.giamgia || 0);
  const phi_van_chuyen = Number(metadata.phi_van_chuyen || 0);
  const tongtien_sau_giam = Number(metadata.tongtien_sau_giam || 0);

  // Parse cart items từ JSON string
  let cartItems = [];
  try {
    cartItems = JSON.parse(metadata.cart_items || '[]');
  } catch (e) {
    console.error('Error parsing cart_items from metadata:', e);
    throw new Error('Không thể parse thông tin giỏ hàng từ metadata');
  }

  if (!cartItems.length) {
    throw new Error("Không có sản phẩm trong giỏ hàng");
  }

  // Tạo đơn hàng
  const donhangId = uuidv4();
  const donhangCode = `DH${Date.now()}`;

  const donhang = await DonHangModel.create({
    id: donhangId,
    code: donhangCode,
    user_id: userId,
    tongtien: tongtien,
    giamgia: giamgia,
    tongtien_sau_giam: tongtien_sau_giam,
    phuongthucthanhtoan: "stripe",
    trangthaithanhtoan: "paid", // Đã thanh toán thành công
    trangthai: "pending",
    payment_intent_id: paymentIntentId,
    diachichitiet,
    phuong_xa: phuong_xa,
    quan_huyen,
    tinh_thanh,
    hoten,
    sdt,
    note: note,
    magiamgia_id: magiamgia_id,
    magiamgia_code: magiamgia_code,
    phi_van_chuyen: phi_van_chuyen,
    ngaythanhtoan: new Date(),
  });

  // Tạo chi tiết đơn hàng từ cart items
  for (const item of cartItems) {
    const gia = Number(item.gia || 0);
    await DonHangChiTietModel.create({
      id: uuidv4(),
      donhang_id: donhangId,
      bienthe_id: item.bienthe_id,
      soluong: item.soluong,
      gia: gia,
      tonggia: gia * Number(item.soluong || 0),
    });
  }

  return donhang;
}

module.exports = {
  createOrderFromMetadata,
};

