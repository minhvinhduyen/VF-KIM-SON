
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
          {user.role === Role.Manager && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center bg-blue-100 hover:bg-blue-200 text-brand-blue font-bold py-2 px-4 rounded transition duration-200 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {isRefreshing ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {isRefreshing ? 'Đang đồng bộ...' : 'Đồng bộ'}
            </button>
          )}
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
