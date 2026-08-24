
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../hooks/useApp';
import { Role } from '../types';
import { getFacilityById } from '../services/facilitiesConfig';
import ChangePasswordModal from './modals/ChangePasswordModal';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { state } = useApp();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Lấy tên cơ sở từ activeFacilityId
  const activeFacility = state.activeFacilityId ? getFacilityById(state.activeFacilityId) : null;
  // Rút gọn tên: "Vinfast Kim Sơn Long Bình" → "Long Bình"
  const facilityShortName = activeFacility ? activeFacility.name.replace('Vinfast Kim Sơn ', '') : '';

  return (
    <>
      <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <img src={state.logoUrl} alt="Logo" className="h-10 w-auto max-w-[150px] object-contain" />
          <span className="text-sm font-bold text-brand-blue sm:hidden truncate max-w-[200px]">
            {user 
              ? (user.role === Role.SuperAdmin || (user as any).role === 'SuperAdmin'
                ? 'Bảng Tiến Độ VF Kim Sơn'
                : `Bảng Tiến Độ${facilityShortName ? ` ${facilityShortName}` : ''}`)
              : 'Bảng Tiến Độ'}
          </span>
          <span className="text-xl font-bold text-brand-blue hidden sm:inline-block">
           {user 
              ? (user.role === Role.SuperAdmin || (user as any).role === 'SuperAdmin'
                ? 'Bảng Tiến Độ Xưởng Dịch Vụ VF Kim Sơn'
                : `Bảng Tiến Độ Xưởng Dịch Vụ${facilityShortName ? ` ${facilityShortName}` : ''}`)
              : 'BẢNG TIẾN ĐỘ VINFAST KIM SƠN'}
          </span>
        </div>
        {user && (
          <div className="flex items-center space-x-3">
            <div className="text-right hidden md:block">
              <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
              <p className="text-xs text-gray-500 font-medium">{user.role}</p>
            </div>
            
            {/* Nút Đổi mật khẩu */}
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              title="Đổi mật khẩu tài khoản"
              className="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-3 rounded-xl transition text-xs sm:text-sm border border-gray-300"
            >
              <span>🔑</span>
              <span className="hidden sm:inline">Đổi mật khẩu</span>
            </button>

            {/* Nút Đăng xuất */}
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 sm:px-4 rounded-xl transition text-xs sm:text-sm shadow-sm"
            >
              Đăng xuất
            </button>
          </div>
        )}
      </header>

      {/* Modal Đổi mật khẩu */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
};

export default Header;
