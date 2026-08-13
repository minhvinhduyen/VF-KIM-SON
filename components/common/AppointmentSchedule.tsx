
import React, { useMemo } from 'react';
import type { Job } from '../../types';
import { JobStatus } from '../../types';

interface AppointmentScheduleProps {
  jobs: Job[]; 
  onJobClick?: (job: Job) => void;
  showPhoneNumber?: boolean;
}

const AppointmentSchedule: React.FC<AppointmentScheduleProps> = ({ jobs, onJobClick, showPhoneNumber = false }) => {
    
    const allAppointments = useMemo(() => {
        return jobs
            .filter(j => j.isAppointment)
            .sort((a, b) => new Date(b.appointmentTime || b.plannedStartTime).getTime() - new Date(a.appointmentTime || a.plannedStartTime).getTime());
    }, [jobs]);

    const getAppointmentTimingStatus = (appointment: Job): { text: string; className: string; title?: string } => {
        if (!appointment.isAppointment || !appointment.appointmentTime) {
            return { text: '---', className: 'text-gray-400', title: 'Không có thông tin giờ hẹn' };
        }

        if (appointment.status === JobStatus.MissedAppointment) {
            return { text: 'Bỏ hẹn', className: 'bg-red-100 text-red-800', title: 'Khách đến sai ngày hẹn' };
        }

        const now = new Date();
        const planned = new Date(appointment.appointmentTime);

        if (appointment.actualArrivalTime) {
            const actual = new Date(appointment.actualArrivalTime);
            const diffMinutes = (actual.getTime() - planned.getTime()) / 60000;

            if (diffMinutes > 15) {
                return { 
                    text: 'Đến trễ', 
                    className: 'bg-yellow-100 text-yellow-800',
                    title: `Khách đến trễ ${Math.floor(diffMinutes)} phút`
                };
            }
            if (diffMinutes < -15) {
                return { 
                    text: 'Đến sớm', 
                    className: 'bg-sky-100 text-sky-800',
                    title: `Khách đến sớm ${Math.abs(Math.floor(diffMinutes))} phút`
                };
            }
            return { 
                text: 'Đúng hẹn', 
                className: 'bg-green-100 text-green-800',
                title: 'Đến trong khoảng thời gian cho phép (-15 đến +15 phút)'
            };
        }

        // If not arrived yet
        if (now > planned) {
             return { text: 'Quá hẹn', className: 'bg-red-100 text-red-800', title: 'Đã quá giờ hẹn mà khách chưa đến' };
        }
        
        return { text: 'Chưa đến', className: 'bg-blue-100 text-blue-800', title: 'Chưa đến giờ hẹn' };
    };
    
    const getJobStatusDisplay = (job: Job): { text: string; className: string } => {
        const statusText = job.status;
        switch(job.status) {
            case JobStatus.Appointment:
                 return { text: statusText, className: 'bg-blue-100 text-blue-800' };
            case JobStatus.Arrived:
                return { text: statusText, className: 'bg-green-100 text-green-800' };
            case JobStatus.TicketOpened:
                return { text: statusText, className: 'bg-indigo-100 text-indigo-800' };
             case JobStatus.Waiting:
                return { text: statusText, className: 'bg-gray-400 text-white' };
            case JobStatus.InProgress:
                return { text: statusText, className: 'bg-status-inprogress text-white' };
            case JobStatus.Paused:
                return { text: statusText, className: 'bg-status-paused text-white' };
            case JobStatus.RepairComplete:
                return { text: statusText, className: 'bg-status-completed text-white' };
            case JobStatus.Washing:
                return { text: statusText, className: 'bg-status-washing text-white' };
            case JobStatus.Ready:
                return { text: statusText, className: 'bg-status-ready text-white' };
            default:
                return { text: statusText, className: 'bg-gray-200 text-gray-800' };
        }
    };

    const groupedAppointments = useMemo(() => {
        const groups: { [key: string]: Job[] } = {};
        allAppointments.forEach(job => {
            const dateStr = new Date(job.appointmentTime || job.plannedStartTime).toISOString().split('T')[0]; // YYYY-MM-DD
            if (!groups[dateStr]) {
                groups[dateStr] = [];
            }
            groups[dateStr].push(job);
        });
        return groups;
    }, [allAppointments]);

    const sortedDates = useMemo(() => {
        return Object.keys(groupedAppointments).sort().reverse();
    }, [groupedAppointments]);

    const formatDisplayDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        const date = new Date(Number(year), Number(month) - 1, Number(day));
         return date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="p-4 bg-white rounded-b-lg rounded-r-lg w-full">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 space-y-2 md:space-y-0">
                <h2 className="text-2xl font-bold text-gray-800">Lịch sử cuộc hẹn</h2>
            </div>
            
            <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                 {allAppointments.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        <p>Chưa có lịch hẹn nào được ghi nhận.</p>
                    </div>
                 )}
                 {sortedDates.map(dateStr => (
                    <div key={dateStr} className="mb-0">
                        <h3 className="text-sm font-bold text-gray-700 bg-gray-100 p-2 border-b border-t first:border-t-0 border-gray-200 sticky top-0 z-10">
                            {formatDisplayDate(dateStr)}
                        </h3>
                        <table className="min-w-full bg-white divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">STT</th>
                                    <th className="text-left py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">Biển số xe</th>
                                    <th className="text-left py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">Tên khách hàng</th>
                                    {showPhoneNumber && <th className="text-left py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">SĐT</th>}
                                    <th className="text-left py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">Nội dung hẹn</th>
                                    <th className="text-left py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">Giờ Hẹn</th>
                                    <th className="text-left py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">Giờ đến TT</th>
                                    <th className="text-left py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">Cố vấn DV</th>
                                    <th className="text-center py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">Trạng thái hẹn</th>
                                    <th className="text-center py-3 px-4 uppercase font-semibold text-xs text-gray-500 whitespace-nowrap">Trạng thái CV</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-700 divide-y divide-gray-100">
                                {groupedAppointments[dateStr].sort((a, b) => new Date(a.appointmentTime || a.plannedStartTime).getTime() - new Date(b.appointmentTime || b.plannedStartTime).getTime()).map((appointment, index) => {
                                    const timingStatus = getAppointmentTimingStatus(appointment);
                                    const jobStatus = getJobStatusDisplay(appointment);
                                    const displayTime = appointment.appointmentTime || appointment.plannedStartTime;
                                    return (
                                        <tr 
                                            key={appointment.id} 
                                            className={`hover:bg-gray-50 transition-colors ${onJobClick ? 'cursor-pointer' : ''}`}
                                            onDoubleClick={() => onJobClick && onJobClick(appointment)}
                                        >
                                            <td className="py-3 px-4 text-sm">{index + 1}</td>
                                            <td className="py-3 px-4 text-sm font-mono font-bold text-gray-900">{appointment.licensePlate}</td>
                                            <td className="py-3 px-4 text-sm">{appointment.customerName}</td>
                                            {showPhoneNumber && <td className="py-3 px-4 text-sm font-mono">{appointment.customerPhone || '---'}</td>}
                                            <td className="py-3 px-4 text-sm">{appointment.jobType}</td>
                                            <td className="py-3 px-4 text-sm">{new Date(displayTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td className="py-3 px-4 text-sm">{appointment.actualArrivalTime ? new Date(appointment.actualArrivalTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '---'}</td>
                                            <td className="py-3 px-4 text-sm">{appointment.advisorName}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span 
                                                    className={`px-2 py-1 text-xs font-semibold rounded-full cursor-help ${timingStatus.className}`}
                                                    title={timingStatus.title}
                                                >
                                                    {timingStatus.text}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${jobStatus.className}`}>
                                                    {jobStatus.text}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                 ))}
            </div>
        </div>
    );
};

export default AppointmentSchedule;
