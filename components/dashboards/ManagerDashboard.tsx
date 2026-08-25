
import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import Timeline from '../common/Timeline';
import BodyShopCalendar from '../common/BodyShopCalendar';
import UserManagement from '../management/UserManagement';
import BayManagement from '../management/BayManagement';
import ReportGenerator from '../management/ReportGenerator';
import { BayType, JobType, Job, JobStatus } from '../../types';
import TimelineFilter from '../common/TimelineFilter';
import { useJobFilter } from '../../hooks/useJobFilter';
import JobForm from '../forms/JobForm';
import { useAuth } from '../../hooks/useAuth';
import JobDetailModal from '../modals/JobDetailModal';
import AppointmentSchedule from '../common/AppointmentSchedule';
import TimelineLegend from '../common/TimelineLegend';
import VehicleArrival from '../common/VehicleArrival';
import Settings from '../management/Settings';
import VehiclesInWorkshop from '../common/VehiclesInWorkshop';
import PausedJobsList from '../common/PausedJobsList';
import QuotationFollowupList from '../management/QuotationFollowupList';
import type { QuotationFollowup } from '../../types';

import ManagerOverview from './ManagerOverview';

const TabGroup: React.FC<{
    label: string;
    tabs: { name: string; label: string }[];
    activeTab: string;
    setActiveTab: (name: string) => void;
    isOpen: boolean;
    onToggle: () => void;
}> = ({ label, tabs, activeTab, setActiveTab, isOpen, onToggle }) => {
    const activeInGroup = tabs.find(t => t.name === activeTab);
    const isGroupActive = !!activeInGroup;

    return (
        <div className="sm:relative">
            <button
                onClick={onToggle}
                className={`w-full sm:w-auto px-3 py-2 font-medium rounded-lg sm:rounded-t-lg sm:rounded-b-none transition-all duration-200 focus:outline-none flex items-center justify-between sm:justify-start gap-1.5 text-sm ${
                    isGroupActive
                    ? 'bg-blue-50 sm:bg-white text-brand-blue border border-blue-200 sm:border-gray-300 sm:border-b-0 sm:-mb-px font-semibold'
                    : 'bg-gray-50 sm:bg-gray-100 text-gray-600 hover:bg-gray-100 sm:hover:bg-gray-200 border border-gray-200 sm:border-transparent'
                }`}
            >
                <div className="flex items-center gap-1.5">
                    <span>{label}</span>
                    {activeInGroup && (
                        <span className="text-xs bg-blue-100 text-brand-blue px-1.5 py-0.5 rounded-full">
                            {activeInGroup.label}
                        </span>
                    )}
                </div>
                <svg className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {/* Dropdown - desktop only */}
            <div className={`hidden sm:block absolute top-full left-0 z-50 transition-all duration-200 origin-top ${isOpen ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'}`}>
                <div className="bg-white rounded-b-lg rounded-r-lg shadow-lg border border-gray-200 min-w-[200px] py-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.name}
                            onClick={() => { setActiveTab(tab.name); onToggle(); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 flex items-center gap-2 ${
                                activeTab === tab.name
                                ? 'bg-blue-50 text-brand-blue font-semibold'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {activeTab === tab.name && <span className="w-1.5 h-1.5 bg-brand-blue rounded-full flex-shrink-0"></span>}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sub-tabs - mobile only */}
            <div className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-2 gap-1 p-1 bg-white rounded-lg border border-gray-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.name}
                            onClick={() => { setActiveTab(tab.name); onToggle(); }}
                            className={`text-left px-3 py-2 text-xs rounded-md transition-colors duration-150 ${
                                activeTab === tab.name
                                ? 'bg-blue-50 text-brand-blue font-semibold'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};


const ManagerDashboard: React.FC = () => {
    const { state, dispatch, deleteJob } = useApp();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [openGroup, setOpenGroup] = useState<string | null>(null);

    const [isJobFormOpen, setIsJobFormOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [formMode, setFormMode] = useState<'job' | 'appointment' | null>(null);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [initialJobData, setInitialJobData] = useState<Partial<Job> | null>(null);

    const isFullScreen = state.isTimelineFullScreen;

    const handleToggleFullScreen = () => {
        dispatch({ type: 'SET_TIMELINE_FULLSCREEN', payload: !isFullScreen });
    };

    const toggleGroup = (groupName: string) => {
        setOpenGroup(prev => prev === groupName ? null : groupName);
    };

    const generalBays = state.bays.filter(b => b.type === BayType.General || b.type === BayType.CarWash);
    const generalJobs = state.jobs.filter(j => j.jobType !== JobType.BodyAndPaint);
    
    // Filter out FreeInspection and Quotation statuses from Body Shop view
    const bodyShopJobs = state.jobs.filter(j => 
        j.jobType === JobType.BodyAndPaint && 
        j.status !== JobStatus.FreeInspection && 
        j.status !== JobStatus.Quotation
    );

    const { filteredJobs, filters, setFilters, resetFilters } = useJobFilter(generalJobs);

    const handleFilterChange = (filterName: string, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };
    
    const handleJobClick = (job: Job, fromTimeline: boolean = false) => {
        // Khóa việc mở modal chi tiết cho lịch hẹn màu đỏ trực tiếp từ timeline
        if (fromTimeline && job.isAppointment && (job.status === JobStatus.Appointment || job.status === JobStatus.Arrived)) {
            return;
        }
        setSelectedJob(job);
        setIsDetailModalOpen(true);
    };

    const handleEditRequest = (job: Job) => {
        setIsDetailModalOpen(false);
        setSelectedJob(job);
        setInitialJobData(null);
        setFormMode(job.isAppointment ? 'appointment' : 'job');
        setIsJobFormOpen(true);
    };

    const handleDeleteRequest = async (job: Job) => {
        try {
            await deleteJob(job.id);
            setIsDetailModalOpen(false);
            setSelectedJob(null);
        } catch (e) {
            alert("Lỗi khi xóa: " + (e as Error).message);
        }
    };

    const handleLaneClick = (bayId: string, startTime: Date) => {
        const now = new Date();
        const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        if (startTime < fourHoursLater) {
        alert('Không thể đặt hẹn trong vòng 4 tiếng kể từ bây giờ.');
        return;
        }
        setSelectedJob(null);
        setInitialJobData({ bayId, plannedStartTime: startTime, status: JobStatus.Appointment, advisorName: user?.name });
        setFormMode('appointment');
        setIsJobFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsJobFormOpen(false);
        setIsDetailModalOpen(false);
        setSelectedJob(null);
        setInitialJobData(null);
        setFormMode(null);
    }

    const handleCreateAppointmentFromQuotation = (followup: QuotationFollowup) => {
        setSelectedJob(null);
        setInitialJobData({
            licensePlate: followup.licensePlate,
            customerName: followup.customerName,
            customerPhone: followup.customerPhone || '',
            carModel: followup.carModel,
            vin: followup.vin || '',
            jobType: followup.jobType as any,
            advisorName: followup.advisorName,
            km: followup.km || 0,
            status: JobStatus.Appointment,
            isAppointment: true,
        });
        setFormMode('appointment');
        setIsJobFormOpen(true);
    };

    const renderGeneralRepairView = () => {
        const timelineView = (
            <>
                <TimelineLegend />
                <TimelineFilter
                    jobs={generalJobs}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onReset={resetFilters}
                />
                <div className={isFullScreen ? 'flex-grow' : ''}>
                    <Timeline 
                        bays={generalBays} 
                        jobs={filteredJobs} 
                        onJobClick={(job) => handleJobClick(job, true)}
                        displayDate={filters.date}
                        onLaneClick={handleLaneClick}
                        isFullScreen={isFullScreen}
                    />
                </div>
            </>
        );

        return (
            <>
                <div className="flex justify-end mb-2">
                    <button onClick={handleToggleFullScreen} className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition duration-200">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15m-6 0L3.75 20.25m16.5-16.5L15 9" />
                        </svg>
                        Toàn màn hình
                    </button>
                </div>
                {timelineView}
            </>
        );
    }
    
    if (isFullScreen && activeTab === 'general_repair') {
        return (
            <div className="fixed inset-0 bg-white z-50 p-4 flex flex-col">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-gray-800">Bảng tiến độ Sửa chữa chung</h2>
                    <button onClick={handleToggleFullScreen} className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition duration-200">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25" />
                        </svg>
                        Thoát
                    </button>
                </div>
                <TimelineLegend />
                <TimelineFilter
                    jobs={generalJobs}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onReset={resetFilters}
                />
                <div className="flex-grow mt-4">
                     <Timeline 
                        bays={generalBays} 
                        jobs={filteredJobs} 
                        onJobClick={(job) => handleJobClick(job, true)}
                        displayDate={filters.date}
                        onLaneClick={handleLaneClick}
                        isFullScreen={isFullScreen}
                    />
                </div>
            </div>
        )
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return <ManagerOverview onNavigateTab={setActiveTab} />;
            case 'general_repair':
                return renderGeneralRepairView();
            case 'vehicle_arrival':
                return <VehicleArrival />;
            case 'body_shop':
                return <BodyShopCalendar jobs={bodyShopJobs} onJobClick={(job) => handleJobClick(job, false)} />;
            case 'appointments':
                return <AppointmentSchedule jobs={state.jobs} onJobClick={(job) => handleJobClick(job, false)} showPhoneNumber={true} />;
            case 'user_management':
                return <UserManagement />;
            case 'bay_management':
                return <BayManagement />;
            case 'reports':
                return <ReportGenerator />;
            case 'settings':
                return <Settings />;
            case 'vehicles_in_workshop':
                return <VehiclesInWorkshop />;
            case 'paused_jobs':
                const pausedJobs = state.jobs.filter(j => 
                    j.status === JobStatus.Paused && 
                    !state.jobs.some(cont => cont.continuationOfJobId === j.id)
                );
                return <PausedJobsList jobs={pausedJobs} showResumeButton={false} />;
            case 'quotation_followup':
                return <QuotationFollowupList readOnly={true} />;
            default:
                return null;
        }
    }

    return (
        <div className="space-y-6">
            {isJobFormOpen && (
                <JobForm 
                existingJob={selectedJob} 
                onClose={handleCloseForm}
                isAppointmentMode={formMode === 'appointment'}
                initialData={initialJobData}
                />
            )}
            {isDetailModalOpen && selectedJob && (
                <JobDetailModal
                    job={selectedJob}
                    onClose={() => {
                        setIsDetailModalOpen(false);
                        setSelectedJob(null);
                    }}
                    onEdit={handleEditRequest}
                    onDelete={handleDeleteRequest}
                />
            )}
             <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Chào mừng Manager!</h1>
            <div>
                <div className="flex flex-col sm:flex-row sm:border-b border-gray-300 sm:flex-nowrap sm:items-end gap-1.5 sm:gap-1 mb-2 sm:mb-0">
                    {/* Nhóm 1: Tiến độ */}
                    <TabGroup label="📊 Tiến độ" activeTab={activeTab} setActiveTab={setActiveTab} isOpen={openGroup === 'progress'} onToggle={() => toggleGroup('progress')} tabs={[
                        { name: 'overview', label: 'Tổng quan' },
                        { name: 'general_repair', label: 'Sửa chữa chung' },
                        { name: 'body_shop', label: 'Đồng sơn' },
                    ]} />

                    {/* Nhóm 2: Quản lý xe */}
                    <TabGroup label="🚗 Quản lý xe" activeTab={activeTab} setActiveTab={setActiveTab} isOpen={openGroup === 'vehicles'} onToggle={() => toggleGroup('vehicles')} tabs={[
                        { name: 'vehicle_arrival', label: 'Xe tới xưởng' },
                        { name: 'appointments', label: 'Lịch hẹn' },
                        { name: 'paused_jobs', label: 'Xe dừng CV' },
                        { name: 'vehicles_in_workshop', label: 'Xe đang ở xưởng' },
                        { name: 'quotation_followup', label: '📝 Báo giá chờ' },
                    ]} />

                    {/* Nhóm 3: Hệ thống */}
                    <TabGroup label="⚙️ Hệ thống" activeTab={activeTab} setActiveTab={setActiveTab} isOpen={openGroup === 'system'} onToggle={() => toggleGroup('system')} tabs={[
                        { name: 'user_management', label: 'Quản lý nhân viên' },
                        { name: 'bay_management', label: 'Quản lý khoang' },
                        { name: 'reports', label: 'Báo cáo' },
                        { name: 'settings', label: 'Cài đặt' },
                    ]} />
                </div>
                <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                    {renderContent()}
                </div>
            </div>
        </div>
    )
};

export default ManagerDashboard;
