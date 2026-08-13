
import React, { useState, useEffect, useMemo } from 'react';
import type { Job, Bay, StageHistory } from '../../types';
import { JobStatus, JobType, Role, BodyShopStage, BayType } from '../../types';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';

interface JobAssignmentModalProps {
  job: Job;
  bays: Bay[];
  onClose: () => void;
  // Prop mới để nhận dữ liệu đề xuất từ thao tác kéo thả (hoặc ngữ cảnh khác)
  initialData?: { bayId: string; actualStartTime: Date } | null;
}

const WORK_START_HOUR = 7;
const WORK_END_HOUR = 21;

// Helper component for technician dropdowns in the Body Shop form
const TechSelect: React.FC<{
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
}> = ({ label, name, value, onChange, options }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <select
            name={name}
            value={value}
            onChange={onChange}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
        >
            <option value="">-- Chọn KTV --</option>
            {options.map(tech => <option key={tech} value={tech}>{tech}</option>)}
        </select>
    </div>
);


const JobAssignmentModal: React.FC<JobAssignmentModalProps> = ({ job, bays, onClose, initialData }) => {
  const { state, updateJob, addJob, deleteJob } = useApp();
  const { user } = useAuth();
  const isBodyShopView = job.jobType === JobType.BodyAndPaint;
  
  const isDKLaneJob = !job.actualStartTime;

  // Sử dụng dữ liệu từ initialData (nếu có) để khởi tạo, ngược lại dùng dữ liệu của Job
  const [selectedBayId, setSelectedBayId] = useState<string>(initialData?.bayId || job.bayId || '');
  const [status, setStatus] = useState<JobStatus>(isDKLaneJob ? JobStatus.InProgress : job.status);
  const [bodyShopStage, setBodyShopStage] = useState<BodyShopStage | undefined>(job.bodyShopStage);
  
  // Helper: tạo chuỗi datetime-local từ Date
  const toLocalISOString = (date: Date) => {
      return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  };

  // Helper: lấy giờ/phút từ Date
  const getHourMinute = (date: Date | undefined | null): { hour: string; minute: string } => {
    if (!date) return { hour: '', minute: '' };
    const d = new Date(date);
    if (isNaN(d.getTime())) return { hour: '', minute: '' };
    return { hour: String(d.getHours()).padStart(2, '0'), minute: String(d.getMinutes()).padStart(2, '0') };
  };

  // State cho thời gian bắt đầu thực tế (giờ + phút)
  const initStart = initialData?.actualStartTime 
    ? getHourMinute(initialData.actualStartTime)
    : (job.actualStartTime ? getHourMinute(job.actualStartTime) : { hour: '', minute: '' });
  
  const [startHour, setStartHour] = useState(initStart.hour);
  const [startMinute, setStartMinute] = useState(initStart.minute);

  // Tạo actualStartTime string từ hour/minute (dùng ngày hôm nay)
  const actualStartTime = (startHour !== '' && startMinute !== '')
    ? (() => {
        const d = new Date();
        d.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
        return toLocalISOString(d);
      })()
    : '';

  // State cho thời gian kết thúc thực tế
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('');

  const actualEndTime = (endHour !== '' && endMinute !== '')
    ? (() => {
        const d = new Date();
        d.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
        return toLocalISOString(d);
      })()
    : '';
  
  const [showWashConfirm, setShowWashConfirm] = useState(false);
  const [pendingUpdatedJob, setPendingUpdatedJob] = useState<Job | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for Revenue Data
  const [revenueData, setRevenueData] = useState({
      congSCC: '',
      congDong: '',
      congSon: '',
      phuTung: ''
  });

  // State for Pause Reason
  const [pauseReason, setPauseReason] = useState('');
  const [customPauseReason, setCustomPauseReason] = useState('');

  // --- Multi-Technician State for General Repair ---
  const [tech1, setTech1] = useState('');
  const [tech2, setTech2] = useState('');
  const [tech3, setTech3] = useState('');
  const [tech4, setTech4] = useState('');

  // State for Body Shop technician assignment
  const [bodyShopTechs, setBodyShopTechs] = useState({
    dong: '',
    nen: '',
    phaSon: '',
    sonMau: '',
    bong: '',
  });

  const ktvSCOptions = useMemo(() => {
    const ktvs = state.users.filter(u => u.role === Role.TechnicianSC).map(u => u.name);
    const options = new Set(ktvs);
    if (user?.name && (user.role === Role.ForemanSC || user.role === Role.Manager || user.role === Role.GeneralManager)) {
        options.add(user.name);
    }
    return Array.from(options).sort();
  }, [state.users, user]);

  const ktvDSOptions = useMemo(() => {
    const ktvs = state.users.filter(u => u.role === Role.TechnicianDS).map(u => u.name);
    const options = new Set(ktvs);
    if (user?.name && (user.role === Role.ForemanDS || user.role === Role.Manager || user.role === Role.GeneralManager)) {
        options.add(user.name);
    }
    return Array.from(options).sort();
  }, [state.users, user]);

  // Parse existing technician string into 4 slots for General Repair
  useEffect(() => {
      if (job.jsonData) {
          try {
              const parsed = JSON.parse(job.jsonData);
              setRevenueData({
                  congSCC: parsed.congSCC || '',
                  congDong: parsed.congDong || '',
                  congSon: parsed.congSon || '',
                  phuTung: parsed.phuTung || ''
              });
              setPauseReason(parsed.pauseReason || '');
              setCustomPauseReason(parsed.customPauseReason || '');
          } catch (e) {
              console.error("Error parsing jsonData", e);
          }
      }

      if (!isBodyShopView && job.technician) {
          // Assuming technician string is like "Name1 - Name2 - Name3"
          const parts = job.technician.split(' - ');
          setTech1(parts[0] || '');
          setTech2(parts[1] || '');
          setTech3(parts[2] || '');
          setTech4(parts[3] || '');
      }
  }, [job.technician, isBodyShopView]);

  useEffect(() => {
    // Khi khoang được chọn thay đổi, tự động chọn KTV mặc định của khoang đó vào ô KTV 1 nếu có.
    const bay = bays.find(b => b.id === selectedBayId);
    if (bay?.technician) {
        setTech1(bay.technician);
        // Optional: Clear other slots if a bay specific tech is forced, or keep them empty
        setTech2('');
        setTech3('');
        setTech4('');
    }
  }, [selectedBayId, bays]);
  
  useEffect(() => {
    if (status === JobStatus.RepairComplete) {
        const now = new Date();
        setEndHour(String(now.getHours()).padStart(2, '0'));
        setEndMinute(String(now.getMinutes()).padStart(2, '0'));
    }
  }, [status]);
  
  useEffect(() => {
    // Automatically set the completion time to now when Body Shop view selects 'Hoàn thành'
    if (isBodyShopView && bodyShopStage === BodyShopStage.HoanThanh) {
      if (endHour === '' && endMinute === '') {
        const now = new Date();
        setEndHour(String(now.getHours()).padStart(2, '0'));
        setEndMinute(String(now.getMinutes()).padStart(2, '0'));
      }
    }
  }, [isBodyShopView, bodyShopStage, endHour, endMinute]);

  useEffect(() => {
    // Pre-populate Body Shop tech fields if data exists
    if (isBodyShopView && job.jobType === JobType.BodyAndPaint && job.technician && job.technician.includes(' - ')) {
      const parts = job.technician.split(' - ');
      if (parts.length >= 4) { // Allow for older 4-part format
        setBodyShopTechs({
          dong: parts[0] !== 'N/A' ? parts[0] : '',
          nen: parts[1] !== 'N/A' ? parts[1] : '',
          // Handle both old (4-part) and new (5-part) formats
          phaSon: parts.length === 5 && parts[2] !== 'N/A' ? parts[2] : '',
          sonMau: parts.length === 5 ? (parts[3] !== 'N/A' ? parts[3] : '') : (parts[2] !== 'N/A' ? parts[2] : ''),
          bong: parts.length === 5 ? (parts[4] !== 'N/A' ? parts[4] : '') : (parts[3] !== 'N/A' ? parts[3] : ''),
        });
      }
    }
  }, [job, isBodyShopView]);

  const handleBodyShopTechChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { name, value } = e.target;
      setBodyShopTechs(prev => ({ ...prev, [name]: value }));
  };

  const handleCompleteAndWash = async (shouldWash: boolean, jobToComplete?: Job) => {
      setIsSubmitting(true);
      try {
        const completionTime = new Date(actualEndTime);
        if (isNaN(completionTime.getTime())) {
            throw new Error("Thời gian kết thúc không hợp lệ.");
        }
        const actionTime = new Date();
        const finalStatus = shouldWash ? JobStatus.RepairComplete : JobStatus.Ready;

        const updatePromises: Promise<void>[] = [];

        const baseJob = jobToComplete || pendingUpdatedJob || job;

        // Update the current job being completed
        const completedCurrentJob: Job = {
          ...baseJob,
          status: finalStatus,
          actualEndTime: completionTime,
        };
        updatePromises.push(updateJob(completedCurrentJob));

        // Recursively find and update all previous jobs in the continuation chain
        let currentJobIdToCheck: string | undefined = completedCurrentJob.continuationOfJobId;
        
        while (currentJobIdToCheck) {
            const previousJob = state.jobs.find(j => j.id === currentJobIdToCheck);
            if (previousJob) {
                const updatedPreviousJob: Job = {
                    ...previousJob,
                    status: finalStatus,
                    // The original job's actualEndTime remains as the time it was paused.
                };
                updatePromises.push(updateJob(updatedPreviousJob));
                
                // Move to the next ancestor in the chain
                currentJobIdToCheck = previousJob.continuationOfJobId;
            } else {
                // Break the loop if the ancestor is not found
                currentJobIdToCheck = undefined;
            }
        }
        
        // Await all status updates before proceeding
        await Promise.all(updatePromises);

        if (shouldWash) {
          const washBayId = 'bay-wash-1';
          const washDurationMs = 20 * 60 * 1000; // Updated to 20 minutes as requested
          
          const now = new Date();
          const washEndTime = new Date(now.getTime() + washDurationMs);

          const newWashJob: Job = {
              // Core info from parent job
              licensePlate: job.licensePlate,
              customerName: job.customerName,
              customerPhone: job.customerPhone,
              carModel: job.carModel,
              advisorName: job.advisorName,
              
              // Specifics for the new wash job
              id: crypto.randomUUID(),
              jobType: job.jobType, 
              status: JobStatus.Washing,
              bayId: washBayId,
              plannedStartTime: now,
              plannedEndTime: washEndTime,
              actualStartTime: undefined, // Changed to undefined to represent "Waiting"
              actualEndTime: undefined,
              useLift: false,
              isAppointment: job.isAppointment, // Pass appointment flag for priority sorting
              appointmentTime: job.appointmentTime,
              actualArrivalTime: job.actualArrivalTime,
              isWaitingCustomer: job.isWaitingCustomer,

              // Link to the parent job that was just completed
              continuationOfJobId: job.id,
          };
          await addJob(newWashJob);
        }

        onClose();
      } catch (e) {
        setAssignmentError("Lỗi khi hoàn thành công việc: " + (e as Error).message);
      } finally {
        setIsSubmitting(false);
      }
  }

  const findEarliestAvailableTime = (bayId: string): Date => {
    const busySlots = state.jobs
        .filter(j => j.bayId === bayId && j.id !== job.id)
        .map(j => {
            let end;
            if (j.actualEndTime) {
                end = new Date(j.actualEndTime);
            } else if (j.actualStartTime) {
                const duration = new Date(j.plannedEndTime).getTime() - new Date(j.plannedStartTime).getTime();
                end = new Date(new Date(j.actualStartTime).getTime() + duration);
            } else {
                end = new Date(j.plannedEndTime);
            }
            return { end };
        })
        .sort((a, b) => a.end.getTime() - b.end.getTime());

    const lastBusySlot = busySlots[busySlots.length - 1];
    const now = new Date();
    if (!lastBusySlot) return now;

    const lastEndTime = new Date(lastBusySlot.end.getTime() + 60000); // add 1 minute buffer
    return lastEndTime > now ? lastEndTime : now;
  }

  const validateAndGetJsonData = (isPausing = false) => {
      const { congSCC, congDong, congSon, phuTung } = revenueData;
      
      const currentJson = job.jsonData ? JSON.parse(job.jsonData) : {};
      
      if (status === JobStatus.RepairComplete || (isBodyShopView && bodyShopStage === BodyShopStage.HoanThanh)) {
          if (congSCC === '' || congDong === '' || congSon === '' || phuTung === '') {
              throw new Error("Vui lòng nhập đầy đủ các trường doanh thu (Tổng Công SCC, Tổng Công Đồng, Tổng Công Sơn, Tổng phụ tùng).");
          }
          const numSCC = Number(congSCC);
          const numDong = Number(congDong);
          const numSon = Number(congSon);
          const numPhuTung = Number(phuTung);

          if (isNaN(numSCC) || isNaN(numDong) || isNaN(numSon) || isNaN(numPhuTung)) {
              throw new Error("Các trường doanh thu phải là số hợp lệ.");
          }
          if (numSCC < 0 || numDong < 0 || numSon < 0 || numPhuTung < 0) {
              throw new Error("Các trường doanh thu không được phép nhập số âm.");
          }
          
          return JSON.stringify({ 
              ...currentJson,
              congSCC: numSCC, 
              congDong: numDong, 
              congSon: numSon, 
              phuTung: numPhuTung 
          });
      }

      if (isPausing) {
          if (!pauseReason) {
              throw new Error("Vui lòng chọn lý do dừng công việc.");
          }
          if (pauseReason === 'Khác' && !customPauseReason.trim()) {
              throw new Error("Vui lòng điền lý do dừng công việc cụ thể.");
          }
          
          return JSON.stringify({
              ...currentJson,
              pauseReason,
              customPauseReason: pauseReason === 'Khác' ? customPauseReason : ''
          });
      }

      return job.jsonData || '';
  };

  const handleSave = async () => {
    setAssignmentError(null);
    setIsSubmitting(true);

    try {
        let updatedJob: Job = { ...job };
        const now = new Date();

        // Validate 10 minute rule for completion
        const validateDuration = (start: Date, end: Date) => {
            const diffMs = end.getTime() - start.getTime();
            const minDurationMs = 10 * 60 * 1000; // 10 minutes
            if (diffMs < minDurationMs) {
                throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu tối thiểu 10 phút.");
            }
        };

        if(isBodyShopView) {
           if (bodyShopStage === BodyShopStage.HoanThanh) {
              if (!actualEndTime) {
                  throw new Error("Vui lòng chọn thời gian hoàn thành thực tế.");
              }
              
              const start = job.actualStartTime || now;
              const end = new Date(actualEndTime);
              validateDuration(start, end);
              
              const h = end.getHours();
              if (h < WORK_START_HOUR || h >= WORK_END_HOUR) {
                  if (!window.confirm(`Thời gian hoàn thành (${end.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}) nằm ngoài giờ làm việc. Bạn có chắc chắn muốn lưu không?`)) {
                      setIsSubmitting(false);
                      return;
                  }
              }

              const jsonDataStr = validateAndGetJsonData();

              const technicianString = [
                bodyShopTechs.dong || 'N/A',
                bodyShopTechs.nen || 'N/A',
                bodyShopTechs.phaSon || 'N/A',
                bodyShopTechs.sonMau || 'N/A',
                bodyShopTechs.bong || 'N/A',
              ].join(' - ');

              const dsUpdatedJob = {
                  ...job,
                  bodyShopStage,
                  technician: technicianString,
                  status: JobStatus.RepairComplete,
                  jsonData: jsonDataStr
              };
              setPendingUpdatedJob(dsUpdatedJob);

              await handleCompleteAndWash(false, dsUpdatedJob);
              return;
          }

          const newStageHistory: StageHistory[] = [...(job.stageHistory || [])];
          
          if(newStageHistory.length > 0) {
            const lastStage = newStageHistory[newStageHistory.length - 1];
            if(lastStage.stage !== bodyShopStage && !lastStage.endTime) {
                lastStage.endTime = now;
            }
          }

          if (job.bodyShopStage !== bodyShopStage && bodyShopStage) {
            newStageHistory.push({ stage: bodyShopStage, startTime: now });
          }
          
          const technicianString = [
            bodyShopTechs.dong || 'N/A',
            bodyShopTechs.nen || 'N/A',
            bodyShopTechs.phaSon || 'N/A',
            bodyShopTechs.sonMau || 'N/A',
            bodyShopTechs.bong || 'N/A',
          ].join(' - ');

          updatedJob = {
              ...job,
              bodyShopStage,
              technician: technicianString,
              status: JobStatus.InProgress,
              stageHistory: newStageHistory,
              actualStartTime: job.actualStartTime || now,
          }
        } else {
            // General Repair Saving Logic
            if (status === JobStatus.InProgress && !actualStartTime) {
              throw new Error("Vui lòng chọn thời gian bắt đầu thực tế để giao việc.");
            }
            
            if (actualStartTime) {
                const startDate = new Date(actualStartTime);
                const h = startDate.getHours();
                if (h < WORK_START_HOUR || h >= WORK_END_HOUR) {
                     if (!window.confirm(`Thời gian bắt đầu (${startDate.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}) nằm ngoài giờ làm việc. Bạn có chắc chắn muốn lưu không?`)) {
                        setIsSubmitting(false);
                        return;
                    }
                }
            }

            if (actualStartTime && selectedBayId && status === JobStatus.InProgress) {
                const unfinishedJobInBay = state.jobs.find(j =>
                    j.bayId === selectedBayId &&
                    j.actualStartTime &&
                    !j.actualEndTime &&
                    j.id !== job.id
                );

                if (unfinishedJobInBay) {
                    throw new Error(`Vui lòng kết thúc công việc xe có biển số ${unfinishedJobInBay.licensePlate} ( đang thực hiện trước đó)`);
                }
                
                const newJobStart = new Date(actualStartTime);
                const durationMs = new Date(job.plannedEndTime).getTime() - new Date(job.plannedStartTime).getTime();
                const newJobEnd = new Date(newJobStart.getTime() + durationMs);

                const conflictingJob = state.jobs.find(j => {
                    if (j.id === job.id || j.bayId !== selectedBayId || !j.actualStartTime || j.jobType === JobType.BodyAndPaint) {
                        return false;
                    }

                    const existingJobStart = new Date(j.actualStartTime);
                    const existingJobDuration = new Date(j.plannedEndTime).getTime() - new Date(j.plannedStartTime).getTime();
                    const existingJobEnd = j.actualEndTime 
                        ? new Date(j.actualEndTime) 
                        : new Date(existingJobStart.getTime() + existingJobDuration);
                    
                    return newJobStart < existingJobEnd && newJobEnd > existingJobStart;
                });

                if (conflictingJob) {
                    const earliestTime = findEarliestAvailableTime(selectedBayId);
                    const suggestedTime = earliestTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    throw new Error(`Lỗi xếp trùng lịch! Khoang này đã có công việc với xe ${conflictingJob.licensePlate}. Thời gian trống sớm nhất là sau ${suggestedTime}.`);
                }
            }
            
            // JOIN THE 4 TECHNICIANS
            const selectedTechs = [tech1, tech2, tech3, tech4].filter(t => t !== '');
            if (selectedTechs.length === 0) {
                throw new Error("Vui lòng chọn ít nhất 1 Kỹ thuật viên thực hiện.");
            }
            const finalTechnicianString = selectedTechs.join(' - ');

            // Cập nhật lại thời gian kế hoạch nếu thời gian bắt đầu thực tế thay đổi (để đảm bảo độ dài thanh timeline hợp lý)
            let newPlannedEndTime = job.plannedEndTime;
            if (actualStartTime) {
                const start = new Date(actualStartTime);
                const originalDuration = job.plannedEndTime.getTime() - job.plannedStartTime.getTime();
                newPlannedEndTime = new Date(start.getTime() + originalDuration);
            }

            updatedJob = {
                ...job,
                bayId: selectedBayId,
                technician: finalTechnicianString,
                status: status,
                actualStartTime: actualStartTime ? new Date(actualStartTime) : job.actualStartTime,
                plannedStartTime: actualStartTime ? new Date(actualStartTime) : job.plannedStartTime, // Cập nhật lại kế hoạch theo thực tế
                plannedEndTime: newPlannedEndTime, // Cập nhật lại kế hoạch theo thực tế
            };

            if (status === JobStatus.RepairComplete && !job.actualEndTime) {
                if (!actualEndTime) {
                    throw new Error("Vui lòng chọn thời gian kết thúc thực tế.");
                }

                const start = actualStartTime ? new Date(actualStartTime) : (job.actualStartTime || now);
                const end = new Date(actualEndTime);
                validateDuration(start, end);
                
                const h = end.getHours();
                if (h < WORK_START_HOUR || h >= WORK_END_HOUR) {
                     if (!window.confirm(`Thời gian kết thúc (${end.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}) nằm ngoài giờ làm việc. Bạn có chắc chắn muốn lưu không?`)) {
                        setIsSubmitting(false);
                        return;
                    }
                }

                const jsonDataStr = validateAndGetJsonData();
                updatedJob.jsonData = jsonDataStr;
                setPendingUpdatedJob(updatedJob);

                setShowWashConfirm(true);
                setIsSubmitting(false);
                return;
            }

            if (status === JobStatus.Paused && job.status !== JobStatus.Paused) {
                const jsonDataWithReason = validateAndGetJsonData(true);
                updatedJob.actualEndTime = now;
                updatedJob.jsonData = jsonDataWithReason;
            }
        }
    
        await updateJob(updatedJob);

        if (bodyShopStage !== BodyShopStage.HoanThanh) {
            onClose();
        }
    } catch (e) {
        setAssignmentError((e as Error).message);
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    if (window.confirm(`Bạn có chắc muốn xóa công việc cho xe ${job.licensePlate}?`)) {
        setIsSubmitting(true);
        try {
            await deleteJob(job.id);
            onClose();
        } catch (e) {
            setAssignmentError("Lỗi khi xóa công việc: " + (e as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    }
  }
  
  if (showWashConfirm) {
      return (
         <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
             <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm text-center">
                <h3 className="text-xl font-bold mb-4">Hoàn thành sửa chữa</h3>
                <p className="mb-6">Bạn có muốn rửa xe này không?</p>
                <fieldset disabled={isSubmitting}>
                    <div className="flex justify-center space-x-4">
                        <button onClick={() => handleCompleteAndWash(true)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded disabled:bg-gray-400">
                            {isSubmitting ? 'Đang xử lý...' : 'Có'}
                        </button>
                        <button onClick={() => handleCompleteAndWash(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded disabled:bg-gray-400">
                            {isSubmitting ? 'Đang xử lý...' : 'Không'}
                        </button>
                    </div>
                </fieldset>
                 {assignmentError && <p className="text-red-500 mt-4">{assignmentError}</p>}
            </div>
         </div>
      )
  }

  // Helper: format số có dấu phẩy ngăn cách hàng nghìn (VD: 1200000 → 1,200,000)
  const formatNumberWithCommas = (value: string): string => {
    const num = value.replace(/[^0-9]/g, ''); // Chỉ giữ lại số
    if (!num) return '';
    return Number(num).toLocaleString('en-US');
  };

  // Helper: xử lý onChange cho input doanh thu
  const handleRevenueChange = (field: string, rawValue: string) => {
    const numericOnly = rawValue.replace(/[^0-9]/g, ''); // Lưu giá trị thuần số
    setRevenueData(prev => ({ ...prev, [field]: numericOnly }));
  };

  const renderRevenueFields = () => (
      <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mt-4 space-y-3">
          <h4 className="text-md font-semibold text-blue-800 border-b border-blue-200 pb-2">Ghi nhận doanh thu</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                  <label className="block text-sm font-medium text-gray-700">Tổng Công SCC <span className="text-red-500">*</span></label>
                  <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberWithCommas(revenueData.congSCC)}
                      onChange={e => handleRevenueChange('congSCC', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue text-right font-mono"
                      placeholder="0"
                      required
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Tổng Công Đồng <span className="text-red-500">*</span></label>
                  <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberWithCommas(revenueData.congDong)}
                      onChange={e => handleRevenueChange('congDong', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue text-right font-mono"
                      placeholder="0"
                      required
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Tổng Công Sơn <span className="text-red-500">*</span></label>
                  <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberWithCommas(revenueData.congSon)}
                      onChange={e => handleRevenueChange('congSon', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue text-right font-mono"
                      placeholder="0"
                      required
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Tổng phụ tùng <span className="text-red-500">*</span></label>
                  <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberWithCommas(revenueData.phuTung)}
                      onChange={e => handleRevenueChange('phuTung', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue text-right font-mono"
                      placeholder="0"
                      required
                  />
              </div>
          </div>
      </div>
  );

  const renderForemanSCView = () => {
    const isDKLaneJob = !job.actualStartTime;
    const statusOptions = isDKLaneJob
        ? [JobStatus.InProgress]
        : [JobStatus.InProgress, JobStatus.Paused, JobStatus.RepairComplete];

    const renderTechSelect = (label: string, val: string, setVal: React.Dispatch<React.SetStateAction<string>>) => (
        <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <select
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue text-sm"
            >
                <option value="">-- Trống --</option>
                {ktvSCOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </select>
        </div>
    );

    return (
     <>
        <div>
            <label className="block text-sm font-medium text-gray-700">Giao cho khoang</label>
            <select
              value={selectedBayId}
              onChange={(e) => setSelectedBayId(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
            >
              <option value="">Chọn khoang</option>
              {bays
                .filter(bay => bay.type !== BayType.CarWash)
                .map(bay => (
                    <option key={bay.id} value={bay.id}>
                    {bay.name} {bay.technician ? `(KTV: ${bay.technician})` : ''}
                    </option>
              ))}
            </select>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Phân công Kỹ thuật viên (Tối đa 4 người)</label>
            <div className="grid grid-cols-2 gap-3">
                {renderTechSelect("KTV Chính", tech1, setTech1)}
                {renderTechSelect("KTV Phụ 1", tech2, setTech2)}
                {renderTechSelect("KTV Phụ 2", tech3, setTech3)}
                {renderTechSelect("KTV Phụ 3", tech4, setTech4)}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as JobStatus)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
            >
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {status === JobStatus.Paused && (
             <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-2 space-y-3">
                <label className="block text-sm font-semibold text-yellow-800">Lý do dừng công việc <span className="text-red-500">*</span></label>
                <select
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                >
                  <option value="">-- Chọn lý do --</option>
                  <option value="Chờ phụ tùng">Chờ phụ tùng</option>
                  <option value="Chờ duyệt giá">Chờ duyệt giá</option>
                  <option value="Khác">Khác</option>
                </select>
                
                {pauseReason === 'Khác' && (
                  <div className="mt-2 text-sm">
                    <label className="block text-gray-700 mb-1">Chi tiết lý do khác:</label>
                    <textarea
                      value={customPauseReason}
                      onChange={(e) => setCustomPauseReason(e.target.value)}
                      placeholder="Nhập lý do cụ thể..."
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-blue focus:border-brand-blue"
                      rows={2}
                    />
                  </div>
                )}
             </div>
          )}

           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TT Bắt đầu</label>
              <div className="flex items-center gap-2">
                <select value={startHour} onChange={e => setStartHour(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-md bg-white text-lg focus:ring-2 focus:ring-brand-blue">
                  <option value="">Giờ</option>
                  {Array.from({length: 14}, (_, i) => i + 7).map(h => <option key={h} value={String(h).padStart(2,'0')}>{String(h).padStart(2,'0')}</option>)}
                </select>
                <span className="text-xl font-bold">:</span>
                <select value={startMinute} onChange={e => setStartMinute(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-md bg-white text-lg focus:ring-2 focus:ring-brand-blue">
                  <option value="">Phút</option>
                  {Array.from({length: 12}, (_, i) => i * 5).map(m => <option key={m} value={String(m).padStart(2,'0')}>{String(m).padStart(2,'0')}</option>)}
                </select>
                <button type="button" onClick={() => { const now = new Date(); setStartHour(String(now.getHours()).padStart(2,'0')); setStartMinute(String(Math.floor(now.getMinutes()/5)*5).padStart(2,'0')); }} className="px-3 py-2 bg-blue-100 text-brand-blue rounded-md hover:bg-blue-200 text-sm font-medium whitespace-nowrap">Bây giờ</button>
              </div>
              {actualStartTime && <p className="text-xs text-gray-500 mt-1">⏰ {new Date(actualStartTime).toLocaleString('vi-VN', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'})}</p>}
          </div>
          {status === JobStatus.RepairComplete && (
            <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">TT Kết thúc</label>
                  <div className="flex items-center gap-2">
                    <select value={endHour} onChange={e => setEndHour(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-md bg-white text-lg focus:ring-2 focus:ring-brand-blue">
                      <option value="">Giờ</option>
                      {Array.from({length: 14}, (_, i) => i + 7).map(h => <option key={h} value={String(h).padStart(2,'0')}>{String(h).padStart(2,'0')}</option>)}
                    </select>
                    <span className="text-xl font-bold">:</span>
                    <select value={endMinute} onChange={e => setEndMinute(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-md bg-white text-lg focus:ring-2 focus:ring-brand-blue">
                      <option value="">Phút</option>
                      {Array.from({length: 12}, (_, i) => i * 5).map(m => <option key={m} value={String(m).padStart(2,'0')}>{String(m).padStart(2,'0')}</option>)}
                    </select>
                    <button type="button" onClick={() => { const now = new Date(); setEndHour(String(now.getHours()).padStart(2,'0')); setEndMinute(String(Math.floor(now.getMinutes()/5)*5).padStart(2,'0')); }} className="px-3 py-2 bg-blue-100 text-brand-blue rounded-md hover:bg-blue-200 text-sm font-medium whitespace-nowrap">Bây giờ</button>
                  </div>
                  {actualEndTime && <p className="text-xs text-gray-500 mt-1">⏰ {new Date(actualEndTime).toLocaleString('vi-VN', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'})}</p>}
                </div>
                {renderRevenueFields()}
            </>
          )}
     </>
    );
  };

  const renderBodyShopView = () => (
      <div className="space-y-4">
        <div>
            <label className="block text-sm font-medium text-gray-700">Cập nhật công đoạn</label>
            <select
            value={bodyShopStage || ''}
            onChange={(e) => setBodyShopStage(e.target.value as BodyShopStage)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
            >
            <option value="" disabled>Chọn công đoạn</option>
            {Object.values(BodyShopStage).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
        </div>

        {bodyShopStage === BodyShopStage.HoanThanh && (
            <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian thực tế hoàn thành</label>
                  <div className="flex items-center gap-2">
                    <select value={endHour} onChange={e => setEndHour(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-md bg-white text-lg focus:ring-2 focus:ring-brand-blue">
                      <option value="">Giờ</option>
                      {Array.from({length: 14}, (_, i) => i + 7).map(h => <option key={h} value={String(h).padStart(2,'0')}>{String(h).padStart(2,'0')}</option>)}
                    </select>
                    <span className="text-xl font-bold">:</span>
                    <select value={endMinute} onChange={e => setEndMinute(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-md bg-white text-lg focus:ring-2 focus:ring-brand-blue">
                      <option value="">Phút</option>
                      {Array.from({length: 12}, (_, i) => i * 5).map(m => <option key={m} value={String(m).padStart(2,'0')}>{String(m).padStart(2,'0')}</option>)}
                    </select>
                    <button type="button" onClick={() => { const now = new Date(); setEndHour(String(now.getHours()).padStart(2,'0')); setEndMinute(String(Math.floor(now.getMinutes()/5)*5).padStart(2,'0')); }} className="px-3 py-2 bg-blue-100 text-brand-blue rounded-md hover:bg-blue-200 text-sm font-medium whitespace-nowrap">Bây giờ</button>
                  </div>
                  {actualEndTime && <p className="text-xs text-gray-500 mt-1">⏰ {new Date(actualEndTime).toLocaleString('vi-VN', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'})}</p>}
                </div>
                {renderRevenueFields()}
            </>
        )}

        <h4 className="text-md font-semibold text-gray-800 border-t pt-4">Phân công Kỹ thuật viên</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TechSelect label="KTV làm đồng" name="dong" value={bodyShopTechs.dong} onChange={handleBodyShopTechChange} options={ktvDSOptions} />
            <TechSelect label="KTV làm nền" name="nen" value={bodyShopTechs.nen} onChange={handleBodyShopTechChange} options={ktvDSOptions} />
            <TechSelect label="KTV pha sơn" name="phaSon" value={bodyShopTechs.phaSon} onChange={handleBodyShopTechChange} options={ktvDSOptions} />
            <TechSelect label="KTV sơn màu" name="sonMau" value={bodyShopTechs.sonMau} onChange={handleBodyShopTechChange} options={ktvDSOptions} />
            <TechSelect label="KTV đánh bóng" name="bong" value={bodyShopTechs.bong} onChange={handleBodyShopTechChange} options={ktvDSOptions} />
        </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Xử lý việc: {job.licensePlate}</h2>
        
        {assignmentError && (
             <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                <p className="font-bold">Không thể phân công</p>
                <p>{assignmentError}</p>
            </div>
        )}
        <fieldset disabled={isSubmitting}>
            <div className="space-y-4">
                {isBodyShopView ? renderBodyShopView() : renderForemanSCView()}
            </div>
            <div className="mt-6 flex justify-between space-x-4">
            {(user?.role === Role.Manager || user?.role === Role.GeneralManager || user?.role === Role.ForemanSC || user?.role === Role.ForemanDS) && (
                <button
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                >
                    Xóa việc
                </button>
            )}
            <div className="flex-grow flex justify-end space-x-4">
                <button
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
                >
                Hủy
                </button>
                <button
                onClick={handleSave}
                className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                >
                {isSubmitting ? 'Đang lưu...' : 'Lưu'}
                </button>
            </div>
            </div>
        </fieldset>
      </div>
    </div>
  );
};

export default JobAssignmentModal;
