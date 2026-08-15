import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../hooks/useApp';
import * as apiService from '../../services/apiService';
import ManagerDashboard from './ManagerDashboard';

interface BranchSummary {
  facilityId: string;
  facilityName: string;
  activeCount: number;
  waitingCount: number;
  appointmentCount: number;
  totalJobs: number;
  baysCount: number;
  revenue: number;
  vehicleVisits: number;
  vehiclesInWorkshop: number;
  completedCount: number;
  onTimeCount: number;
  onTimeRate: number;
  appointmentJobCount: number;
  uniqueJobCount: number;
  appointmentRate: number;
}

interface SlaViolation {
  id: string;
  licensePlate: string;
  carModel: string;
  facilityName: string;
  status: string;
  plannedTime: string;
  delayMinutes: number;
  type: 'overdue_start' | 'overdue_end';
}

interface OverviewData {
  totalActiveJobs: number;
  totalWaitingJobs: number;
  totalAppointments: number;
  totalBays: number;
  totalRevenue: number;
  totalVehicleVisits: number;
  totalVehiclesInWorkshop: number;
  totalOnTimeRate: number;
  totalAppointmentRate: number;
  branchSummaries: BranchSummary[];
  slaViolations: SlaViolation[];
}

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString('vi-VN');
};

const formatFullCurrency = (value: number): string => {
  return value.toLocaleString('vi-VN') + ' đ';
};

const toDateString = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setFacility } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | string>('overview');
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Date range filter — default: 1st of current month to today
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(toDateString(firstOfMonth));
  const [dateTo, setDateTo] = useState(toDateString(now));

  // Load facility list
  useEffect(() => {
    const loadFacilitiesList = async () => {
      try {
        const list = await apiService.fetchFacilities();
        if (user?.managedFacilities) {
          const allowed = list.filter((f: any) => user.managedFacilities?.includes(f.id));
          setFacilities(allowed);
        } else {
          setFacilities(list);
        }
      } catch (e) {
        console.error("Lỗi khi tải danh sách cơ sở:", e);
      }
    };
    loadFacilitiesList();
  }, [user]);

  const loadOverviewData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiService.fetchSuperAdminOverview(dateFrom, dateTo);
      setOverviewData(data);
    } catch (e: any) {
      setError(e.message || 'Không thể tải báo cáo tổng quan.');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverviewData();
    }
  }, [activeTab, loadOverviewData]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (activeTab === 'overview') {
      const interval = setInterval(loadOverviewData, 60000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadOverviewData]);

  const handleTabChange = (tabId: 'overview' | string) => {
    setActiveTab(tabId);
    if (tabId !== 'overview') {
      setFacility(tabId);
    }
  };

  const getSlaBadgeColor = (delay: number) => {
    if (delay > 60) return 'bg-red-100 text-red-800 border-red-200';
    if (delay > 30) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  // Export Excel
  const handleExportExcel = async () => {
    if (!overviewData) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Overview
      const summaryRows = overviewData.branchSummaries.map(b => ({
        'Chi nhánh': b.facilityName,
        'Doanh thu (đ)': b.revenue,
        'Lượt xe': b.vehicleVisits,
        'Xe tồn': b.vehiclesInWorkshop,
        'Đang làm': b.activeCount,
        'Đang chờ': b.waitingCount,
        'Lịch hẹn': b.appointmentCount,
        'Số khoang': b.baysCount,
        'TL Hẹn (%)': b.appointmentRate,
        'TL Đúng hẹn (%)': b.onTimeRate,
      }));
      summaryRows.push({
        'Chi nhánh': 'TỔNG CỘNG',
        'Doanh thu (đ)': overviewData.totalRevenue,
        'Lượt xe': overviewData.totalVehicleVisits,
        'Xe tồn': overviewData.totalVehiclesInWorkshop,
        'Đang làm': overviewData.totalActiveJobs,
        'Đang chờ': overviewData.totalWaitingJobs,
        'Lịch hẹn': overviewData.totalAppointments,
        'Số khoang': overviewData.totalBays,
        'TL Hẹn (%)': overviewData.totalAppointmentRate,
        'TL Đúng hẹn (%)': overviewData.totalOnTimeRate,
      });
      const ws = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Tổng quan chuỗi');

      // Sheet 2: SLA Violations
      if (overviewData.slaViolations.length > 0) {
        const slaRows = overviewData.slaViolations.map(v => ({
          'Biển số': v.licensePlate,
          'Model': v.carModel,
          'Chi nhánh': v.facilityName,
          'Trạng thái': v.status,
          'Trễ (phút)': v.delayMinutes,
          'Loại': v.type === 'overdue_end' ? 'Quá giờ hoàn thành' : 'Chờ làm quá lâu',
        }));
        const ws2 = XLSX.utils.json_to_sheet(slaRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'Vi phạm SLA');
      }

      XLSX.writeFile(wb, `BaoCao_ToanChuoi_${dateFrom}_${dateTo}.xlsx`);
    } catch (e) {
      alert('Lỗi khi xuất Excel: ' + (e as Error).message);
    }
  };

  // --- Branch detail view ---
  if (activeTab !== 'overview') {
    const activeFacilityName = facilities.find(f => f.id === activeTab)?.name || 'Chi nhánh';
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleTabChange('overview')}
              className="flex items-center space-x-2 text-brand-blue hover:text-blue-800 font-bold transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              <span>Quay lại Tổng quan</span>
            </button>
            <span className="text-gray-300">|</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-500">Đang xem:</span>
              <span className="text-sm font-bold bg-blue-50 text-brand-blue px-2.5 py-1 rounded-md">{activeFacilityName}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <select value={activeTab} onChange={(e) => handleTabChange(e.target.value)}
              className="border border-gray-300 rounded px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue font-bold text-gray-700 bg-white cursor-pointer">
              {facilities.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </div>
        </div>
        <div className="flex-1"><ManagerDashboard /></div>
      </div>
    );
  }

  // Max revenue for bar chart scale
  const maxRevenue = overviewData ? Math.max(...overviewData.branchSummaries.map(b => b.revenue), 1) : 1;

  // --- Main Overview ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">HỆ THỐNG BÁO CÁO TOÀN CHUỖI</h1>
          <p className="text-gray-500 mt-1">Xin chào, <span className="font-bold text-brand-blue">{user?.name}</span> (Quản lý chung)</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center flex-wrap gap-3">
          {/* Date range filter */}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm">
            <label className="text-xs font-semibold text-gray-500">Từ:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border-0 text-sm font-bold text-gray-700 focus:outline-none bg-transparent w-[130px]" />
            <span className="text-gray-300 mx-1">&rarr;</span>
            <label className="text-xs font-semibold text-gray-500">Đến:</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border-0 text-sm font-bold text-gray-700 focus:outline-none bg-transparent w-[130px]" />
          </div>
          <button onClick={loadOverviewData} disabled={isLoading}
            className="flex items-center space-x-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold px-4 py-2.5 rounded-lg shadow-sm transition duration-150 disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 3v3L19 6" />
            </svg>
            <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
          <button onClick={handleExportExcel} disabled={!overviewData}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-lg shadow-sm transition duration-150 disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-6 shadow-sm">
          <p className="text-sm font-bold text-red-800">{error}</p>
        </div>
      )}

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {/* Doanh thu */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-4 shadow-lg hover:scale-[1.02] transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-xs font-semibold tracking-wider uppercase">Doanh thu</p>
              <p className="text-2xl font-extrabold mt-1">{formatCurrency(overviewData?.totalRevenue ?? 0)}</p>
              <p className="text-blue-200 text-[10px] mt-1">{formatFullCurrency(overviewData?.totalRevenue ?? 0)}</p>
            </div>
            <span className="text-2xl">💰</span>
          </div>
        </div>
        {/* Luot xe */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-2xl p-4 shadow-lg hover:scale-[1.02] transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-orange-100 text-xs font-semibold tracking-wider uppercase">Lượt xe</p>
              <p className="text-2xl font-extrabold mt-1">{overviewData?.totalVehicleVisits ?? 0}</p>
              <p className="text-orange-200 text-[10px] mt-1">Trong kỳ</p>
            </div>
            <span className="text-2xl">🚗</span>
          </div>
        </div>
        {/* Xe ton */}
        <div className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-4 shadow-lg hover:scale-[1.02] transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-100 text-xs font-semibold tracking-wider uppercase">Xe tồn xưởng</p>
              <p className="text-2xl font-extrabold mt-1">{overviewData?.totalVehiclesInWorkshop ?? 0}</p>
              <p className="text-red-200 text-[10px] mt-1">Hiện tại</p>
            </div>
            <span className="text-2xl">🏭</span>
          </div>
        </div>
        {/* Lich hen */}
        <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-2xl p-4 shadow-lg hover:scale-[1.02] transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 text-xs font-semibold tracking-wider uppercase">Lịch hẹn</p>
              <p className="text-2xl font-extrabold mt-1">{overviewData?.totalAppointments ?? 0}</p>
              <p className="text-green-200 text-[10px] mt-1">Hôm nay</p>
            </div>
            <span className="text-2xl">📅</span>
          </div>
        </div>
        {/* TL Hen */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-4 shadow-lg hover:scale-[1.02] transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-100 text-xs font-semibold tracking-wider uppercase">TL Hẹn</p>
              <p className="text-2xl font-extrabold mt-1">{overviewData?.totalAppointmentRate ?? 0}%</p>
              <p className="text-purple-200 text-[10px] mt-1">Xe có hẹn / Tổng</p>
            </div>
            <span className="text-2xl">📊</span>
          </div>
        </div>
        {/* Dung hen */}
        <div className="bg-gradient-to-br from-teal-500 to-teal-700 text-white rounded-2xl p-4 shadow-lg hover:scale-[1.02] transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-teal-100 text-xs font-semibold tracking-wider uppercase">Đúng hẹn</p>
              <p className="text-2xl font-extrabold mt-1">{overviewData?.totalOnTimeRate ?? 0}%</p>
              <p className="text-teal-200 text-[10px] mt-1">Hoàn thành đúng giờ</p>
            </div>
            <span className="text-2xl">✅</span>
          </div>
        </div>
      </div>

      {/* Revenue bar chart */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">📊 So sánh doanh thu giữa các chi nhánh</h2>
          <p className="text-xs text-gray-400 mt-0.5">Kỳ: {dateFrom} &rarr; {dateTo}</p>
        </div>
        <div className="p-6 space-y-4">
          {overviewData?.branchSummaries.map((b, idx) => {
            const pct = maxRevenue > 0 ? (b.revenue / maxRevenue) * 100 : 0;
            const colors = [
              'from-blue-500 to-blue-600',
              'from-orange-500 to-orange-600',
              'from-green-500 to-green-600',
              'from-purple-500 to-purple-600',
            ];
            const color = colors[idx % colors.length];
            return (
              <div key={b.facilityId} className="flex items-center gap-4">
                <div className="w-28 sm:w-[160px] flex-shrink-0 text-sm font-bold text-gray-700 truncate" title={b.facilityName}>
                  {b.facilityName.replace('Vinfast Kim Sơn ', '')}
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden relative">
                  <div
                    className={`bg-gradient-to-r ${color} h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-3`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  >
                    {pct > 25 && <span className="text-white text-xs font-bold whitespace-nowrap">{formatFullCurrency(b.revenue)}</span>}
                  </div>
                  {pct <= 25 && (
                    <span className="absolute top-1/2 -translate-y-1/2 text-xs font-bold text-gray-600 whitespace-nowrap" style={{ left: `calc(${Math.max(pct, 3)}% + 8px)` }}>
                      {formatFullCurrency(b.revenue)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(!overviewData || overviewData.branchSummaries.length === 0) && (
            <p className="text-center text-gray-400 py-8">Không có dữ liệu</p>
          )}
        </div>
      </div>

      {/* Comparison table + SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Comparison table */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">📋 Chi tiết hiệu suất từng chi nhánh</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3 px-4">Chi nhánh</th>
                  <th className="py-3 px-3 text-center">Doanh thu</th>
                  <th className="py-3 px-3 text-center">Lượt xe</th>
                  <th className="py-3 px-3 text-center">Xe tồn</th>
                  <th className="py-3 px-3 text-center">Đang làm</th>
                  <th className="py-3 px-3 text-center">Đang chờ</th>
                  <th className="py-3 px-3 text-center">Hẹn</th>
                  <th className="py-3 px-3 text-center">TL Hẹn</th>
                  <th className="py-3 px-3 text-center">Đúng hẹn</th>
                  <th className="py-3 px-3 text-center">Khoang</th>
                  <th className="py-3 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-700">
                {overviewData?.branchSummaries.map((b) => (
                  <tr key={b.facilityId} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900 text-xs">{b.facilityName}</td>
                    <td className="py-3 px-3 text-center text-xs font-bold text-blue-700">{formatCurrency(b.revenue)}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full text-xs font-extrabold border border-orange-100">{b.vehicleVisits}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold border ${b.vehiclesInWorkshop > 5 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-700 border-gray-100'}`}>{b.vehiclesInWorkshop}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-extrabold border border-blue-100">{b.activeCount}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-extrabold border border-yellow-100">{b.waitingCount}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-extrabold border border-green-100">{b.appointmentCount}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold border ${b.appointmentRate >= 50 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'}`}>{b.appointmentRate}%</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold border ${b.onTimeRate >= 80 ? 'bg-green-50 text-green-700 border-green-100' : b.onTimeRate >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{b.onTimeRate}%</span>
                    </td>
                    <td className="py-3 px-3 text-center text-gray-500 font-bold text-xs">{b.baysCount}</td>
                    <td className="py-3 px-3 text-center">
                      <button onClick={() => handleTabChange(b.facilityId)}
                        className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-xs shadow-sm hover:shadow transition duration-150">
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                {overviewData && overviewData.branchSummaries.length > 0 && (
                  <tr className="bg-gray-50 font-extrabold border-t-2 border-gray-300">
                    <td className="py-3 px-4 text-gray-900 text-xs">TỔNG CỘNG</td>
                    <td className="py-3 px-3 text-center text-xs text-blue-700">{formatCurrency(overviewData.totalRevenue)}</td>
                    <td className="py-3 px-3 text-center text-xs">{overviewData.totalVehicleVisits}</td>
                    <td className="py-3 px-3 text-center text-xs">{overviewData.totalVehiclesInWorkshop}</td>
                    <td className="py-3 px-3 text-center text-xs">{overviewData.totalActiveJobs}</td>
                    <td className="py-3 px-3 text-center text-xs">{overviewData.totalWaitingJobs}</td>
                    <td className="py-3 px-3 text-center text-xs">{overviewData.totalAppointments}</td>
                    <td className="py-3 px-3 text-center text-xs">{overviewData.totalAppointmentRate}%</td>
                    <td className="py-3 px-3 text-center text-xs">{overviewData.totalOnTimeRate}%</td>
                    <td className="py-3 px-3 text-center text-xs">{overviewData.totalBays}</td>
                    <td className="py-3 px-3"></td>
                  </tr>
                )}
                {(!overviewData || overviewData.branchSummaries.length === 0) && (
                  <tr><td colSpan={11} className="text-center py-8 text-gray-400">Không có dữ liệu xưởng.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SLA Violations */}
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/30">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
              <h2 className="text-lg font-bold text-gray-900">Cảnh báo SLA</h2>
            </div>
            <span className="bg-red-100 text-red-700 text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded border border-red-200">
              Quá giờ
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-[400px]">
            {overviewData?.slaViolations.map((v) => (
              <div key={v.id} className="p-4 hover:bg-red-50/10 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-extrabold text-sm text-gray-900 bg-gray-100 px-2 py-0.5 rounded shadow-sm border border-gray-200">{v.licensePlate}</span>
                    <span className="text-xs text-gray-400 font-bold ml-2">({v.carModel})</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSlaBadgeColor(v.delayMinutes)}`}>
                    Trễ {v.delayMinutes} phút
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Chi nhánh: <span className="text-gray-800">{v.facilityName}</span></span>
                  <span className="text-red-500">
                    {v.type === 'overdue_end' ? 'Quá giờ hoàn thành' : 'Chờ làm quá lâu'}
                  </span>
                </div>
              </div>
            ))}
            {(!overviewData || overviewData.slaViolations.length === 0) && (
              <div className="flex flex-col items-center justify-center h-full py-16 px-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-bold text-green-700 text-center">Không có xe nào bị quá hạn.</p>
                <p className="text-xs text-gray-400 text-center mt-1">Mọi công đoạn đều đúng tiến độ.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
