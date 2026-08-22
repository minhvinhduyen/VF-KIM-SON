import React, { createContext, useState, ReactNode, useEffect } from 'react';
import type { User } from '../types';
import { useApp } from '../hooks/useApp';
import { loginUser } from '../services/apiService';

interface AuthContextType {
  user: User | null;
  login: (username: string, pass: string, facilityId?: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Khôi phục user từ sessionStorage khi tải lại trang
    try {
      const saved = sessionStorage.getItem('auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[AuthContext] Khôi phục user từ sessionStorage:', parsed);
        return parsed;
      }
    } catch (e) {
      console.error('[AuthContext] Lỗi đọc sessionStorage:', e);
    }
    return null;
  });
  const { setFacility } = useApp();

  // Đồng bộ user state vào sessionStorage
  useEffect(() => {
    if (user) {
      sessionStorage.setItem('auth_user', JSON.stringify(user));
      console.log('[AuthContext] Đã lưu user vào sessionStorage:', user.id);
    } else {
      sessionStorage.removeItem('auth_user');
      console.log('[AuthContext] Đã xóa user khỏi sessionStorage');
    }
  }, [user]);

  // Khi app khởi động lại và user đã có từ sessionStorage, thiết lập facility
  useEffect(() => {
    if (user && user.facilityId) {
      console.log('[AuthContext] Khôi phục facility từ user đã lưu:', user.facilityId);
      setFacility(user.facilityId);
    }
  }, []); // Chỉ chạy 1 lần khi mount

  const login = async (username: string, pass: string, facilityId?: string): Promise<boolean> => {
    try {
        console.log('[AuthContext] Bắt đầu đăng nhập:', username, 'facilityId:', facilityId);
        const response = await loginUser(username, pass, facilityId);
        console.log('[AuthContext] Phản hồi từ server:', JSON.stringify(response));
        if (response && response.success && response.user) {
            // Ưu tiên facilityId do người dùng chọn trên form đăng nhập
            const effectiveFacilityId = facilityId || response.user.facilityId;
            console.log('[AuthContext] Đặt user state:', response.user.id, 'facility:', effectiveFacilityId);
            const userWithFacility = { ...response.user, facilityId: effectiveFacilityId };
            setUser(userWithFacility);
            if (effectiveFacilityId) {
                console.log('[AuthContext] Đặt facility:', effectiveFacilityId);
                setFacility(effectiveFacilityId);
            }
            console.log('[AuthContext] Login thành công, return true');
            return true;
        }
        console.log('[AuthContext] Response không hợp lệ, return false');
    } catch (e) {
        console.error('[AuthContext] Lỗi đăng nhập:', e);
    }
    return false;
  };

  const logout = () => {
    console.log('[AuthContext] Đăng xuất');
    setUser(null);
    // Xóa facility cũ để tránh stale data khi đăng nhập tài khoản khác
    localStorage.removeItem('activeFacilityId');
    // Reset API facility ID để không gửi header cũ
    import('../services/apiService').then(api => api.setApiFacilityId(''));
    // Reset facility trong AppContext
    setFacility('');
  };

  console.log('[AuthContext] Render - user:', user ? user.id : 'null');

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};