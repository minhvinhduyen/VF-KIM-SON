
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

const ForemanDashboard: React.FC = () => {
  const { state, dispatch, addJob, updateJob } = useApp();
  const { user } = useAuth();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [resumedJobIds, setResumedJobIds] = useState<Set<string>>(new Set());
  
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [jobToReschedule, setJobToReschedule] = useState<Job | null>(null);

  // State mới để lưu dữ liệu đề xuất từ thao tác kéo thả trên Timeline
  const [initialAssignmentData, setInitialAssignmentData] = useState<{ bayId: string; actualStartTime: Date } | null>(null);


  const isForemanSC = user?.role === Role.ForemanSC;
  const isForemanDS = user?.role === Role.ForemanDS;
  
  const [activeTab, setActiveTab] = useState(isForemanSC ? 'timeline' : 'bodyshop');
  
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

  // Effect to clean up the temporary resumedJobIds state once the global state has been updated
  // from the backend, preventing the temporary set from growing indefinitely.
  useEffect(() => {
    const newResumedJobIds = new Set(resumedJobIds);
    let changed = false;
    for (const jobId of newResumedJobIds) {
        // If a continuation job now exists in the main state, we can remove the ID from our temporary set.
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
    // Khóa chức năng double-click cho các lịch hẹn (khối màu đỏ) đối với Tổ trưởng.
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
        return; // Ngăn modal mở cho các trạng thái này đối với Tổ Trưởng
    }
    setSelectedJob(job);
    setInitialAssignmentData(null); // Reset đề xuất nếu mở bằng click
  };
  
  // Handler mới: Khi thả Job trên Timeline (vào làn thực tế)
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

    // Check for any OTHER active, "InProgress" job in the target bay.
    const unfinishedJobInBay = state.jobs.find(j => 
        j.bayId === jobToResume.bayId &&
        j.id !== jobToResume.id &&
        j.status === JobStatus.InProgress
    );
    
    if (unfinishedJobInBay) {
        alert(`Không thể tiếp tục! Khoang "${jobToResume.bayId}" đang bận với xe ${unfinishedJobInBay.licensePlate}.`);
        return;
    }

    // If we reach here, the bay is free. We can resume the job starting from now.
    const now = new Date();
    const originalDuration = jobToResume.plannedEndTime.getTime() - jobToResume.plannedStartTime.getTime();

    const newContinuationJob: Job = {
        // Inherit all relevant details from the paused job
        licensePlate: jobToResume.licensePlate,
        customerName: jobToResume.customerName,
        customerPhone: jobToResume.customerPhone,
        carModel: jobToResume.carModel,
        jobType: jobToResume.jobType,
        advisorName: jobToResume.advisorName,
        bayId: jobToResume.bayId,
        technician: jobToResume.technician,
        useLift: jobToResume.useLift,
        isAppointment: false, // Một công việc tiếp nối không phải là một lịch hẹn.
        appointmentTime: undefined, // Xóa thời gian hẹn cho công việc tiếp nối.
        actualArrivalTime: jobToResume.actualArrivalTime,
        laborCost: jobToResume.laborCost,
        stageHistory: jobToResume.stageHistory,
        bodyShopStage: jobToResume.bodyShopStage,

        // Set new values for this continuation segment
        id: crypto.randomUUID(),
        status: JobStatus.InProgress,
        actualStartTime: now,
        plannedStartTime: now,
        plannedEndTime: new Date(now.getTime() + originalDuration),
        actualEndTime: undefined,
        continuationOfJobId: jobToResume.id,
    };


    // Optimistic UI Update: Hide the job from the paused list immediately.
    setResumedJobIds(prev => new Set(prev).add(jobToResume.id));

    try {
        await addJob(newContinuationJob);
    } catch (e) {
        alert(`Lỗi khi tiếp tục công việc: ${(e as Error).message}`);
        // Revert the optimistic update if the API call fails
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
        className={`px-4 py-2 font-medium rounded-t-lg transition-colors duration-200 focus:outline-none flex-shrink-0 ${
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
                    onJobDrop={handleTimelineDrop} // Pass the drop handler
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
        case 'timeline':
            return isForemanSC ? renderTimelineView() : null;
        case 'bodyshop':
            return isForemanDS ? <BodyShopCalendar jobs={bodyShopJobs} onJobClick={handleJobClick} /> : null;
        case 'paused_jobs':
            const pausedJobs = state.jobs.filter(j => {
                // Common conditions for a job to be considered "paused and resumable"
                const isPausedAndNotContinued = 
                    j.status === JobStatus.Paused && 
                    !state.jobs.some(cont => cont.continuationOfJobId === j.id) &&
                    !resumedJobIds.has(j.id);

                if (!isPausedAndNotContinued) {
                    return false;
                }

                // Role-specific filtering
                if (isForemanSC && j.jobType === JobType.BodyAndPaint) {
                    return false; // SC Foreman does not see Body & Paint jobs
                }
                if (isForemanDS && j.jobType !== JobType.BodyAndPaint) {
                    return false; // DS Foreman does not see General Repair jobs
                }
                
                return true; // The job is relevant for the current foreman
            });
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
  
  if (isFullScreen && isForemanSC && activeTab === 'timeline') {
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
            initialData={initialAssignmentData} // Pass proposed data
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
        <h1 className="text-3xl font-bold text-gray-800">Xin chào Tổ Trưởng, {user?.name}!</h1>
       </div>
       
       <div>
         <div className="flex border-b border-gray-300 overflow-x-auto flex-nowrap scrollbar-none">
            {isForemanSC && <TabButton tabName="timeline" label="Sửa chữa chung" />}
            {isForemanDS && <TabButton tabName="bodyshop" label="Đồng sơn" />}
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

export default ForemanDashboard;
