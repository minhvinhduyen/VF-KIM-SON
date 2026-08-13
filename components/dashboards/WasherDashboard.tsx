
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import { Job, JobStatus } from '../../types';
import ConfirmationModal from '../modals/ConfirmationModal';

const WasherDashboard: React.FC = () => {
    const { state, updateJob } = useApp();
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const washingJobs = useMemo(() => {
        return state.jobs.filter(j => j.status === JobStatus.Washing || (j.status === JobStatus.Ready && j.bayId === 'bay-wash-1'));
    }, [state.jobs]);

    const pendingJobs = useMemo(() => {
        const jobs = washingJobs.filter(j => j.status === JobStatus.Washing);
        
        const isPriority = (j: Job) => {
            if (!j.isAppointment || !j.appointmentTime || !j.actualArrivalTime) return false;
            // "Đúng hẹn": arrives no later than 15 minutes after appointment time
            const limit = new Date(j.appointmentTime.getTime() + 15 * 60 * 1000);
            return j.actualArrivalTime <= limit;
        };

        return [...jobs].sort((a, b) => {
            // Started jobs always stay at top
            if (a.actualStartTime && !b.actualStartTime) return -1;
            if (!a.actualStartTime && b.actualStartTime) return 1;

            const prioA = isPriority(a);
            const prioB = isPriority(b);

            // 1. Appointment priority (if on time)
            if (prioA && !prioB) return -1;
            if (!prioA && prioB) return 1;

            // 2. Among appointments, sort by appointment time
            if (a.isAppointment && b.isAppointment) {
                return (a.appointmentTime?.getTime() || 0) - (b.appointmentTime?.getTime() || 0);
            }

            // 3. FIFO by creation time
            return (a.plannedStartTime?.getTime() || 0) - (b.plannedStartTime?.getTime() || 0);
        });
    }, [washingJobs]);

    const completedJobs = useMemo(() => {
        return washingJobs
            .filter(j => j.status === JobStatus.Ready)
            .sort((a, b) => (b.actualEndTime?.getTime() || 0) - (a.actualEndTime?.getTime() || 0));
    }, [washingJobs]);

    const handleStart = async (job: Job) => {
        await updateJob({
            ...job,
            actualStartTime: new Date(),
        });
    };

    const handleFinish = async (job: Job) => {
        await updateJob({
            ...job,
            status: JobStatus.Ready,
            actualEndTime: new Date(),
        });
    };

    const handleCancelWash = (job: Job) => {
        setModalConfig({
            isOpen: true,
            message: `Bạn có muốn Hủy rửa xe này hay không?`,
            onConfirm: async () => {
                await updateJob({
                    ...job,
                    status: JobStatus.Ready,
                    bayId: null as any // Rời khỏi khoang rửa (Cần null để xóa trong DB)
                });
                setModalConfig(null);
                setNotification(`Đã hoàn tất hủy rửa xe ${job.licensePlate}.`);
                setTimeout(() => setNotification(null), 3000);
            }
        });
    };

    const formatDuration = (start: Date) => {
        const diff = Math.floor((currentTime.getTime() - start.getTime()) / 1000);
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const JobCard: React.FC<{ job: Job }> = ({ job }) => {
        const isStarted = !!job.actualStartTime;
        
        const isPriority = useMemo(() => {
            if (!job.isAppointment || !job.appointmentTime || !job.actualArrivalTime) return false;
            const limit = new Date(job.appointmentTime.getTime() + 15 * 60 * 1000);
            return job.actualArrivalTime <= limit;
        }, [job]);

        return (
            <div className={`p-4 mb-4 rounded-xl shadow-md border-l-8 transition-all ${isStarted ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className={`text-xl font-bold ${isPriority ? 'text-red-600' : 'text-gray-800'}`}>
                            {job.licensePlate} {isPriority && '(Hẹn đúng giờ)'}
                        </h3>
                        <p className="text-gray-600 text-sm">{job.carModel} • {job.customerName}</p>
                    </div>
                    {isStarted && (
                        <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-mono font-bold animate-pulse">
                            {formatDuration(job.actualStartTime!)}
                        </div>
                    )}
                </div>

                <div className="flex items-center text-xs text-gray-500 mb-4 space-x-2">
                    <span className="bg-gray-100 px-2 py-1 rounded">{job.advisorName}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">Vào rửa: {job.plannedStartTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="flex space-x-3">
                    {!isStarted ? (
                        <>
                            <button 
                                onClick={() => handleStart(job)}
                                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition active:scale-95"
                            >
                                Bắt đầu rửa
                            </button>
                            <button 
                                onClick={() => handleCancelWash(job)}
                                className="flex-[1] bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition active:scale-95 text-sm"
                                title="Khách hủy rửa xe"
                            >
                                Hủy rửa
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => handleFinish(job)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition active:scale-95"
                        >
                            Kết thúc rửa
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col max-w-lg mx-auto">
            {/* Header */}
            <div className="bg-brand-blue p-4 text-white shadow-lg sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">Khu Vực Rửa Xe</h1>
                    <div className="text-xs opacity-80 text-right">
                        Chào {user?.name}<br/>
                        {currentTime.toLocaleTimeString('vi-VN')}
                    </div>
                </div>
                
                <div className="flex p-1 bg-white/20 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition ${activeTab === 'pending' ? 'bg-white text-brand-blue' : 'text-white'}`}
                    >
                        Chờ rửa / Đang rửa ({pendingJobs.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('completed')}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition ${activeTab === 'completed' ? 'bg-white text-brand-blue' : 'text-white'}`}
                    >
                        Đã xong ({completedJobs.length})
                    </button>
                </div>
            </div>

            {/* List View */}
            <div className="p-4 flex-grow">
                {activeTab === 'pending' ? (
                    pendingJobs.length > 0 ? (
                        pendingJobs.map(job => <JobCard key={job.id} job={job} />)
                    ) : (
                        <div className="text-center py-20 text-gray-400">
                            <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            Không có xe đang chờ rửa
                        </div>
                    )
                ) : (
                    completedJobs.length > 0 ? (
                        completedJobs.map(job => (
                            <div key={job.id} className="bg-white p-4 mb-4 rounded-xl shadow-sm border-l-8 border-green-500 opacity-75">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-lg">{job.licensePlate}</h3>
                                    <span className="text-xs text-green-600 font-bold">Hoàn thành lúc: {job.actualEndTime?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-xs text-gray-500">{job.carModel} • {job.customerName}</p>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 text-gray-400">Chưa có xe nào hoàn thành</div>
                    )
                )}
            </div>
            {/* Notification Toast */}
            {notification && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-xl animate-bounce">
                    {notification}
                </div>
            )}

            {/* Confirmation Modal */}
            {modalConfig?.isOpen && (
                <ConfirmationModal 
                    message={modalConfig.message}
                    onConfirm={modalConfig.onConfirm}
                    onCancel={() => setModalConfig(null)}
                />
            )}
        </div>
    );
};

export default WasherDashboard;
