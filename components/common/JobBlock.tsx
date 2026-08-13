
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Job } from '../../types';
import { JobStatus } from '../../types';

interface JobBlockProps {
  job: Job;
  left: number;
  width: number;
  onDoubleClick: (job: Job) => void;
  onDragStart: (job: Job, e: React.MouseEvent<HTMLDivElement>) => void;
  onResizeStart: (job: Job, edge: 'left' | 'right', e: React.MouseEvent<HTMLDivElement>) => void;
  isFullScreen?: boolean;
  readOnly?: boolean;
}

const Tooltip: React.FC<{ job: Job; element: HTMLDivElement | null }> = ({ job, element }) => {
    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        display: 'none',
        transition: 'opacity 0.2s',
        opacity: 0,
    });

    const formatTime = (date?: Date) => date ? new Date(date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    useEffect(() => {
        if (element) {
            const rect = element.getBoundingClientRect();
            setStyle({
                position: 'fixed',
                top: `${rect.top - 8}px`,
                left: `${rect.left + rect.width / 2}px`,
                transform: 'translate(-50%, -100%)',
                zIndex: 9999, // Đảm bảo nó ở trên cùng
                opacity: 1,
            });
        }
    }, [element]);

    if (!element) return null;

    return createPortal(
        <div style={style} className="w-max max-w-xs p-3 bg-gray-800 text-white text-xs rounded-md shadow-lg pointer-events-none">
            <p className="font-bold border-b pb-1 mb-1">{job.licensePlate} - {job.customerName}</p>
            {job.isWaitingCustomer && <p className="text-yellow-400 font-bold mb-1">[★] Khách đợi lấy xe</p>}
            {job.customerPhone && <p><strong>SĐT:</strong> {job.customerPhone}</p>}
            <p><strong>Loại CV:</strong> {job.jobType}</p>
            <p><strong>CVDV:</strong> {job.advisorName}</p>
            <p><strong>Trạng thái:</strong> {job.status}</p>
            <p><strong>DK:</strong> {formatTime(job.plannedStartTime)} - {formatTime(job.plannedEndTime)}</p>
            {job.actualStartTime && <p><strong>TT:</strong> {formatTime(job.actualStartTime)} - {job.actualEndTime ? formatTime(job.actualEndTime) : 'Đang làm'}</p>}
        </div>,
        document.body
    );
};

const JobBlock: React.FC<JobBlockProps> = ({ job, left, width, onDoubleClick, onDragStart, onResizeStart, isFullScreen = false, readOnly = false }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const [isBeingResized, setIsBeingResized] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hiệu ứng này quản lý việc kết thúc thao tác thay đổi kích thước.
    // Khi bắt đầu thay đổi kích thước (isBeingResized = true), nó sẽ thêm một trình lắng nghe một lần cho sự kiện mouseup.
    // Khi chuột được thả ra ở bất kỳ đâu trên cửa sổ, việc thay đổi kích thước được coi là kết thúc.
    if (!isBeingResized) {
      return;
    }

    const handleMouseUp = () => {
      setIsBeingResized(false);
    };

    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isBeingResized]);


  const getStatusColor = () => {
    // Nếu công việc là một lịch hẹn và đang ở trạng thái hẹn hoặc mới đến, giữ màu đỏ của lịch hẹn.
    if (job.isAppointment && (job.status === JobStatus.Appointment || job.status === JobStatus.Arrived)) {
      return 'bg-status-appointment';
    }

    switch (job.status) {
      // JobStatus.Appointment được xử lý ở trên.
      case JobStatus.Arrived: // Dành cho khách vãng lai
        return 'bg-gray-400';
      case JobStatus.TicketOpened:
        return 'bg-status-ticket-opened'; // violet
      case JobStatus.Waiting:
        return 'bg-gray-400';
      case JobStatus.InProgress:
        return 'bg-status-inprogress'; // blue
      case JobStatus.Paused:
        return 'bg-status-paused'; // orange
      case JobStatus.RepairComplete:
        return 'bg-status-completed'; // green
      case JobStatus.FreeInspection:
        return 'bg-green-400';
      case JobStatus.Quotation:
        return 'bg-emerald-400';
      case JobStatus.Washing:
        return job.actualStartTime ? 'bg-status-washing' : 'bg-gray-400'; // Blue if started, Gray if pending
      case JobStatus.Ready:
        return 'bg-status-completed'; // Map Ready to Green as requested (Wash finish -> Green)
      case JobStatus.Exited:
        return 'bg-status-exited ring-1 ring-gray-400 shadow-lg';
      default:
        return 'bg-gray-500';
    }
  };

  const colorClass = getStatusColor();
  const isLocked = job.status === JobStatus.Paused;

  // CẬP NHẬT: Cho phép kéo thả lịch hẹn (bỏ điều kiện chặn isAppointment).
  // Chỉ chặn nếu công việc đã bắt đầu thực tế (actualStartTime) hoặc bị khóa (Paused) HOẶC readOnly.
  const isDraggable = !readOnly && !job.actualStartTime && !isLocked;
  
  // Logic resize giữ nguyên, cho phép co dãn miễn là chưa hoàn thành và không readOnly.
  const isResizable = !readOnly && 
    job.status !== JobStatus.RepairComplete && 
    job.status !== JobStatus.Washing && 
    job.status !== JobStatus.Ready && 
    job.status !== JobStatus.FreeInspection && 
    job.status !== JobStatus.Quotation && 
    !isLocked;
  
  const heightClass = isFullScreen ? 'h-8' : 'h-12';
  const paddingClass = isFullScreen ? 'p-1' : 'p-2';

  // Thêm z-index động. Khi di chuột qua, nó sẽ cao hơn các phần tử khác như header (z-30).
  const zIndexClass = isHovering ? 'z-40' : 'z-10';

  // Tooltip chỉ nên được hiển thị nếu người dùng đang di chuột qua khối chính,
  // nhưng không phải qua tay cầm thay đổi kích thước và không phải trong khi đang thay đổi kích thước.
  const showTooltip = isHovering && !isResizeHandleHovered && !isBeingResized;
  
  const cursorClass = isLocked 
    ? 'cursor-not-allowed' 
    : isDraggable 
    ? 'cursor-grab hover:ring-2 hover:ring-brand-gold' 
    : 'cursor-pointer'; // Nếu readOnly (guest), chỉ là pointer để double click xem thông tin (nếu có logic đó) hoặc default.


  return (
    <>
      {showTooltip && <Tooltip job={job} element={blockRef.current} />}
      <div
        ref={blockRef}
        className={`absolute top-1/2 -translate-y-1/2 ${heightClass} flex items-center ${paddingClass} rounded-lg shadow-md text-white text-xs font-bold transition-all duration-200 ${colorClass} ${cursorClass} ${zIndexClass}`}
        style={{ left: `${left}%`, width: `${width}%`, minWidth: '20px' }}
        onDoubleClick={() => !isLocked && onDoubleClick(job)}
        onMouseDown={(e) => isDraggable && onDragStart(job, e)}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {isResizable && (
          <>
              <div
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-20"
                  onMouseDown={(e) => {
                      setIsBeingResized(true);
                      onResizeStart(job, 'left', e);
                  }}
                  onMouseEnter={() => setIsResizeHandleHovered(true)}
                  onMouseLeave={() => setIsResizeHandleHovered(false)}
              />
              <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20"
                  onMouseDown={(e) => {
                      setIsBeingResized(true);
                      onResizeStart(job, 'right', e);
                  }}
                  onMouseEnter={() => setIsResizeHandleHovered(true)}
                  onMouseLeave={() => setIsResizeHandleHovered(false)}
              />
          </>
        )}
        <div className="truncate">
          <p className={`${job.isWaitingCustomer ? "border-b-4 border-yellow-400 inline-block" : ""} ${job.status === JobStatus.Exited ? "text-orange-600 font-bold [text-shadow:-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff,0_1px_0_#fff,0_-1px_0_#fff,1px_0_0_#fff,-1px_0_0_#fff]" : ""}`}>{job.licensePlate}</p>
          <p className={`font-normal opacity-90 ${job.status === JobStatus.Exited ? "text-orange-600 font-bold [text-shadow:-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff,0_1px_0_#fff,0_-1px_0_#fff,1px_0_0_#fff,-1px_0_0_#fff] mt-0.5" : ""}`}>{job.advisorName}</p>
        </div>
      </div>
    </>
  );
};

export default JobBlock;
