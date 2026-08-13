
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
        <div className="flex justify-center items-center h-screen bg-gray-100 flex-col">
             <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-xl font-semibold text-gray-700">Đang tải dữ liệu...</div>
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
