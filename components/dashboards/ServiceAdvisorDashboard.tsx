
import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import Timeline from '../common/Timeline';
import BodyShopCalendar from '../common/BodyShopCalendar';
import JobForm from '../forms/JobForm';
import { BayType, JobType, Job, JobStatus, isCarWashBay } from '../../types';
import type { QuotationFollowup } from '../../types';
import TimelineFilter from '../common/TimelineFilter';
import { useJobFilter } from '../../hooks/useJobFilter';
import AppointmentSchedule from '../common/AppointmentSchedule';
import TimelineLegend from '../common/TimelineLegend';
import VehicleArrival from '../common/VehicleArrival';
import GatePassModal from '../modals/GatePassModal';
import VehiclesInWorkshop from '../common/VehiclesInWorkshop';
import { useSlaMonitor } from '../../hooks/useSlaMonitor';
import SlaAlertModal from '../modals/SlaAlertModal';
import QuotationFollowupList from '../management/QuotationFollowupList';

const ServiceAdvisorDashboard: React.FC = () => {
  const { state, dispatch, updateJob } = useApp();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general_repair');
  
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [isGatePassModalOpen, setIsGatePassModalOpen] = useState(false); // State for Gate Pass Modal
  const [formMode, setFormMode] = useState<'job' | 'appointment' | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [initialJobData, setInitialJobData] = useState<Partial<Job> | null>(null);

  const isFullScreen = state.isTimelineFullScreen;

  const handleToggleFullScreen = () => {
      dispatch({ type: 'SET_TIMELINE_FULLSCREEN', payload: !isFullScreen });
  };

  const generalBays = state.bays.filter(b => b.type === BayType.General || isCarWashBay(b));
  const generalJobs = state.jobs.filter(j => j.jobType !== JobType.BodyAndPaint);
  
  // Filter out FreeInspection and Quotation statuses from Body Shop view
  const bodyShopJobs = state.jobs.filter(j => 
    j.jobType === JobType.BodyAndPaint && 
    j.status !== JobStatus.FreeInspection && 
    j.status !== JobStatus.Quotation
  );

  const { filteredJobs, filters, setFilters, resetFilters } = useJobFilter(generalJobs);

  const { violatingJobs } = useSlaMonitor(state.jobs, user);

  const handleSlaUpdate = async (job: Job, newTime: Date) => {
      await updateJob({ ...job, plannedEndTime: newTime });
  };

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleJobClick = (job: Job, fromTimeline: boolean = false) => {
    // Khóa việc mở form chỉnh sửa cho lịch hẹn màu đỏ trực tiếp từ timeline
    if (fromTimeline && job.isAppointment && (job.status === JobStatus.Appointment || job.status === JobStatus.Arrived)) {
      return;
    }
    setSelectedJob(job);
    setInitialJobData(null);
    setFormMode(job.isAppointment ? 'appointment' : 'job');
    setIsJobFormOpen(true);
  };
  
  const handleAddNewJob = () => {
    setSelectedJob(null);
    setInitialJobData(null);
    setFormMode('job');
    setIsJobFormOpen(true);
  };

  const handleAddNewAppointment = () => {
    setSelectedJob(null);
    setInitialJobData({ status: JobStatus.Appointment, advisorName: user?.name });
    setFormMode('appointment');
    setIsJobFormOpen(true);
  };

  const handleOpenGatePass = () => {
    setIsGatePassModalOpen(true);
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
    setSelectedJob(null);
    setInitialJobData(null);
    setFormMode(null);
  }

  // Tạo lịch hẹn từ danh sách báo giá (pre-fill thông tin xe)
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

  const TabButton: React.FC<{tabName: string; label: string}> = ({ tabName, label }) => (
    <button
        onClick={() => setActiveTab(tabName)}
        className={`px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-t-lg sm:rounded-b-none transition-colors duration-200 focus:outline-none ${
            activeTab === tabName
            ? 'bg-white text-brand-blue border-gray-300 border-l border-t border-r -mb-px'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
    >
        {label}
    </button>
  );

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
        <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300 flex flex-col">
          <div className="flex justify-end mb-2">
            <button
                onClick={handleToggleFullScreen}
                className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition duration-200"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15m-6 0L3.75 20.25m16.5-16.5L15 9" />
                </svg>
                Toàn màn hình
            </button>
          </div>
          {timelineView}
        </div>
     )
  }
  
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 bg-white z-50 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-2 flex-shrink-0">
            <h2 className="text-2xl font-bold text-gray-800">Bảng tiến độ Sửa chữa chung</h2>
            <button
              onClick={handleToggleFullScreen}
              className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition duration-200"
            >
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

  return (
    <div className="space-y-6">
       {!isJobFormOpen && !isGatePassModalOpen && (
         <SlaAlertModal jobs={violatingJobs} userRole={user!.role} onUpdateJobTime={handleSlaUpdate} />
       )}
       {isJobFormOpen && (
        <JobForm 
          existingJob={selectedJob} 
          onClose={handleCloseForm}
          isAppointmentMode={formMode === 'appointment'}
          initialData={initialJobData}
        />
       )}
       {isGatePassModalOpen && (
         <GatePassModal onClose={() => setIsGatePassModalOpen(false)} />
       )}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
         <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Xin chào, {user?.name}!</h1>
         <div className="flex flex-wrap gap-2">
             <button 
               onClick={handleAddNewAppointment}
               className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
             >
               + Thêm lịch hẹn
             </button>
             <button 
               onClick={handleOpenGatePass}
               className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
             >
               📄 Giấy ra cổng
             </button>
             <button 
               onClick={handleAddNewJob}
               className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
             >
               + Thêm việc mới
             </button>
         </div>
        </div>
       
       <div>
         <div className="grid grid-cols-3 sm:flex gap-1 sm:gap-0 sm:border-b border-gray-300 sm:flex-nowrap mb-2 sm:mb-0">
            <TabButton tabName="general_repair" label="Sửa chữa chung" />
            <TabButton tabName="vehicle_arrival" label="Xe tới xưởng" />
            <TabButton tabName="body_shop" label="Đồng sơn" />
            <TabButton tabName="appointments" label="Lịch hẹn" />
            <TabButton tabName="vehicles_in_workshop" label="Xe đang ở xưởng" />
            <TabButton tabName="quotation_followup" label="📝 Báo giá chờ" />
         </div>
         
            {activeTab === 'general_repair' && renderGeneralRepairView()}
            {activeTab === 'vehicle_arrival' && <VehicleArrival />}
            {activeTab === 'body_shop' && (
              <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                <BodyShopCalendar jobs={bodyShopJobs} onJobClick={(job) => handleJobClick(job, false)} />
              </div>
            )}
            {activeTab === 'appointments' && (
              <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                <AppointmentSchedule jobs={state.jobs} onJobClick={(job) => handleJobClick(job, false)} showPhoneNumber={true} />
              </div>
            )}
            {activeTab === 'vehicles_in_workshop' && (
              <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                <VehiclesInWorkshop />
              </div>
            )}
            {activeTab === 'quotation_followup' && (
              <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                <QuotationFollowupList 
                  advisorId={user?.id}
                  onCreateAppointment={handleCreateAppointmentFromQuotation}
                />
              </div>
            )}
       </div>
    </div>
  );
};

export default ServiceAdvisorDashboard;
