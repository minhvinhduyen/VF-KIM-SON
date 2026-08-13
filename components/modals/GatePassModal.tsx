
import React, { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import type { Job } from '../../types';
import { JobType, JobStatus, CAR_MODELS } from '../../types';
import { getFacilityById } from '../../services/facilitiesConfig';

interface GatePassModalProps {
  onClose: () => void;
}

const GatePassModal: React.FC<GatePassModalProps> = ({ onClose }) => {
  const { state, updateJob } = useApp();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    licensePlate: '',
    customerName: '',
    customerPhone: '',
    carModel: CAR_MODELS[0],
    km: 0,
    jobType: JobType.Repair,
    advisorName: user?.name || '',
    status: JobStatus.FreeInspection as JobStatus, // Default status
  });

  const [selectedJobId, setSelectedJobId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [error, setError] = useState('');

  // Chỉ hiển thị xe ở trạng thái "Chờ tiếp nhận" (chưa mở phiếu công việc)
  // Xe đã mở phiếu (TicketOpened, InProgress, Waiting...) phải theo quy trình và bảo vệ bấm cho ra cổng
  const arrivedVehicles = state.jobs.filter(j => 
    j.status === JobStatus.Arrived
  );

  const handleVehicleSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const jobId = e.target.value;
    setSelectedJobId(jobId);
    
    const job = state.jobs.find(j => j.id === jobId);
    if (job) {
        setFormData(prev => ({
            ...prev,
            licensePlate: job.licensePlate,
            customerName: job.customerName || '',
            customerPhone: job.customerPhone || '',
            carModel: job.carModel || CAR_MODELS[0],
            km: job.km || 0,
            jobType: job.jobType,
            status: JobStatus.FreeInspection, // Reset status selection
        }));
    } else {
        // Reset if deselecting
        setFormData(prev => ({
            ...prev,
            licensePlate: '',
            customerName: '',
            customerPhone: '',
            km: 0,
        }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedJobId) {
        setError("Vui lòng chọn xe đã đến xưởng.");
        return;
    }
    if (!formData.customerName || !formData.customerPhone || !formData.carModel) {
        setError("Vui lòng điền đầy đủ các thông tin bắt buộc.");
        return;
    }

    setIsSubmitting(true);
    try {
        const primaryJob = state.jobs.find(j => j.id === selectedJobId);
        if (!primaryJob) throw new Error("Không tìm thấy thông tin xe.");

        // Tìm tất cả các công việc liên quan đến xe này (cùng biển số)
        const relatedJobs = state.jobs.filter(j => j.licensePlate === primaryJob.licensePlate);

        // Cập nhật tất cả các công việc liên quan sang trạng thái Đã ra cổng
        const updatePromises = relatedJobs.map(job => {
            const updatedJob: Job = {
                ...job,
                // Nếu là công việc được chọn để in giấy ra cổng, cập nhật thêm thông tin từ form
                ...(job.id === selectedJobId ? formData : {}),
                status: JobStatus.Exited,
                // KHÔNG xóa bayId để vẫn hiện trên timeline theo yêu cầu người dùng
                actualEndTime: job.actualEndTime || new Date(), 
                // Đảm bảo có thời gian bắt đầu nếu chưa có
                actualStartTime: job.actualStartTime || job.plannedStartTime || new Date(),
            };
            return updateJob(updatedJob);
        });

        await Promise.all(updatePromises);
        setShowPrintPreview(true); // Chuyển sang màn hình in
    } catch (err) {
        setError((err as Error).message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (showPrintPreview) {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();

      return (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
             {/* Print Styles for A5 Landscape */}
            <style>
                {`
                    @page {
                        size: A5 landscape;
                        margin: 0;
                    }
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .printable-area, .printable-area * {
                            visibility: visible;
                        }
                        .printable-area {
                            position: fixed;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: 100%;
                            padding: 10mm;
                            background: white;
                            color: black;
                            display: flex;
                            flex-direction: column;
                            font-family: 'Times New Roman', Times, serif;
                        }
                        .no-print {
                            display: none !important;
                        }
                        html, body {
                            margin: 0;
                            padding: 0;
                            height: 100%;
                        }
                    }
                    .font-serif {
                        font-family: 'Times New Roman', Times, serif;
                    }
                `}
            </style>
            
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 font-serif">
                {/* Form Container mimicking A5 Landscape proportions on screen */}
                <div className="printable-area bg-white shadow-lg w-[210mm] min-h-[148mm] relative text-black p-[10mm] flex flex-col box-border">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-xs font-bold leading-relaxed">
                            <h3 className="uppercase text-sm mb-1">{(() => { const f = state.activeFacilityId ? getFacilityById(state.activeFacilityId) : null; return f ? f.name.toUpperCase() : 'VINFAST KIM SƠN'; })()}</h3>
                        </div>
                        <img src={state.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
                    </div>

                    {/* Title */}
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold uppercase tracking-wide">GIẤY RA CỔNG</h1>
                    </div>

                    {/* Body Content */}
                    <div className="flex justify-between mb-2">
                        {/* Left Column */}
                        <div className="w-2/3 pr-4 space-y-2 text-sm">
                            <p className="font-bold underline mb-2 text-base">Thông tin</p>
                            <div className="flex items-baseline">
                                <span className="w-36">Biển số xe:</span>
                                <span className="font-bold text-base uppercase">{formData.licensePlate}</span>
                            </div>
                            <div className="flex items-baseline">
                                <span className="w-36">Loại xe:</span>
                                <span>{formData.carModel}</span>
                            </div>
                            <div className="flex items-baseline">
                                <span className="w-36">Tên Khách hàng:</span>
                                <span className="font-bold">{formData.customerName}</span>
                            </div>
                             <div className="flex items-baseline">
                                <span className="w-36">Nội dung sửa chữa:</span>
                                <span>{formData.jobType} - {formData.status}</span>
                            </div>
                        </div>
                        
                        {/* Right Column */}
                        <div className="w-1/3 text-sm flex flex-col items-end pt-8 space-y-3">
                            <div className="flex items-baseline">
                                <span className="mr-2">Ngày tạo</span>
                                <span className="font-bold">{day}/{month}/{year}</span>
                            </div>
                            <div className="flex items-center">
                                <span className="mr-6 font-bold">Miễn phí</span>
                                <div className="border border-black w-6 h-6 flex items-center justify-center">
                                    {formData.status === JobStatus.FreeInspection ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    ) : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Signatures - Moved closer to content, added spacer for actual signature */}
                    <div className="flex justify-between text-center mt-4 text-sm">
                        <div className="w-1/3 flex flex-col items-center">
                            <p className="font-bold">Cố vấn dịch vụ</p>
                            <p className="italic text-xs mb-2">(Ký, họ tên)</p>
                            <div className="h-24"></div>
                        </div>
                        <div className="w-1/3 flex flex-col items-center">
                             <p className="font-bold">Thu ngân/ Cửa hàng trưởng</p>
                             <p className="italic text-xs mb-2">(Ký, họ tên)</p>
                             <div className="h-24"></div>
                        </div>
                        <div className="w-1/3 flex flex-col items-center">
                             <p className="font-bold">Bảo vệ cổng ra</p>
                             <p className="italic text-xs mb-2">(Ký, họ tên)</p>
                             <div className="h-24"></div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-end text-sm mt-auto">
                        <div className="italic font-bold">
                            Ghi chú: <span className="font-normal not-italic ml-2">Phiếu này chỉ có giá trị trong ngày ra cổng.</span>
                        </div>
                        <div className="italic">
                             Ngày .... Tháng .... Năm 202..
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="mt-6 flex gap-4 no-print">
                    <button 
                        onClick={handlePrint} 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        In Phiếu
                    </button>
                    <button 
                        onClick={onClose} 
                        className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg shadow"
                    >
                        Đóng & Quay lại
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-2xl max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-2xl font-bold text-gray-800">Tạo Giấy Ra Cổng</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Chọn xe đến xưởng <span className="text-red-500">*</span></label>
                    <select
                        value={selectedJobId}
                        onChange={handleVehicleSelection}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-brand-blue focus:border-brand-blue"
                        required
                    >
                        <option value="">-- Chọn xe --</option>
                        {arrivedVehicles.map(job => (
                            <option key={job.id} value={job.id}>
                                {job.licensePlate} - {job.carModel} (Đến: {new Date(job.actualArrivalTime || job.plannedStartTime).toLocaleTimeString('vi-VN')})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Tên khách hàng <span className="text-red-500">*</span></label>
                    <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Số điện thoại <span className="text-red-500">*</span></label>
                    <input type="text" name="customerPhone" value={formData.customerPhone} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Dòng xe <span className="text-red-500">*</span></label>
                    <select name="carModel" value={formData.carModel} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required>
                      {CAR_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Số Km</label>
                    <input type="number" name="km" value={formData.km} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Loại công việc</label>
                    <select name="jobType" value={formData.jobType} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                        <option value={JobType.Repair}>{JobType.Repair}</option>
                        <option value={JobType.BodyAndPaint}>{JobType.BodyAndPaint}</option>
                        <option value={JobType.Warranty}>{JobType.Warranty}</option>
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Cố vấn dịch vụ</label>
                    <input type="text" value={formData.advisorName} disabled className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed" />
                </div>

                <div className="md:col-span-2 border-t pt-4 mt-2">
                    <label className="block text-sm font-bold text-gray-800 mb-2">Trạng thái ra cổng <span className="text-red-500">*</span></label>
                    <div className="flex gap-4">
                        <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-blue-50 w-1/2">
                            <input 
                                type="radio" 
                                name="status" 
                                value={JobStatus.FreeInspection} 
                                checked={formData.status === JobStatus.FreeInspection} 
                                onChange={handleChange}
                                className="h-5 w-5 text-brand-blue"
                            />
                            <span className="ml-2 font-medium">Kiểm tra miễn phí</span>
                        </label>
                        <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-blue-50 w-1/2">
                            <input 
                                type="radio" 
                                name="status" 
                                value={JobStatus.Quotation} 
                                checked={formData.status === JobStatus.Quotation} 
                                onChange={handleChange}
                                className="h-5 w-5 text-brand-blue"
                            />
                            <span className="ml-2 font-medium">Báo giá</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="pt-6 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg">
                    Hủy
                </button>
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400 flex items-center"
                >
                    {isSubmitting ? 'Đang xử lý...' : 'Xác nhận ra cổng'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default GatePassModal;
