
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../hooks/useApp';
import { Role } from '../types';
import { getFacilityById } from '../services/facilitiesConfig';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { refreshData, state } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Lấy tên cơ sở từ activeFacilityId
  const activeFacility = state.activeFacilityId ? getFacilityById(state.activeFacilityId) : null;
  // Rút gọn tên: "Vinfast Kim Sơn Long Bình" → "Long Bình"
  const facilityShortName = activeFacility ? activeFacility.name.replace('Vinfast Kim Sơn ', '') : '';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
        await refreshData();
    } catch (e) {
        alert("Lỗi khi đồng bộ dữ liệu: " + (e as Error).message);
    } finally {
        setIsRefreshing(false);
    }
  };

  return (
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
        <div className="flex items-center space-x-4">
          <div className="text-right hidden md:block">
            <p className="font-semibold text-gray-800">{user.name}</p>
            <p className="text-sm text-gray-500">{user.role}</p>
          </div>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition duration-200"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
