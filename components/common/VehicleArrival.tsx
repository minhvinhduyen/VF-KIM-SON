
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../hooks/useApp';
import { Job, JobStatus, JobType, Vehicle } from '../../types';

const VehicleArrival: React.FC = () => {
  const { state, addJob, updateJob, refreshData } = useApp();

  // State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [scanStep, setScanStep] = useState<'live' | 'processing' | 'result'>('live');
  const [scannedPlate, setScannedPlate] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State tìm kiếm xe
  const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
  const [showInvalidWarning, setShowInvalidWarning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Helper: Normalize & Format ---
  
  // Hàm chuẩn hóa để so sánh: Xóa hết ký tự đặc biệt, chỉ giữ chữ và số (VD: "51E-316.14" -> "51E31614")
  const normalizePlate = (plate: string) => plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const formatLicensePlate = (raw: string): string => {
      const clean = normalizePlate(raw);
      if (/^[A-Z]{2}/.test(clean)) { // QH-12...
          if (clean.length > 2) return `${clean.slice(0, 2)}-${clean.slice(2, 7)}`;
          return clean;
      }
      if (/^\d{2}[A-Z]{2}/.test(clean)) { // 50LD-123.45
          if (clean.length >= 8) return `${clean.slice(0, 4)}-${clean.slice(4, 7)}.${clean.slice(7, 9)}`;
          if (clean.length > 4) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
          return clean;
      }
      if (/^\d{2}[A-Z]/.test(clean)) { // 50A-123.45
          if (clean.length >= 8) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}.${clean.slice(6, 8)}`;
          if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3, 8)}`;
          return clean;
      }
      return clean;
  };

  // --- Real-time Lookup Effect (Smart Search) ---
  useEffect(() => {
      if (!scannedPlate) {
          setFoundVehicle(null);
          return;
      }
      const searchKey = normalizePlate(scannedPlate);
      if (searchKey.length < 3) return; // Chỉ tìm khi nhập đủ dài

      // Tìm kiếm thông minh: So sánh chuỗi đã chuẩn hóa (bỏ dấu câu)
      const vehicle = state.vehicles.find(v => normalizePlate(v.licensePlate) === searchKey);
      setFoundVehicle(vehicle || null);
  }, [scannedPlate, state.vehicles]);

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      try {
          await refreshData();
          setStatusMessage({ type: 'success', text: 'Đã cập nhật dữ liệu mới nhất!' });
      } catch (error) {
          setStatusMessage({ type: 'error', text: 'Lỗi cập nhật dữ liệu.' });
      } finally {
          setIsRefreshing(false);
          // Tự tắt thông báo sau 3s
          setTimeout(() => setStatusMessage(null), 3000);
      }
  };

  const validateLicensePlate = (plate: string): boolean => {
      const oldPersonalRegex = /^\d{2}[A-Z]-\d{4}$/;
      const newPersonalRegex = /^\d{2}[A-Z]-\d{3}\.\d{2}$/;
      const jointVentureRegex = /^\d{2}[A-Z]{2}-\d{3}\.\d{2}$/;
      const militaryRegex = /^[A-Z]{2}-\d+$/;
      return oldPersonalRegex.test(plate) || newPersonalRegex.test(plate) || jointVentureRegex.test(plate) || militaryRegex.test(plate);
  };

  // --- Camera Management ---
  const stopStream = useCallback(() => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
  }, []);

  const startStream = useCallback(async () => {
      stopStream();
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment' } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
          }
      } catch (err) {
          setStatusMessage({ type: 'error', text: 'Không thể mở camera.' });
      }
  }, [stopStream]);

  useEffect(() => {
      if (isScannerOpen && scanStep === 'live') {
          startStream();
      }
      return () => stopStream();
  }, [isScannerOpen, scanStep, startStream, stopStream]);

  // --- Actions ---
  const handleOpenScanner = () => {
      setStatusMessage(null);
      setScannedPlate('');
      setFoundVehicle(null);
      setCapturedImage(null);
      setScanStep('live');
      setIsScannerOpen(true);
      setIsManualInputOpen(false);
      setShowInvalidWarning(false);
  };

  const handleCloseScanner = () => {
      stopStream();
      setIsScannerOpen(false);
  };

  const handleOpenManualInput = () => {
      setStatusMessage(null);
      setScannedPlate('');
      setFoundVehicle(null);
      setIsManualInputOpen(true);
      setIsScannerOpen(false);
      setShowInvalidWarning(false);
  };

  const handleCloseManualInput = () => {
      setIsManualInputOpen(false);
      setScannedPlate('');
      setFoundVehicle(null);
  };

  const handleRetake = () => {
      setCapturedImage(null);
      setScannedPlate('');
      setFoundVehicle(null);
      setScanStep('live');
      setStatusMessage(null);
  };

  const handleCaptureAndScan = async () => {
      if (!videoRef.current) return;

      const video = videoRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      
      // Tính toán vùng cắt (Cropping) tương ứng với khung ngắm (tỷ lệ 1.6)
      let cropWidth, cropHeight;
      if (vw / vh > 1.6) {
          cropHeight = vh * 0.6; 
          cropWidth = cropHeight * 1.6;
      } else {
          cropWidth = vw * 0.8;
          cropHeight = cropWidth / 1.6;
      }
      const startX = (vw - cropWidth) / 2;
      const startY = (vh - cropHeight) / 2;

      // Tính toán kích thước thu nhỏ (Downscale chiều cao tối đa 480px)
      const scale = Math.min(1, 480 / cropHeight);
      const targetWidth = Math.floor(cropWidth * scale);
      const targetHeight = Math.floor(cropHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
          ctx.drawImage(video, startX, startY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
          
          // Chuyển sang ảnh Trắng Đen (Grayscale)
          const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
              const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              data[i] = gray;     // Red
              data[i + 1] = gray; // Green
              data[i + 2] = gray; // Blue
          }
          ctx.putImageData(imgData, 0, 0);
      }

      // Nén định dạng WebP chất lượng 70%
      const imageUrl = canvas.toDataURL('image/webp', 0.7);
      
      setCapturedImage(imageUrl);
      stopStream();
      setScanStep('processing');

      try {
        setScanStep('processing');
        const base64Data = imageUrl.split(',')[1];
        
        const response = await fetch('/api/scan-plate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Data })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Lỗi khi quét biển số');
        }

        const data = await response.json();
        const text = data.plate;
        const formatted = formatLicensePlate(text);
        setScannedPlate(formatted);
        setScanStep('result');

      } catch (error: any) {
          console.error("Scan Error Detail:", error);
          const errorMsg = error.message || 'Không nhận diện được biển số. Vui lòng thử lại.';
          setStatusMessage({ type: 'error', text: errorMsg });
          setScanStep('result');
      }
  };

  // State cho hộp thoại xác nhận lịch hẹn tương lai
  const [futureAppointmentDialog, setFutureAppointmentDialog] = useState<{
    appointment: Job;
    cleanPlate: string;
    knownVehicle: Vehicle | null;
  } | null>(null);

  const handleConfirmAndSubmit = async () => {
      const cleanPlate = scannedPlate.trim();
      
      if (!cleanPlate) {
          setStatusMessage({ type: 'error', text: 'Vui lòng nhập biển số.' });
          return;
      }

      if (!validateLicensePlate(cleanPlate)) {
          setShowInvalidWarning(true);
          return;
      }
      
      setIsSubmitting(true);
      try {
        if (cleanPlate.length < 5) {
             throw new Error("Biển số quá ngắn. Vui lòng kiểm tra lại.");
        }

        const appointment = state.jobs.find(j => j.licensePlate === cleanPlate && j.status === JobStatus.Appointment);
        
        const activeJob = state.jobs.find(j => 
            j.licensePlate === cleanPlate && 
            j.status !== JobStatus.Ready && 
            j.status !== JobStatus.RepairComplete && 
            j.status !== JobStatus.Washing && 
            j.status !== JobStatus.Arrived && 
            j.status !== JobStatus.Appointment &&
            j.status !== JobStatus.FreeInspection && 
            j.status !== JobStatus.Quotation &&
            j.status !== JobStatus.Exited &&
            j.status !== JobStatus.MissedAppointment
        );

        if (activeJob) {
            throw new Error(`Xe ${cleanPlate} đang sửa chữa trong xưởng.`);
        }

        const knownVehicle = foundVehicle;
        
        if (appointment) {
            const appointmentDate = new Date(appointment.plannedStartTime);
            const now = new Date();
            
            // So sánh ngày (bỏ qua giờ)
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const apptDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
            
            const isSameDay = apptDay.getTime() === todayStart.getTime();
            const isFuture = apptDay.getTime() > todayStart.getTime();
            const isPast = apptDay.getTime() < todayStart.getTime();

            if (isSameDay) {
                // === HẸN ĐÚNG NGÀY HÔM NAY → Tự động khớp ===
                await updateJob({ ...appointment, status: JobStatus.Arrived, actualArrivalTime: now });
                alert(`Đã tiếp nhận xe hẹn ${cleanPlate} (${appointment.customerName}).`);
            } else if (isPast) {
                // === HẸN ĐÃ QUA NGÀY → Tự động "Bỏ hẹn" + Tạo vãng lai ===
                await updateJob({ ...appointment, status: JobStatus.MissedAppointment });
                
                const newJob: Job = {
                    id: crypto.randomUUID(),
                    licensePlate: cleanPlate,
                    customerName: appointment.customerName,
                    carModel: appointment.carModel,
                    customerPhone: appointment.customerPhone,
                    vin: appointment.vin,
                    jobType: JobType.Repair,
                    advisorName: 'Chưa giao',
                    status: JobStatus.Arrived,
                    plannedStartTime: now,
                    plannedEndTime: new Date(now.getTime() + 60 * 60 * 1000),
                    actualArrivalTime: now,
                    useLift: false,
                    isAppointment: false,
                };
                await addJob(newJob);
                
                const apptDateStr = appointmentDate.toLocaleDateString('vi-VN');
                alert(`Xe ${cleanPlate} có lịch hẹn ${appointment.jobType} ngày ${apptDateStr} đã quá hạn.\nĐã tự động hủy hẹn cũ và tạo công việc mới.`);
            } else if (isFuture) {
                // === HẸN TƯƠNG LAI → Hiện hộp thoại hỏi xác nhận ===
                setFutureAppointmentDialog({
                    appointment,
                    cleanPlate,
                    knownVehicle,
                });
                setIsSubmitting(false);
                return; // Dừng lại, chờ user chọn
            }
        } else {
            const existingArrival = state.jobs.find(j => j.licensePlate === cleanPlate && j.status === JobStatus.Arrived);
            if (existingArrival) {
                 throw new Error(`Xe ${cleanPlate} đã ở trong danh sách chờ.`);
            }

            const now = new Date();
            const newJob: Job = {
                id: crypto.randomUUID(),
                licensePlate: cleanPlate,
                customerName: knownVehicle ? knownVehicle.customerName : 'Khách vãng lai',
                carModel: knownVehicle ? knownVehicle.carModel : 'Khác',
                customerPhone: knownVehicle ? knownVehicle.customerPhone : undefined,
                vin: knownVehicle ? knownVehicle.vin : undefined,
                jobType: JobType.Repair,
                advisorName: 'Chưa giao',
                status: JobStatus.Arrived,
                plannedStartTime: now,
                plannedEndTime: new Date(now.getTime() + 60 * 60 * 1000),
                actualArrivalTime: now,
                useLift: false,
                isAppointment: false,
            };
            await addJob(newJob);
            
            const infoText = knownVehicle 
                ? `\nKhách: ${knownVehicle.customerName}\nXe: ${knownVehicle.carModel}`
                : '\n(Khách vãng lai - Chưa có thông tin)';
            alert(`Đã tiếp nhận xe ${cleanPlate}.${infoText}`);
        }

        handleCloseScanner();
        handleCloseManualInput();
      } catch (e) {
          setStatusMessage({ type: 'error', text: (e as Error).message });
      } finally {
          setIsSubmitting(false);
      }
  };

  // Xử lý khi user chọn trong hộp thoại hẹn tương lai
  const handleFutureAppointmentChoice = async (choice: 'new_job' | 'use_appointment' | 'cancel') => {
      if (!futureAppointmentDialog) return;

      const { appointment, cleanPlate, knownVehicle } = futureAppointmentDialog;
      const now = new Date();

      setIsSubmitting(true);
      try {
          if (choice === 'new_job') {
              // Tạo công việc mới, GIỮ NGUYÊN lịch hẹn tương lai
              const newJob: Job = {
                  id: crypto.randomUUID(),
                  licensePlate: cleanPlate,
                  customerName: knownVehicle?.customerName || appointment.customerName,
                  carModel: knownVehicle?.carModel || appointment.carModel,
                  customerPhone: knownVehicle?.customerPhone || appointment.customerPhone,
                  vin: knownVehicle?.vin || appointment.vin,
                  jobType: JobType.Repair,
                  advisorName: 'Chưa giao',
                  status: JobStatus.Arrived,
                  plannedStartTime: now,
                  plannedEndTime: new Date(now.getTime() + 60 * 60 * 1000),
                  actualArrivalTime: now,
                  useLift: false,
                  isAppointment: false,
              };
              await addJob(newJob);
              
              const apptDateStr = new Date(appointment.plannedStartTime).toLocaleDateString('vi-VN');
              alert(`Đã tiếp nhận xe ${cleanPlate} như khách vãng lai.\nLịch hẹn ${appointment.jobType} ngày ${apptDateStr} vẫn được giữ nguyên.`);
          } else if (choice === 'use_appointment') {
              // Xe đến sớm cho lịch hẹn → Cập nhật lịch hẹn cũ thành Arrived
              await updateJob({ ...appointment, status: JobStatus.Arrived, actualArrivalTime: now });
              alert(`Đã tiếp nhận xe ${cleanPlate} cho lịch hẹn ${appointment.jobType}.`);
          }
          // choice === 'cancel' → không làm gì

          handleCloseScanner();
          handleCloseManualInput();
      } catch (e) {
          setStatusMessage({ type: 'error', text: (e as Error).message });
      } finally {
          setIsSubmitting(false);
          setFutureAppointmentDialog(null);
      }
  };

  const handleCloseInvalidWarning = () => {
      setShowInvalidWarning(false);
  };

  // --- Render Functions ---

  const renderFoundVehicleInfo = () => {
      if (!foundVehicle) {
          // Hiển thị trạng thái dữ liệu để debug
          if (scannedPlate.length > 3) {
            return (
                 <div className="mt-2 p-2 text-center text-xs text-gray-400">
                    Không tìm thấy trong CSDL ({state.vehicles.length} xe)
                 </div>
            )
          }
          return null;
      }
      return (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg animate-fade-in-up">
              <div className="flex items-center text-green-800 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-bold text-sm">Đã tìm thấy:</span>
              </div>
              <div className="text-sm text-gray-700 ml-6">
                  <p><strong>Khách:</strong> {foundVehicle.customerName}</p>
                  <p><strong>Xe:</strong> {foundVehicle.carModel}</p>
              </div>
          </div>
      );
  };

  // ... (Invalid Modal & Camera Overlay similar to previous but using updated logic if needed - keeping it concise) ...
  const renderInvalidWarningModal = () => {
      if (!showInvalidWarning) return null;
      return (
          <div className="fixed inset-0 z-[60] bg-red-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-bounce-in">
                  <div className="p-6 text-center">
                      <h3 className="text-2xl font-bold text-red-700 mb-2">CẢNH BÁO BIỂN SỐ SAI!</h3>
                      <p className="text-gray-600 mb-4">Biển số <span className="font-bold">{scannedPlate}</span> không đúng quy định.</p>
                      <button onClick={handleCloseInvalidWarning} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">QUAY LẠI</button>
                  </div>
              </div>
          </div>
      );
  };

  const renderCameraOverlay = () => {
    if (!isScannerOpen) return null;
    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
                 <h3 className="text-white font-bold">Quét Biển Số</h3>
                 <button onClick={handleCloseScanner} className="text-white p-2 rounded-full bg-white/20">X</button>
            </div>
            {/* Viewport */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                 {capturedImage ? (
                    <img src={capturedImage} className="w-full h-full object-cover opacity-60" alt="Captured" />
                 ) : (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                 )}
                 {scanStep === 'live' && <div className="absolute w-72 h-48 border-2 border-white/80 rounded-lg z-10 pointer-events-none" />}
                 {scanStep === 'processing' && <div className="absolute text-white font-bold">Đang xử lý...</div>}
            </div>
            {/* Controls */}
            <div className="bg-white p-6 rounded-t-3xl z-20 min-h-[160px]">
                {scanStep === 'live' ? (
                    <div className="flex justify-center">
                        <button onClick={handleCaptureAndScan} className="w-20 h-20 rounded-full border-4 border-blue-600 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-blue-600"></div>
                        </button>
                    </div>
                ) : (
                     <div className="space-y-4">
                         <div className="flex gap-3">
                            <input 
                                type="text" 
                                value={scannedPlate} 
                                onChange={(e) => setScannedPlate(formatLicensePlate(e.target.value))}
                                className="w-full text-2xl font-bold border-b-2 outline-none uppercase"
                                placeholder="59A-..."
                            />
                            <button onClick={handleConfirmAndSubmit} disabled={isSubmitting} className="bg-blue-600 text-white font-bold px-4 rounded">
                                {isSubmitting ? '...' : 'OK'}
                            </button>
                         </div>
                         {renderFoundVehicleInfo()}
                         <button onClick={handleRetake} className="w-full text-gray-500 font-semibold text-sm">Quét lại</button>
                     </div>
                )}
            </div>
         </div>
    )
  };

  const renderManualInputModal = () => {
      if (!isManualInputOpen) return null;
      return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-gray-800 text-lg">Nhập Biển Số</h3>
                      <button onClick={handleCloseManualInput} className="text-gray-500 p-2">X</button>
                  </div>
                  <div className="p-6">
                      <input 
                          type="text" 
                          value={scannedPlate}
                          onChange={(e) => setScannedPlate(formatLicensePlate(e.target.value))}
                          onKeyDown={(e) => { if(e.key === 'Enter') handleConfirmAndSubmit() }}
                          className="w-full text-4xl font-bold text-center border-2 border-gray-200 rounded-xl py-4 bg-gray-50 uppercase tracking-wider"
                          placeholder="59A-..."
                          autoFocus
                      />
                      {renderFoundVehicleInfo()}
                      {statusMessage && <p className={`mt-2 text-center text-sm ${statusMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{statusMessage.text}</p>}
                      <button onClick={handleConfirmAndSubmit} disabled={isSubmitting} className="w-full mt-6 bg-brand-blue text-white font-bold py-4 rounded-xl">
                           {isSubmitting ? 'Đang xử lý...' : 'Tiếp nhận xe'}
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  const arrivedVehicles = state.jobs.filter(j => j.status === JobStatus.Arrived || j.status === JobStatus.TicketOpened || j.status === JobStatus.Waiting)
                                    .sort((a, b) => (b.actualArrivalTime?.getTime() || 0) - (a.actualArrivalTime?.getTime() || 0));

  return (
    <div className="bg-white rounded-lg shadow border overflow-hidden">
      <div className="p-4 flex flex-col gap-4">
         {/* Data Status Indicator */}
         <div className="flex justify-between items-center bg-gray-50 p-2 rounded border text-xs text-gray-500">
             <span>Đã tải {state.vehicles.length} xe từ CSDL</span>
             <button onClick={handleManualRefresh} className="flex items-center text-blue-600 hover:text-blue-800 font-semibold" disabled={isRefreshing}>
                 <svg className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 {isRefreshing ? 'Đang tải...' : 'Làm mới'}
             </button>
         </div>

         <div className="grid grid-cols-2 gap-3">
             <button onClick={handleOpenScanner} className="flex flex-col items-center gap-2 bg-gradient-to-br from-blue-600 to-blue-700 text-white p-4 rounded-xl shadow-md">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="font-bold text-lg">Quét Camera</span>
             </button>
             <button onClick={handleOpenManualInput} className="flex flex-col items-center gap-2 bg-white border-2 border-gray-100 text-gray-700 p-4 rounded-xl shadow-sm">
                 <svg className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <span className="font-bold text-lg">Nhập Tay</span>
             </button>
         </div>

         <div className="mt-2">
            <h4 className="text-sm font-bold text-gray-500 uppercase mb-2 tracking-wide">Xe đang chờ ({arrivedVehicles.length})</h4>
            <ul className="divide-y border rounded-xl max-h-[400px] overflow-y-auto bg-gray-50/50">
                {arrivedVehicles.length === 0 ? <li className="p-8 text-center text-gray-400 italic">Chưa có xe nào.</li> : arrivedVehicles.map(job => {
                    const timeString = job.actualArrivalTime 
                        ? new Date(job.actualArrivalTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) 
                        : '--:--';
                    
                    let badgeText = '';
                    let badgeClass = '';

                    if (job.status === JobStatus.TicketOpened) {
                        badgeText = 'Đã mở phiếu';
                        badgeClass = 'bg-indigo-100 text-indigo-700';
                    } else if (job.status === JobStatus.Waiting) {
                        badgeText = 'Chờ SC';
                        badgeClass = 'bg-gray-200 text-gray-700';
                    } else {
                        // Status is likely Arrived
                        if (job.isAppointment) {
                            if (job.jobType === JobType.BodyAndPaint) {
                                badgeText = 'Có hẹn ĐS';
                            } else if (job.jobType === JobType.Warranty) {
                                badgeText = 'Có hẹn BH';
                            } else {
                                badgeText = 'Có hẹn SCC';
                            }
                            badgeClass = 'bg-purple-100 text-purple-700';
                        } else {
                            badgeText = 'Vãng lai';
                            badgeClass = 'bg-yellow-100 text-yellow-700';
                        }
                    }

                    return (
                        <li key={job.id} className="p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors bg-white">
                            <div className="flex justify-between items-start">
                                {/* Left Side: Plate, Time, Name, Model */}
                                <div className="flex flex-col">
                                     <div className="flex items-baseline gap-2">
                                         <span className="text-xl font-bold text-gray-900 font-mono">{job.licensePlate}</span>
                                         <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                            {timeString}
                                         </span>
                                     </div>
                                     <div className="text-sm text-gray-700 font-medium mt-1">
                                        {job.customerName || 'Khách vãng lai'}
                                     </div>
                                     <div className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">
                                        {job.carModel}
                                     </div>
                                </div>

                                {/* Right Side: Status Badge */}
                                <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${badgeClass}`}>
                                    {badgeText}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
         </div>
      </div>
      {renderCameraOverlay()}
      {renderManualInputModal()}
      {renderInvalidWarningModal()}

      {/* Hộp thoại xác nhận lịch hẹn tương lai */}
      {futureAppointmentDialog && (() => {
          const { appointment, cleanPlate } = futureAppointmentDialog;
          const apptDate = new Date(appointment.plannedStartTime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
          const jobTypeName = appointment.jobType;
          return (
              <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
                      {/* Header */}
                      <div className="bg-amber-500 p-4 text-center">
                          <div className="text-4xl mb-2">📅</div>
                          <h3 className="text-xl font-bold text-white">Xe có lịch hẹn sắp tới</h3>
                      </div>
                      
                      {/* Content */}
                      <div className="p-5">
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                              <p className="text-sm text-gray-700">
                                  Xe <span className="font-bold text-lg">{cleanPlate}</span> có lịch hẹn:
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                  <span className="bg-amber-200 text-amber-800 px-2 py-1 rounded font-bold text-sm">{jobTypeName}</span>
                                  <span className="text-gray-600 font-medium">{apptDate}</span>
                              </div>
                              <p className="text-sm text-gray-500 mt-2">
                                  Khách: <span className="font-medium">{appointment.customerName}</span>
                              </p>
                          </div>

                          <p className="text-sm text-gray-600 mb-4 font-medium text-center">
                              Xe đến hôm nay vì lý do gì?
                          </p>

                          <div className="space-y-3">
                              {/* Option 1: New job, keep appointment */}
                              <button 
                                  onClick={() => handleFutureAppointmentChoice('new_job')}
                                  disabled={isSubmitting}
                                  className="w-full flex items-start gap-3 p-3 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl transition-colors text-left"
                              >
                                  <span className="text-2xl mt-0.5">🔧</span>
                                  <div>
                                      <p className="font-bold text-blue-800">Công việc khác (BD/SCC/BH)</p>
                                      <p className="text-xs text-blue-600 mt-0.5">Tạo công việc mới, giữ nguyên lịch hẹn {jobTypeName}</p>
                                  </div>
                              </button>

                              {/* Option 2: Use appointment early */}
                              <button 
                                  onClick={() => handleFutureAppointmentChoice('use_appointment')}
                                  disabled={isSubmitting}
                                  className="w-full flex items-start gap-3 p-3 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-xl transition-colors text-left"
                              >
                                  <span className="text-2xl mt-0.5">📋</span>
                                  <div>
                                      <p className="font-bold text-green-800">Đến sớm cho lịch hẹn {jobTypeName}</p>
                                      <p className="text-xs text-green-600 mt-0.5">Tiếp nhận xe cho lịch hẹn này (đến trước ngày hẹn)</p>
                                  </div>
                              </button>

                              {/* Option 3: Cancel */}
                              <button 
                                  onClick={() => handleFutureAppointmentChoice('cancel')}
                                  disabled={isSubmitting}
                                  className="w-full p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium text-center"
                              >
                                  Hủy
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          );
      })()}
    </div>
  );
};

export default VehicleArrival;
