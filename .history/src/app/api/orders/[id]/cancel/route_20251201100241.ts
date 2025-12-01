import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:5001';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    
    // Lấy lý do hủy từ request body
    const body = await request.json().catch(() => ({}));
    const ly_do_huy = body.ly_do_huy || null;
    
    const response = await fetch(`${BACKEND_URL}/api/donhang/${id}/huy`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ly_do_huy })
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Không thể hủy đơn hàng' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { error: 'Lỗi kết nối server' },
      { status: 500 }
    );
  }
}

