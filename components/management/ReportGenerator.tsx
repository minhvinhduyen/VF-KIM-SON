
import React, { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import { JobType, JobStatus, BayType, BodyShopStage, Role } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
    Activity, DollarSign, Users, Calendar, Settings, Palette, CheckCircle, 
    ClipboardList, PieChart, TrendingUp, UserCog, Clock, CalendarRange, 
    UserCheck, Contact2, ChevronLeft, Search, Filter
} from 'lucide-react';

declare var XLSX: any;

const REPORT_CATEGORIES = [
    { id: 'all', label: 'Tất cả báo cáo', icon: Activity },
    { id: 'activity', label: 'Hoạt động & Tiến độ', icon: Activity },
    { id: 'revenue', label: 'Doanh thu & Kinh doanh', icon: DollarSign },
    { id: 'performance', label: 'Quản trị & Hiệu suất', icon: Users },
    { id: 'customer', label: 'Đặt hẹn & Khách hàng', icon: Calendar },
];

const REPORT_LIST = [
    { id: 'general_repair_report', category: 'activity', label: 'Chi tiết lượt xe SC & BD', desc: 'Thống kê chi tiết các lượt xe vào sửa chữa chung và bảo dưỡng.', icon: Settings, managerOnly: true },
    { id: 'body_shop_report', category: 'activity', label: 'Chi tiết Đồng sơn', desc: 'Theo dõi tiến độ và chi tiết các xe làm bảo hiểm, đồng sơn.', icon: Palette, managerOnly: true },
    { id: 'summary_completion_report', category: 'activity', label: 'Tổng hợp xe hoàn thành', desc: 'Tổng hợp toàn bộ xe đã hoàn thành sửa chữa và sẵn sàng giao.', icon: CheckCircle, managerOnly: false },
    { id: 'job_status_summary', category: 'activity', label: 'Thống kê trạng thái', desc: 'Cái nhìn tổng quan về số lượng xe theo từng trạng thái hiện tại.', icon: ClipboardList, managerOnly: true },
    
    { id: 'detailed_revenue_report', category: 'revenue', label: 'Doanh thu chi tiết', desc: 'Thống kê chi tiết doanh thu từ tiền công và phụ tùng theo ngày.', icon: DollarSign, managerOnly: false },
    { id: 'vehicle_count_summary', category: 'revenue', label: 'Tổng hợp lượt xe CVDV', desc: 'Thống kê số lượng lượt xe và tỉ lệ phân bổ theo Cố vấn dịch vụ.', icon: PieChart, managerOnly: true },
    { id: 'advisor_performance', category: 'revenue', label: 'Hiệu suất CVDV (Doanh thu nội)', desc: 'Đánh giá hiệu quả kinh doanh của từng Cố vấn qua doanh thu công.', icon: TrendingUp, managerOnly: true },
    
    { id: 'technician_performance', category: 'performance', label: 'Hiệu suất KTV (Chia lượt)', desc: 'Tính toán điểm công và hiệu suất làm việc của đội ngũ kỹ thuật.', icon: UserCog, managerOnly: true },
    { id: 'bay_performance', category: 'performance', label: 'Hiệu suất khoang', desc: 'Phân tích thời gian chiếm khoang và tỉ lệ lấp đầy của các khoang.', icon: Clock, managerOnly: true },
    
    { id: 'appointment_ratio', category: 'customer', label: 'Tỉ lệ khách hẹn', desc: 'Phân tích tỉ lệ xe có hẹn so với xe vãng lai vào xưởng.', icon: CalendarRange, managerOnly: true },
    { id: 'on_time_arrival_ratio', category: 'customer', label: 'Tỷ lệ đúng hẹn (Tổng)', desc: 'Đánh giá độ chính xác của giờ hẹn đối với toàn bộ khách hàng.', icon: UserCheck, managerOnly: true },
    { id: 'on_time_by_advisor', category: 'customer', label: 'Tỷ lệ đúng hẹn (CVDV)', desc: 'Đánh giá khả năng quản lý thời gian và hẹn khách của từng CVDV.', icon: Contact2, managerOnly: true },
];

const ReportGenerator: React.FC = () => {
    const { state } = useApp();
    const { user } = useAuth();
    const isManager = user?.role === Role.Manager;
    const isCSKH = user?.role === Role.CustomerCare;
    
    const [reportType, setReportType] = useState('');
    const [viewMode, setViewMode] = useState<'library' | 'generator'>('library');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    useEffect(() => {
        if (!reportType) return;

        if (isManager) return;
        
        const allowedReports = ['detailed_revenue_report'];
        if (isCSKH) allowedReports.push('summary_completion_report');

        if (!allowedReports.includes(reportType)) {
            setReportType('');
            setViewMode('library');
        }
    }, [isManager, isCSKH, reportType]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [generatedReport, setGeneratedReport] = useState<any | null>(null);
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

    const getMaintenanceLevel = (km: number): string => {
        // Cấp 1000: <= 3000 (1000 + 2000)
        if (km <= 3000) return '1.000';
        
        // Các cấp tiếp theo: 7500, 15000, 22500... (bước nhảy 7500)
        // Điều kiện: km <= level + 2000
        let level = 7500;
        // Giới hạn vòng lặp an toàn
        while (level <= 1000000) {
            if (km <= level + 2000) {
                return level.toLocaleString('vi-VN');
            }
            level += 7500;
        }
        return '';
    };

    const handleGenerate = () => {
        // Filter out continuation jobs to ensure each vehicle visit is counted only once
        // Tuy nhiên, với báo cáo KTV, ta cần tính công việc thực tế, nên nếu job đó có người làm thì vẫn tính.
        // Nhưng để nhất quán, ta dùng danh sách gốc, loại bỏ các job con nếu chúng chỉ là nối tiếp thời gian mà không thay đổi bản chất.
        // Ở đây ta dùng tất cả các job có trạng thái hoàn thành hoặc đang làm để tính công.
        
        const allJobs = state.jobs;
        const now = new Date();
        let jobsToProcess: any[];

        const hasDateFilter = startDate || endDate;

        if (hasDateFilter) {
            const start = startDate ? new Date(startDate) : new Date('1970-01-01');
            start.setHours(0, 0, 0, 0);

            const end = endDate ? new Date(endDate) : new Date('2999-12-31');
            end.setHours(23, 59, 59, 999);

            jobsToProcess = allJobs.filter(job => {
                let jobDate: Date;

                if (['appointment_ratio', 'on_time_arrival_ratio', 'on_time_by_advisor'].includes(reportType)) {
                    // These reports are based on the appointment date
                    jobDate = new Date(job.appointmentTime || job.plannedStartTime);
                } else if (reportType === 'bay_performance' || reportType === 'technician_performance') {
                    // Performance reports based on completion time or start time if not completed
                    jobDate = job.actualEndTime ? new Date(job.actualEndTime) : (job.actualStartTime ? new Date(job.actualStartTime) : new Date(job.plannedStartTime));
                } else {
                    // General reports (job_details, advisor_performance, etc.) are based on service date.
                    jobDate = new Date(job.actualStartTime || job.plannedStartTime);
                }

                if (isNaN(jobDate.getTime())) {
                    return false; // Skip jobs with invalid or missing dates for the given report type
                }

                return jobDate >= start && jobDate <= end;
            });
        } else {
            // If there's no date filter, process all data
            jobsToProcess = allJobs;
        }
        
        let reportData: any = [];

        switch(reportType) {
            case 'general_repair_report': {
                reportData = jobsToProcess
                    .filter(job => 
                        job.status !== JobStatus.Washing &&
                        (job.jobType === JobType.ScheduledMaintenance || job.jobType === JobType.Repair || job.jobType === JobType.Warranty)
                    )
                    .sort((a, b) => { // Sắp xếp theo ngày thực hiện
                        const dateA = a.actualStartTime || a.plannedStartTime;
                        const dateB = b.actualStartTime || b.plannedStartTime;
                        return new Date(dateA).getTime() - new Date(dateB).getTime();
                    })
                    .map((job, index) => {
                        let thoiGianSuaChua = 'N/A';
                        if (job.actualStartTime && job.actualEndTime) {
                            const durationMinutes = Math.round((new Date(job.actualEndTime).getTime() - new Date(job.actualStartTime).getTime()) / 60000);
                            if (durationMinutes < 0) {
                                 thoiGianSuaChua = 'Lỗi dữ liệu';
                            } else if (durationMinutes >= 60) {
                                const hours = Math.floor(durationMinutes / 60);
                                const minutes = durationMinutes % 60;
                                thoiGianSuaChua = `${hours} giờ ${minutes} phút`;
                            } else {
                                thoiGianSuaChua = `${durationMinutes} phút`;
                            }
                        } else if (job.status === JobStatus.InProgress) {
                            thoiGianSuaChua = "Đang làm";
                        }
                        
                        const serviceDate = job.actualStartTime || job.plannedStartTime;

                        // Tính cấp bảo dưỡng
                        const maintenanceLvl = (job.jobType === JobType.ScheduledMaintenance && job.km) 
                            ? getMaintenanceLevel(job.km) 
                            : '';

                        return {
                            'STT': index + 1,
                            'Ngày thực hiện': new Date(serviceDate).toLocaleDateString('vi-VN'),
                            'Biển số xe': job.licensePlate,
                            'Loại xe': job.carModel,
                            'Số Km': job.km ? job.km.toLocaleString('vi-VN') : 'N/A',
                            'Cấp bảo dưỡng': maintenanceLvl,
                            'Tên khách hàng': job.customerName,
                            'Trạng thái công việc': job.status,
                            'Cố vấn dịch vụ': job.advisorName,
                            'Kỹ thuật viên': job.technician || 'Chưa giao',
                            'Loại hình sửa chữa': job.jobType,
                            'Thời gian sửa chữa': thoiGianSuaChua,
                        };
                    });
                break;
            }
            case 'body_shop_report': {
                reportData = jobsToProcess
                    .filter(job => job.jobType === JobType.BodyAndPaint)
                    .sort((a, b) => {
                        const dateA = a.actualStartTime || a.plannedStartTime;
                        const dateB = b.actualStartTime || b.plannedStartTime;
                        return new Date(dateA).getTime() - new Date(dateB).getTime();
                    })
                    .map((job, index) => {
                        const technicianString = job.technician || '';
                        const techParts = technicianString.split(' - ');

                        const getTechPart = (partIndex: number) => {
                            const part = techParts[partIndex];
                            return part && part !== 'N/A' ? part : '';
                        };

                        return {
                            'STT': index + 1,
                            'Ngày bắt đầu thực hiện': job.actualStartTime ? new Date(job.actualStartTime).toLocaleDateString('vi-VN') : 'Chưa bắt đầu',
                            'Ngày hoàn thành': job.actualEndTime ? new Date(job.actualEndTime).toLocaleDateString('vi-VN') : 'Chưa xong',
                            'Biển số xe': job.licensePlate,
                            'Loại xe': job.carModel,
                            'Tên khách hàng': job.customerName,
                            'Trạng thái công việc': job.status,
                            'KTV làm đồng': getTechPart(0),
                            'KTV làm nền': getTechPart(1),
                            'KTV pha sơn': getTechPart(2),
                            'KTV sơn': getTechPart(3),
                            'KTV Đánh bóng, dọn xe': getTechPart(4),
                        };
                    });
                break;
            }
            case 'vehicle_count_summary': {
                const advisorStats = new Map<string, { maintenance: number; repair: number; bodyPaint: number; warranty: number; other: number }>();
                
                // Initialize totals
                let totalM = 0, totalR = 0, totalBP = 0, totalW = 0, totalO = 0;

                jobsToProcess.forEach(job => {
                    // Only count unique visits based on main job (not continuations)
                    if (job.continuationOfJobId) return;

                    const name = job.advisorName || 'Không xác định';
                    const stats = advisorStats.get(name) || { maintenance: 0, repair: 0, bodyPaint: 0, warranty: 0, other: 0 };

                    // Logic phân loại
                    let type = '';
                    if (job.status === JobStatus.Quotation || job.status === JobStatus.FreeInspection) {
                        type = 'other';
                    } else if (job.jobType === JobType.ScheduledMaintenance) {
                        type = 'maintenance';
                    } else if (job.jobType === JobType.Repair) {
                        type = 'repair';
                    } else if (job.jobType === JobType.BodyAndPaint) {
                        type = 'bodyPaint';
                    } else if (job.jobType === JobType.Warranty) {
                        type = 'warranty';
                    }

                    // Increment counts
                    if (type === 'other') { stats.other++; totalO++; }
                    else if (type === 'maintenance') { stats.maintenance++; totalM++; }
                    else if (type === 'repair') { stats.repair++; totalR++; }
                    else if (type === 'bodyPaint') { stats.bodyPaint++; totalBP++; }
                    else if (type === 'warranty') { stats.warranty++; totalW++; }

                    advisorStats.set(name, stats);
                });

                // Convert map to array
                reportData = Array.from(advisorStats.entries()).map(([name, stats]) => ({
                    'Cố vấn': name,
                    'Bảo dưỡng': stats.maintenance,
                    'Sửa chữa': stats.repair,
                    'Đồng sơn': stats.bodyPaint,
                    'Bảo hành': stats.warranty,
                    'Báo giá/KT': stats.other,
                    'Tổng cộng': stats.maintenance + stats.repair + stats.bodyPaint + stats.warranty + stats.other
                }));

                // Add Total Row
                reportData.push({
                    'Cố vấn': 'TỔNG CỘNG TOÀN XƯỞNG',
                    'Bảo dưỡng': totalM,
                    'Sửa chữa': totalR,
                    'Đồng sơn': totalBP,
                    'Bảo hành': totalW,
                    'Báo giá/KT': totalO,
                    'Tổng cộng': totalM + totalR + totalBP + totalW + totalO
                });
                break;
            }
            case 'technician_performance': {
                // Báo cáo hiệu suất KTV (Chia lượt)
                const techStats = new Map<string, { maintenance: number; repair: number }>();

                jobsToProcess.forEach(job => {
                    // Chỉ tính SCC và Bảo dưỡng, bỏ qua Đồng sơn, Rửa xe, Báo giá
                    if (job.jobType === JobType.BodyAndPaint) return;
                    if (job.status === JobStatus.Washing || job.status === JobStatus.FreeInspection || job.status === JobStatus.Quotation || job.status === JobStatus.Arrived || job.status === JobStatus.Appointment || job.status === JobStatus.TicketOpened) return;
                    
                    if (!job.technician) return;

                    // Tách tên KTV (VD: "Sang - Cường")
                    const techs = job.technician.split(' - ').map(t => t.trim()).filter(t => t && t !== 'N/A');
                    const numTechs = techs.length;

                    if (numTechs === 0) return;

                    // Tính điểm chia đều
                    const credit = 1 / numTechs;

                    techs.forEach(techName => {
                        const stats = techStats.get(techName) || { maintenance: 0, repair: 0 };

                        if (job.jobType === JobType.ScheduledMaintenance) {
                            stats.maintenance += credit;
                        } else if (job.jobType === JobType.Repair) {
                            stats.repair += credit;
                        }

                        techStats.set(techName, stats);
                    });
                });

                // Chuyển đổi map sang mảng và làm tròn số
                reportData = Array.from(techStats.entries()).map(([name, stats]) => ({
                    'Kỹ thuật viên': name,
                    'Bảo dưỡng (Lượt)': parseFloat(stats.maintenance.toFixed(2)),
                    'Sửa chữa (Lượt)': parseFloat(stats.repair.toFixed(2)),
                    'Tổng lượt': parseFloat((stats.maintenance + stats.repair).toFixed(2))
                })).sort((a, b) => b['Tổng lượt'] - a['Tổng lượt']);
                
                // Thêm dòng tổng cộng
                const totalM = reportData.reduce((sum, item) => sum + item['Bảo dưỡng (Lượt)'], 0);
                const totalR = reportData.reduce((sum, item) => sum + item['Sửa chữa (Lượt)'], 0);
                
                reportData.push({
                    'Kỹ thuật viên': 'TỔNG CỘNG',
                    'Bảo dưỡng (Lượt)': parseFloat(totalM.toFixed(2)),
                    'Sửa chữa (Lượt)': parseFloat(totalR.toFixed(2)),
                    'Tổng lượt': parseFloat((totalM + totalR).toFixed(2))
                });

                break;
            }
            case 'detailed_revenue_report': {
                const techStats = new Map<string, { carCount: number, congDong: number, congSon: number, congSCC: number, phuTung: number }>();
                const advisorStats = new Map<string, { carCount: number, congDong: number, congSon: number, congSCC: number, phuTung: number }>();

                jobsToProcess.forEach(job => {
                    // Chỉ tính các job đã hoàn thành hoặc đang làm (có doanh thu)
                    if (job.status === JobStatus.Washing || job.status === JobStatus.FreeInspection || job.status === JobStatus.Quotation || job.status === JobStatus.Arrived || job.status === JobStatus.Appointment || job.status === JobStatus.TicketOpened) return;

                    let revenue = { congSCC: 0, congDong: 0, congSon: 0, phuTung: 0 };
                    if (job.jsonData) {
                        try {
                            const parsed = JSON.parse(job.jsonData);
                            revenue.congSCC = Number(parsed.congSCC) || 0;
                            revenue.congDong = Number(parsed.congDong) || 0;
                            revenue.congSon = Number(parsed.congSon) || 0;
                            revenue.phuTung = Number(parsed.phuTung) || 0;
                        } catch (e) {
                            console.error("Error parsing jsonData for job", job.id);
                        }
                    }

                    // Advisor logic
                    if (job.advisorName) {
                        const advStats = advisorStats.get(job.advisorName) || { carCount: 0, congDong: 0, congSon: 0, congSCC: 0, phuTung: 0 };
                        advStats.carCount += 1;
                        advStats.congDong += revenue.congDong;
                        advStats.congSon += revenue.congSon;
                        advStats.congSCC += revenue.congSCC;
                        advStats.phuTung += revenue.phuTung;
                        advisorStats.set(job.advisorName, advStats);
                    }

                    // Technician logic
                    if (!job.technician) return;

                    if (job.jobType === JobType.BodyAndPaint) {
                        const techParts = job.technician.split(' - ').map(t => t.trim());
                        const dong = techParts[0] && techParts[0] !== 'N/A' ? techParts[0] : '';
                        const nen = techParts[1] && techParts[1] !== 'N/A' ? techParts[1] : '';
                        const phaSon = techParts[2] && techParts[2] !== 'N/A' ? techParts[2] : '';
                        const sonMau = techParts[3] && techParts[3] !== 'N/A' ? techParts[3] : '';
                        const bong = techParts[4] && techParts[4] !== 'N/A' ? techParts[4] : '';

                        const uniqueTechs = new Set([dong, nen, phaSon, sonMau, bong].filter(t => t));
                        const numTechs = uniqueTechs.size;
                        const carCountSplit = numTechs > 0 ? 1 / numTechs : 0;

                        uniqueTechs.forEach(t => {
                            const stats = techStats.get(t) || { carCount: 0, congDong: 0, congSon: 0, congSCC: 0, phuTung: 0 };
                            stats.carCount += carCountSplit;
                            techStats.set(t, stats);
                        });

                        if (revenue.congDong > 0) {
                            const diemStats = techStats.get('Điềm') || { carCount: 0, congDong: 0, congSon: 0, congSCC: 0, phuTung: 0 };
                            diemStats.congDong += revenue.congDong;
                            techStats.set('Điềm', diemStats);
                        }

                        if (revenue.congSon > 0) {
                            const addSon = (name: string, percentage: number) => {
                                if (name) {
                                    const stats = techStats.get(name) || { carCount: 0, congDong: 0, congSon: 0, congSCC: 0, phuTung: 0 };
                                    stats.congSon += revenue.congSon * percentage;
                                    techStats.set(name, stats);
                                }
                            };
                            addSon(phaSon, 0.15);
                            addSon(nen, 0.30);
                            addSon(sonMau, 0.25);
                            addSon(bong, 0.30);
                        }

                        if (revenue.phuTung > 0) {
                            const ptSplit = revenue.phuTung / 3;
                            ['Điềm', 'Chí', 'Tạo'].forEach(name => {
                                const stats = techStats.get(name) || { carCount: 0, congDong: 0, congSon: 0, congSCC: 0, phuTung: 0 };
                                stats.phuTung += ptSplit;
                                techStats.set(name, stats);
                            });
                        }

                    } else if (job.jobType === JobType.ScheduledMaintenance || job.jobType === JobType.Repair || job.jobType === JobType.Warranty) {
                        const techs = job.technician.split(' - ').map(t => t.trim()).filter(t => t && t !== 'N/A');
                        const numTechs = techs.length;
                        if (numTechs > 0) {
                            const carCountSplit = 1 / numTechs;
                            const congSCCSplit = revenue.congSCC / numTechs;
                            const phuTungSplit = revenue.phuTung / numTechs;

                            techs.forEach(t => {
                                const stats = techStats.get(t) || { carCount: 0, congDong: 0, congSon: 0, congSCC: 0, phuTung: 0 };
                                stats.carCount += carCountSplit;
                                stats.congSCC += congSCCSplit;
                                stats.phuTung += phuTungSplit;
                                techStats.set(t, stats);
                            });
                        }
                    }
                });

                const advisorData: any[] = [];
                let totalAdvCar = 0, totalAdvDong = 0, totalAdvSon = 0, totalAdvSCC = 0, totalAdvPT = 0;
                Array.from(advisorStats.entries()).forEach(([name, stats]) => {
                    totalAdvCar += stats.carCount;
                    totalAdvDong += stats.congDong;
                    totalAdvSon += stats.congSon;
                    totalAdvSCC += stats.congSCC;
                    totalAdvPT += stats.phuTung;
                    advisorData.push({
                        'Họ tên': name,
                        'Lượt xe': parseFloat(stats.carCount.toFixed(2)),
                        'Công SCC': Math.round(stats.congSCC),
                        'Công Đồng': Math.round(stats.congDong),
                        'Công Sơn': Math.round(stats.congSon),
                        'Phụ tùng': Math.round(stats.phuTung),
                        'Tổng doanh thu': Math.round(stats.congSCC + stats.congDong + stats.congSon + stats.phuTung)
                    });
                });
                advisorData.sort((a, b) => b['Tổng doanh thu'] - a['Tổng doanh thu']);
                advisorData.push({
                    'Họ tên': 'TỔNG CỘNG',
                    'Lượt xe': parseFloat(totalAdvCar.toFixed(2)),
                    'Công SCC': Math.round(totalAdvSCC),
                    'Công Đồng': Math.round(totalAdvDong),
                    'Công Sơn': Math.round(totalAdvSon),
                    'Phụ tùng': Math.round(totalAdvPT),
                    'Tổng doanh thu': Math.round(totalAdvSCC + totalAdvDong + totalAdvSon + totalAdvPT)
                });

                const techData: any[] = [];
                let totalTechCar = 0, totalTechDong = 0, totalTechSon = 0, totalTechSCC = 0, totalTechPT = 0;
                Array.from(techStats.entries()).forEach(([name, stats]) => {
                    totalTechCar += stats.carCount;
                    totalTechDong += stats.congDong;
                    totalTechSon += stats.congSon;
                    totalTechSCC += stats.congSCC;
                    totalTechPT += stats.phuTung;
                    techData.push({
                        'Họ tên': name,
                        'Lượt xe': parseFloat(stats.carCount.toFixed(2)),
                        'Công SCC': Math.round(stats.congSCC),
                        'Công Đồng': Math.round(stats.congDong),
                        'Công Sơn': Math.round(stats.congSon),
                        'Phụ tùng': Math.round(stats.phuTung),
                        'Tổng doanh thu': Math.round(stats.congSCC + stats.congDong + stats.congSon + stats.phuTung)
                    });
                });
                techData.sort((a, b) => b['Tổng doanh thu'] - a['Tổng doanh thu']);
                techData.push({
                    'Họ tên': 'TỔNG CỘNG',
                    'Lượt xe': parseFloat(totalTechCar.toFixed(2)),
                    'Công SCC': Math.round(totalTechSCC),
                    'Công Đồng': Math.round(totalTechDong),
                    'Công Sơn': Math.round(totalTechSon),
                    'Phụ tùng': Math.round(totalTechPT),
                    'Tổng doanh thu': Math.round(totalTechSCC + totalTechDong + totalTechSon + totalTechPT)
                });

                reportData = { type: 'detailed_revenue', advisorData, techData } as any;
                break;
            }
            case 'advisor_performance': {
                const advisorStats = new Map<string, { jobCount: number, totalLabor: number }>();
                jobsToProcess.forEach(job => {
                    if (job.continuationOfJobId) return; // Only count unique jobs
                    const stats = advisorStats.get(job.advisorName) || { jobCount: 0, totalLabor: 0 };
                    stats.jobCount += 1;
                    if (job.jobType === JobType.BodyAndPaint && job.laborCost) {
                        stats.totalLabor += job.laborCost;
                    }
                    advisorStats.set(job.advisorName, stats);
                });
                reportData = Array.from(advisorStats.entries()).map(([name, data]) => ({ 'Cố vấn': name, 'Số xe': data.jobCount, 'Tổng công': data.totalLabor }));
                break;
            }
            case 'job_status_summary': {
                const statusCounts = new Map<JobStatus, number>();
                Object.values(JobStatus).forEach(status => statusCounts.set(status, 0));
                jobsToProcess.forEach(job => {
                    statusCounts.set(job.status, (statusCounts.get(job.status) || 0) + 1);
                });
                reportData = Array.from(statusCounts.entries()).map(([status, count]) => ({ 'Trạng thái': status, 'Số lượng': count }));
                break;
            }
            case 'bay_performance': {
                const bayStats = new Map<string, { jobCount: number, totalMinutes: number, bayName: string, technician: string }>();

                state.bays.filter(b => b.type === BayType.General).forEach(bay => {
                    bayStats.set(bay.id, {
                        jobCount: 0,
                        totalMinutes: 0,
                        bayName: bay.name,
                        technician: bay.technician || 'N/A'
                    });
                });

                jobsToProcess.forEach(job => {
                    if (job.bayId && job.actualStartTime && job.actualEndTime) {
                        const bay = state.bays.find(b => b.id === job.bayId);
                        if (bay && bay.type === BayType.General && bayStats.has(job.bayId)) {
                            const stats = bayStats.get(job.bayId)!;
                            stats.jobCount += 1;
                            const durationMinutes = (job.actualEndTime.getTime() - job.actualStartTime.getTime()) / (1000 * 60);
                            stats.totalMinutes += durationMinutes;
                            bayStats.set(job.bayId, stats);
                        }
                    }
                });

                reportData = Array.from(bayStats.values()).map(data => ({
                    'Khoang': data.bayName,
                    'Kỹ thuật viên': data.technician,
                    'Số xe hoàn thành': data.jobCount,
                    'Tổng giờ làm việc': (data.totalMinutes / 60).toFixed(2)
                }));
                break;
            }
            case 'appointment_ratio': {
                // For ratio reports, we should use unique vehicle visits, not continuations
                const uniqueJobs = jobsToProcess.filter(j => !j.continuationOfJobId);
                const totalJobs = uniqueJobs.length;
                const appointedJobsCount = uniqueJobs.filter(j => j.isAppointment).length;
                const walkInJobs = totalJobs - appointedJobsCount;
                reportData = [{
                    'Tổng số xe tiếp nhận': totalJobs,
                    'Số xe có hẹn': appointedJobsCount,
                    'Số xe vãng lai': walkInJobs,
                    'Tỷ lệ khách hẹn': totalJobs > 0 ? `${((appointedJobsCount / totalJobs) * 100).toFixed(1)}%` : 'N/A',
                }];
                break;
            }
            case 'on_time_arrival_ratio': {
                const appointmentJobs = jobsToProcess.filter(j => j.isAppointment && j.appointmentTime && !j.continuationOfJobId);
                let onTime = 0, early = 0, late = 0, missed = 0;
                
                appointmentJobs.forEach(job => {
                    if (job.actualArrivalTime && job.appointmentTime) {
                        const diff = (new Date(job.actualArrivalTime).getTime() - new Date(job.appointmentTime).getTime()) / 60000;
                        if (diff < -30) { // Đến sớm hơn 30 phút
                            early++;
                        } else if (diff > 15) { // Đến trễ hơn 15 phút
                            late++;
                        } else { // Đúng hẹn trong khoảng -30 phút đến +15 phút
                            onTime++;
                        }
                    } else if (job.appointmentTime && new Date(job.appointmentTime) < now) {
                        missed++;
                    }
                });
                
                const totalAppointments = appointmentJobs.length;
                reportData = [{
                    'Tổng số hẹn': totalAppointments,
                    'Đến đúng hẹn (-30/+15 phút)': onTime,
                    'Đến sớm (> 30 phút)': early,
                    'Đến trễ (> 15 phút)': late,
                    'Bỏ lỡ / Chưa đến': missed,
                    'Tỷ lệ đúng hẹn': totalAppointments > 0 ? `${((onTime / totalAppointments) * 100).toFixed(1)}%` : 'N/A',
                }];
                break;
            }
            case 'on_time_by_advisor': {
                const advisorStats = new Map<string, { total: number; onTime: number; late: number; early: number; missed: number }>();
                const appointmentJobsByAdvisor = jobsToProcess.filter(j => j.isAppointment && j.appointmentTime && !j.continuationOfJobId);
                
                appointmentJobsByAdvisor.forEach(job => {
                    const stats = advisorStats.get(job.advisorName) || { total: 0, onTime: 0, late: 0, early: 0, missed: 0 };
                    stats.total++;
                    if (job.actualArrivalTime && job.appointmentTime) {
                        const diff = (new Date(job.actualArrivalTime).getTime() - new Date(job.appointmentTime).getTime()) / 60000;
                        if (diff < -30) { // Đến sớm hơn 30 phút
                            stats.early++;
                        } else if (diff > 15) { // Đến trễ hơn 15 phút
                            stats.late++;
                        } else { // Đúng hẹn trong khoảng -30 phút đến +15 phút
                            stats.onTime++;
                        }
                    } else if (job.appointmentTime && new Date(job.appointmentTime) < now) {
                        stats.missed++;
                    }
                    advisorStats.set(job.advisorName, stats);
                });

                reportData = Array.from(advisorStats.entries()).map(([name, data]) => ({
                    'Cố vấn dịch vụ': name,
                    'Tổng số hẹn': data.total,
                    'Đến sớm (> 30 phút)': data.early,
                    'Đúng hẹn (-30/+15 phút)': data.onTime,
                    'Trễ hẹn (> 15 phút)': data.late,
                    'Bỏ lỡ': data.missed,
                    'Tỷ lệ đúng hẹn': data.total > 0 ? `${((data.onTime / data.total) * 100).toFixed(1)}%` : 'N/A',
                })).sort((a, b) => b['Tổng số hẹn'] - a['Tổng số hẹn']);
                break;
            }
            case 'summary_completion_report': {
                reportData = jobsToProcess
                    .filter(job => job.status === JobStatus.RepairComplete || job.status === JobStatus.Ready)
                    .map((job, index) => {
                        let revenue = { congSCC: 0, congDong: 0, congSon: 0, phuTung: 0 };
                        if (job.jsonData) {
                            try {
                                const parsed = JSON.parse(job.jsonData);
                                revenue.congSCC = Number(parsed.congSCC) || 0;
                                revenue.congDong = Number(parsed.congDong) || 0;
                                revenue.congSon = Number(parsed.congSon) || 0;
                                revenue.phuTung = Number(parsed.phuTung) || 0;
                            } catch (e) {
                                console.error("Error parsing jsonData for report", e);
                            }
                        }

                        const totalLabor = revenue.congSCC + revenue.congDong + revenue.congSon;
                        const totalAmount = totalLabor + revenue.phuTung;

                        return {
                            'Số thứ tự': index + 1,
                            'Ngày thực hiện': job.actualStartTime ? new Date(job.actualStartTime).toLocaleDateString('vi-VN') : 'N/A',
                            'Ngày hoàn thành': job.actualEndTime ? new Date(job.actualEndTime).toLocaleDateString('vi-VN') : 'N/A',
                            'Biển số xe': job.licensePlate,
                            'Loại xe': job.carModel,
                            'Số khung (vin)': job.vin || '',
                            'Tên Khách hàng': job.customerName,
                            'Số KM thực tế': job.km || 0,
                            'Cấp bảo dưỡng': getMaintenanceLevel(job.km || 0),
                            'Tổng số tiền sửa chữa': totalAmount,
                            'Tổng Tiền công': totalLabor,
                            'Tổng tiền phụ tùng': revenue.phuTung,
                            'Tên KTV sửa chữa': job.technician || '',
                            'Tên CVDV': job.advisorName || '',
                            'Loại hình sc': job.jobType
                        };
                    });
                break;
            }
        }
        setGeneratedReport(reportData);
        setColumnFilters({}); // Reset filters when generating a new report
    };

    const handleExport = () => {
        if (!generatedReport || (Array.isArray(generatedReport) && generatedReport.length === 0)) {
            alert("Không có dữ liệu để xuất.");
            return;
        }
        try {
            const workbook = XLSX.utils.book_new();
            if (!Array.isArray(generatedReport) && generatedReport.type === 'detailed_revenue') {
                const wsAdvisor = XLSX.utils.json_to_sheet(generatedReport.advisorData);
                XLSX.utils.book_append_sheet(workbook, wsAdvisor, 'Cố vấn dịch vụ');
                const wsTech = XLSX.utils.json_to_sheet(generatedReport.techData);
                XLSX.utils.book_append_sheet(workbook, wsTech, 'Kỹ thuật viên');
            } else {
                const worksheet = XLSX.utils.json_to_sheet(generatedReport);
                XLSX.utils.book_append_sheet(workbook, worksheet, 'BaoCao');
            }
            XLSX.writeFile(workbook, `BaoCao_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error("Error exporting to Excel:", error);
            alert("Đã có lỗi xảy ra khi xuất file Excel.");
        }
    };
    
    const renderReport = () => {
        if (!generatedReport) return <p className="text-center text-gray-500 mt-8">Chọn thông số và tạo báo cáo.</p>;
        if (Array.isArray(generatedReport) && generatedReport.length === 0) return <p className="text-center text-gray-500 mt-8">Không có dữ liệu cho báo cáo này.</p>;

        if (!Array.isArray(generatedReport) && generatedReport.type === 'detailed_revenue') {
            const renderTable = (title: string, data: any[]) => {
                const headers = Object.keys(data[0] || {});
                return (
                    <div className="mt-6 bg-white shadow rounded-lg overflow-x-auto flex-1">
                        <h3 className="text-lg font-bold p-4 bg-gray-50 border-b">{title}</h3>
                        <table className="min-w-full leading-normal">
                            <thead>
                                <tr>
                                    {headers.map(header => (
                                        <th key={header} className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row, index) => {
                                    const isTotalRow = row['Họ tên'] === 'TỔNG CỘNG';
                                    return (
                                        <tr key={index} className={isTotalRow ? 'bg-yellow-100 font-bold' : ''}>
                                            {headers.map(header => (
                                                <td key={header} className="px-5 py-5 border-b border-gray-200 bg-transparent text-sm">
                                                    {typeof row[header] === 'number' ? row[header].toLocaleString('vi-VN') : row[header]}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            };

            const renderChart = (title: string, data: any[]) => {
                const chartData = data.filter((d: any) => d['Họ tên'] !== 'TỔNG CỘNG');
                return (
                    <div className="mt-6 bg-white shadow rounded-lg p-4 flex-1" style={{ minWidth: '400px', height: '400px' }}>
                        <h3 className="text-lg font-bold mb-4 text-center">{title}</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="Họ tên" />
                                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                <Tooltip formatter={(value: number, name: string) => [value.toLocaleString('vi-VN'), name]} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="Lượt xe" fill="#8884d8" name="Lượt xe" />
                                <Bar yAxisId="right" dataKey="Tổng doanh thu" fill="#82ca9d" name="Doanh thu (VNĐ)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                );
            };

            return (
                <div className="flex flex-col space-y-8">
                    <div className="flex flex-col xl:flex-row gap-6">
                        {renderChart('Biểu đồ Doanh thu & Lượt xe CVDV', generatedReport.advisorData)}
                        {renderChart('Biểu đồ Doanh thu & Lượt xe KTV', generatedReport.techData)}
                    </div>
                    <div className="flex flex-col xl:flex-row gap-6 items-start">
                        {renderTable('Báo cáo Doanh thu Cố vấn dịch vụ', generatedReport.advisorData)}
                        {renderTable('Báo cáo Doanh thu Kỹ thuật viên', generatedReport.techData)}
                    </div>
                </div>
            );
        }

        const headers = Object.keys(generatedReport[0]);

        // Apply column filters
        const filteredReport = generatedReport.filter((row: any) => {
            // Always show total rows
            if (row['Cố vấn'] === 'TỔNG CỘNG TOÀN XƯỞNG' || row['Kỹ thuật viên'] === 'TỔNG CỘNG') {
                return true;
            }
            
            return Object.entries(columnFilters).every(([header, filterValue]) => {
                if (!filterValue) return true;
                const cellValue = String(row[header] || '').toLowerCase();
                return cellValue.includes(filterValue.toLowerCase());
            });
        });

        const handleFilterChange = (header: string, value: string) => {
            setColumnFilters(prev => ({
                ...prev,
                [header]: value
            }));
        };

        return (
             <div className="mt-6 bg-white shadow rounded-lg overflow-x-auto">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            {headers.map(header => (
                                <th key={header} className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <div className="flex flex-col space-y-2">
                                        <span>{header}</span>
                                        <input 
                                            type="text" 
                                            placeholder="Lọc..." 
                                            value={columnFilters[header] || ''}
                                            onChange={(e) => handleFilterChange(header, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-brand-blue font-normal"
                                        />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReport.map((row, index) => {
                             const isTotalRow = row['Cố vấn'] === 'TỔNG CỘNG TOÀN XƯỞNG' || row['Kỹ thuật viên'] === 'TỔNG CỘNG' || row['Họ tên'] === 'TỔNG CỘNG';
                             return (
                                <tr key={index} className={isTotalRow ? 'bg-yellow-100 font-bold' : ''}>
                                    {headers.map(header => (
                                        <td key={header} className="px-5 py-5 border-b border-gray-200 bg-transparent text-sm">
                                            {typeof row[header] === 'number' ? row[header].toLocaleString('vi-VN') : row[header]}
                                        </td>
                                    ))}
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
             </div>
        )
    }

    return (
        <div className="space-y-6">
            {viewMode === 'library' ? (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Thư viện báo cáo</h2>
                            <p className="text-gray-500">Chọn một loại báo cáo để bắt đầu trích xuất dữ liệu</p>
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input 
                                type="text" 
                                placeholder="Tìm báo cáo..." 
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                        {REPORT_CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                                        activeCategory === cat.id 
                                        ? 'bg-brand-blue text-white shadow-md' 
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="text-sm font-medium">{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {REPORT_LIST
                            .filter(report => {
                                if (!isManager && report.managerOnly && !(isCSKH && report.id === 'summary_completion_report')) return false;
                                if (activeCategory !== 'all' && report.category !== activeCategory) return false;
                                if (searchTerm && !report.label.toLowerCase().includes(searchTerm.toLowerCase()) && !report.desc.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                                return true;
                            })
                            .map(report => {
                                const Icon = report.icon;
                                return (
                                    <div 
                                        key={report.id}
                                        onClick={() => {
                                            setReportType(report.id);
                                            setViewMode('generator');
                                            setGeneratedReport(null);
                                        }}
                                        className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-full"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="p-3 bg-blue-50 text-brand-blue rounded-lg group-hover:bg-brand-blue group-hover:text-white transition-colors">
                                                <Icon className="h-6 w-6" />
                                            </div>
                                            {report.managerOnly && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-1 rounded">Quản lý</span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">{report.label}</h3>
                                        <p className="text-sm text-gray-500 line-clamp-2 flex-grow">{report.desc}</p>
                                        <div className="mt-4 flex items-center text-brand-blue font-semibold text-sm">
                                            <span>Mở báo cáo</span>
                                            <svg className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ) : (
                <div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={() => {
                                    setViewMode('library');
                                    setGeneratedReport(null);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title="Quay lại thư viện"
                            >
                                <ChevronLeft className="h-6 w-6 text-gray-600" />
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {REPORT_LIST.find(r => r.id === reportType)?.label}
                                </h2>
                                <p className="text-sm text-gray-500">Cấu hình thời gian và xuất dữ liệu</p>
                            </div>
                        </div>
                        {generatedReport && (Array.isArray(generatedReport) ? generatedReport.length > 0 : true) && (
                            <button 
                                onClick={handleExport}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 shadow-sm transition-colors w-full md:w-auto justify-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Xuất Excel</span>
                            </button>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Từ ngày</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Đến ngày</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none" />
                            </div>
                            <button onClick={handleGenerate} className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-sm flex items-center justify-center space-x-2">
                                <Activity className="h-5 w-5" />
                                <span>Tạo báo cáo</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="mt-8">
                        {renderReport()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportGenerator;
