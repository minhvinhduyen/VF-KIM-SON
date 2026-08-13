import React, { useState } from 'react';
import { Job, Role } from '../../types';

interface SlaAlertModalProps {
    jobs: Job[];
    userRole: Role;
    onUpdateJobTime: (job: Job, newTime: Date) => Promise<void>;
    onAssignNow?: (job: Job) => void;
    onReschedule?: (job: Job) => void;
}

const SlaAlertModal: React.FC<SlaAlertModalProps> = ({ jobs, userRole, onUpdateJobTime, onAssignNow, onReschedule }) => {
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const handleExtend = async (job: Job, minutes: number) => {
        setUpdatingId(job.id);
        try {
            const newTime = new Date(new Date().getTime() + minutes * 60000);
            await onUpdateJobTime(job, newTime);
        } finally {
            setUpdatingId(null);
        }
    };

    if (jobs.length === 0) return null;

    const isAdvisor = userRole === Role.ServiceAdvisor;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-80">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center mb-4 text-red-600">
                    <svg className="w-8 h-8 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <h2 className="text-2xl font-bold">Cảnh báo quá hạn thời gian!</h2>
                </div>
                <p className="mb-4 text-gray-700">
                    {isAdvisor 
                        ? 'Các xe sau đã quá thời gian dự kiến. Bạn hãy cập nhật lại thời gian dự kiến nếu xe vẫn còn sửa chữa hoặc báo lại tổ trưởng để hoàn thành công việc.'
                        : 'Các xe sau đã đến giờ dự kiến bắt đầu nhưng chưa được phân công. Vui lòng dời lịch dự kiến hoặc phân công ngay.'}
                </p>
                <div className="space-y-4">
                    {jobs.map(job => {
                        const timeToDisplay = isAdvisor ? job.plannedEndTime : job.plannedStartTime;
                        const timeString = timeToDisplay ? new Date(timeToDisplay).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'}) : 'N/A';
                        
                        return (
                            <div key={job.id} className="border border-red-200 bg-red-50 p-4 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <p className="font-bold text-lg">{job.licensePlate} - {job.customerName}</p>
                                    <p className="text-sm text-gray-600">
                                        {isAdvisor 
                                            ? `Giờ kết thúc dự kiến: ${timeString}`
                                            : `Giờ bắt đầu dự kiến: ${timeString}`}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {isAdvisor ? (
                                        <>
                                            <button 
                                                disabled={updatingId === job.id}
                                                onClick={() => handleExtend(job, 15)}
                                                className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm font-medium disabled:opacity-50"
                                            >
                                                +15 phút
                                            </button>
                                            <button 
                                                disabled={updatingId === job.id}
                                                onClick={() => handleExtend(job, 30)}
                                                className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm font-medium disabled:opacity-50"
                                            >
                                                +30 phút
                                            </button>
                                            <button 
                                                disabled={updatingId === job.id}
                                                onClick={() => handleExtend(job, 60)}
                                                className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm font-medium disabled:opacity-50"
                                            >
                                                +1 giờ
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => onAssignNow && onAssignNow(job)}
                                                className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm font-medium"
                                            >
                                                Phân công ngay
                                            </button>
                                            <button 
                                                onClick={() => onReschedule && onReschedule(job)}
                                                className="px-3 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded text-sm font-medium"
                                            >
                                                Dời lịch dự kiến
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SlaAlertModal;
