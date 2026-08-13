import React from 'react';
import type { Job } from '../../types';
import ConfirmationModal from './ConfirmationModal';
import { useState } from 'react';

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
}

const DetailRow: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
    value ? <p><span className="font-semibold text-gray-600">{label}:</span> {value}</p> : null
);

const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, onEdit, onDelete }) => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const handleDeleteRequest = () => {
        setIsConfirmOpen(true);
    };

    const handleDeleteConfirm = () => {
        onDelete(job);
        setIsConfirmOpen(false);
        onClose();
    };

    const formatTime = (date?: Date) => date ? new Date(date).toLocaleString('vi-VN') : 'Chưa có';

    return (
        <>
            {isConfirmOpen && (
                <ConfirmationModal
                    message={`Bạn có chắc muốn xóa ${job.isAppointment ? 'lịch hẹn' : 'công việc'} cho xe ${job.licensePlate}?`}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setIsConfirmOpen(false)}
                />
            )}
            <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex justify-center items-center p-4">
                <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-lg">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-2xl font-bold text-gray-800">Chi tiết: {job.licensePlate}</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light">&times;</button>
                    </div>
                    
                    <div className="space-y-2 text-gray-800">
                        <DetailRow label="Khách hàng" value={job.customerName} />
                        <DetailRow label="Dòng xe" value={job.carModel} />
                        <DetailRow label="Cố vấn DV" value={job.advisorName} />
                        <DetailRow label="Loại công việc" value={job.jobType} />
                        <DetailRow label="Trạng thái" value={job.status} />
                        <DetailRow label="Số Km" value={job.km ? job.km.toLocaleString('vi-VN') : undefined} />
                        <DetailRow label="KTV" value={job.technician} />
                        <DetailRow label="TG bắt đầu (DK)" value={formatTime(job.plannedStartTime)} />
                        <DetailRow label="TG kết thúc (DK)" value={formatTime(job.plannedEndTime)} />
                        <DetailRow label="TG bắt đầu (TT)" value={formatTime(job.actualStartTime)} />
                        <DetailRow label="TG kết thúc (TT)" value={formatTime(job.actualEndTime)} />
                    </div>

                    <div className="pt-6 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={handleDeleteRequest}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Xóa
                        </button>
                        <div className="flex space-x-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={() => onEdit(job)}
                                className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Chỉnh sửa
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default JobDetailModal;