
import React, { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import type { Job, Bay } from '../../types';
import { JobType, JobStatus, CAR_MODELS, Role } from '../../types';
import ConfirmationModal from '../modals/ConfirmationModal';

interface JobFormProps {
  existingJob: Job | null;
  onClose: () => void;
  isAppointmentMode?: boolean;
  initialData?: Partial<Job> | null;
}

const WORK_START_HOUR = 7;
const WORK_END_HOUR = 21;

const JobForm: React.FC<JobFormProps> = ({ existingJob, onClose, isAppointmentMode = false, initialData = null }) => {
  const { state, addJob, updateJob, deleteJob } = useApp();
  const { user } = useAuth();
  
  const isEditMode = Boolean(existingJob);
  const serviceAdvisors = state.users.filter(u => u.role === Role.ServiceAdvisor);

  const toDateTimeLocal = (date?: Date): string => {
    if (!date) return '';
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffset);
    return localDate.toISOString().slice(0, 16);
  };

  const getInitialFormData = () => {
    const now = new Date();
    const startTime = !isAppointmentMode && !isEditMode 
        ? now 
        : (initialData?.plannedStartTime || (() => {
            const nextHour = new Date(now.getTime());
            nextHour.setMinutes(0, 0, 0);
            nextHour.setHours(now.getHours() + 1);
            return nextHour;
          })());

    const endTime = initialData?.plannedEndTime || new Date(startTime.getTime() + 60 * 60 * 1000);
    const durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
    
    const defaultData = {
        licensePlate: '',
        customerName: '',
        customerPhone: '',
        carModel: CAR_MODELS[0],
        vin: '', // Added VIN default
        jobType: JobType.ScheduledMaintenance,
        advisorName: user?.role === Role.ServiceAdvisor ? user.name : (serviceAdvisors[0]?.name || ''),
        status: isAppointmentMode ? JobStatus.Appointment : JobStatus.Waiting,
        useLift: false,
        plannedStartTime: toDateTimeLocal(startTime),
        plannedEndTime: toDateTimeLocal(endTime),
        durationMinutes: durationMinutes,
        appointmentTime: toDateTimeLocal(startTime),
        laborCost: 0,
        km: 0,
        isAppointment: isAppointmentMode,
        isWaitingCustomer: false, // Thêm mặc định cho khách chờ
        // Thêm trường thời gian thực tế cho form
        actualStartTime: '',
        actualEndTime: '',
        maintenanceLevel: '',
        maintenanceType: 'Thường',
    };
    
    if (initialData) {
        return {
            ...defaultData,
            ...initialData,
            vin: initialData.vin || '', // Hydrate VIN
            advisorName: initialData.advisorName || defaultData.advisorName,
            plannedStartTime: toDateTimeLocal(initialData.plannedStartTime || startTime),
            plannedEndTime: toDateTimeLocal(initialData.plannedEndTime || endTime),
            durationMinutes: initialData.plannedStartTime && initialData.plannedEndTime ? Math.max(1, Math.round((new Date(initialData.plannedEndTime).getTime() - new Date(initialData.plannedStartTime).getTime()) / 60000)) : durationMinutes,
            appointmentTime: toDateTimeLocal(initialData.appointmentTime || initialData.plannedStartTime || startTime),
            isWaitingCustomer: initialData.isWaitingCustomer || false,
            actualStartTime: toDateTimeLocal(initialData.actualStartTime),
            actualEndTime: toDateTimeLocal(initialData.actualEndTime),
            maintenanceLevel: (initialData as any).maintenanceLevel || '',
            maintenanceType: (initialData as any).maintenanceType || 'Thường',
        }
    }
    return defaultData;
  }

  const [formData, setFormData] = useState(getInitialFormData());
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmDuplicateOpen, setIsConfirmDuplicateOpen] = useState(false);
  const [jobFromArrival, setJobFromArrival] = useState<Job | null>(null);

  const isAdvisorCreatingFromArrival = user?.role === Role.ServiceAdvisor && !isEditMode && !isAppointmentMode;
  const arrivedVehicles = state.jobs.filter(j => j.status === JobStatus.Arrived);

  useEffect(() => {
    if (existingJob) {
      const start = new Date(existingJob.plannedStartTime);
      const end = new Date(existingJob.plannedEndTime);
      const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

      setFormData({
        ...getInitialFormData(),
        ...existingJob,
        vin: existingJob.vin || '', // Load VIN if exists
        plannedStartTime: toDateTimeLocal(existingJob.plannedStartTime),
        plannedEndTime: toDateTimeLocal(existingJob.plannedEndTime),
        durationMinutes: duration,
        appointmentTime: toDateTimeLocal(existingJob.appointmentTime),
        isWaitingCustomer: existingJob.isWaitingCustomer || false,
        laborCost: existingJob.laborCost || 0,
        km: existingJob.km || 0,
        customerPhone: existingJob.customerPhone || '',
        // Load thời gian thực tế nếu có
        actualStartTime: toDateTimeLocal(existingJob.actualStartTime),
        actualEndTime: toDateTimeLocal(existingJob.actualEndTime),
        maintenanceLevel: (existingJob as any).maintenanceLevel || '',
        maintenanceType: (existingJob as any).maintenanceType || 'Thường',
      });
    } else {
        setFormData(getInitialFormData());
    }
  }, [existingJob, user, isAppointmentMode, initialData]);

  useEffect(() => {
    if (formData.jobType !== JobType.BodyAndPaint && formData.plannedStartTime && formData.durationMinutes) {
        try {
            const startTime = new Date(formData.plannedStartTime);
            if (!isNaN(startTime.getTime())) {
                const endTime = new Date(startTime.getTime() + formData.durationMinutes * 60000);
                const endTimeLocal = toDateTimeLocal(endTime);
                if (endTimeLocal !== formData.plannedEndTime) {
                    setFormData(prev => ({ ...prev, plannedEndTime: endTimeLocal }));
                }
            }
        } catch (e) {
            console.error("Invalid date", e);
        }
    }
  }, [formData.plannedStartTime, formData.durationMinutes, formData.jobType]);

  useEffect(() => {
      if (formData.jobType === JobType.ScheduledMaintenance && formData.maintenanceLevel) {
          const durations: Record<string, { Nhanh: number, Thường: number }> = {
              '1k': { Nhanh: 15, Thường: 15 },
              '1': { Nhanh: 15, Thường: 20 },
              '2': { Nhanh: 20, Thường: 55 },
              '3': { Nhanh: 40, Thường: 60 },
              '4': { Nhanh: 60, Thường: 100 },
          };
          
          const level = formData.maintenanceLevel;
          const type = formData.maintenanceType as 'Nhanh' | 'Thường';
          
          if (durations[level] && durations[level][type]) {
              const newDuration = durations[level][type];
              if (formData.durationMinutes !== newDuration) {
                  setFormData(prev => ({ ...prev, durationMinutes: newDuration }));
              }
          }
      }
  }, [formData.maintenanceLevel, formData.maintenanceType, formData.jobType]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked }));
        return;
    }

    if (name === 'licensePlate') {
        const format = (raw: string): string => {
            const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
            
            // Case: QH-12... (e.g., QH1234 -> QH-1234)
            if (/^[A-Z]{2}/.test(clean)) {
                if (clean.length > 2) return `${clean.slice(0, 2)}-${clean.slice(2, 7)}`;
                return clean;
            }
            
            // Case: 50LD-123.45 (e.g., 50LD12345 -> 50LD-123.45)
            if (/^\d{2}[A-Z]{2}/.test(clean)) {
                if (clean.length >= 8) return `${clean.slice(0, 4)}-${clean.slice(4, 7)}.${clean.slice(7, 9)}`;
                if (clean.length > 4) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
                return clean;
            }
            
            // Case: 50A-123.45 (clean len 8) or 50A-1234[5] (clean len 7/8)
            if (/^\d{2}[A-Z]/.test(clean)) {
                if (clean.length >= 8) { // 50A12345 -> 50A-123.45
                    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}.${clean.slice(6, 8)}`;
                }
                if (clean.length > 3) { // 50A1234 -> 50A-1234
                    return `${clean.slice(0, 3)}-${clean.slice(3, 8)}`; // Supports 4 or 5 digits
                }
                return clean;
            }
            
            return clean;
        };
        setFormData(prev => ({ ...prev, licensePlate: format(value) }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
  };
  
  const handleSearchVehicle = () => {
    if (!formData.licensePlate) {
        alert("Vui lòng nhập biển số xe trước khi tìm.");
        return;
    }

    // Chuẩn hóa biển số nhập vào: bỏ ký tự đặc biệt, uppercase
    const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const searchKey = normalize(formData.licensePlate);

    if (searchKey.length < 3) {
        alert("Vui lòng nhập đầy đủ biển số để tìm kiếm chính xác.");
        return;
    }

    const found = state.vehicles.find(v => normalize(v.licensePlate) === searchKey);

    if (found) {
        setFormData(prev => ({
            ...prev,
            customerName: found.customerName || prev.customerName,
            customerPhone: found.customerPhone || prev.customerPhone,
            // Nếu dòng xe có trong danh sách thì chọn, không thì để 'Khác'
            carModel: CAR_MODELS.includes(found.carModel) ? found.carModel : 'Khác',
            vin: found.vin || prev.vin,
        }));
    } else {
        alert("Biển số xe chưa có trong CSDL.");
    }
  };

  const findAvailableBayForSlot = (startTime: Date, endTime: Date, requiresLift: boolean, excludeJobId?: string): Bay | null => {
      // FIX: Filter out Body & Paint jobs upfront to prevent any possibility of cross-schedule conflicts.
      const generalJobs = state.jobs.filter(j => j.jobType !== JobType.BodyAndPaint);

      let relevantBays = state.bays.filter(bay => 
          bay.type === 'General' &&
          (!requiresLift || bay.supportsLift)
      );

      // Lọc khoang theo loại bảo dưỡng định kỳ
      if (formData.jobType === JobType.ScheduledMaintenance && formData.maintenanceLevel) {
          if (formData.maintenanceType === 'Nhanh') {
              relevantBays = relevantBays.filter(bay => bay.name.includes('3') || bay.name.includes('4'));
          } else if (formData.maintenanceType === 'Thường') {
              relevantBays = relevantBays.filter(bay => bay.name.includes('1') || bay.name.includes('2'));
          }
      }

      for (const bay of relevantBays) {
          const isOccupied = generalJobs.some(job => {
              if (job.id === excludeJobId || job.bayId !== bay.id) return false;
              
              const jobStart = job.actualStartTime || job.plannedStartTime;
              let jobEnd;

              if (job.actualStartTime && !job.actualEndTime) {
                  const durationMs = job.plannedEndTime.getTime() - job.plannedStartTime.getTime();
                  jobEnd = new Date(job.actualStartTime.getTime() + durationMs);
              } else {
                  jobEnd = job.actualEndTime || job.plannedEndTime;
              }

              return startTime < jobEnd && endTime > jobStart;
          });

          if (!isOccupied) {
              return bay;
          }
      }
      return null;
  };

  const proceedWithSubmit = async () => {
    setIsSubmitting(true);
    try {
        const plannedStartTime = new Date(formData.plannedStartTime);
        const plannedEndTime = new Date(formData.plannedEndTime);

        // Convert chuỗi thời gian thực tế sang Date nếu có
        const actualStartTime = formData.actualStartTime ? new Date(formData.actualStartTime) : undefined;
        const actualEndTime = formData.actualEndTime ? new Date(formData.actualEndTime) : undefined;
        
        const { maintenanceLevel, maintenanceType, durationMinutes: _, ...restFormData } = formData;

        if (isEditMode && existingJob) {
            let jobData: any = {
                ...restFormData,
                id: existingJob.id,
                plannedStartTime: plannedStartTime,
                plannedEndTime: plannedEndTime,
                
                // Cập nhật thời gian thực tế
                actualStartTime: actualStartTime || null,
                actualEndTime: actualEndTime || null,

                appointmentTime: isAppointmentMode ? plannedStartTime : (existingJob.appointmentTime ? new Date(existingJob.appointmentTime) : undefined),
                
                status: (existingJob.isAppointment && existingJob.status === JobStatus.Arrived) 
                        ? JobStatus.TicketOpened 
                        : existingJob.status,

                actualArrivalTime: existingJob.actualArrivalTime ? new Date(existingJob.actualArrivalTime) : undefined,
                
                laborCost: formData.jobType === JobType.BodyAndPaint ? formData.laborCost : undefined,
                appointmentCreatedAt: existingJob.appointmentCreatedAt ? new Date(existingJob.appointmentCreatedAt) : undefined,
            };

            // CRITICAL FIX: If the job type is Body & Paint, ensure bayId is cleared.
            if (formData.jobType === JobType.BodyAndPaint) {
                jobData.bayId = null;
                jobData.technician = null;
            }
            
            await updateJob(jobData as Job);

        } else if (jobFromArrival) {
            let jobData: any;

            // CRITICAL FIX: Do not assign a bay for Body & Paint jobs.
            if (formData.jobType === JobType.BodyAndPaint) {
                jobData = {
                    ...restFormData,
                    id: jobFromArrival.id,
                    bayId: null, // Ensure no bay is assigned
                    technician: null, // Ensure no technician is assigned
                    plannedStartTime: plannedStartTime,
                    plannedEndTime: plannedEndTime,
                    status: jobFromArrival.isAppointment ? JobStatus.TicketOpened : JobStatus.Waiting,
                    appointmentTime: jobFromArrival.appointmentTime ? new Date(jobFromArrival.appointmentTime) : undefined,
                    actualArrivalTime: jobFromArrival.actualArrivalTime ? new Date(jobFromArrival.actualArrivalTime) : undefined,
                    appointmentCreatedAt: jobFromArrival.appointmentCreatedAt ? new Date(jobFromArrival.appointmentCreatedAt) : undefined,
                    actualStartTime: actualStartTime || null,
                    actualEndTime: actualEndTime || null,
                    isAppointment: jobFromArrival.isAppointment
                };
            } else {
                const availableBay = findAvailableBayForSlot(plannedStartTime, plannedEndTime, formData.useLift, jobFromArrival.id);
                if (!availableBay) {
                    throw new Error('Lỗi! Không tìm thấy khoang trống phù hợp cho khung giờ này. Vui lòng kiểm tra lại lịch trình.');
                }

                jobData = {
                    ...restFormData,
                    id: jobFromArrival.id,
                    bayId: availableBay.id,
                    technician: availableBay.technician,
                    plannedStartTime: plannedStartTime,
                    plannedEndTime: plannedEndTime,
                    status: jobFromArrival.isAppointment ? JobStatus.TicketOpened : JobStatus.Waiting,
                    appointmentTime: jobFromArrival.appointmentTime ? new Date(jobFromArrival.appointmentTime) : undefined,
                    actualArrivalTime: jobFromArrival.actualArrivalTime ? new Date(jobFromArrival.actualArrivalTime) : undefined,
                    appointmentCreatedAt: jobFromArrival.appointmentCreatedAt ? new Date(jobFromArrival.appointmentCreatedAt) : undefined,
                    actualStartTime: actualStartTime || null,
                    actualEndTime: actualEndTime || null,
                    isAppointment: jobFromArrival.isAppointment
                };
            }
            await updateJob(jobData as Job);

        } else { // This is a new item
             const appointmentTime = isAppointmentMode ? plannedStartTime : undefined;
             let newJobData: any;

             if (formData.jobType === JobType.BodyAndPaint) {
                 newJobData = {
                    ...restFormData,
                    id: crypto.randomUUID(),
                    plannedStartTime: plannedStartTime,
                    plannedEndTime: plannedEndTime,
                    appointmentTime: appointmentTime,
                    isAppointment: isAppointmentMode,
                    status: isAppointmentMode ? JobStatus.Appointment : JobStatus.Waiting,
                    bayId: null,
                    technician: null,
                    appointmentCreatedAt: isAppointmentMode ? new Date() : null,
                    actualStartTime: actualStartTime || null,
                    actualEndTime: actualEndTime || null,
                 };
             } else {
                 const availableBay = findAvailableBayForSlot(plannedStartTime, plannedEndTime, formData.useLift, undefined);

                 if (!availableBay) {
                     const errorMessage = isAppointmentMode 
                        ? "Không có khoang nào trống cho khung giờ hẹn này. Vui lòng chọn thời gian khác."
                        : "Không có khoang nào trống cho khung giờ đã chọn. Vui lòng chọn thời gian khác hoặc kiểm tra lại lịch trình.";
                     throw new Error(errorMessage);
                 }
                 
                 newJobData = {
                    ...restFormData,
                    id: crypto.randomUUID(),
                    plannedStartTime: plannedStartTime,
                    plannedEndTime: plannedEndTime,
                    appointmentTime: appointmentTime,
                    isAppointment: isAppointmentMode,
                    status: isAppointmentMode ? JobStatus.Appointment : JobStatus.Waiting,
                    bayId: availableBay.id,
                    technician: availableBay.technician,
                    appointmentCreatedAt: isAppointmentMode ? new Date() : null,
                    actualStartTime: actualStartTime || null,
                    actualEndTime: actualEndTime || null,
                 };
             }
             await addJob(newJobData as Job);
        }
        onClose();
    } catch(err) {
        setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
        setIsSubmitting(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAdvisorCreatingFromArrival) {
        const licensePlateRegex = /^(\d{2}[A-Z]-\d{3}\.\d{2}|\d{2}[A-Z]-\d{4,5}|\d{2}[A-Z]{2}-\d{3}\.\d{2}|[A-Z]{2}-\d{2,5})$/i;
        if (!licensePlateRegex.test(formData.licensePlate)) {
            setError("Định dạng biển số xe không hợp lệ. Ví dụ: 50A-123.45, 50A-1234, 50LD-123.45, QH-12.");
            return;
        }
    } else if (!jobFromArrival) {
        setError("Vui lòng chọn một xe từ danh sách đã đến xưởng.");
        return;
    }

    // Validation for VIN (Mandatory)
    if (!formData.vin || formData.vin.trim() === '') {
        setError("Số VIN là trường bắt buộc.");
        return;
    }

    // Áp dụng cho tất cả các công việc (tạo mới, sửa, tạo từ xe đã đến), trừ lịch hẹn
    if (!isAppointmentMode && (!formData.km || formData.km <= 0)) {
        setError("Số Km là trường bắt buộc và phải lớn hơn 0.");
        return;
    }

    const plannedStartTime = new Date(formData.plannedStartTime);
    const plannedEndTime = new Date(formData.plannedEndTime);
    const currentTime = new Date();
    
    // Chỉ kiểm tra thời gian dự kiến bắt đầu > hiện tại đối với các xe chưa bắt đầu sửa chữa
    if ((!existingJob || !existingJob.actualStartTime) && plannedStartTime <= currentTime) {
        setError("Thời gian dự kiến bắt đầu phải lớn hơn thời gian hiện tại.");
        return;
    }

    if (plannedEndTime <= plannedStartTime) {
        setError("Thời gian kết thúc phải sau thời gian bắt đầu.");
        return;
    }
    
    // --- Working Hours Check ---
    const startHour = plannedStartTime.getHours();
    const endHour = plannedEndTime.getHours();
    
    const isStartOut = startHour < WORK_START_HOUR || startHour >= WORK_END_HOUR;
    const isEndOut = endHour < WORK_START_HOUR || (endHour >= WORK_END_HOUR && plannedEndTime.getMinutes() > 0) || endHour > WORK_END_HOUR;

    if (isStartOut || isEndOut) {
        const confirmMsg = `Thời gian bạn chọn (${plannedStartTime.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})} - ${plannedEndTime.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}) nằm ngoài giờ làm việc (${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00). Bạn có chắc chắn muốn lưu không?`;
        if (!window.confirm(confirmMsg)) {
            return;
        }
    }
    // ---------------------------

    if (isAppointmentMode) {
      const now = new Date();
      const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      if (plannedStartTime < fourHoursLater) {
        const errorMessage = isEditMode 
            ? 'Khi chỉnh sửa, thời gian hẹn mới phải cách giờ hiện tại ít nhất 4 tiếng.'
            : 'Lịch hẹn phải được đặt trước ít nhất 4 tiếng.';
        setError(errorMessage);
        return;
      }
    }

    if (!isEditMode && !jobFromArrival) {
        const existingAppointment = state.jobs.find(
            j => j.licensePlate === formData.licensePlate && j.isAppointment
        );

        if (existingAppointment) {
            setIsConfirmDuplicateOpen(true);
            return;
        }
    }

    await proceedWithSubmit();
  };
  
  const handleDelete = async () => {
    if (!existingJob) return;
    const isManager = user?.role === Role.Manager;
    const isOwner = user?.name === existingJob.advisorName;
    
    if (isManager || isOwner) {
        const confirmMessage = `Bạn có chắc muốn xóa ${existingJob.isAppointment ? 'lịch hẹn' : 'công việc'} cho xe ${existingJob.licensePlate}? Thao tác này sẽ xóa ở cả bảng công việc và bảng lịch hẹn.`;
        if (window.confirm(confirmMessage)) {
            try {
                setIsSubmitting(true);
                await deleteJob(existingJob.id); // Backend should handle deletion from both if necessary
                onClose();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Lỗi khi xóa.");
            } finally {
                setIsSubmitting(false);
            }
        }
    } else {
        alert("Bạn không có quyền xóa mục này.");
    }
  };

  const handleVehicleSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedJobId = e.target.value;
    const selectedJob = state.jobs.find(j => j.id === selectedJobId);

    if (selectedJob) {
        setJobFromArrival(selectedJob);
        const start = new Date(selectedJob.plannedStartTime);
        const end = new Date(selectedJob.plannedEndTime);
        const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

        // Fix: Convert appointmentTime to a string for the form state.
        setFormData({
            ...getInitialFormData(),
            ...selectedJob,
            vin: selectedJob.vin || '', // Load VIN from selected job/vehicle
            advisorName: user!.name,
            plannedStartTime: toDateTimeLocal(selectedJob.plannedStartTime),
            plannedEndTime: toDateTimeLocal(selectedJob.plannedEndTime),
            durationMinutes: duration,
            appointmentTime: toDateTimeLocal(selectedJob.appointmentTime),
            isWaitingCustomer: selectedJob.isWaitingCustomer || false,
            laborCost: selectedJob.laborCost || 0,
            actualStartTime: toDateTimeLocal(selectedJob.actualStartTime),
            actualEndTime: toDateTimeLocal(selectedJob.actualEndTime),
        });
    } else {
        setJobFromArrival(null);
        setFormData(getInitialFormData());
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex justify-center items-center p-4">
      {isConfirmDuplicateOpen && (
        <ConfirmationModal
          message="Xe đã có lịch hẹn. Bạn có muốn mở thêm công việc mới không?"
          onConfirm={() => {
            setIsConfirmDuplicateOpen(false);
            proceedWithSubmit();
          }}
          onCancel={() => setIsConfirmDuplicateOpen(false)}
        />
      )}
      <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-2xl max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Chỉnh sửa' : (isAppointmentMode ? 'Thêm lịch hẹn' : 'Thêm việc mới')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl" disabled={isSubmitting}>&times;</button>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isAdvisorCreatingFromArrival ? (
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Chọn xe đã đến xưởng</label>
                    <select
                        name="selectedArrivalId"
                        value={jobFromArrival?.id || ''}
                        onChange={handleVehicleSelection}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                        required
                    >
                        <option value="">-- Chọn biển số --</option>
                        {arrivedVehicles.map(job => (
                            <option key={job.id} value={job.id}>
                                {job.licensePlate} - (Đến lúc: {new Date(job.actualArrivalTime!).toLocaleTimeString('vi-VN')})
                            </option>
                        ))}
                    </select>
                </div>
              ) : (
                <div>
                    <label className="block text-sm font-medium text-gray-700">Biển số xe</label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                        <input 
                            type="text" 
                            name="licensePlate" 
                            value={formData.licensePlate || ''} 
                            onChange={handleChange} 
                            className="flex-1 min-w-0 block w-full p-2 border border-gray-300 rounded-l-md focus:ring-brand-blue focus:border-brand-blue" 
                            required 
                            readOnly={isEditMode && user?.role !== Role.Manager} 
                            placeholder="Ví dụ: 50A-123.45" 
                            maxLength={12} 
                        />
                        <button
                            type="button"
                            onClick={handleSearchVehicle}
                            disabled={isEditMode && user?.role !== Role.Manager}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tìm kiếm trong CSDL"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
              )}

              <fieldset disabled={isSubmitting || (isAdvisorCreatingFromArrival && !jobFromArrival)} className="contents">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tên khách hàng</label>
                    <input type="text" name="customerName" value={formData.customerName || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required />
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-700">Số điện thoại</label>
                    <input type="tel" name="customerPhone" value={formData.customerPhone || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" placeholder="Ví dụ: 0912345678" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dòng xe</label>
                    <select name="carModel" value={formData.carModel} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                      {CAR_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Số VIN <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        name="vin" 
                        value={formData.vin || ''} 
                        onChange={handleChange} 
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md" 
                        required 
                        placeholder="Nhập số khung/VIN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Số Km</label>
                    <input 
                        type="number" 
                        name="km" 
                        value={(formData.km === 0 || formData.km === undefined || formData.km === null) ? '' : formData.km} 
                        onChange={handleNumberChange} 
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md" 
                        placeholder="Bắt buộc nhập"
                        min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{isAppointmentMode ? 'Loại lịch hẹn' : 'Loại công việc'}</label>
                    <select name="jobType" value={formData.jobType} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                      <option value={JobType.ScheduledMaintenance}>{JobType.ScheduledMaintenance}</option>
                      <option value={JobType.Repair}>{JobType.Repair}</option>
                      <option value={JobType.BodyAndPaint}>{JobType.BodyAndPaint}</option>
                      <option value={JobType.Warranty}>{JobType.Warranty}</option>
                    </select>
                  </div>
                  
                  {formData.jobType === JobType.ScheduledMaintenance && (
                      <>
                          <div>
                              <label className="block text-sm font-medium text-gray-700">Cấp bảo dưỡng <span className="text-red-500">*</span></label>
                              <select 
                                  name="maintenanceLevel" 
                                  value={formData.maintenanceLevel} 
                                  onChange={handleChange} 
                                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                                  required
                              >
                                  <option value="" disabled>-- Chọn cấp bảo dưỡng --</option>
                                  <option value="1k">Bảo dưỡng 1k (1.000 km)</option>
                                  <option value="1">Bảo dưỡng cấp 1 (7.500, 37.500, 52.500 km)</option>
                                  <option value="2">Bảo dưỡng cấp 2 (15.000, 75.000, 105.000 km)</option>
                                  <option value="3">Bảo dưỡng cấp 3 (30.000, 60.000 km)</option>
                                  <option value="4">Bảo dưỡng cấp 4 (45.000, 90.000 km)</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700">Loại bảo dưỡng</label>
                              <select 
                                  name="maintenanceType" 
                                  value={formData.maintenanceType} 
                                  onChange={handleChange} 
                                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                              >
                                  <option value="Thường">Bảo dưỡng thường</option>
                                  <option value="Nhanh">Bảo dưỡng nhanh</option>
                              </select>
                          </div>
                      </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cố vấn dịch vụ</label>
                    <select name="advisorName" value={formData.advisorName} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required>
                      <option value="" disabled>-- Chọn Cố vấn --</option>
                      {serviceAdvisors.map(sa => <option key={sa.id} value={sa.name}>{sa.name}</option>)}
                    </select>
                  </div>
                  {formData.jobType === JobType.BodyAndPaint && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Chi phí nhân công / Báo giá (Đồng sơn)</label>
                      <div className="relative mt-1">
                        <input 
                          type="text" 
                          name="laborCost" 
                          value={formData.laborCost ? Math.round(Number(formData.laborCost)).toLocaleString('vi-VN') : ''} 
                          onChange={(e) => {
                            const rawValue = e.target.value.replace(/[^0-9]/g, '');
                            const numericValue = rawValue ? parseInt(rawValue, 10) : 0;
                            setFormData(prev => ({ ...prev, laborCost: numericValue }));
                          }} 
                          placeholder="VD: 6.217.927"
                          className="block w-full p-2 pr-14 border border-gray-300 rounded-md font-bold text-gray-800 focus:ring-2 focus:ring-brand-blue outline-none" 
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500 font-bold text-xs">
                          vnđ
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{isAppointmentMode ? 'Thời gian hẹn' : 'Thời gian bắt đầu (DK)'}</label>
                    <input 
                      type="datetime-local" 
                      name="plannedStartTime" 
                      value={formData.plannedStartTime || ''} 
                      onChange={handleChange} 
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      required 
                    />
                  </div>
                  {formData.jobType !== JobType.BodyAndPaint && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Thời gian thực hiện (phút) <span className="text-red-500">*</span></label>
                        <input 
                            type="number" 
                            name="durationMinutes" 
                            value={formData.durationMinutes || ''} 
                            onChange={handleNumberChange} 
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md" 
                            placeholder="Ví dụ: 30, 45, 60..."
                            min="1"
                            required
                            list="duration-options"
                        />
                        <datalist id="duration-options">
                            <option value="5" />
                            <option value="10" />
                            <option value="15" />
                            <option value="20" />
                            <option value="30" />
                            <option value="45" />
                            <option value="60" />
                            <option value="90" />
                            <option value="120" />
                        </datalist>
                      </div>
                  )}
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Thời gian kết thúc (dự kiến)</label>
                      <input 
                        type="datetime-local" 
                        name="plannedEndTime" 
                        value={formData.plannedEndTime || ''} 
                        onChange={handleChange}
                        className={`mt-1 block w-full p-2 border border-gray-300 rounded-md ${formData.jobType !== JobType.BodyAndPaint ? 'bg-gray-100' : ''}`} 
                        readOnly={formData.jobType !== JobType.BodyAndPaint} 
                        required
                    />
                  </div>
                  
                  {!isAppointmentMode && (
                      <div className="flex items-center pt-6 space-x-6">
                          <div className="flex items-center">
                              <input type="checkbox" id="useLift" name="useLift" checked={formData.useLift} onChange={handleChange} className="h-4 w-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue" />
                              <label htmlFor="useLift" className="ml-2 block text-sm text-gray-900">Yêu cầu cầu nâng</label>
                          </div>
                          <div className="flex items-center">
                              <input type="checkbox" id="isWaitingCustomer" name="isWaitingCustomer" checked={formData.isWaitingCustomer} onChange={handleChange} className="h-4 w-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue" />
                              <label htmlFor="isWaitingCustomer" className="ml-2 block text-sm font-bold text-yellow-600">Khách chờ lấy xe</label>
                          </div>
                      </div>
                  )}
              </fieldset>

              {/* Chỉ Quản lý mới thấy phần chỉnh sửa thời gian thực tế */}
              {user?.role === Role.Manager && !isAppointmentMode && (
                  <div className="md:col-span-2 border-t pt-4 mt-4 bg-yellow-50 p-4 rounded-lg">
                      <h4 className="font-bold text-gray-700 mb-2">Điều chỉnh thời gian thực tế (Dành cho Quản lý)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700">Thời gian thực tế bắt đầu</label>
                              <input 
                        type="datetime-local" 
                        name="actualStartTime" 
                        value={formData.actualStartTime || ''} 
                        onChange={handleChange} 
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Thời gian thực tế kết thúc</label>
                      <input 
                          type="datetime-local" 
                          name="actualEndTime" 
                          value={formData.actualEndTime || ''} 
                          onChange={handleChange} 
                          className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      />
                  </div>
                      </div>
                  </div>
              )}
            </div>
            
            <div className="pt-4 flex justify-between">
              <div>
                {isEditMode && (user?.role === Role.Manager || user?.role === Role.GeneralManager || user?.name === existingJob?.advisorName) && (
                  <button type="button" onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                    Xóa
                  </button>
                )}
              </div>
              <div className="flex space-x-2">
                  <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
                    Hủy
                  </button>
                  <button type="submit" className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                    {isSubmitting ? 'Đang lưu...' : (isEditMode ? 'Lưu thay đổi' : (isAppointmentMode ? 'Tạo hẹn' : 'Thêm việc'))}
                  </button>
              </div>
            </div>
        </form>
      </div>
    </div>
  );
};

export default JobForm;
