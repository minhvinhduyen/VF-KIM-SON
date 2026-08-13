import { useState, useMemo } from 'react';
import type { Job } from '../types';
import { JobStatus } from '../types';

// Helper to format date to YYYY-MM-DD
const toYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface Filters {
  status: string;
  advisor: string;
  jobType: string;
  date: string;
}

const getInitialFilters = (): Filters => ({
  status: '',
  advisor: '',
  jobType: '',
  date: toYYYYMMDD(new Date()), // Default to today
});

export const useJobFilter = (jobs: Job[]) => {
  const [filters, setFilters] = useState<Filters>(getInitialFilters());

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Date filter
      if (filters.date) {
        const dayStart = new Date(filters.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(filters.date);
        dayEnd.setHours(23, 59, 59, 999);

        // A job should be shown if its time range intersects with the selected day.
        const jobStart = job.actualStartTime || job.plannedStartTime;
        const jobEnd = job.actualEndTime || job.plannedEndTime;
        
        if (jobStart > dayEnd || jobEnd < dayStart) {
          return false;
        }
      }

      // Hide newly arrived vehicles (Chờ tiếp nhận) and missed appointments from the timeline
      if (job.status === JobStatus.Arrived || job.status === JobStatus.MissedAppointment) {
        return false;
      }
      if (filters.status && job.status !== filters.status) {
        return false;
      }
      if (filters.advisor && job.advisorName !== filters.advisor) {
        return false;
      }
      if (filters.jobType && job.jobType !== filters.jobType) {
        return false;
      }
      return true;
    });
  }, [jobs, filters]);
  
  const resetFilters = () => {
    setFilters(getInitialFilters());
  };

  return {
    filteredJobs,
    filters,
    setFilters,
    resetFilters,
  };
};