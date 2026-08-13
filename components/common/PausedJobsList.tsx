
import React from 'react';
import { Job } from '../../types';

interface PausedJobsListProps {
    jobs: Job[];
    onResume?: (job: Job) => void;
    showResumeButton?: boolean;
}

const PausedJobsList: React.FC<PausedJobsListProps> = ({ jobs, onResume, showResumeButton = true }) => {
    const getPauseReason = (jsonData?: string) => {
        if (!jsonData) return 'N/A';
        try {
            const parsed = JSON.parse(jsonData);
            if (parsed.pauseReason === 'Khác') {
                return parsed.customPauseReason || 'Khác';
            }
            return parsed.pauseReason || 'N/A';
        } catch {
            return 'N/A';
        }
    };

    if (jobs.length === 0) {
        return <p className="text-center text-gray-500 py-4">Không có công việc nào đang bị dừng.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left py-2 px-3 uppercase font-semibold text-sm">Biển số</th>
                        <th className="text-left py-2 px-3 uppercase font-semibold text-sm">Khách hàng</th>
                        <th className="text-left py-2 px-3 uppercase font-semibold text-sm">Khoang</th>
                        <th className="text-left py-2 px-3 uppercase font-semibold text-sm">Lý do dừng</th>
                        <th className="text-left py-2 px-3 uppercase font-semibold text-sm">Thời gian dừng</th>
                        {showResumeButton && <th className="py-2 px-3"></th>}
                    </tr>
                </thead>
                <tbody className="text-gray-700">
                    {jobs.map(job => (
                        <tr key={job.id} className="border-b">
                            <td className="py-2 px-3 font-mono">{job.licensePlate}</td>
                            <td className="py-2 px-3">{job.customerName}</td>
                            <td className="py-2 px-3">{job.bayId}</td>
                            <td className="py-2 px-3">
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs border border-gray-200">
                                    {getPauseReason(job.jsonData)}
                                </span>
                            </td>
                            <td className="py-2 px-3">{job.actualEndTime ? new Date(job.actualEndTime).toLocaleString('vi-VN') : 'N/A'}</td>
                            {showResumeButton && (
                                <td className="py-2 px-3 text-center">
                                    <button
                                        onClick={() => onResume && onResume(job)}
                                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-xs transition duration-200"
                                    >
                                        Tiếp tục
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PausedJobsList;
