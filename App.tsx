
import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import { useApp } from './hooks/useApp';

const App: React.FC = () => {
  const { user } = useAuth();
  const { state, refreshData, dispatch } = useApp();

  useEffect(() => {
    // Bắt đầu tự động làm mới dữ liệu
    const intervalId = setInterval(() => {
      // Nếu đã có lỗi nghiêm trọng (Cấu hình sai), ngừng làm mới để tránh spam server
      if (state.error && (state.error.includes('LỖI CẤU HÌNH') || state.error.includes('KHÔNG THỂ KẾT NỐI'))) {
          return;
      }

      refreshData().catch(err => {
          // Chỉ warn ở console, không crash ứng dụng nếu là lỗi mạng/server bận thoáng qua
          console.warn("Tự động làm mới thất bại (sẽ thử lại sau):", err.message);
          
          // Chỉ dừng ứng dụng và hiện màn hình đỏ nếu là lỗi CẤU HÌNH nghiêm trọng
          if (err.message.includes('LỖI CẤU HÌNH') || err.message.includes('BACKEND_URL')) {
              dispatch({ type: 'FETCH_DATA_FAILURE', payload: err.message });
              clearInterval(intervalId);
          }
      });
    }, 10000); // Cập nhật xuống 10 giây theo yêu cầu

    return () => clearInterval(intervalId);
  }, [refreshData, state.error, dispatch]);

  console.log('[App] Render - user:', user ? user.id : 'null', '| isLoading:', state.isLoading, '| error:', state.error ? state.error.substring(0, 50) : 'null');

  if (state.isLoading) {
    return (
        <div className="flex justify-center items-center h-screen bg-gradient-to-b from-sky-100 via-sky-50 to-gray-100 flex-col select-none overflow-hidden">
          {/* Clouds */}
          <div className="absolute top-[15%] w-full">
            <div className="absolute left-[10%] animate-[slideRight_18s_linear_infinite]">
              <svg width="80" height="40" viewBox="0 0 80 40" fill="white" opacity="0.7"><ellipse cx="40" cy="28" rx="38" ry="12"/><ellipse cx="25" cy="20" rx="22" ry="14"/><ellipse cx="55" cy="18" rx="20" ry="13"/><ellipse cx="40" cy="14" rx="16" ry="10"/></svg>
            </div>
            <div className="absolute left-[55%] animate-[slideRight_24s_linear_infinite]" style={{animationDelay: '-8s'}}>
              <svg width="60" height="30" viewBox="0 0 60 30" fill="white" opacity="0.5"><ellipse cx="30" cy="20" rx="28" ry="10"/><ellipse cx="18" cy="14" rx="16" ry="10"/><ellipse cx="42" cy="13" rx="15" ry="9"/></svg>
            </div>
          </div>

          {/* Car Container */}
          <div className="relative w-72 h-32 mb-8">
            {/* Road */}
            <div className="absolute bottom-0 w-full h-3 bg-gray-400 rounded-full overflow-hidden">
              <div className="absolute inset-0 flex items-center gap-3 animate-[slideLeft_1s_linear_infinite]">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-6 h-[3px] bg-yellow-400 rounded-full flex-shrink-0" />
                ))}
              </div>
            </div>

            {/* Car SVG - bouncing */}
            <div className="absolute bottom-2 animate-[carBounce_0.5s_ease-in-out_infinite]" style={{left: 'calc(50% - 50px)'}}>
              <svg width="100" height="60" viewBox="0 0 100 60" fill="none">
                {/* Car body */}
                <rect x="5" y="28" width="90" height="22" rx="6" fill="#2563EB"/>
                {/* Car top */}
                <path d="M25 28 L35 12 L70 12 L80 28" fill="#3B82F6" stroke="#2563EB" strokeWidth="1.5"/>
                {/* Windows */}
                <path d="M37 14 L30 26 L52 26 L52 14 Z" fill="#BFDBFE" opacity="0.9"/>
                <path d="M54 14 L54 26 L75 26 L68 14 Z" fill="#BFDBFE" opacity="0.9"/>
                {/* Headlight */}
                <rect x="89" y="33" width="6" height="6" rx="2" fill="#FCD34D"/>
                {/* Taillight */}
                <rect x="5" y="33" width="5" height="5" rx="2" fill="#EF4444"/>
                {/* Front wheel */}
                <circle cx="75" cy="50" r="9" fill="#1E293B"/>
                <circle cx="75" cy="50" r="4" fill="#94A3B8">
                  <animateTransform attributeName="transform" type="rotate" from="0 75 50" to="360 75 50" dur="0.5s" repeatCount="indefinite"/>
                </circle>
                {/* Rear wheel */}
                <circle cx="28" cy="50" r="9" fill="#1E293B"/>
                <circle cx="28" cy="50" r="4" fill="#94A3B8">
                  <animateTransform attributeName="transform" type="rotate" from="0 28 50" to="360 28 50" dur="0.5s" repeatCount="indefinite"/>
                </circle>
                {/* Exhaust smoke */}
                <circle cx="2" cy="45" r="3" fill="#D1D5DB" opacity="0.6">
                  <animate attributeName="cx" values="2;-12;-25" dur="1s" repeatCount="indefinite"/>
                  <animate attributeName="r" values="2;4;6" dur="1s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.6;0.3;0" dur="1s" repeatCount="indefinite"/>
                </circle>
                <circle cx="2" cy="45" r="2" fill="#D1D5DB" opacity="0.4">
                  <animate attributeName="cx" values="2;-8;-18" dur="1s" begin="0.3s" repeatCount="indefinite"/>
                  <animate attributeName="cy" values="45;40;36" dur="1s" begin="0.3s" repeatCount="indefinite"/>
                  <animate attributeName="r" values="1.5;3;5" dur="1s" begin="0.3s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.4;0.2;0" dur="1s" begin="0.3s" repeatCount="indefinite"/>
                </circle>
              </svg>
            </div>
          </div>

          {/* Loading text with animated dots */}
          <div className="text-xl font-semibold text-gray-600 flex items-center">
            Đang tải dữ liệu
            <span className="inline-flex w-8 ml-1">
              <span className="animate-[dotBlink_1.4s_infinite_0s]">.</span>
              <span className="animate-[dotBlink_1.4s_infinite_0.2s]">.</span>
              <span className="animate-[dotBlink_1.4s_infinite_0.4s]">.</span>
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-2">Vui lòng đợi trong giây lát</p>

          {/* Inline keyframes */}
          <style>{`
            @keyframes carBounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-3px); }
            }
            @keyframes slideLeft {
              from { transform: translateX(0); }
              to { transform: translateX(-36px); }
            }
            @keyframes slideRight {
              from { transform: translateX(-100px); }
              to { transform: translateX(calc(100vw + 100px)); }
            }
            @keyframes dotBlink {
              0%, 20% { opacity: 0; }
              50% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
    );
  }

  if (state.error) {
      // Don't show full-screen red error if it's just a missing configuration or uninitialized client
      // Let the user see the Login screen (and facility selector) so they can fix it
      const isConfigError = state.error.includes('Supabase client chưa được khởi tạo') || state.error.includes('Lỗi khởi tạo cấu hình');
      
      if (!isConfigError) {
          return (
            <div className="flex justify-center items-center h-screen bg-red-50 text-red-900 p-4">
                <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full border-l-8 border-red-600">
                    <h2 className="text-3xl font-bold mb-4 text-red-700 flex items-center">
                        <svg className="w-8 h-8 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Đã có lỗi xảy ra
                    </h2>
                    <div className="whitespace-pre-wrap font-mono text-sm bg-gray-100 p-4 rounded border border-gray-300">
                        {state.error}
                    </div>
                    <div className="mt-6 text-right">
                        <button 
                            onClick={() => window.location.reload()} 
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded shadow-lg transition-transform transform hover:scale-105"
                        >
                            Tải lại trang
                        </button>
                    </div>
                </div>
            </div>
        );
      }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 font-sans">
      <Header />
      <main className="flex-grow p-2 md:p-6">
        {user ? <Dashboard /> : <Login />}
      </main>
      <footer className="text-center py-4 text-sm text-gray-500 bg-white shadow-inner mt-auto">
            Made by Duong Minh Vinh
      </footer>
    </div>
  );
};

export default App;
