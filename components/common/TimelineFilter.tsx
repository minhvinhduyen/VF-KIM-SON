import React, { useMemo, useState } from 'react';
import type { Job } from '../../types';
import { JobStatus, JobType } from '../../types';

interface TimelineFilterProps {
  jobs: Job[];
  filters: {
    status: string;
    advisor: string;
    jobType: string;
    date: string;
  };
  onFilterChange: (filterName: string, value: string) => void;
  onReset: () => void;
}

const TimelineFilter: React.FC<TimelineFilterProps> = ({ jobs, filters, onFilterChange, onReset }) => {
  const [isOpen, setIsOpen] = useState(false);
  const advisors = useMemo(() => {
    const advisorSet = new Set(jobs.map(job => job.advisorName));
    return Array.from(advisorSet).sort();
  }, [jobs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onFilterChange(e.target.name, e.target.value);
  };

  return (
    <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-200 shadow-sm">
      {/* Mobile Toggle Header */}
      <div className="flex justify-between items-center md:hidden">
        <span className="font-bold text-sm text-gray-700 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
          </svg>
          Bộ lọc dữ liệu
        </span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-brand-blue text-white text-xs font-semibold py-1.5 px-3 rounded shadow hover:bg-opacity-90 flex items-center transition"
        >
          {isOpen ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
        </button>
      </div>

      <div className={`${isOpen ? 'block mt-3' : 'hidden'} md:block`}>
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
          <div className="font-bold text-gray-700 md:col-span-1 lg:col-span-1 hidden md:block">Bộ lọc:</div>
        
        <div>
          <label htmlFor="date-filter" className="block text-sm font-medium text-gray-600">Ngày</label>
          <input
            type="date"
            id="date-filter"
            name="date"
            value={filters.date}
            onChange={handleInputChange}
            className="mt-1 block w-full pl-3 pr-2 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm rounded-md"
          />
        </div>

        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-600">Trạng thái</label>
          <select
            id="status-filter"
            name="status"
            value={filters.status}
            onChange={handleInputChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm rounded-md"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.values(JobStatus).map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="advisor-filter" className="block text-sm font-medium text-gray-600">Cố vấn DV</label>
          <select
            id="advisor-filter"
            name="advisor"
            value={filters.advisor}
            onChange={handleInputChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm rounded-md"
          >
            <option value="">Tất cả cố vấn</option>
            {advisors.map(advisor => (
              <option key={advisor} value={advisor}>{advisor}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="jobtype-filter" className="block text-sm font-medium text-gray-600">Loại công việc</label>
          <select
            id="jobtype-filter"
            name="jobType"
            value={filters.jobType}
            onChange={handleInputChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm rounded-md"
          >
            <option value="">Tất cả loại</option>
            <option value={JobType.ScheduledMaintenance}>{JobType.ScheduledMaintenance}</option>
            <option value={JobType.Repair}>{JobType.Repair}</option>
            <option value={JobType.Warranty}>{JobType.Warranty}</option>
          </select>
        </div>
        
        <button
          onClick={onReset}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 w-full"
        >
          Xóa lọc
        </button>
      </div>
      </div>
    </div>
  );
};

export default TimelineFilter;