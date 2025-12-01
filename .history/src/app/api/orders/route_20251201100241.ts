import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:5001';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    console.log('[API Orders] Fetching orders list');
    
    if (!token) {
      console.error('[API Orders] No token provided');
      return NextResponse.json(
        { error: 'Thiếu token xác thực' },
        { status: 401 }
      );
    }
    
    const response = await fetch(`${BACKEND_URL}/api/donhang`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    console.log(`[API Orders] Backend response status: ${response.status}`);

    if (!response.ok) {
      let errorMessage = 'Không thể tải đơn hàng';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        console.error('[API Orders] Backend error:', errorData);
      } catch {
        const errorText = await response.text();
        console.error('[API Orders] Backend error text:', errorText);
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const orders = await response.json();
    console.log(`[API Orders] Loaded ${Array.isArray(orders) ? orders.length : 0} orders`);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('[API Orders] Error fetching orders:', error);
    return NextResponse.json(
      { 
        error: 'Lỗi kết nối server',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

