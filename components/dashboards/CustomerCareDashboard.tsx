
import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import Timeline from '../common/Timeline';
import JobForm from '../forms/JobForm';
import { BayType, JobType, Job, JobStatus } from '../../types';
import TimelineFilter from '../common/TimelineFilter';
import { useJobFilter } from '../../hooks/useJobFilter';
import AppointmentSchedule from '../common/AppointmentSchedule';
import TimelineLegend from '../common/TimelineLegend';
import BodyShopCalendar from '../common/BodyShopCalendar';
import UIOImportModal from '../modals/UIOImportModal';
import VehiclesInWorkshop from '../common/VehiclesInWorkshop';
import ReportGenerator from '../management/ReportGenerator';

const CustomerCareDashboard: React.FC = () => {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('timeline');
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [isUIOModalOpen, setIsUIOModalOpen] = useState(false); // State cho modal UIO
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [initialJobData, setInitialJobData] = useState<Partial<Job> | null>(null);

  const isFullScreen = state.isTimelineFullScreen;
  
  const generalJobs = state.jobs.filter(j => j.jobType !== JobType.BodyAndPaint);
  
  // Filter out FreeInspection and Quotation statuses from Body Shop view
  const bodyShopJobs = state.jobs.filter(j => 
    j.jobType === JobType.BodyAndPaint && 
    j.status !== JobStatus.FreeInspection && 
    j.status !== JobStatus.Quotation
  );


  const handleToggleFullScreen = () => {
      dispatch({ type: 'SET_TIMELINE_FULLSCREEN', payload: !isFullScreen });
  };

  const generalBays = state.bays.filter(b => b.type === BayType.General || b.type === BayType.CarWash);
  
  const { filteredJobs, filters, setFilters, resetFilters } = useJobFilter(generalJobs);

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleAddNewAppointment = () => {
    setSelectedJob(null);
    setInitialJobData({ status: JobStatus.Appointment });
    setIsJobFormOpen(true);
  };
  
  const handleEditAppointment = (job: Job, fromTimeline: boolean = false) => {
    // Khóa việc mở form chỉnh sửa cho lịch hẹn màu đỏ trực tiếp từ timeline
    if (fromTimeline && job.isAppointment && (job.status === JobStatus.Appointment || job.status === JobStatus.Arrived)) {
      return;
    }
    if (!job.isAppointment) {
      alert("Bạn chỉ có thể chỉnh sửa các lịch hẹn.");
      return;
    }
    setSelectedJob(job);
    setInitialJobData(null);
    setIsJobFormOpen(true);
  };

  const handleLaneClick = (bayId: string, startTime: Date) => {
    const now = new Date();
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    if (startTime < fourHoursLater) {
      alert('Không thể đặt hẹn trong vòng 4 tiếng kể từ bây giờ.');
      return;
    }
    setSelectedJob(null);
    setInitialJobData({ bayId, plannedStartTime: startTime, status: JobStatus.Appointment });
    setIsJobFormOpen(true);
  };
  
  const handleCloseForm = () => {
    setIsJobFormOpen(false);
    setInitialJobData(null);
    setSelectedJob(null);
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

  const renderTimelineView = () => {
    const timelineContent = (
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
              onJobClick={(job) => handleEditAppointment(job, true)}
              displayDate={filters.date}
              onLaneClick={handleLaneClick}
              isFullScreen={isFullScreen}
            />
        </div>
      </>
    );

    if (isFullScreen) {
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
            {timelineContent}
        </div>
      );
    }

    return (
       <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Bảng tiến độ Sửa chữa chung</h2>
               <button onClick={handleToggleFullScreen} className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15m-6 0L3.75 20.25m16.5-16.5L15 9" />
                  </svg>
                  Toàn màn hình
              </button>
            </div>
            {timelineContent}
       </div>
    );
  };
  
  if (isFullScreen && activeTab === 'timeline') {
    return renderTimelineView();
  }

  return (
    <div className="space-y-6">
       {isJobFormOpen && (
         <JobForm 
           existingJob={selectedJob} 
           onClose={handleCloseForm} 
           isAppointmentMode={true} 
           initialData={initialJobData} 
         />
        )}
       {isUIOModalOpen && (
         <UIOImportModal onClose={() => setIsUIOModalOpen(false)} />
       )}

       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Xin chào, {user?.name}!</h1>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setIsUIOModalOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            Cập nhật UIO
          </button>
          <button 
            onClick={handleAddNewAppointment}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
          >
            + Thêm lịch hẹn
          </button>
        </div>
       </div>
       
      <div>
        <div className="grid grid-cols-3 sm:flex gap-1 sm:gap-0 sm:border-b border-gray-300 sm:flex-nowrap mb-2 sm:mb-0">
            <TabButton tabName="timeline" label="Bảng tiến độ" />
            <TabButton tabName="bodyshop" label="Đồng sơn" />
            <TabButton tabName="appointments" label="Lịch hẹn" />
            <TabButton tabName="vehicles_in_workshop" label="Xe đang ở xưởng" />
            <TabButton tabName="reports" label="Báo cáo" />
        </div>
        <div>
            {activeTab === 'timeline' && renderTimelineView()}
            {activeTab === 'bodyshop' && (
              <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                <BodyShopCalendar jobs={bodyShopJobs} onJobClick={(job) => handleEditAppointment(job, false)} />
              </div>
            )}
            {activeTab === 'appointments' && (
                <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                    <AppointmentSchedule 
                        jobs={state.jobs}
                        onJobClick={(job) => handleEditAppointment(job, false)}
                        showPhoneNumber={true}
                    />
                </div>
            )}
            {activeTab === 'vehicles_in_workshop' && (
                <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                    <VehiclesInWorkshop />
                </div>
            )}
            {activeTab === 'reports' && (
                <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
                    <ReportGenerator />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default CustomerCareDashboard;
