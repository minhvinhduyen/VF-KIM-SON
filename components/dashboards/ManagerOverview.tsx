
import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Job, JobStatus, JobType } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { AlertCircle, Clock, CheckCircle2, TrendingUp, Calendar, Filter } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

type TimeRange = 'today' | 'week' | 'month' | 'all';

const ManagerOverview: React.FC = () => {
  const { state } = useApp();
  const [timeRange, setTimeRange] = useState<TimeRange>('today');

  // Helper to determine if a date is within the selected range
  const isInRange = (date: Date) => {
    const now = new Date();
    const target = new Date(date);
    
    switch (timeRange) {
      case 'today':
        return target.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return target >= weekAgo;
      case 'month':
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return target >= monthAgo;
      case 'all':
        return true;
      default:
        return false;
    }
  };

  // Filtered jobs based on time range
  const filteredJobs = useMemo(() => {
    return state.jobs.filter(j => {
        // Use actualStartTime if available, otherwise plannedStartTime
        const dateToUse = j.actualStartTime || j.plannedStartTime;
        return isInRange(dateToUse);
    });
  }, [state.jobs, timeRange]);

  // Cumulative metrics (independent of time filter)
  const longStayingVehicles = useMemo(() => {
    const now = new Date();
    return state.jobs.filter(j => {
        if (j.status === JobStatus.Exited || j.status === JobStatus.Ready) return false;
        const arrival = j.actualArrivalTime || j.plannedStartTime;
        const diffDays = Math.floor((now.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 3; // More than 3 days
    });
  }, [state.jobs]);

  const pausedJobs = useMemo(() => {
    return state.jobs.filter(j => j.status === JobStatus.Paused);
  }, [state.jobs]);

  // Statistics for charts
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach(j => {
      counts[j.status] = (counts[j.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredJobs]);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach(j => {
      counts[j.jobType] = (counts[j.jobType] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredJobs]);

  // Hourly distribution for Area Chart
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 to 18:00
    const counts: Record<number, number> = {};
    
    hours.forEach(h => counts[h] = 0);
    
    filteredJobs.forEach(j => {
      const date = j.actualArrivalTime || j.plannedStartTime;
      const hour = date.getHours();
      if (counts[hour] !== undefined) {
        counts[hour]++;
      }
    });

    return hours.map(h => ({
      hour: `${h}h`,
      count: counts[h]
    }));
  }, [filteredJobs]);

  // KPI calculations
  const totalJobs = filteredJobs.length;
  const completedJobs = filteredJobs.filter(j => j.status === JobStatus.Ready || j.status === JobStatus.Exited).length;
  const inProgressJobs = filteredJobs.filter(j => j.status === JobStatus.InProgress).length;
  const revenue = filteredJobs.reduce((acc, j) => acc + (j.laborCost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Tổng quan xưởng dịch vụ</h2>
          <p className="text-sm text-gray-500">Xem nhanh tình trạng hoạt động và các vấn đề cần lưu ý</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          {(['today', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                timeRange === range
                  ? 'bg-white text-brand-blue shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range === 'today' ? 'Hôm nay' : range === 'week' ? '7 ngày qua' : range === 'month' ? '30 ngày qua' : 'Tất cả'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium font-sans">Tổng lượt xe</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalJobs}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-green-50 rounded-lg text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium font-sans">Hoàn thành</p>
            <h3 className="text-2xl font-bold text-gray-900">{completedJobs}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium font-sans">Đang sửa chữa</p>
            <h3 className="text-2xl font-bold text-gray-900">{inProgressJobs}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium font-sans">Doanh thu dự kiến</p>
            <h3 className="text-2xl font-bold text-gray-900">{revenue.toLocaleString()}đ</h3>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 font-sans">Trạng thái công việc</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="40%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  layout="vertical" 
                  align="right" 
                  verticalAlign="middle" 
                  iconType="rect"
                  formatter={(value) => <span className="text-sm text-gray-600 font-sans">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 font-sans">Phân loại dịch vụ</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{fill: '#6b7280'}}
                  fontFamily="Inter"
                />
                <YAxis 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{fill: '#6b7280'}}
                  fontFamily="Inter"
                />
                <Tooltip cursor={{fill: '#f9fafb'}} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hourly Distribution Area Chart */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-2">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Biểu đồ lưu lượng xe theo giờ</h3>
                <p className="text-xs text-gray-500">Phân tích khung giờ cao điểm để tối ưu hóa nhân sự và khuyến mãi</p>
            </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="hour" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tick={{fill: '#9ca3af'}} 
              />
              <YAxis 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tick={{fill: '#9ca3af'}} 
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                name="Lượt xe"
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorCount)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Critical Alerts (Cumulative) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              Xe tồn lâu ({longStayingVehicles.length}+ ngày)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-sans">
                <tr>
                  <th className="px-4 py-3 font-medium">Biển số</th>
                  <th className="px-4 py-3 font-medium">Khách hàng</th>
                  <th className="px-4 py-3 font-medium">Ngày vào</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {longStayingVehicles.length > 0 ? (
                  longStayingVehicles.slice(0, 5).map(j => (
                    <tr key={j.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 font-bold text-brand-blue">{j.licensePlate}</td>
                      <td className="px-4 py-4 text-gray-700">{j.customerName}</td>
                      <td className="px-4 py-4 text-gray-500">
                        {(j.actualArrivalTime || j.plannedStartTime).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                          {j.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic font-sans">
                      Không có xe tồn đọng quá lâu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Filter size={18} className="text-orange-500" />
                    Xe dừng sửa chữa
                </h3>
            </div>
            <div className="p-4 space-y-4 flex-grow overflow-auto max-h-[300px]">
                {pausedJobs.length > 0 ? (
                    pausedJobs.map(j => (
                        <div key={j.id} className="p-3 border border-orange-100 bg-orange-50/30 rounded-lg">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-gray-900">{j.licensePlate}</span>
                                <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-bold">PAUSED</span>
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-1">{j.customerName}</p>
                            <p className="text-[11px] text-gray-400 mt-1">Cố vấn: {j.advisorName}</p>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 font-sans py-10">
                        <CheckCircle2 className="mb-2 text-green-200" size={32} />
                        <p className="text-sm">Tất cả xe đang trôi</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerOverview;
