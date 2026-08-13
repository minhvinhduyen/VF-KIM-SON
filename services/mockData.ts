import { User, Role, Bay, BayType, Job, JobType, JobStatus, BodyShopStage } from '../types';

export const USERS: User[] = [
  { id: '4905', name: 'Dương Minh Vinh', role: Role.Manager, password: '123456' },
  { id: '5063', name: 'Võ Chí Vương', role: Role.ServiceAdvisor, password: '123456' },
  { id: '4982', name: 'Nguyễn Tấn Duy', role: Role.ServiceAdvisor, password: '123456' },
  { id: '5080', name: 'Đặng Hòa Minh', role: Role.ServiceAdvisor, password: '123456' },
  { id: '4912', name: 'Trần Nhật Thùy Linh', role: Role.CustomerCare, password: '123456' },
  { id: '4994', name: 'Trần Trọng Sang', role: Role.ForemanSC, password: '123456' },
  { id: '4438', name: 'Từ Thiện Chí', role: Role.ForemanDS, password: '123456' },
];

export const BAYS: Bay[] = [
  { id: 'bay-sc-1', name: 'Khoang 1', type: BayType.General, technician: 'Thiệu', supportsLift: true },
  { id: 'bay-sc-2', name: 'Khoang 2', type: BayType.General, technician: 'Lỗi', supportsLift: true },
  { id: 'bay-sc-3', name: 'Khoang 3', type: BayType.General, technician: 'Cường', supportsLift: true },
  { id: 'bay-sc-4', name: 'Khoang 4', type: BayType.General, technician: 'Khải', supportsLift: true },
  { id: 'bay-wash-1', name: 'Khoang Rửa Xe', type: BayType.CarWash, supportsLift: false },
  { id: 'bay-mem-1', name: 'Khoang mềm 1', type: BayType.General, supportsLift: false },
  { id: 'bay-mem-2', name: 'Khoang mềm 2', type: BayType.General, supportsLift: false },
  { id: 'bay-mem-3', name: 'Khoang mềm 3', type: BayType.General, supportsLift: false },
];

const today = new Date();
const setTime = (date: Date, hours: number, minutes: number) => {
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
}

export const JOBS: Job[] = [
    // General Repair Jobs
    {
        id: 'job-1',
        licensePlate: '51G-123.45',
        customerName: 'Nguyễn Văn A',
        carModel: 'VF8',
        jobType: JobType.ScheduledMaintenance,
        advisorName: 'Nguyễn Tấn Duy',
        status: JobStatus.InProgress,
        plannedStartTime: setTime(today, 8, 0),
        plannedEndTime: setTime(today, 10, 0),
        actualStartTime: setTime(today, 8, 10),
        bayId: 'bay-sc-1',
        technician: 'Thiệu',
        useLift: true,
        isAppointment: false,
    },
    {
        id: 'job-2',
        licensePlate: '29A-987.65',
        customerName: 'Trần Thị B',
        carModel: 'VF5',
        jobType: JobType.Repair,
        advisorName: 'Võ Chí Vương',
        status: JobStatus.InProgress,
        plannedStartTime: setTime(today, 9, 0),
        plannedEndTime: setTime(today, 11, 30),
        actualStartTime: setTime(today, 9, 5),
        bayId: 'bay-sc-2',
        technician: 'Lỗi',
        useLift: true,
        isAppointment: false,
    },
    {
        id: 'job-3',
        licensePlate: '30E-456.78',
        customerName: 'Lê Văn C',
        carModel: 'VF6',
        jobType: JobType.Repair,
        advisorName: 'Đặng Hòa Minh',
        status: JobStatus.Waiting,
        plannedStartTime: setTime(today, 13, 0),
        plannedEndTime: setTime(today, 14, 0),
        useLift: false,
        isAppointment: false,
    },
    {
        id: 'job-4',
        licensePlate: '92K-111.22',
        customerName: 'Phạm Thị D',
        carModel: 'VF3',
        jobType: JobType.Repair,
        advisorName: 'Nguyễn Tấn Duy',
        status: JobStatus.Appointment,
        plannedStartTime: setTime(today, 15, 0),
        plannedEndTime: setTime(today, 16, 30),
        useLift: true,
        isAppointment: true,
    },
     // Body & Paint Jobs
    {
        id: 'job-5',
        licensePlate: '75H-555.55',
        customerName: 'Hoàng Văn E',
        carModel: 'VF34',
        jobType: JobType.BodyAndPaint,
        advisorName: 'Đặng Hòa Minh',
        status: JobStatus.InProgress,
        bodyShopStage: BodyShopStage.Nen,
        plannedStartTime: new Date(new Date().setDate(today.getDate() - 2)),
        plannedEndTime: new Date(new Date().setDate(today.getDate() + 1)),
        laborCost: 15000000,
        useLift: false,
        isAppointment: false,
        stageHistory: [
            { stage: BodyShopStage.Dong, startTime: new Date(new Date().setDate(today.getDate() - 2)), endTime: new Date(new Date().setDate(today.getDate() -1)) },
            { stage: BodyShopStage.Nen, startTime: new Date(new Date().setDate(today.getDate() -1)) },
        ]
    },
    {
        id: 'job-6',
        licensePlate: '43C-333.44',
        customerName: 'Võ Thị F',
        carModel: 'VF7',
        jobType: JobType.BodyAndPaint,
        advisorName: 'Võ Chí Vương',
        status: JobStatus.InProgress,
        bodyShopStage: BodyShopStage.Son,
        plannedStartTime: new Date(new Date().setDate(today.getDate())),
        plannedEndTime: new Date(new Date().setDate(today.getDate() + 3)),
        laborCost: 8000000,
        useLift: false,
        isAppointment: false,
        stageHistory: [
             { stage: BodyShopStage.Dong, startTime: new Date(new Date().setDate(today.getDate())), endTime: new Date(new Date().setDate(today.getDate())) },
             { stage: BodyShopStage.Nen, startTime: new Date(new Date().setDate(today.getDate())), endTime: new Date(new Date().setDate(today.getDate())) },
             { stage: BodyShopStage.Son, startTime: new Date(new Date().setDate(today.getDate())) },
        ]
    }
];