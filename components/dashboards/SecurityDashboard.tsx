import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import { Job, JobStatus, JobType, Role } from '../../types';

const SecurityDashboard: React.FC = () => {
  const { state, addJob, updateJob, refreshData } = useApp();
  const { user } = useAuth();
  const [activeTab, setActiveTab ] = useState<'entry' | 'exit'>('entry');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Scanner/Input state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [scanStep, setScanStep] = useState<'live' | 'processing' | 'result'>('live');
  const [scannedPlate, setScannedPlate] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Helper Logic ---
  const normalizePlate = (plate: string) => plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const formatLicensePlate = (raw: string): string => {
      const clean = normalizePlate(raw);
      if (/^[A-Z]{2}/.test(clean)) {
          if (clean.length > 2) return `${clean.slice(0, 2)}-${clean.slice(2, 7)}`;
          return clean;
      }
      if (/^\d{2}[A-Z]{2}/.test(clean)) {
          if (clean.length >= 8) return `${clean.slice(0, 4)}-${clean.slice(4, 7)}.${clean.slice(7, 9)}`;
          if (clean.length > 4) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
          return clean;
      }
      if (/^\d{2}[A-Z]/.test(clean)) {
          if (clean.length >= 8) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}.${clean.slice(6, 8)}`;
          if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3, 8)}`;
          return clean;
      }
      return clean;
  };

  const validateLicensePlate = (plate: string): boolean => {
      const p = normalizePlate(plate);
      return p.length >= 5;
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
        const formatted = formatLicensePlate(data.plate);
        setScannedPlate(formatted);
        setScanStep('result');
      } catch (error: any) {
          console.error("Scan Error Detail:", error);
          const errorMsg = error.message || 'Nhận diện lỗi. Vui lòng nhập tay.';
          setStatusMessage({ type: 'error', text: errorMsg });
          setScanStep('result');
      }
  };

  const handleAction = async () => {
      const plate = scannedPlate.trim();
      if (!validateLicensePlate(plate)) {
          setStatusMessage({ type: 'error', text: 'Biển số không hợp lệ.' });
          return;
      }

      setIsSubmitting(true);
      try {
        const now = new Date();
        const activeJobsForPlate = state.jobs.filter(j => normalizePlate(j.licensePlate) === normalizePlate(plate) && j.status !== JobStatus.Exited);

        if (activeTab === 'entry') {
            // Kiểm tra xem xe đã thực sự nằm trong xưởng chưa (trừ Lịch hẹn / Bỏ hẹn)
            const inWorkshopJob = activeJobsForPlate.find(j => j.status !== JobStatus.Appointment && j.status !== JobStatus.MissedAppointment);
            
            if (inWorkshopJob) {
                throw new Error(`Xe ${plate} đã có lệnh ở trong xưởng chưa ra cổng.`);
            }
            
            // Tìm xem xe có lịch hẹn (hoặc bỏ hẹn) nào không
            const appointmentJob = activeJobsForPlate.find(j => j.status === JobStatus.Appointment || j.status === JobStatus.MissedAppointment);
            
            if (appointmentJob) {
                // Nếu có lịch hẹn, cập nhật lịch hẹn thành trạng thái Đã đến xưởng (Tiếp nhận)
                await updateJob({
                    ...appointmentJob,
                    status: JobStatus.Arrived,
                    actualArrivalTime: now,
                });
                setStatusMessage({ type: 'success', text: `Đã tiếp nhận xe ${plate} từ Lịch hẹn thành công.` });
            } else {
                // Nếu không có lịch hẹn, tạo phiếu mới hoàn toàn
                const vehicle = state.vehicles.find(v => normalizePlate(v.licensePlate) === normalizePlate(plate));
                
                const newJob: Job = {
                    id: crypto.randomUUID(),
                    licensePlate: plate,
                    customerName: vehicle ? vehicle.customerName : 'Khách vãng lai',
                    carModel: vehicle ? vehicle.carModel : 'Khác',
                    customerPhone: vehicle ? vehicle.customerPhone : undefined,
                    vin: vehicle ? vehicle.vin : undefined,
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
                setStatusMessage({ type: 'success', text: `Đã nhập xe ${plate} vào xưởng.` });
            }
            setTimeout(() => setStatusMessage(null), 3000);
        } else {
            // EXIT Tab
            const activeJobs = activeJobsForPlate;
            
            if (activeJobs.length === 0) {
                throw new Error(`Không tìm thấy xe ${plate} đang ở trong xưởng.`);
            }

            // Kiểm tra nếu xe đang trong quá trình Rửa xe
            const isWashing = activeJobs.some(j => j.status === JobStatus.Washing);
            if (isWashing) {
                throw new Error(`Xe ${plate} đang trong danh sách chờ rửa hoặc đang rửa. Vui lòng chờ hoàn tất rửa xe trước khi cho ra cổng.`);
            }

            // Kiểm tra trạng thái sẵn sàng ra cổng
            const readyStatuses = [JobStatus.Ready, JobStatus.RepairComplete, JobStatus.FreeInspection, JobStatus.Quotation];
            const isReady = activeJobs.some(j => readyStatuses.includes(j.status));
            
            if (!isReady) {
                throw new Error(`Xe ${plate} chưa hoàn thành sửa chữa hoặc chưa được cấp phép ra cổng.`);
            }
            
            // Cập nhật tất cả các lệnh liên quan của xe này thành "Đã ra cổng"
            for (const activeJob of activeJobs) {
                await updateJob({
                    ...activeJob,
                    status: JobStatus.Exited,
                    actualExitTime: now
                });
            }
            
            setStatusMessage({ type: 'success', text: `Xác nhận xe ${plate} ra cổng thành công.` });
            setTimeout(() => setStatusMessage(null), 3000);
        }

        setTimeout(() => {
            setIsScannerOpen(false);
            setIsManualInputOpen(false);
            setScannedPlate('');
        }, 1500);
        
        await refreshData();
      } catch (e) {
          setStatusMessage({ type: 'error', text: (e as Error).message });
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- Render logic ---
  // Lọc danh sách xe "Đang ở cổng/chờ tiếp nhận"
  // Theo yêu cầu: Chỉ hiện xe mới vào (Arrived) và xe đã mở phiếu chờ sửa chữa (Pending)
  const entryTabJobs = state.jobs.filter(j => 
    j.status === JobStatus.Arrived || j.status === JobStatus.Pending
  );
  
  const uniqueArrivedJobs = entryTabJobs.reduce((acc: Job[], current) => {
      const existingIndex = acc.findIndex(j => normalizePlate(j.licensePlate) === normalizePlate(current.licensePlate));
      if (existingIndex === -1) {
          acc.push(current);
      } else {
          const existing = acc[existingIndex];
          const currentTime = current.actualArrivalTime ? new Date(current.actualArrivalTime).getTime() : 0;
          const existingTime = existing.actualArrivalTime ? new Date(existing.actualArrivalTime).getTime() : 0;
          if (currentTime > existingTime) {
              acc[existingIndex] = current;
          }
      }
      return acc;
  }, []).sort((a,b) => {
    const timeA = a.actualArrivalTime ? new Date(a.actualArrivalTime).getTime() : 0;
    const timeB = b.actualArrivalTime ? new Date(b.actualArrivalTime).getTime() : 0;
    return timeB - timeA;
  });

  const exitedList = state.jobs.filter(j => j.status === JobStatus.Exited)
                                .sort((a,b) => {
                                    const timeA = a.actualExitTime ? new Date(a.actualExitTime).getTime() : 0;
                                    const timeB = b.actualExitTime ? new Date(b.actualExitTime).getTime() : 0;
                                    return timeB - timeA;
                                })
                                .slice(0, 20);

  const readyToExitJobs = state.jobs.filter(j => {
    const isReadyStatus = [
      JobStatus.Ready, 
      JobStatus.RepairComplete, 
      JobStatus.FreeInspection, 
      JobStatus.Quotation
    ].includes(j.status);
    
    if (!isReadyStatus) return false;

    // Kiểm tra xem biển số này có đang trong danh sách Rửa xe (đang rửa hoặc chờ rửa) không
    const hasWashingJob = state.jobs.some(other => 
      normalizePlate(other.licensePlate) === normalizePlate(j.licensePlate) && 
      other.status === JobStatus.Washing
    );

    return !hasWashingJob;
  }).filter((job, index, self) => 
      index === self.findIndex((t) => normalizePlate(t.licensePlate) === normalizePlate(job.licensePlate))
  );

  const getStatusBadge = (status: JobStatus) => {
    switch(status) {
        case JobStatus.Arrived: return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold uppercase tracking-wide">Mới vào xưởng</span>;
        case JobStatus.Pending: return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wide">Chờ sửa chữa</span>;
        default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-lg mx-auto pb-20">
        <div className="bg-brand-blue p-4 text-white shadow-lg sticky top-0 z-10 font-sans">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold tracking-tight">Trạm Kiểm Soát Bảo Vệ</h1>
                <div className="text-xs text-right opacity-80 font-medium tracking-tight">
                    {user?.name}<br/>
                    {currentTime.toLocaleTimeString('vi-VN')}
                </div>
            </div>
            
            <div className="flex p-1 bg-white/20 rounded-xl backdrop-blur-sm">
                <button 
                    onClick={() => setActiveTab('entry')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === 'entry' ? 'bg-white text-brand-blue shadow-md scale-[1.02]' : 'text-white hover:bg-white/10'}`}
                >
                    Vào Cổng
                </button>
                <button 
                    onClick={() => setActiveTab('exit')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === 'exit' ? 'bg-white text-brand-blue shadow-md scale-[1.02]' : 'text-white hover:bg-white/10'}`}
                >
                    Ra Cổng
                </button>
            </div>
        </div>

        <div className="p-4 grid grid-cols-2 gap-4">
            <button 
                onClick={() => { setIsScannerOpen(true); setScanStep('live'); setStatusMessage(null); setScannedPlate(''); setCapturedImage(null); }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 group active:scale-95 transition-all"
            >
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span className="font-bold text-gray-700 text-sm">Quét biển số</span>
            </button>
            <button 
                onClick={() => { setIsManualInputOpen(true); setStatusMessage(null); setScannedPlate(''); }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 group active:scale-95 transition-all"
            >
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-600 group-hover:bg-gray-600 group-hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <span className="font-bold text-gray-700 text-sm">Nhập tay</span>
            </button>
        </div>

        <div className="px-4 pb-4">
            <h2 className="text-[11px] font-extrabold text-gray-400 uppercase mb-3 px-1 tracking-wider flex justify-between">
                <span>{activeTab === 'entry' ? `CHỜ TIẾP NHẬN (${uniqueArrivedJobs.length})` : `LỊCH SỬ RA CỔNG (GẦN NHẤT)`}</span>
                {activeTab === 'entry' && <span className="text-blue-500 lowercase font-normal italic">Ẩn khi bắt đầu sửa chữa</span>}
            </h2>
            <div className="space-y-3">
                {(activeTab === 'entry' ? uniqueArrivedJobs : exitedList).map(job => (
                    <div key={job.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center animate-fade-in-up">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="text-lg font-bold font-mono text-gray-800 tracking-tight leading-none">{job.licensePlate}</div>
                                {activeTab === 'entry' && getStatusBadge(job.status)}
                            </div>
                            <div className="text-[11px] text-gray-400 font-medium truncate uppercase tracking-tight">
                                {job.carModel} • {job.customerName}
                            </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                            <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                {activeTab === 'entry' 
                                    ? `VÀO: ${job.actualArrivalTime ? new Date(job.actualArrivalTime).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : '--:--'}`
                                    : `RA: ${job.actualExitTime ? new Date(job.actualExitTime).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : '--:--'}`
                                }
                            </div>
                        </div>
                    </div>
                ))}
                {(activeTab === 'entry' ? uniqueArrivedJobs : exitedList).length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-400 text-sm font-medium">Không có dữ liệu hiển thị</p>
                    </div>
                )}
            </div>
        </div>

        {isScannerOpen && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                <div className="p-4 flex justify-between items-center text-white">
                    <span className="font-bold">QUÉT MÃ RA/VÀO CỔNG</span>
                    <button onClick={() => setIsScannerOpen(false)} className="bg-white/20 p-2 rounded-full">X</button>
                </div>
                <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
                    {capturedImage ? <img src={capturedImage} className="w-full h-full object-cover opacity-60" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
                    {scanStep === 'live' && <div className="absolute w-64 h-40 border-2 border-white/50 rounded-lg pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />}
                </div>
                <div className="bg-white p-6 rounded-t-3xl">
                        {scanStep === 'live' ? <button onClick={handleCaptureAndScan} className="w-16 h-16 bg-blue-600 rounded-full mx-auto border-4 border-white shadow-lg" /> : (
                            <div className="space-y-4">
                                <input value={scannedPlate} onChange={e => setScannedPlate(formatLicensePlate(e.target.value))} className="w-full text-center text-3xl font-extrabold font-mono border-b-2 uppercase py-2 outline-none" />
                                {statusMessage && (
                                    <p className={`text-center text-sm font-bold ${statusMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                                        {statusMessage.text}
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={() => { setScanStep('live'); setCapturedImage(null); setStatusMessage(null); setScannedPlate(''); }} className="flex-1 py-3 text-gray-500 font-bold bg-gray-50 rounded-xl">Quét lại</button>
                                    <button onClick={handleAction} disabled={isSubmitting} className="flex-2 py-3 bg-brand-blue text-white font-bold rounded-xl">{isSubmitting ? 'Đang xử lý...' : (activeTab === 'entry' ? 'CÀI VÀO' : 'XÁC NHẬN RA')}</button>
                                </div>
                            </div>
                        )}
                </div>
            </div>
        )}

        {isManualInputOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-fade-in-up">
                    <div className="p-4 border-b flex justify-between items-center">
                        <span className="font-bold text-gray-700">Nhập biển số bằng tay</span>
                        <button onClick={() => setIsManualInputOpen(false)} className="text-gray-400">X</button>
                    </div>
                    <div className="p-6">
                        {activeTab === 'exit' && readyToExitJobs.length > 0 && (
                            <div className="mb-6">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Sẵn sàng giao ({readyToExitJobs.length}):</p>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                                    {readyToExitJobs.map(j => (
                                        <button key={j.id} onClick={() => setScannedPlate(j.licensePlate)} className={`px-2 py-1 rounded font-mono text-sm border ${scannedPlate === j.licensePlate ? 'bg-blue-600 text-white' : 'bg-gray-50'}`}>{j.licensePlate}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <input value={scannedPlate} onChange={e => setScannedPlate(formatLicensePlate(e.target.value))} className="w-full text-center text-4xl font-extrabold font-mono bg-gray-50 rounded-xl py-5 border-2 border-gray-100 uppercase outline-none" placeholder="59A-..." />
                        {statusMessage && (
                            <p className={`mt-3 text-center text-sm font-bold ${statusMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                                {statusMessage.text}
                            </p>
                        )}
                        <button onClick={handleAction} disabled={isSubmitting} className="w-full mt-6 bg-brand-blue text-white font-bold py-4 rounded-xl shadow-lg">{isSubmitting ? 'Đang xử lý...' : 'XÁC NHẬN'}</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SecurityDashboard;
