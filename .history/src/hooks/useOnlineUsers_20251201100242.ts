'use client';

import { useState, useEffect } from 'react';

/**
 * Hook để lấy danh sách users online từ API
 * 
 * Usage:
 * ```tsx
 * const { onlineUsers, loading, error, refresh } = useOnlineUsers();
 * ```
 */

interface OnlineUser {
  id: string;
  ho_ten: string | null;
  email: string;
  role: 'admin' | 'customer';
  socket_id?: string | null;
  connected_at?: string | null;
}

interface UseOnlineUsersReturn {
  onlineUsers: OnlineUser[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useOnlineUsers = (): UseOnlineUsersReturn => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOnlineUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Chưa đăng nhập');
      }

      const response = await fetch('http://localhost:5001/api/admin/users/online', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Không thể tải danh sách users online');
      }

      const data = await response.json();
      setOnlineUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(errorMessage);
      console.error('[useOnlineUsers] Lỗi:', errorMessage);
      setOnlineUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch khi component mount
  useEffect(() => {
    fetchOnlineUsers();

    // Refresh mỗi 5 giây để cập nhật realtime
    const interval = setInterval(() => {
      fetchOnlineUsers();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    onlineUsers,
    total,
    loading,
    error,
    refresh: fetchOnlineUsers,
  };
};



