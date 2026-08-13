import React, { useMemo, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Job, JobStatus, JobType } from '../../types';

const VehiclesInWorkshop: React.FC = () => {
    const { state } = useApp();
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

    const activeVehicles = useMemo(() => {
        const vehicleMap = new Map<string, Job[]>();

        // Group jobs by license plate
        state.jobs.forEach(job => {
            if (!vehicleMap.has(job.licensePlate)) {
                vehicleMap.set(job.licensePlate, []);
            }
            vehicleMap.get(job.licensePlate)!.push(job);
        });

        const activeList: any[] = [];

        const getPauseReason = (jsonData?: string) => {
            if (!jsonData) return '';
            try {
                const parsed = JSON.parse(jsonData);
                if (parsed.pauseReason === 'Khác') {
                    return parsed.customPauseReason || 'Khác';
                }
                return parsed.pauseReason || '';
            } catch {
                return '';
            }
        };

        vehicleMap.forEach((jobs, licensePlate) => {
            // Sort jobs by start time to find the latest one
            jobs.sort((a, b) => {
                const timeA = a.actualStartTime ? new Date(a.actualStartTime).getTime() : new Date(a.plannedStartTime).getTime();
                const timeB = b.actualStartTime ? new Date(b.actualStartTime).getTime() : new Date(b.plannedStartTime).getTime();
                return timeB - timeA; // Descending
            });

            const latestJob = jobs[0];
            const firstJob = jobs[jobs.length - 1]; // The very first job in the chain

            // Check if the latest job is in one of the requested statuses
            const isActive = [
                JobStatus.Arrived,
                JobStatus.TicketOpened,
                JobStatus.Waiting,
                JobStatus.InProgress,
                JobStatus.Paused
            ].includes(latestJob.status);

            if (isActive) {
                // Find reception time (prioritize actualArrivalTime)
                const receptionTime = latestJob.actualArrivalTime || firstJob.actualArrivalTime || latestJob.actualStartTime || firstJob.actualStartTime || latestJob.plannedStartTime;
                
                // Find expected delivery time (from the latest job)
                const expectedDeliveryTime = latestJob.plannedEndTime;

                activeList.push({
                    licensePlate: latestJob.licensePlate,
                    carModel: latestJob.carModel,
                    customerName: latestJob.customerName || 'Khách vãng lai',
                    jobType: latestJob.jobType,
                    status: latestJob.status,
                    pauseReason: getPauseReason(latestJob.jsonData),
                    receptionTime: new Date(receptionTime),
                    expectedDeliveryTime: new Date(expectedDeliveryTime),
                });
            }
        });

        return activeList;
    }, [state.jobs]);

    const handleFilterChange = (header: string, value: string) => {
        setColumnFilters(prev => ({
            ...prev,
            [header]: value
        }));
    };

    const renderTable = (title: string, jobs: any[]) => {
        if (jobs.length === 0) return null;

        const headers = [
            { key: 'licensePlate', label: 'Biển số xe' },
            { key: 'carModel', label: 'Loại xe' },
            { key: 'customerName', label: 'Tên khách hàng' },
            { key: 'jobType', label: 'Loại hình' },
            { key: 'status', label: 'Trạng thái' },
            { key: 'pauseReason', label: 'Lý do dừng (nếu có)' },
            { key: 'receptionTime', label: 'Thời gian tiếp nhận' },
            { key: 'expectedDeliveryTime', label: 'Dự kiến giao xe' },
        ];

        const filteredJobs = jobs.filter(job => {
            return headers.every(({ key }) => {
                const filterValue = columnFilters[`${title}-${key}`];
                if (!filterValue) return true;
                
                let cellValue = '';
                if (key === 'receptionTime' || key === 'expectedDeliveryTime') {
                    cellValue = job[key].toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
                } else {
                    cellValue = String(job[key] || '');
                }
                
                return cellValue.toLowerCase().includes(filterValue.toLowerCase());
            });
        });

        return (
            <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-brand-blue pl-2">{title} ({filteredJobs.length} xe)</h3>
                <div className="bg-white shadow rounded-lg overflow-x-auto">
                    <table className="min-w-full leading-normal">
                        <thead>
                            <tr>
                                {headers.map(({ key, label }) => (
                                    <th key={key} className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        <div className="flex flex-col space-y-2">
                                            <span>{label}</span>
                                            <input 
                                                type="text" 
                                                placeholder="Lọc..." 
                                                value={columnFilters[`${title}-${key}`] || ''}
                                                onChange={(e) => handleFilterChange(`${title}-${key}`, e.target.value)}
                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-brand-blue font-normal"
                                            />
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.map((job, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-5 py-4 border-b border-gray-200 text-sm font-medium text-gray-900">{job.licensePlate}</td>
                                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-gray-700">{job.carModel}</td>
                                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-gray-700">{job.customerName}</td>
                                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-gray-700">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                            job.jobType === JobType.BodyAndPaint ? 'bg-purple-100 text-purple-800' :
                                            job.jobType === JobType.ScheduledMaintenance ? 'bg-green-100 text-green-800' :
                                            job.jobType === JobType.Warranty ? 'bg-amber-100 text-amber-800' :
                                            'bg-blue-100 text-blue-800'
                                        }`}>
                                            {job.jobType}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-gray-700">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                            job.status === JobStatus.InProgress ? 'bg-blue-100 text-blue-800' :
                                            job.status === JobStatus.Paused ? 'bg-red-100 text-red-800' :
                                            job.status === JobStatus.Waiting ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-gray-700 font-medium italic">
                                        {job.pauseReason || '-'}
                                    </td>
                                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-gray-700">
                                        {job.receptionTime.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </td>
                                    <td className="px-5 py-4 border-b border-gray-200 text-sm text-gray-700">
                                        {job.expectedDeliveryTime.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </td>
                                </tr>
                            ))}
                            {filteredJobs.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-5 py-4 border-b border-gray-200 text-sm text-center text-gray-500">
                                        Không tìm thấy xe nào phù hợp với bộ lọc.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const bodyAndPaintJobs = activeVehicles.filter(j => j.jobType === JobType.BodyAndPaint);
    const maintenanceJobs = activeVehicles.filter(j => j.jobType === JobType.ScheduledMaintenance);
    const repairJobs = activeVehicles.filter(j => j.jobType === JobType.Repair);
    const warrantyJobs = activeVehicles.filter(j => j.jobType === JobType.Warranty);

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Danh sách xe đang ở xưởng</h2>
            
            {activeVehicles.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                    Hiện tại không có xe nào đang ở xưởng.
                </div>
            ) : (
                <>
                    {renderTable('Nhóm Đồng sơn', bodyAndPaintJobs)}
                    {renderTable('Nhóm Bảo dưỡng định kỳ', maintenanceJobs)}
                    {renderTable('Nhóm Sửa chữa chung', repairJobs)}
                    {renderTable('Nhóm Bảo hành', warrantyJobs)}
                </>
            )}
        </div>
    );
};

export default VehiclesInWorkshop;
