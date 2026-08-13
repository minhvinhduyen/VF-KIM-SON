
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useApp } from '../../hooks/useApp';
import { JobStatus, Job } from '../../types';

const WelcomeScreen: React.FC = () => {
  const { state } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [slideIndex, setSlideIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cập nhật đồng hồ mỗi giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tự động chuyển slide mỗi 20 giây
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setSlideIndex((prev) => prev + 1);
    }, 20000); // 20 giây
    return () => clearInterval(slideTimer);
  }, []);

  // Lắng nghe sự kiện thay đổi fullscreen để cập nhật state icon
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        // Vào chế độ toàn màn hình trên container này
        if (containerRef.current) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Lỗi khi bật toàn màn hình: ${err.message}`);
            });
        }
    } else {
        // Thoát chế độ toàn màn hình
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  // Logic lọc danh sách xe hợp lệ để hiển thị
  const validJobs = useMemo(() => {
    const now = currentTime.getTime();
    
    // Lọc các xe thỏa mãn điều kiện
    const jobs = state.jobs.filter(j => {
      // 1. Phải có trạng thái là Arrived (Chờ tiếp nhận)
      if (j.status !== JobStatus.Arrived) return false;
      
      // 2. Phải có thời gian đến thực tế
      if (!j.actualArrivalTime) return false;

      const arrivalTime = new Date(j.actualArrivalTime).getTime();
      const diffMinutes = (now - arrivalTime) / 60000; // Đổi ra phút

      // 3. Thời gian đến không quá 10 phút so với hiện tại
      return diffMinutes <= 10;
    });

    // Sắp xếp: Xe mới đến nhất lên đầu (hoặc tùy nhu cầu)
    return jobs.sort((a, b) => {
      const timeA = a.actualArrivalTime ? new Date(a.actualArrivalTime).getTime() : 0;
      const timeB = b.actualArrivalTime ? new Date(b.actualArrivalTime).getTime() : 0;
      return timeB - timeA;
    });
  }, [state.jobs, currentTime]);

  // Xác định xe hiện tại cần hiển thị dựa trên slideIndex
  const currentJob = useMemo(() => {
    if (validJobs.length === 0) return null;
    // Sử dụng toán tử modulo để lặp vòng tròn qua danh sách
    const index = slideIndex % validJobs.length;
    return validJobs[index];
  }, [validJobs, slideIndex]);

  // Component hiển thị biển số xe giả lập
  const LicensePlate: React.FC<{ plate: string; isYellow?: boolean }> = ({ plate, isYellow = false }) => (
    <div className={`
      inline-block border-4 border-gray-800 rounded-lg px-6 py-2 shadow-lg
      ${isYellow ? 'bg-yellow-300' : 'bg-white'}
    `}>
      <span className="text-3xl md:text-5xl font-mono font-bold text-gray-900 tracking-wider">
        {plate}
      </span>
    </div>
  );

  // Background Watermark Logo
  const Watermark = () => (
    <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none overflow-hidden">
        <img 
            src={state.logoUrl} 
            alt="Watermark" 
            className="w-[80%] opacity-[0.03] grayscale transform -rotate-12"
        />
    </div>
  );

  // Nút điều khiển Fullscreen
  const FullScreenButton = () => (
    <button 
        onClick={toggleFullScreen}
        className="absolute top-4 right-4 z-50 p-2 bg-gray-800/20 hover:bg-gray-800/60 text-gray-600 hover:text-white rounded-full transition-all duration-300 backdrop-blur-sm"
        title={isFullscreen ? "Thoát toàn màn hình" : "Chế độ trình chiếu (Toàn màn hình)"}
    >
        {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
        )}
    </button>
  );

  // === MÀN HÌNH CHỜ (DEFAULT - KHI KHÔNG CÓ XE NÀO MỚI) ===
  if (!currentJob) {
    return (
      <div 
        ref={containerRef}
        className="relative flex flex-col items-center justify-between h-full w-full bg-slate-50 overflow-hidden font-sans"
      >
        <FullScreenButton />
        <Watermark />
        
        {/* Header Spacer */}
        <div className="h-1/6"></div>

        {/* Main Content */}
        <div className="z-10 flex flex-col items-center text-center animate-fade-in px-4">
            <img 
                src={state.logoUrl} 
                alt="VinFast Logo" 
                className="h-32 w-auto object-contain mb-10 drop-shadow-sm" 
            />
            <h1 className="text-4xl md:text-6xl font-bold text-brand-blue tracking-wide uppercase mb-6">
                XƯỞNG DỊCH VỤ VINFAST KIM SƠN BÌNH DƯƠNG
            </h1>
            <div className="h-1 w-24 bg-brand-gold mb-6"></div>
            <p className="text-2xl md:text-3xl text-gray-500 font-light tracking-wide">
                Hân hạnh được phục vụ Quý khách
            </p>
        </div>
        
        {/* Footer */}
        <div className="z-10 mb-8 text-center">
             <p className="text-5xl font-thin text-gray-400 font-mono tracking-widest">
                {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute:'2-digit'})}
             </p>
             <p className="text-sm text-gray-400 mt-2 uppercase tracking-widest">
                {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
             </p>
        </div>
      </div>
    );
  }

  // === MÀN HÌNH CHÀO MỪNG KHÁCH CỤ THỂ ===
  const isGuest = currentJob.customerName === 'Khách vãng lai' || !currentJob.customerName;

  return (
    <div 
        ref={containerRef}
        className="relative flex flex-col items-center justify-between h-full w-full bg-slate-50 overflow-hidden font-sans border-t-8 border-brand-blue"
    >
      <FullScreenButton />
      <Watermark />

      {/* Hiển thị chỉ số trang nếu có nhiều hơn 1 xe (ví dụ: 1/3) */}
      {validJobs.length > 1 && (
        <div className="absolute top-4 left-4 bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-sm font-bold z-20">
           {(slideIndex % validJobs.length) + 1} / {validJobs.length}
        </div>
      )}

      {/* 1. Header Section */}
      <div className="z-10 mt-12 flex flex-col items-center animate-slide-down">
        <img 
            src={state.logoUrl} 
            alt="VinFast Logo" 
            className="h-16 w-auto object-contain mb-6" 
        />
        <h2 className="text-xl md:text-2xl text-gray-500 font-light uppercase tracking-[0.3em]">
          Nhiệt Liệt Chào Mừng
        </h2>
      </div>

      {/* 2. Main Hero Section */}
      <div className="z-10 flex flex-col items-center justify-center w-full max-w-5xl px-4 animate-scale-in">
        
        {isGuest ? (
            // Layout cho Khách Vãng Lai
            <>
                <h1 className="text-5xl md:text-7xl font-black text-gray-800 mb-8 uppercase tracking-tight">
                    KHÁCH HÀNG
                </h1>
                <LicensePlate plate={currentJob.licensePlate} />
                <div className="mt-12 bg-blue-50 px-8 py-4 rounded-full border border-blue-100">
                    <p className="text-2xl text-brand-blue font-medium flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Vui lòng liên hệ Cố vấn dịch vụ để được hỗ trợ
                    </p>
                </div>
            </>
        ) : (
            // Layout cho Khách Có Hẹn/Thông Tin
            <>
                {/* Tên khách hàng - Điểm nhấn chính */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-brand-blue mb-6 text-center leading-tight drop-shadow-sm">
                    {currentJob.customerName}
                </h1>

                {/* Thông tin xe & Biển số */}
                <div className="flex flex-col items-center space-y-6">
                    <div className="bg-gray-200 text-gray-700 px-6 py-1 rounded-full text-lg font-bold uppercase tracking-wider shadow-inner">
                        VINFAST {currentJob.carModel}
                    </div>
                    
                    <LicensePlate plate={currentJob.licensePlate} isYellow={currentJob.licensePlate.includes('LD') || currentJob.licensePlate.includes('C')} />
                </div>
            </>
        )}
      </div>

      {/* 3. Footer Section */}
      <div className="z-10 mb-8 text-center flex flex-col items-center animate-slide-up">
        <p className="text-xl md:text-2xl text-gray-600 font-serif italic mb-4">
            "Kính chúc Quý khách một ngày tốt lành"
        </p>
        <div className="h-px w-32 bg-gray-300 mb-4"></div>
        <p className="text-3xl font-thin text-brand-blue font-mono">
            {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute:'2-digit'})}
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
