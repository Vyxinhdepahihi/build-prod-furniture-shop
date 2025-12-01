const { GioHangModel, DonHangChiTietModel } = require("../../database");

/**
 * Helper function: Xóa giỏ hàng cho đơn hàng cụ thể
 * Chỉ xóa các sản phẩm có trong đơn hàng đó
 * 
 * @param {string} userId - ID của user
 * @param {string} donhangId - ID của đơn hàng
 * @returns {Promise<void>}
 */
async function deleteCartForOrder(userId, donhangId) {
  try {
    // Lấy chi tiết đơn hàng
    const chitiet = await DonHangChiTietModel.findAll({
      where: { donhang_id: donhangId },
    });

    if (!chitiet || chitiet.length === 0) {
      console.log(`Không tìm thấy chi tiết đơn hàng ${donhangId}`);
      return;
    }

    // Xóa từng sản phẩm trong đơn hàng khỏi giỏ hàng
    for (const item of chitiet) {
      // Tìm item trong giỏ hàng
      const cartItem = await GioHangModel.findOne({
        where: {
          user_id: userId,
          bienthe_id: item.bienthe_id,
        },
      });

      if (cartItem) {
        // Nếu số lượng trong giỏ hàng >= số lượng trong đơn hàng
        // Xóa item đó hoặc giảm số lượng
        if (cartItem.soluong >= item.soluong) {
          // Nếu số lượng bằng nhau, xóa hoàn toàn
          if (cartItem.soluong === item.soluong) {
            await cartItem.destroy();
          } else {
            // Nếu số lượng trong giỏ hàng nhiều hơn, giảm số lượng
            await cartItem.update({
              soluong: cartItem.soluong - item.soluong,
            });
          }
        } else {
          // Nếu số lượng trong giỏ hàng ít hơn, xóa item đó
          await cartItem.destroy();
        }
      }
    }

    console.log(`Đã xóa giỏ hàng cho đơn hàng ${donhangId} của user ${userId}`);
  } catch (error) {
    console.error("Lỗi khi xóa giỏ hàng cho đơn hàng:", error);
    throw error;
  }
}

module.exports = {
  deleteCartForOrder,
};



