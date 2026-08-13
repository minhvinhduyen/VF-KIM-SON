
import React, { useState, useEffect, useRef } from 'react';
import type { Bay, Job } from '../../types';
import { JobStatus, BayType, Role, JobType } from '../../types';
import JobBlock from './JobBlock';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';

interface TimelineProps {
  bays: Bay[];
  jobs: Job[]; // This now includes both active jobs and appointments
  onJobClick: (job: Job) => void;
  displayDate: string;
  onLaneClick?: (bayId: string, startTime: Date) => void;
  onJobDrop?: (job: Job, bayId: string, startTime: Date) => void; // NEW PROP
  isFullScreen?: boolean;
}

const WORK_START_HOUR = 7;
const WORK_END_HOUR = 21;
const LUNCH_START_HOUR = 12.0;
const LUNCH_END_HOUR = 13.0;
const TOTAL_HOURS = WORK_END_HOUR - WORK_START_HOUR;
const BAY_LABEL_WIDTH_PX = 144; // Corresponds to w-36 (9rem * 16px/rem)

interface DraggingState {
  job: Job;
  offsetX: number; // Offset of click from the element's left edge
  jobDurationMs: number;
}

interface ResizingState {
  job: Job;
  edge: 'left' | 'right';
  initialMouseX: number;
  initialJobRect: DOMRect;
  gridRect: DOMRect;
}

const TimeIndicator: React.FC<{ displayDate: string }> = ({ displayDate }) => {
  const [position, setPosition] = useState(-1);

  const toYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const isToday = toYYYYMMDD(new Date()) === displayDate;

  useEffect(() => {
    if (!isToday) {
      setPosition(-1);
      return;
    }

    const updatePosition = () => {
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60;
      const percentage = ((hours - WORK_START_HOUR) / TOTAL_HOURS) * 100;
      if (percentage >= 0 && percentage <= 100) {
        setPosition(percentage);
      } else {
        setPosition(-1);
      }
    };
    updatePosition();
    const interval = setInterval(updatePosition, 60000);
    return () => clearInterval(interval);
  }, [isToday, displayDate]);

  if (position < 0) return null;

  return (
    <div
      className="absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
      style={{ left: `${position}%` }}
    >
      <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
    </div>
  );
};

const Timeline: React.FC<TimelineProps> = ({ bays, jobs, onJobClick, displayDate, onLaneClick, onJobDrop, isFullScreen = false }) => {
  const { state, updateJob } = useApp(); // Sử dụng `state` để kiểm tra xung đột toàn diện
  const { user } = useAuth();
  const timelineGridRef = useRef<HTMLDivElement>(null); // Ref for the grid area
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

  const [draggingState, setDraggingState] = useState<DraggingState | null>(null);
  const [resizingState, setResizingState] = useState<ResizingState | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const canSchedule = user?.role === Role.ServiceAdvisor || user?.role === Role.CustomerCare || user?.role === Role.Manager;

  const getPositionAndWidth = (start: Date, end: Date) => {
    const dayViewStart = new Date(`${displayDate}T00:00:00`);
    dayViewStart.setHours(WORK_START_HOUR, 0, 0, 0);
    
    const dayViewEnd = new Date(`${displayDate}T00:00:00`);
    dayViewEnd.setHours(WORK_END_HOUR, 0, 0, 0);

    const effectiveStart = start < dayViewStart ? dayViewStart : start;
    const effectiveEnd = end > dayViewEnd ? dayViewEnd : end;
    
    if (effectiveStart >= effectiveEnd) {
        return { left: 0, width: 0 };
    }

    const startTime = effectiveStart.getHours() + effectiveStart.getMinutes() / 60;
    const endTime = effectiveEnd.getHours() + effectiveEnd.getMinutes() / 60;
    
    const left = Math.max(0, ((startTime - WORK_START_HOUR) / TOTAL_HOURS) * 100);
    const width = Math.min(100 - left, ((endTime - startTime) / TOTAL_HOURS) * 100);
    return { left, width };
  };
  
  const handleDragStart = (job: Job, e: React.MouseEvent<HTMLDivElement>) => {
    // SECURITY: Nếu chưa đăng nhập, chặn hoàn toàn thao tác kéo
    if (!user) return;

    // CẬP NHẬT: Cho phép mọi nhân viên kéo thả các công việc chưa bắt đầu thực tế (Lịch hẹn/Dự kiến)
    // Giữ nguyên logic chặn kéo các công việc đã bắt đầu thực tế (trừ khi là người có quyền).
    if (job.actualStartTime) {
         if (user?.role !== Role.ServiceAdvisor && user?.role !== Role.ForemanSC && user?.role !== Role.Manager) {
            return;
         }
    }

    e.preventDefault();
    if (!timelineGridRef.current) return;

    const jobDurationMs = job.plannedEndTime.getTime() - job.plannedStartTime.getTime();
    const rect = e.currentTarget.getBoundingClientRect();
    const gridRect = timelineGridRef.current.getBoundingClientRect();
    
    const offsetX = e.clientX - rect.left;
    const initialLeft = rect.left - gridRect.left;
    const initialTop = rect.top - gridRect.top;

    const jobHeight = rect.height;
    const margin = 2; // 2px gap
    const ghostTop = initialTop - (jobHeight + margin); // Position Above
    
    setDraggingState({
        job,
        jobDurationMs,
        offsetX,
    });
    
    setGhostPosition({
        top: ghostTop,
        left: initialLeft,
        width: rect.width,
    });
  };

    const handleResizeStart = (job: Job, edge: 'left' | 'right', e: React.MouseEvent<HTMLDivElement>) => {
        // SECURITY: Nếu chưa đăng nhập, chặn hoàn toàn thao tác co dãn
        if (!user) return;

        if (job.status === JobStatus.RepairComplete || job.status === JobStatus.Washing || job.status === JobStatus.Ready) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (!timelineGridRef.current) return;

        const jobElement = e.currentTarget.parentElement!;
        const initialJobRect = jobElement.getBoundingClientRect();
        const gridRect = timelineGridRef.current.getBoundingClientRect();

        const initialTopInGrid = initialJobRect.top - gridRect.top;
        const initialLeftInGrid = initialJobRect.left - gridRect.left;
        const jobHeight = initialJobRect.height;
        const margin = 2; // 2px gap
        const newTop = initialTopInGrid - (jobHeight + margin);
        
        setResizingState({
            job,
            edge,
            initialMouseX: e.clientX,
            initialJobRect: initialJobRect,
            gridRect: gridRect,
        });
        
        setGhostPosition({
            top: newTop,
            left: initialLeftInGrid,
            width: initialJobRect.width,
        });
    };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (resizingState) {
        const { edge, initialMouseX, initialJobRect, gridRect } = resizingState;
        const deltaX = e.clientX - initialMouseX;
        const minWidthPx = 20;

        const initialLeftPx = initialJobRect.left - gridRect.left;
        const initialRightPx = initialJobRect.right - gridRect.left;

        let newLeftPx = initialLeftPx;
        let newRightPx = initialRightPx;

        if (edge === 'left') {
            newLeftPx = initialLeftPx + deltaX;
            if (newLeftPx > newRightPx - minWidthPx) {
                newLeftPx = newRightPx - minWidthPx;
            }
        } else { // 'right'
            newRightPx = initialRightPx + deltaX;
            if (newRightPx < newLeftPx + minWidthPx) {
                newRightPx = newLeftPx + minWidthPx;
            }
        }

        newLeftPx = Math.max(0, newLeftPx);
        newRightPx = Math.min(gridRect.width, newRightPx);
        
        if (newRightPx - newLeftPx < minWidthPx) {
           if (edge === 'left') {
               newLeftPx = newRightPx - minWidthPx;
           } else {
               newRightPx = newLeftPx + minWidthPx;
           }
        }
        // When resizing, only left and width change. Top position remains from handleResizeStart.
        setGhostPosition(prev => prev ? { ...prev, left: newLeftPx, width: newRightPx - newLeftPx } : null);
        return;
    }

    if (!draggingState || !timelineGridRef.current) return;

    const gridRect = timelineGridRef.current.getBoundingClientRect();
    
    // This part of the logic is for when the user is actively dragging the job to a new lane.
    // The ghost should snap to the target lane to show where it will be dropped.
    let newLeft = e.clientX - gridRect.left - draggingState.offsetX;
    
    // CẬP NHẬT: Snap (hút) về thời gian cũ nếu sai số < 10 phút để dễ dàng đổi khoang
    const percentLeft = (newLeft / gridRect.width) * 100;
    const hoursFromStart = (percentLeft / 100) * TOTAL_HOURS;
    const newStartHour = WORK_START_HOUR + hoursFromStart;
    const tempStartTime = new Date(`${displayDate}T00:00:00`);
    tempStartTime.setHours(Math.floor(newStartHour), (newStartHour % 1) * 60, 0, 0);
    
    const originalStartTime = new Date(draggingState.job.plannedStartTime);
    if (Math.abs(tempStartTime.getTime() - originalStartTime.getTime()) < 10 * 60 * 1000) {
        const originalHoursFromStart = originalStartTime.getHours() + originalStartTime.getMinutes() / 60 - WORK_START_HOUR;
        newLeft = (originalHoursFromStart / TOTAL_HOURS) * gridRect.width;
    }

    const mouseY = e.clientY - gridRect.top;
    
    const bayRowHeight = isFullScreen && bays.length > 0 ? gridRect.height / bays.length : 128;
    const laneHeight = bayRowHeight / 2;
    const ghostHeight = isFullScreen ? 32 : 48; // h-8 : h-12 in pixels

    const bayIndex = Math.max(0, Math.min(bays.length - 1, Math.floor(mouseY / bayRowHeight)));
    const yInBay = mouseY % bayRowHeight;
    const isTTLane = yInBay >= laneHeight;
    const bayTopOffset = bayIndex * bayRowHeight;
    const laneTopOffset = bayTopOffset + (isTTLane ? laneHeight : 0);
    const centeredGhostTop = laneTopOffset + (laneHeight - ghostHeight) / 2;
    
    setGhostPosition(prev => prev ? {...prev, left: newLeft, top: centeredGhostTop } : null);
  };
  
  const handleMouseUp = async (e: React.MouseEvent<HTMLDivElement>) => {
    // Luôn lọc để chỉ làm việc với các công việc sửa chữa chung
    const generalJobs = state.jobs.filter(j => j.jobType !== JobType.BodyAndPaint);
    
    // CẤU HÌNH: Kiểm tra quy tắc 4 tiếng cho Lịch hẹn
    // CẬP NHẬT: Chỉ áp dụng nếu là nguồn gốc lịch hẹn VÀ trạng thái vẫn là 'Hẹn'
    const validateFourHourRule = (startTime: Date, job: Job) => {
        // Nếu không phải nguồn gốc lịch hẹn, hoặc trạng thái không còn là Hẹn (đã đến/tiếp nhận/làm), bỏ qua quy tắc
        if (!job.isAppointment || job.status !== JobStatus.Appointment) return true;
        
        // CẬP NHẬT: Nếu thời gian bắt đầu không thay đổi (chỉ đổi khoang), bỏ qua quy tắc 4 tiếng
        if (startTime.getTime() === new Date(job.plannedStartTime).getTime()) return true;

        const now = new Date();
        const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        
        // Nếu startTime < now + 4h -> Báo lỗi
        if (startTime < fourHoursLater) {
            alert(`QUY TẮC AN TOÀN:\nKhông thể thay đổi lịch hẹn vào thời điểm sớm hơn 4 tiếng kể từ bây giờ.\nVui lòng chọn thời gian sau: ${fourHoursLater.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`);
            return false;
        }
        return true;
    };

    if (resizingState) {
        const { job, gridRect } = resizingState;
        const currentGhostPosition = ghostPosition;
        
        setResizingState(null);
        setGhostPosition(null);

        if (currentGhostPosition && timelineGridRef.current) {
            const gridWidth = gridRect.width;
            const percentLeft = (currentGhostPosition.left / gridWidth) * 100;
            const percentWidth = (currentGhostPosition.width / gridWidth) * 100;
            const startHoursFromWorkStart = (percentLeft / 100) * TOTAL_HOURS;
            const newStartHour = WORK_START_HOUR + startHoursFromWorkStart;
            const durationHours = (percentWidth / 100) * TOTAL_HOURS;

            const newStartTime = new Date(`${displayDate}T00:00:00`);
            newStartTime.setHours(Math.floor(newStartHour), (newStartHour % 1) * 60, 0, 0);
            
            const newEndTime = new Date(newStartTime.getTime() + durationHours * 60 * 60 * 1000);

            // KIỂM TRA QUY TẮC 4 TIẾNG KHI RESIZE
            if (!validateFourHourRule(newStartTime, job)) return;

            // Conflict check: resizing jobs should not conflict with any *actual* (TT) jobs.
            const conflictingJob = generalJobs.find(j => {
                // Exclude self, jobs in other bays.
                if (j.id === job.id || j.bayId !== job.bayId) return false;
                // We only care about conflicts with jobs on the TT lane.
                if (!j.actualStartTime) return false;
                
                const existingJobStart = j.actualStartTime;
                const existingJobEnd = j.actualEndTime 
                    ? j.actualEndTime 
                    : new Date(j.actualStartTime!.getTime() + (j.plannedEndTime.getTime() - j.plannedStartTime.getTime()));
                
                return newStartTime < existingJobEnd && newEndTime > existingJobStart;
            });

            if (conflictingJob) {
                alert(`Không thể thay đổi! Thời gian mới bị trùng với công việc thực tế của xe ${conflictingJob.licensePlate}.`);
                return; 
            }
            
            let updatedJob: Job = { ...job };
            if (job.actualStartTime) { // Resizing a TT job
                const newDurationMs = newEndTime.getTime() - newStartTime.getTime();
                updatedJob.actualStartTime = newStartTime;
                updatedJob.actualEndTime = undefined;
                updatedJob.plannedStartTime = newStartTime; 
                updatedJob.plannedEndTime = new Date(newStartTime.getTime() + newDurationMs);
            } else { // Resizing a DK job
                updatedJob.plannedStartTime = newStartTime;
                updatedJob.plannedEndTime = newEndTime;
                if (job.isAppointment) {
                    updatedJob.appointmentTime = newStartTime; // Cập nhật luôn giờ hẹn
                }
            }
            
            await updateJob(updatedJob);
        }
        return;
    }

    if (!draggingState || !timelineGridRef.current) {
        if(ghostPosition) setGhostPosition(null);
        return;
    };
    
    const currentDraggingState = draggingState;
    setDraggingState(null);
    setGhostPosition(null);

    const gridRect = timelineGridRef.current.getBoundingClientRect();
    const finalLeftInGrid = e.clientX - gridRect.left - currentDraggingState.offsetX;
    const clampedLeft = Math.max(0, Math.min(finalLeftInGrid, gridRect.width));
    const percentLeft = (clampedLeft / gridRect.width) * 100;
    const hoursFromStart = (percentLeft / 100) * TOTAL_HOURS;
    const newStartHour = WORK_START_HOUR + hoursFromStart;

    let newStartTime = new Date(`${displayDate}T00:00:00`);
    newStartTime.setHours(Math.floor(newStartHour), (newStartHour % 1) * 60, 0, 0);
    
    // CẬP NHẬT: Nếu sai số thời gian < 10 phút so với giờ cũ, tự động giữ nguyên giờ cũ (giúp việc đổi khoang dễ dàng hơn)
    const originalStartTime = new Date(currentDraggingState.job.plannedStartTime);
    if (Math.abs(newStartTime.getTime() - originalStartTime.getTime()) < 10 * 60 * 1000) {
        newStartTime = originalStartTime;
    }

    const newEndTime = new Date(newStartTime.getTime() + currentDraggingState.jobDurationMs);
    
    const finalTop = e.clientY - gridRect.top;
    const bayRowHeight = isFullScreen && bays.length > 0 ? gridRect.height / bays.length : 128;
    const bayIndex = Math.max(0, Math.min(bays.length - 1, Math.floor(finalTop / bayRowHeight)));
    const targetBay = bays[bayIndex];

    if (targetBay && targetBay.type === BayType.CarWash) {
        alert("Không thể phân công thủ công cho Khoang Rửa Xe.\n\nCông việc rửa xe sẽ được tự động tạo và xếp hàng sau khi một công việc sửa chữa được 'Hoàn thành SC'.");
        return; // Prevent the assignment
    }

    const yInBay = finalTop % bayRowHeight;
    const targetIsTT = yInBay > (bayRowHeight / 2);

    if (targetBay) {
        let updatedJob: Job = {
            ...currentDraggingState.job,
            bayId: targetBay.id,
            technician: targetBay.technician,
        };
        
        // KIỂM TRA QUY TẮC 4 TIẾNG KHI KÉO THẢ (DRAG)
        if (!validateFourHourRule(newStartTime, updatedJob)) return;

        if((user?.role === Role.ForemanSC || user?.role === Role.Manager) && targetIsTT) {
             // Check for any job that is currently "InProgress" in the target bay.
            const unfinishedJobInBay = generalJobs.find(j =>
                j.bayId === targetBay.id &&
                j.status === JobStatus.InProgress &&
                j.id !== updatedJob.id
            );

            if (unfinishedJobInBay) {
                alert(`Vui lòng kết thúc công việc xe có biển số ${unfinishedJobInBay.licensePlate} ( đang thực hiện trước đó)`);
                return; // Stop the assignment
            }

            // --- THAY ĐỔI: Sử dụng Callback thay vì Update ngay lập tức ---
            // Nếu có callback onJobDrop (được truyền từ Dashboard), gọi nó để mở Modal
            if (onJobDrop) {
                onJobDrop(updatedJob, targetBay.id, newStartTime);
                return; // DỪNG LẠI TẠI ĐÂY, không gọi updateJob
            }

             if (targetBay.name.includes('mềm')) {
                const technicianName = window.prompt("Vui lòng nhập tên Kỹ thuật viên cho khoang mềm:");
                if (!technicianName || technicianName.trim() === '') {
                    alert("Phải nhập tên Kỹ thuật viên. Phân công đã bị hủy.");
                    return; // Hủy thao tác thả
                }
                updatedJob.technician = technicianName.trim();
            }
             const conflictingJob = generalJobs.find(j => {
                if (j.id === updatedJob.id || j.bayId !== targetBay.id || !j.actualStartTime) {
                    return false;
                }
                const existingJobStart = new Date(j.actualStartTime);
                const existingJobDuration = new Date(j.plannedEndTime).getTime() - new Date(j.plannedStartTime).getTime();
                const existingJobEnd = j.actualEndTime
                    ? new Date(j.actualEndTime)
                    : new Date(existingJobStart.getTime() + existingJobDuration);
                
                return newStartTime < existingJobEnd && newEndTime > existingJobStart;
            });

            if (conflictingJob) {
                 alert(`Không thể phân công! Khoang này đã có công việc với xe ${conflictingJob.licensePlate}.`);
            } else {
                // FALLBACK: Nếu không có onJobDrop (ví dụ view cũ), vẫn lưu như bình thường
                updatedJob.status = JobStatus.InProgress;
                updatedJob.actualStartTime = newStartTime;
                updatedJob.actualEndTime = undefined;
                updatedJob.plannedStartTime = newStartTime;
                updatedJob.plannedEndTime = newEndTime;
                await updateJob(updatedJob);
            }
        } else {
            // Logic cho dòng Dự kiến (Giữ nguyên)
            const conflictingTTJob = generalJobs.find(j => {
                if (j.bayId !== targetBay.id || !j.actualStartTime) {
                    return false;
                }
                if (j.id === currentDraggingState.job.id) return false;

                const existingTTJobStart = new Date(j.actualStartTime);
                const existingTTJobEnd = j.actualEndTime
                    ? new Date(j.actualEndTime)
                    : new Date(new Date(j.actualStartTime).getTime() + (new Date(j.plannedEndTime).getTime() - new Date(j.plannedStartTime).getTime()));
                
                return newStartTime < existingTTJobEnd && newEndTime > existingTTJobStart;
            });

            if (conflictingTTJob) {
                alert("Công việc thực tế ở khoang chưa hoàn thành");
                return; // Prevent the update
            }
            updatedJob.plannedStartTime = newStartTime;
            updatedJob.plannedEndTime = newEndTime;
            
            if (updatedJob.isAppointment) {
                updatedJob.appointmentTime = newStartTime; // Cập nhật luôn giờ hẹn
            }

            await updateJob(updatedJob);
        }
    }
  };
  
  const handleDkLaneClick = (bayId: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (!onLaneClick || !canSchedule) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentClicked = (clickX / rect.width) * 100;
    
    const hoursFromStart = (percentClicked / 100) * TOTAL_HOURS;
    const clickedHour = WORK_START_HOUR + hoursFromStart;
    
    const clickedTime = new Date(`${displayDate}T00:00:00`);
    clickedTime.setHours(Math.floor(clickedHour), (clickedHour % 1) * 60, 0, 0);

    onLaneClick(bayId, clickedTime);
  };

  // Auto-scroll to evening hours if current time is past 5 PM (17:00)
  useEffect(() => {
    const handleAutoScroll = () => {
      const now = new Date();
      const toYYYYMMDD = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      if (toYYYYMMDD(now) === displayDate && scrollContainerRef.current) {
        const currentHour = now.getHours();
        if (currentHour >= 17) {
          // Use a small timeout to ensure the grid has rendered its width
          setTimeout(() => {
            if (scrollContainerRef.current) {
              const container = scrollContainerRef.current;
              container.scrollTo({
                left: container.scrollWidth - container.clientWidth,
                behavior: 'smooth'
              });
            }
          }, 100);
        }
      }
    };

    handleAutoScroll();
    
    // Also scroll when window gets focus (user returns to the tab)
    window.addEventListener('focus', handleAutoScroll);
    return () => window.removeEventListener('focus', handleAutoScroll);
  }, [displayDate]);

  return (
    <div className={`bg-white rounded-lg shadow-xl p-2 md:p-4 ${isFullScreen ? 'h-full flex flex-col' : 'relative'}`}>
      
      {/* Scrollable Container containing BOTH Bay List and Grid */}
      <div 
        ref={scrollContainerRef}
        className="flex-grow overflow-x-auto flex flex-row relative"
      >
        <div className="flex min-w-max flex-grow flex-row">
          
          {/* BAY LIST COLUMN (Sticky left) */}
          <div className={`
            sticky left-0 z-20 bg-white border-r flex-shrink-0 flex flex-col shadow-[2px_0_5px_rgba(0,0,0,0.05)]
            w-24 md:w-36
          `}>
            <div className="h-10 border-b font-bold p-1 md:p-2 text-gray-700 flex items-center justify-center bg-white sticky top-0 z-30 text-xs md:text-sm">
              <span>Khoang/KTV</span>
            </div>
            {bays.map(bay => (
              <div key={bay.id} className={`border-b p-1 md:p-2 font-semibold flex flex-col justify-center ${isFullScreen ? 'flex-1' : 'h-32'}`}>
                <div className="h-full flex flex-col justify-between">
                  <span className="text-[10px] md:text-xs font-bold text-gray-400 text-right">Dự Kiến</span>
                  <div className="text-left">
                    <p className="text-xs md:text-sm text-gray-800 truncate" title={bay.name}>{bay.name}</p>
                    {bay.technician && <p className="text-[10px] md:text-sm text-gray-500 truncate" title={bay.technician}>{bay.technician}</p>}
                  </div>
                  <span className="text-[10px] md:text-xs font-bold text-gray-400 text-right">Thực Tế</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* TIMELINE GRID COLUMN */}
          <div className="flex-grow flex flex-col">
            {/* Time Headers */}
            <div 
              className="grid h-10 border-b sticky top-0 bg-white z-10 flex-shrink-0"
              style={{ 
                gridTemplateColumns: `repeat(${TOTAL_HOURS}, 1fr)`,
                width: '100%',
                minWidth: '800px'
              }}
            >
              {Array.from({ length: TOTAL_HOURS }, (_, i) => WORK_START_HOUR + i).map(hour => (
                <div key={hour} className="text-center font-semibold p-2 border-r text-xs md:text-sm text-gray-600">{`${hour}:00`}</div>
              ))}
            </div>

            {/* Grid Body */}
            <div
              ref={timelineGridRef}
              className={`relative ${isFullScreen ? 'flex flex-col flex-grow' : ''}`}
              style={{ 
                width: '100%',
                minWidth: '800px'
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Grid Background */}
              <div 
                className="absolute inset-0 grid pointer-events-none"
                style={{ gridTemplateColumns: `repeat(${TOTAL_HOURS}, 1fr)` }}
              >
                {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                    <div key={i} className="border-r border-gray-300 h-full relative">
                      {/* 15 minute markers */}
                      <div className="absolute inset-0 flex">
                          <div className="w-1/4 h-full border-r border-gray-100 border-dashed"></div>
                          <div className="w-1/4 h-full border-r border-gray-100 border-dashed"></div>
                          <div className="w-1/4 h-full border-r border-gray-100 border-dashed"></div>
                          <div className="w-1/4 h-full"></div>
                      </div>
                    </div>
                ))}
              </div>

              <div 
                className="absolute top-0 bottom-0 bg-gray-200 opacity-50 z-0"
                style={{
                  left: `${((LUNCH_START_HOUR - WORK_START_HOUR) / TOTAL_HOURS) * 100}%`,
                  width: `${((LUNCH_END_HOUR - LUNCH_START_HOUR) / TOTAL_HOURS) * 100}%`,
                }}
              ></div>
              
              <TimeIndicator displayDate={displayDate} />
              
              {bays.map(bay => (
                <div key={bay.id} className={`flex flex-col border-b relative ${isFullScreen ? 'flex-1' : 'h-32'}`}>
                  <div 
                    className={`h-1/2 border-b relative ${canSchedule ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={(e) => handleDkLaneClick(bay.id, e)}
                  >
                    {jobs.filter(job => 
                      job.bayId === bay.id && 
                      !job.actualStartTime && 
                      job.status !== JobStatus.Ready && 
                      job.status !== JobStatus.Exited
                    ).map(job => (
                      <JobBlock 
                          key={job.id} 
                          job={job} 
                          {...getPositionAndWidth(job.plannedStartTime, job.plannedEndTime)} 
                          onDoubleClick={onJobClick} 
                          onDragStart={handleDragStart} 
                          onResizeStart={handleResizeStart} 
                          isFullScreen={isFullScreen} 
                          readOnly={!user}
                      />
                    ))}
                  </div>
                  <div className="h-1/2 relative">
                      {jobs.filter(job => job.bayId === bay.id && job.actualStartTime).map(job => (
                      <JobBlock 
                          key={job.id} 
                          job={job} 
                          {...getPositionAndWidth(job.actualStartTime!, job.actualEndTime || new Date(job.actualStartTime!.getTime() + (job.plannedEndTime.getTime() - job.plannedStartTime.getTime())))} 
                          onDoubleClick={onJobClick} 
                          onDragStart={handleDragStart} 
                          onResizeStart={handleResizeStart} 
                          isFullScreen={isFullScreen} 
                          readOnly={!user}
                      />
                    ))}
                  </div>
                </div>
              ))}
              
              {(draggingState || resizingState) && ghostPosition && (
                  <div 
                      className={`absolute ${isFullScreen ? 'h-8 p-1' : 'h-12 p-2'} rounded-lg bg-yellow-300 opacity-70 z-50 pointer-events-none flex items-center text-black text-xs font-bold border-2 border-dashed border-yellow-500`}
                      style={{
                          top: `${ghostPosition.top}px`,
                          left: `${ghostPosition.left}px`,
                          width: `${ghostPosition.width}px`,
                      }}
                  >
                      {(() => {
                          if (!timelineGridRef.current) return null;
                          const gridWidth = timelineGridRef.current.getBoundingClientRect().width;
                          const percentLeft = (ghostPosition.left / gridWidth) * 100;
                          const hoursFromStart = (percentLeft / 100) * TOTAL_HOURS;
                          const newStartHour = WORK_START_HOUR + hoursFromStart;
                          const hours = Math.floor(newStartHour);
                          const minutes = Math.round((newStartHour % 1) * 60);
                          return (
                              <div className="bg-black text-white px-1 py-0.5 rounded mr-1 whitespace-nowrap">
                                  {`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`}
                              </div>
                          );
                      })()}
                      <div className="truncate">{(draggingState || resizingState)?.job.licensePlate}</div>
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
