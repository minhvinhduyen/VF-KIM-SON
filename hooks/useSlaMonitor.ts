import { useState, useEffect, useMemo } from 'react';
import { Job, JobStatus, Role, JobType } from '../types';

export const useSlaMonitor = (jobs: Job[], user: any) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Update current time every 30 seconds
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const violatingJobs = useMemo(() => {
        if (!user) return [];

        return jobs.filter(job => {
            // Chỉ áp dụng cho Sửa chữa chung và Bảo dưỡng định kỳ (Loại trừ Đồng sơn)
            if (job.jobType === JobType.BodyAndPaint) return false;

            if (user.role === Role.ServiceAdvisor) {
                // CVDV logic: Job assigned to them, InProgress, plannedEndTime passed today
                if (job.advisorName !== user.name) return false;
                if (job.status !== JobStatus.InProgress) return false;
                if (!job.plannedEndTime) return false;

                const endTime = new Date(job.plannedEndTime);
                const isToday = endTime.toDateString() === currentTime.toDateString();
                
                return isToday && currentTime > endTime;
            } 
            else if (user.role === Role.ForemanSC || user.role === Role.ForemanDS || user.role === Role.GeneralManager) {
                // Foreman logic: Waiting or TicketOpened, plannedStartTime passed today
                if (job.status !== JobStatus.Waiting && job.status !== JobStatus.TicketOpened) return false;
                if (!job.plannedStartTime) return false;

                // ForemanSC only sees General Repair
                if (user.role === Role.ForemanSC && job.jobType === JobType.BodyAndPaint) return false;
                // ForemanDS only sees Body Shop
                if (user.role === Role.ForemanDS && job.jobType !== JobType.BodyAndPaint) return false;
                // GeneralManager sees all (no extra filter needed)

                const startTime = new Date(job.plannedStartTime);
                const isToday = startTime.toDateString() === currentTime.toDateString();

                return isToday && currentTime > startTime;
            }
            
            return false;
        });
    }, [jobs, user, currentTime]);

    return { violatingJobs };
};
