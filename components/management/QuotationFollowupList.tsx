import React, { useState, useEffect } from 'react';
import * as apiService from '../../services/apiService';
import { QuotationFollowup, QuotationFollowupStatus, Role } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface QuotationFollowupListProps {
  advisorId?: string;
  readOnly?: boolean;
  onCreateAppointment?: (followup: QuotationFollowup) => void;
}

const QuotationFollowupList: React.FC<QuotationFollowupListProps> = ({
  advisorId,
  readOnly = false,
  onCreateAppointment,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<QuotationFollowup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Tất cả');

  // Edit Note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');

  // Chỉ cho phép chỉnh sửa/cập nhật/xóa nếu là CVDV nhận xe đó
  const canEditItem = (item: QuotationFollowup) => {
    if (readOnly) return false;
    if (user?.role !== Role.ServiceAdvisor) return false;
    const userId = String(user?.id || '').trim().toLowerCase();
    const userName = String(user?.name || '').trim().toLowerCase();
    const itemAdvId = String(item.advisorId || '').trim().toLowerCase();
    const itemAdvName = String(item.advisorName || '').trim().toLowerCase();
    return (itemAdvId && itemAdvId === userId) || (itemAdvName && itemAdvName === userName);
  };

  const isCVDV = !readOnly && user?.role === Role.ServiceAdvisor;

  const loadData = async () => {
    try {
      setError('');
      const followups = await apiService.fetchQuotationFollowups(advisorId);
      setData(followups || []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách báo giá chờ xử lý.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [advisorId]);

  // Derived State
  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus =
      filterStatus === 'Tất cả' || item.followupStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const countPending = data.filter(i => i.followupStatus === QuotationFollowupStatus.Pending).length;
  const countApproved = data.filter(i => i.followupStatus === QuotationFollowupStatus.Approved).length;
  const countScheduled = data.filter(i => i.followupStatus === QuotationFollowupStatus.Scheduled).length;

  // Handlers
  const handleStatusChange = async (id: string, newStatus: QuotationFollowupStatus) => {
    try {
      await apiService.updateQuotationFollowup(id, { followupStatus: newStatus });
      setSuccess('Đã cập nhật trạng thái thành công.');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật trạng thái.');
    }
  };

  const handleSaveNote = async (id: string) => {
    try {
      await apiService.updateQuotationFollowup(id, { notes: editNoteContent });
      setSuccess('Đã cập nhật ghi chú thành công.');
      setEditingNoteId(null);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu ghi chú.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa mục này khỏi danh sách theo dõi?')) {
      try {
        await apiService.deleteQuotationFollowup(id);
        setSuccess('Đã xóa thành công.');
        loadData();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: any) {
        setError(err.message || 'Lỗi khi xóa.');
      }
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case QuotationFollowupStatus.Pending:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case QuotationFollowupStatus.Approved:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case QuotationFollowupStatus.Scheduled:
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-2">
            <span>📝</span>
            <span>Danh Sách Xe Báo Giá Chờ Xử Lý</span>
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            {isCVDV
              ? 'Theo dõi và gọi lại đặt hẹn cho các xe đã đến lấy báo giá của bạn.'
              : 'Danh sách tổng hợp các xe đến lấy báo giá (Chế độ xem).'}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center space-x-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold px-3 py-1.5 rounded-xl shadow-sm text-xs transition disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 3v3L19 6" />
          </svg>
          <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3.5 rounded-r-xl text-xs sm:text-sm text-red-700 font-bold">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-3.5 rounded-r-xl text-xs sm:text-sm text-green-700 font-bold">
          {success}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-yellow-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-3 rounded-xl text-yellow-600">🟡</div>
            <div className="font-bold text-gray-700">Chờ duyệt</div>
          </div>
          <div className="text-2xl font-extrabold text-yellow-600">{countPending}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">🔵</div>
            <div className="font-bold text-gray-700">Đã duyệt</div>
          </div>
          <div className="text-2xl font-extrabold text-blue-600">{countApproved}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-green-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-xl text-green-600">🟢</div>
            <div className="font-bold text-gray-700">Đã đặt hẹn</div>
          </div>
          <div className="text-2xl font-extrabold text-green-600">{countScheduled}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm theo biển số, tên khách hàng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue outline-none"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue outline-none bg-white font-medium"
          >
            <option value="Tất cả">Tất cả trạng thái</option>
            <option value={QuotationFollowupStatus.Pending}>Chờ duyệt</option>
            <option value={QuotationFollowupStatus.Approved}>Đã duyệt</option>
            <option value={QuotationFollowupStatus.Scheduled}>Đã đặt hẹn</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/80 border-b border-gray-200 text-xs font-extrabold text-gray-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-12">STT</th>
                <th className="py-3.5 px-4">Biển số xe</th>
                <th className="py-3.5 px-4">Khách hàng</th>
                <th className="py-3.5 px-4">Thông tin xe</th>
                <th className="py-3.5 px-4">Ngày BG</th>
                {!advisorId && <th className="py-3.5 px-4">Cố vấn</th>}
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Ghi chú</th>
                {isCVDV && <th className="py-3.5 px-4 text-center">Hành động</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={isCVDV ? (advisorId ? 8 : 9) : (advisorId ? 7 : 8)} className="text-center py-8 text-gray-400">
                    <div className="flex justify-center items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-brand-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Đang tải dữ liệu...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={isCVDV ? (advisorId ? 8 : 9) : (advisorId ? 7 : 8)} className="text-center py-8 text-gray-500">
                    Không tìm thấy dữ liệu nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => {
                  const editable = canEditItem(item);
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4 text-center text-gray-500">{index + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-extrabold text-brand-blue bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                          {item.licensePlate}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{item.customerName}</div>
                        <div className="text-xs text-gray-500">{item.customerPhone || 'Không có SĐT'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{item.carModel}</div>
                        <div className="text-xs text-gray-500">{item.jobType}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(item.quotationDate).toLocaleDateString('vi-VN')}
                      </td>
                      {!advisorId && (
                        <td className="py-3 px-4 text-gray-900">{item.advisorName}</td>
                      )}
                      <td className="py-3 px-4">
                        {editable ? (
                          <select
                            value={item.followupStatus}
                            onChange={(e) => handleStatusChange(item.id, e.target.value as QuotationFollowupStatus)}
                            className={`text-xs font-bold px-2 py-1.5 rounded-full border outline-none ${getStatusBadgeClass(item.followupStatus)}`}
                          >
                            <option value={QuotationFollowupStatus.Pending}>{QuotationFollowupStatus.Pending}</option>
                            <option value={QuotationFollowupStatus.Approved}>{QuotationFollowupStatus.Approved}</option>
                            <option value={QuotationFollowupStatus.Scheduled}>{QuotationFollowupStatus.Scheduled}</option>
                          </select>
                        ) : (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadgeClass(item.followupStatus)}`}>
                            {item.followupStatus}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingNoteId === item.id ? (
                          <div className="flex flex-col gap-1 min-w-[150px]">
                            <textarea
                              className="w-full text-xs p-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-brand-blue outline-none"
                              value={editNoteContent}
                              onChange={(e) => setEditNoteContent(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => setEditingNoteId(null)} className="text-[10px] px-2 py-1 bg-gray-100 rounded text-gray-600 font-bold hover:bg-gray-200">Hủy</button>
                              <button onClick={() => handleSaveNote(item.id)} className="text-[10px] px-2 py-1 bg-brand-blue text-white rounded font-bold hover:bg-blue-800">Lưu</button>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative">
                            <p className="text-xs text-gray-600 max-w-[150px] line-clamp-2">
                              {item.notes || <span className="text-gray-400 italic">Chưa có ghi chú</span>}
                            </p>
                            {editable && (
                              <button
                                onClick={() => {
                                  setEditingNoteId(item.id);
                                  setEditNoteContent(item.notes || '');
                                }}
                                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 bg-white shadow-sm border border-gray-200 p-1 rounded text-xs text-blue-600 hover:text-blue-800"
                                title="Sửa ghi chú"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      {isCVDV && (
                        <td className="py-3 px-4">
                          {editable ? (
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => onCreateAppointment && onCreateAppointment(item)}
                                className="bg-brand-blue hover:bg-blue-800 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs transition flex items-center shadow-sm"
                                title="Đặt hẹn ngay"
                              >
                                📅 Đặt hẹn
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-2 py-1.5 rounded-lg text-xs transition"
                                title="Xóa"
                              >
                                🗑️
                              </button>
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 text-xs italic">
                              Chỉ xem
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 flex justify-center items-center space-x-2">
              <svg className="animate-spin h-5 w-5 text-brand-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Đang tải dữ liệu...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Không tìm thấy dữ liệu nào phù hợp.
            </div>
          ) : (
            filteredData.map((item) => {
              const editable = canEditItem(item);
              return (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-brand-blue bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 text-base sm:text-lg">
                      {item.licensePlate}
                    </span>
                    {editable ? (
                      <select
                        value={item.followupStatus}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as QuotationFollowupStatus)}
                        className={`text-xs font-bold px-2 py-1 rounded border outline-none ${getStatusBadgeClass(item.followupStatus)}`}
                      >
                        <option value={QuotationFollowupStatus.Pending}>{QuotationFollowupStatus.Pending}</option>
                        <option value={QuotationFollowupStatus.Approved}>{QuotationFollowupStatus.Approved}</option>
                        <option value={QuotationFollowupStatus.Scheduled}>{QuotationFollowupStatus.Scheduled}</option>
                      </select>
                    ) : (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadgeClass(item.followupStatus)}`}>
                        {item.followupStatus}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500 block text-xs">Khách hàng</span>
                      <span className="font-bold text-gray-900">{item.customerName}</span>
                      <div className="text-xs text-gray-600">{item.customerPhone || 'Không có SĐT'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Xe & Dịch vụ</span>
                      <span className="font-bold text-gray-900">{item.carModel}</span>
                      <div className="text-xs text-gray-600">{item.jobType}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Ngày Báo Giá</span>
                      <span className="font-semibold text-gray-800">{new Date(item.quotationDate).toLocaleDateString('vi-VN')}</span>
                    </div>
                    {!advisorId && (
                      <div>
                        <span className="text-gray-500 block text-xs">Cố vấn</span>
                        <span className="font-semibold text-gray-800">{item.advisorName}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-gray-500 block text-xs mb-1">Ghi chú:</span>
                    {editingNoteId === item.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none"
                          value={editNoteContent}
                          onChange={(e) => setEditNoteContent(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingNoteId(null)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 font-bold text-sm">Hủy</button>
                          <button onClick={() => handleSaveNote(item.id)} className="px-3 py-1.5 bg-brand-blue text-white rounded-lg font-bold text-sm">Lưu</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded flex-1">
                          {item.notes || <span className="text-gray-400 italic">Chưa có ghi chú...</span>}
                        </p>
                        {editable && (
                          <button
                            onClick={() => {
                              setEditingNoteId(item.id);
                              setEditNoteContent(item.notes || '');
                            }}
                            className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 rounded"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {editable && (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => onCreateAppointment && onCreateAppointment(item)}
                        className="flex-1 bg-brand-blue hover:bg-blue-800 text-white font-bold py-2 rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-1"
                      >
                        📅 Đặt hẹn ngay
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-xl text-sm transition"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default QuotationFollowupList;
