
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useApp } from './hooks/useApp';
import Timeline from './components/common/Timeline';
import BodyShopCalendar from './components/common/BodyShopCalendar';
import { BayType, JobType, JobStatus } from './types';
import TimelineLegend from './common/TimelineLegend';
import WelcomeScreen from './common/WelcomeScreen';

const toYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState('login');
  const { state } = useApp();
  
  // Ref cho container của tab Sửa chữa chung để kích hoạt native fullscreen
  const generalRepairContainerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [forgotPasswordMsg, setForgotPasswordMsg] = useState('');
  const { login } = useAuth();

  // Lắng nghe sự kiện fullscreenchange của trình duyệt để đồng bộ state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!login(id, password)) {
      setError('Mã số nhân viên hoặc mật khẩu không chính xác.');
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
      e.preventDefault();
      setForgotPasswordMsg('Vui lòng liên hệ admin');
  };

  const generalBays = state.bays.filter(b => b.type === BayType.General || b.type === BayType.CarWash);
  
  const generalJobs = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    return state.jobs.filter(j => {
        if (j.jobType === JobType.BodyAndPaint) {
            return false;
        }
        const jobStart = j.actualStartTime || j.plannedStartTime;
        const jobEnd = j.actualEndTime || j.plannedEndTime;
        return jobStart <= endOfToday && jobEnd >= startOfToday;
    });
  }, [state.jobs]);

  // Filter out FreeInspection and Quotation statuses from Body Shop view
  const bodyShopJobs = state.jobs.filter(j => 
    j.jobType === JobType.BodyAndPaint && 
    j.status !== JobStatus.FreeInspection && 
    j.status !== JobStatus.Quotation
  );

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        if (generalRepairContainerRef.current) {
            generalRepairContainerRef.current.requestFullscreen().catch(err => {
                console.error(`Lỗi khi bật toàn màn hình: ${err.message}`);
            });
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  // Nút Icon nổi (Floating Button) giống WelcomeScreen
  const FullScreenButton = () => (
    <button 
        onClick={toggleFullScreen}
        className="absolute top-4 right-4 z-50 p-2 bg-gray-800/10 hover:bg-gray-800/60 text-gray-600 hover:text-white rounded-full transition-all duration-300 backdrop-blur-sm"
        title={isFullScreen ? "Thoát toàn màn hình" : "Chế độ xem toàn màn hình"}
    >
        {isFullScreen ? (
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

  const TabButton: React.FC<{tabName: string; label: string}> = ({ tabName, label }) => (
    <button
        onClick={() => setActiveTab(tabName)}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200 focus:outline-none ${
            activeTab === tabName
            ? 'bg-white text-brand-blue border-gray-300 border-l border-t border-r -mb-px'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
    >
        {label}
    </button>
  );

  const renderContent = () => {
    switch (activeTab) {
        case 'welcome':
            // Màn hình chào mừng sẽ chiếm trọn không gian content
            return (
                <div className="h-[80vh] w-full bg-white rounded-b-lg rounded-r-lg border border-gray-300 overflow-hidden">
                    <WelcomeScreen />
                </div>
            );
        case 'general_repair':
            return (
                <div 
                    ref={generalRepairContainerRef}
                    className={`relative p-4 bg-white rounded-b-lg rounded-r-lg border border-gray-300 w-full flex flex-col ${isFullScreen ? 'h-full overflow-hidden' : ''}`}
                >
                    <FullScreenButton />
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold text-gray-800">Bảng tiến độ Sửa chữa chung (Chế độ xem)</h2>
                      {/* Nút cũ đã được thay thế bằng FullScreenButton */}
                    </div>
                    <TimelineLegend isFullScreen={isFullScreen} />
                    <div className="flex-grow">
                      <Timeline 
                        bays={generalBays} 
                        jobs={generalJobs} 
                        onJobClick={() => {}} 
                        displayDate={toYYYYMMDD(new Date())} 
                        isFullScreen={isFullScreen} 
                      />
                    </div>
                </div>
            );
        case 'body_shop':
            return (
                 <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-gray-300">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Bảng tiến độ Đồng sơn (Chế độ xem)</h2>
                    <BodyShopCalendar jobs={bodyShopJobs} />
                </div>
            );
        case 'login':
        default:
            return (
                <div className="w-full max-w-md bg-white rounded-b-lg rounded-r-lg shadow-2xl p-8 border border-gray-300">
                    <div className="flex justify-center mb-6">
                        <img src={state.logoUrl} alt="Logo" className="h-16 object-contain" />
                    </div>
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">Đăng Nhập</h2>
                    <p className="text-center text-gray-500 mb-8">Vui lòng đăng nhập để tiếp tục</p>
                    
                    {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">{error}</p>}
                    
                    <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="employeeId">
                        Mã số nhân viên
                        </label>
                        <input
                        id="employeeId"
                        type="text"
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        placeholder="Nhập mã số nhân viên"
                        className="shadow-inner appearance-none border rounded w-full py-3 px-4 text-gray-700 font-semibold leading-tight focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50"
                        required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                        Mật khẩu
                        </label>
                        <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        className="shadow-inner appearance-none border rounded w-full py-3 px-4 text-gray-700 font-semibold leading-tight focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50"
                        required
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                        type="submit"
                        className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:shadow-outline w-full transition duration-300 ease-in-out"
                        >
                        Đăng nhập
                        </button>
                    </div>
                    <div className="text-center mt-4">
                        <a href="#" onClick={handleForgotPassword} className="inline-block align-baseline font-bold text-sm text-brand-blue hover:text-blue-800">
                            Quên mật khẩu?
                        </a>
                        {forgotPasswordMsg && (
                            <p className="text-red-500 text-sm mt-2 font-semibold">{forgotPasswordMsg}</p>
                        )}
                        </div>
                    </form>
                </div>
            );
    }
  }

  const contentContainerClass = activeTab === 'login' 
    ? "flex justify-center" 
    : "";

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-200 p-4">
       <div className="w-full max-w-7xl">
         <div className="flex border-b border-gray-300 overflow-x-auto">
            <TabButton tabName="login" label="Đăng nhập" />
            <TabButton tabName="welcome" label="👋 Chào mừng" />
            <TabButton tabName="general_repair" label="Sửa chữa chung" />
            <TabButton tabName="body_shop" label="Đồng sơn" />
         </div>
         <div className={contentContainerClass}>
            {renderContent()}
         </div>
       </div>
    </div>
  );
};

export default Login;
