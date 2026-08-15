
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import Timeline from '../common/Timeline';
import BodyShopCalendar from '../common/BodyShopCalendar';
import JobAssignmentModal from '../modals/JobAssignmentModal';
import { BayType, JobType, Role, Job, Bay, JobStatus } from '../../types';
import TimelineFilter from '../common/TimelineFilter';
import { useJobFilter } from '../../hooks/useJobFilter';
import AppointmentSchedule from '../common/AppointmentSchedule';
import TimelineLegend from '../common/TimelineLegend';
import VehiclesInWorkshop from '../common/VehiclesInWorkshop';
import ReportGenerator from '../management/ReportGenerator';
import { useSlaMonitor } from '../../hooks/useSlaMonitor';
import SlaAlertModal from '../modals/SlaAlertModal';
import JobForm from '../forms/JobForm';
import PausedJobsList from '../common/PausedJobsList';

const GeneralManagerDashboard: React.FC = () => {
  const { state, dispatch, addJob, updateJob } = useApp();
  const { user } = useAuth();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [resumedJobIds, setResumedJobIds] = useState<Set<string>>(new Set());
  
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [jobToReschedule, setJobToReschedule] = useState<Job | null>(null);

  const [initialAssignmentData, setInitialAssignmentData] = useState<{ bayId: string; actualStartTime: Date } | null>(null);

  const [activeTab, setActiveTab] = useState('general');
  
  const generalJobs = useMemo(() => state.jobs.filter(j => j.jobType !== JobType.BodyAndPaint), [state.jobs]);
  
  const bodyShopJobs = useMemo(() => state.jobs.filter(j => 
    j.jobType === JobType.BodyAndPaint && 
    j.status !== JobStatus.FreeInspection && 
    j.status !== JobStatus.Quotation
  ), [state.jobs]);

  const { filteredJobs, filters, setFilters, resetFilters } = useJobFilter(generalJobs);
  
  const { violatingJobs } = useSlaMonitor(state.jobs, user);

  const handleSlaUpdate = async (job: Job, newTime: Date) => {
      const oldStart = new Date(job.plannedStartTime).getTime();
      const oldEnd = new Date(job.plannedEndTime).getTime();
      const duration = oldEnd - oldStart;
      const newEndTime = new Date(newTime.getTime() + duration);
      
      await updateJob({ ...job, plannedStartTime: newTime, plannedEndTime: newEndTime });
  };

  const handleAssignNow = (job: Job) => {
      setSelectedJob(job);
  };

  const handleReschedule = (job: Job) => {
      setJobToReschedule(job);
      setIsJobFormOpen(true);
  };

  const isFullScreen = state.isTimelineFullScreen;

  useEffect(() => {
    const newResumedJobIds = new Set(resumedJobIds);
    let changed = false;
    for (const jobId of newResumedJobIds) {
        const hasContinuationInState = state.jobs.some(cont => cont.continuationOfJobId === jobId);
        if (hasContinuationInState) {
            newResumedJobIds.delete(jobId);
            changed = true;
        }
    }
    if (changed) {
        setResumedJobIds(newResumedJobIds);
    }
  }, [state.jobs, resumedJobIds]);

  const handleToggleFullScreen = () => {
      dispatch({ type: 'SET_TIMELINE_FULLSCREEN', payload: !isFullScreen });
  };

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleJobClick = (job: Job) => {
    if (job.isAppointment && (job.status === JobStatus.Appointment || job.status === JobStatus.Arrived)) {
        return;
    }
    
    const forbiddenStatuses: JobStatus[] = [
        JobStatus.RepairComplete,
        JobStatus.Washing,
        JobStatus.Ready,
        JobStatus.Paused,
    ];

    if (forbiddenStatuses.includes(job.status)) {
        return;
    }
    setSelectedJob(job);
    setInitialAssignmentData(null);
  };
  
  const handleTimelineDrop = (job: Job, bayId: string, startTime: Date) => {
      setSelectedJob(job);
      setInitialAssignmentData({
          bayId: bayId,
          actualStartTime: startTime
      });
  };
  
  const handleCloseModal = () => {
    setSelectedJob(null);
    setInitialAssignmentData(null);
  };

  const handleResumeJob = async (jobToResume: Job) => {
    if (!jobToResume.bayId) {
        alert("Công việc này không có thông tin khoang. Không thể tiếp tục.");
        return;
    }

    const unfinishedJobInBay = state.jobs.find(j => 
        j.bayId === jobToResume.bayId &&
        j.id !== jobToResume.id &&
        j.status === JobStatus.InProgress
    );
    
    if (unfinishedJobInBay) {
        alert(`Không thể tiếp tục! Khoang "${jobToResume.bayId}" đang bận với xe ${unfinishedJobInBay.licensePlate}.`);
        return;
    }

    const now = new Date();
    const originalDuration = jobToResume.plannedEndTime.getTime() - jobToResume.plannedStartTime.getTime();

    const newContinuationJob: Job = {
        ...jobToResume,
        id: crypto.randomUUID(),
        status: JobStatus.InProgress,
        actualStartTime: now,
        plannedStartTime: now,
        plannedEndTime: new Date(now.getTime() + originalDuration),
        actualEndTime: undefined,
        continuationOfJobId: jobToResume.id,
        isAppointment: false,
        appointmentTime: undefined,
    };

    setResumedJobIds(prev => new Set(prev).add(jobToResume.id));

    try {
        await addJob(newContinuationJob);
    } catch (e) {
        alert(`Lỗi khi tiếp tục công việc: ${(e as Error).message}`);
        setResumedJobIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(jobToResume.id);
            return newSet;
        });
    }
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
                    bays={state.bays.filter(b => b.type === BayType.General || b.type === BayType.CarWash)} 
                    jobs={filteredJobs} 
                    onJobClick={handleJobClick} 
                    onJobDrop={handleTimelineDrop}
                    displayDate={filters.date} 
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
        )
      }
      return (
        <div className="flex flex-col">
            <div className="flex justify-end mb-2">
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
  
  const renderContent = () => {
    switch(activeTab) {
        case 'general':
            return renderTimelineView();
        case 'bodyshop':
            return <BodyShopCalendar jobs={bodyShopJobs} onJobClick={handleJobClick} />;
        case 'paused_jobs':
            const pausedJobs = state.jobs.filter(j => 
                j.status === JobStatus.Paused && 
                !state.jobs.some(cont => cont.continuationOfJobId === j.id) &&
                !resumedJobIds.has(j.id)
            );
            return <PausedJobsList jobs={pausedJobs} onResume={handleResumeJob} />;
        case 'appointments':
            return <AppointmentSchedule jobs={state.jobs} onJobClick={handleJobClick} showPhoneNumber={true} />;
        case 'vehicles_in_workshop':
            return <VehiclesInWorkshop />;
        case 'reports':
            return <ReportGenerator />;
        default:
            return null;
    }
  };
  
  const getBaysForJob = (job: Job | null): Bay[] => {
      if (!job) return [];
      if (job.jobType === JobType.BodyAndPaint) {
          return state.bays.filter(b => b.type === BayType.BodyShop);
      }
      return state.bays.filter(b => b.type === BayType.General);
  }
  
  if (isFullScreen && activeTab === 'general') {
    return (
      <>
        {!selectedJob && !isJobFormOpen && (
          <SlaAlertModal jobs={violatingJobs} userRole={user!.role} onUpdateJobTime={handleSlaUpdate} onAssignNow={handleAssignNow} onReschedule={handleReschedule} />
        )}
        {renderTimelineView()}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {!selectedJob && !isJobFormOpen && (
        <SlaAlertModal jobs={violatingJobs} userRole={user!.role} onUpdateJobTime={handleSlaUpdate} onAssignNow={handleAssignNow} onReschedule={handleReschedule} />
      )}
      {selectedJob && (
        <JobAssignmentModal 
            job={selectedJob} 
            bays={getBaysForJob(selectedJob)} 
            onClose={handleCloseModal} 
            initialData={initialAssignmentData}
        />
      )}
      {isJobFormOpen && (
        <JobForm 
          existingJob={jobToReschedule} 
          onClose={() => {
              setIsJobFormOpen(false);
              setJobToReschedule(null);
          }} 
        />
      )}
       <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Xin chào Quản Đốc, {user?.name}!</h1>
       </div>
       
       <div>
         <div className="grid grid-cols-3 sm:flex gap-1 sm:gap-0 sm:border-b border-gray-300 sm:flex-nowrap mb-2 sm:mb-0">
            <TabButton tabName="general" label="Sửa chữa chung" />
            <TabButton tabName="bodyshop" label="Đồng sơn" />
            <TabButton tabName="paused_jobs" label="Xe dừng CV" />
            <TabButton tabName="appointments" label="Lịch hẹn" />
            <TabButton tabName="vehicles_in_workshop" label="Xe đang ở xưởng" />
            <TabButton tabName="reports" label="Báo cáo" />
         </div>
         <div className="p-4 bg-white rounded-b-lg rounded-r-lg border border-t-0 border-gray-300">
            {renderContent()}
         </div>
       </div>
    </div>
  );
};

export default GeneralManagerDashboard;
