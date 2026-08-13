
import React, { useState, useRef } from 'react';
import { useApp } from '../../hooks/useApp';

const Settings: React.FC = () => {
  const { state, setLogo, resetLogo } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 500KB to be safe for LocalStorage)
    if (file.size > 500 * 1024) {
      setError("Dung lượng file quá lớn. Vui lòng chọn ảnh dưới 500KB.");
      return;
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
        setError("Vui lòng chọn file hình ảnh.");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogo(base64String);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
        setError("Có lỗi khi đọc file.");
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
      if(window.confirm("Bạn có chắc muốn quay về logo mặc định?")) {
          resetLogo();
      }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Cài đặt chung</h2>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Logo Phần mềm</h3>
        <p className="text-sm text-gray-500 mb-4">
            Logo này sẽ hiển thị ở tiêu đề trang, màn hình đăng nhập và trên các phiếu in (Giấy ra cổng).
            <br/>Khuyến nghị: Ảnh PNG nền trong suốt, dung lượng nhỏ (khoảng 20-50KB).
        </p>

        <div className="flex items-start space-x-8">
            <div className="flex flex-col items-center">
                <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden mb-2 relative">
                    <img src={state.logoUrl} alt="Current Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <span className="text-xs text-gray-500">Xem trước</span>
            </div>

            <div className="flex-1 space-y-4">
                {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
                
                <div className="flex items-center space-x-3">
                    <label className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer transition-colors">
                        <span>Tải logo mới</span>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/png, image/jpeg, image/svg+xml" 
                            className="hidden" 
                            onChange={handleFileChange}
                        />
                    </label>

                    <button 
                        onClick={handleReset}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition-colors"
                    >
                        Khôi phục mặc định
                    </button>
                </div>
                <p className="text-xs text-gray-400 italic">Hỗ trợ: PNG, JPG, SVG.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
