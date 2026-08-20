
import React, { createContext, useReducer, ReactNode, useEffect, useCallback } from 'react';
import type { Job, Bay, User, Vehicle } from '../types';
import * as apiService from '../services/apiService';
import { JobStatus } from '../types';
import { getFacilityById, getDefaultFacility } from '../services/facilitiesConfig';

// Default VinFast Logo URL
const DEFAULT_LOGO = "https://inviva.vn/wp-content/uploads/2026/04/logo-vinfast-vector-01.jpg";

interface AppState {
  jobs: Job[];
  bays: Bay[];
  users: User[];
  vehicles: Vehicle[]; // Added vehicles
  isTimelineFullScreen: boolean;
  isLoading: boolean;
  error: string | null;
  logoUrl: string;
  activeFacilityId: string | null;
}

type Action =
  | { type: 'FETCH_DATA_START' }
  | { type: 'FETCH_DATA_SUCCESS'; payload: { jobs: Job[], bays: Bay[], users: User[], vehicles: Vehicle[] } }
  | { type: 'FETCH_DATA_FAILURE'; payload: string }
  | { type: 'SET_ALL_DATA'; payload: { jobs: Job[], bays: Bay[], users: User[], vehicles: Vehicle[] } }
  | { type: 'ADD_JOB'; payload: Job }
  | { type: 'UPDATE_JOB'; payload: Job }
  | { type: 'DELETE_JOB'; payload: string }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'ADD_BAY'; payload: Bay }
  | { type: 'UPDATE_BAY'; payload: Bay }
  | { type: 'DELETE_BAY'; payload: string }
  | { type: 'ADD_VEHICLE'; payload: Vehicle }
  | { type: 'UPDATE_VEHICLE'; payload: Vehicle }
  | { type: 'SET_TIMELINE_FULLSCREEN'; payload: boolean }
  | { type: 'SET_LOGO'; payload: string }
  | { type: 'SET_FACILITY'; payload: string | null };

const initialState: AppState = {
  jobs: [],
  bays: [],
  users: [],
  vehicles: [],
  isTimelineFullScreen: false,
  isLoading: true, // we will change to false or true based on if facility is set
  error: null,
  logoUrl: localStorage.getItem('app_custom_logo') || DEFAULT_LOGO,
  activeFacilityId: localStorage.getItem('activeFacilityId') || getDefaultFacility().id,
};


const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'FETCH_DATA_START':
        return { ...state, isLoading: true, error: null };
    case 'FETCH_DATA_SUCCESS':
    case 'SET_ALL_DATA': {
        return { 
            ...state, 
            isLoading: action.type === 'FETCH_DATA_SUCCESS' ? false : state.isLoading,
            jobs: action.payload.jobs,
            bays: action.payload.bays,
            users: action.payload.users,
            vehicles: action.payload.vehicles || [],
        };
    }
    case 'FETCH_DATA_FAILURE':
        return { ...state, isLoading: false, error: action.payload };
    case 'ADD_JOB':
      return { ...state, jobs: [...state.jobs, action.payload] };
    case 'UPDATE_JOB':
      return {
        ...state,
        jobs: state.jobs.map(job =>
          job.id === action.payload.id ? action.payload : job
        ),
      };
    case 'DELETE_JOB':
      return { ...state, jobs: state.jobs.filter(job => job.id !== action.payload) };
    case 'ADD_USER':
        return { ...state, users: [...state.users, action.payload] };
    case 'UPDATE_USER':
        return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
    case 'DELETE_USER':
        return { ...state, users: state.users.filter(u => u.id !== action.payload) };
    case 'ADD_BAY':
        return { ...state, bays: [...state.bays, action.payload] };
    case 'UPDATE_BAY':
        return { ...state, bays: state.bays.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'DELETE_BAY':
        return { ...state, bays: state.bays.filter(b => b.id !== action.payload) };
    case 'ADD_VEHICLE':
        return { ...state, vehicles: [...state.vehicles, action.payload] };
    case 'UPDATE_VEHICLE':
        return { ...state, vehicles: state.vehicles.map(v => v.licensePlate === action.payload.licensePlate ? action.payload : v) };
    case 'SET_TIMELINE_FULLSCREEN':
        return { ...state, isTimelineFullScreen: action.payload };
    case 'SET_LOGO':
        return { ...state, logoUrl: action.payload };
    case 'SET_FACILITY':
        return { ...state, activeFacilityId: action.payload, jobs: [], bays: [], users: [], vehicles: [] };
    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addJob: (job: Job) => Promise<void>;
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  addUser: (user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  addBay: (bay: Bay) => Promise<void>;
  updateBay: (bay: Bay) => Promise<void>;
  deleteBay: (bayId: string) => Promise<void>;
  checkAndUpsertVehicle: (job: Job) => Promise<void>;
  refreshData: () => Promise<void>;
  setLogo: (base64String: string) => void;
  resetLogo: () => void;
  importVehicles: (vehicles: Vehicle[]) => Promise<void>;
  setFacility: (facilityId: string) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

const safeNewDate = (dateString: any): Date | undefined => {
    if (!dateString) return undefined;
    // MySQL trả về dạng "2026-08-20 15:56:00" (dấu cách thay vì T)
    // Safari/WebKit không parse được format này, cần chuyển sang ISO format
    let normalized = String(dateString);
    if (normalized.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/) && !normalized.includes('T')) {
        normalized = normalized.replace(' ', 'T');
    }
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? undefined : date;
};

const hydrateJobsAfterFetch = (items: any[]): Job[] => {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
        // Ignored empty rows silently
        if (!item || !item.id || item.id === "") return null;

        const plannedStartTime = safeNewDate(item.plannedStartTime);
        const plannedEndTime = safeNewDate(item.plannedEndTime);

        if (!plannedStartTime || !plannedEndTime) {
            console.warn('Bỏ qua công việc/lịch hẹn do ngày tháng không hợp lệ:', JSON.stringify(item, null, 2));
            return null;
        }
        
        const hydratedItem: Job = {
            ...item,
            km: item.km ? Number(item.km) : undefined,
            plannedStartTime,
            plannedEndTime,
            actualStartTime: safeNewDate(item.actualStartTime),
            actualEndTime: safeNewDate(item.actualEndTime),
            actualExitTime: safeNewDate(item.actualExitTime),
            actualArrivalTime: safeNewDate(item.actualArrivalTime),
            appointmentCreatedAt: safeNewDate(item.appointmentCreatedAt),
            appointmentTime: safeNewDate(item.appointmentTime),
            stageHistory: Array.isArray(item.stageHistory) ? item.stageHistory.map((h: any) => ({
                ...h,
                startTime: safeNewDate(h.startTime)!,
                endTime: safeNewDate(h.endTime),
            })) : [],
            isAppointment: item.isAppointment || item.status === JobStatus.Appointment,
        };
        return hydratedItem;
    }).filter((item): item is Job => item !== null);
};


export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const loadData = async () => {
        if (!state.activeFacilityId) {
            dispatch({ type: 'FETCH_DATA_SUCCESS', payload: { users: [], bays: [], jobs: [], vehicles: [] } });
            return;
        }

        const facility = getFacilityById(state.activeFacilityId);
        if (!facility) {
            dispatch({ type: 'FETCH_DATA_FAILURE', payload: 'Cơ sở không hợp lệ. Vui lòng chọn lại.' });
            return;
        }

        // Set active facility in API service
        apiService.setApiFacilityId(state.activeFacilityId);

        dispatch({ type: 'FETCH_DATA_START' });
        try {
            const [fastData, vehicleData] = await Promise.all([
                apiService.fetchFastData(),
                apiService.fetchVehicles()
            ]);

            const fastResult = fastData as any;
            const vehicleResult = vehicleData as any;

            dispatch({ 
                type: 'FETCH_DATA_SUCCESS', 
                payload: { 
                    users: fastResult.users, 
                    bays: fastResult.bays, 
                    jobs: hydrateJobsAfterFetch(fastResult.jobs),
                    vehicles: vehicleResult || [],
                } 
            });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Đã có lỗi không xác định xảy ra';
            dispatch({ type: 'FETCH_DATA_FAILURE', payload: errorMessage });
        }
    };
    loadData();
  }, [state.activeFacilityId]);

  // Optimized refresh: Only fetches lightweight data (Jobs/Bays/Users), reusing existing Vehicles.
  // This prevents the "Server is busy" error caused by reading the huge Vehicle sheet repeatedly.
  const refreshData = useCallback(async () => {
    try {
        const data: any = await apiService.fetchFastData();
        dispatch({ 
            type: 'SET_ALL_DATA', 
            payload: { 
                users: data.users, 
                bays: data.bays, 
                jobs: hydrateJobsAfterFetch(data.jobs),
                // IMPORTANT: Keep existing vehicles, do not overwrite with empty or re-fetch unnecessary heavy data
                vehicles: state.vehicles, 
            } 
        });
    } catch (e) {
        console.error("Manual data refresh failed:", e);
        throw e;
    }
  }, [dispatch, state.vehicles]); // Dependency on state.vehicles ensures we don't lose them

  // Logic tự động lưu xe mới hoặc cập nhật thông tin xe
  // MOVED UP: Để addJob và updateJob có thể gọi được
  const checkAndUpsertVehicle = useCallback(async (job: Job) => {
      // --- LOGIC MỚI: LƯU XE KHI ĐẾN, HOÀN THÀNH, SẴN SÀNG HOẶC RA CỔNG ---
      // Nếu là lịch hẹn hoặc bỏ hẹn thì không lưu vào danh sách xe chính thức
      if (job.status === JobStatus.Appointment || job.status === JobStatus.MissedAppointment) {
          return;
      }

      // Chỉ lưu xe nếu có thông tin đầy đủ và biển số hợp lệ
      if (!job.licensePlate || !job.customerName) return;

      // Hàm chuẩn hóa chuỗi: Bỏ dấu, bỏ khoảng trắng, chữ hoa
      // Ví dụ: "59A-123.45" -> "59A12345"
      const normalize = (str: string) => str ? str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
      
      const jobPlateClean = normalize(job.licensePlate);

      // Tìm kiếm xe trong danh sách bằng biển số đã chuẩn hóa
      const existingVehicle = state.vehicles.find(v => normalize(v.licensePlate) === jobPlateClean);
      
      // Dữ liệu mới từ Job (chỉ những trường JobForm có thể cung cấp)
      const inputData = {
          customerName: job.customerName,
          customerPhone: job.customerPhone || '',
          carModel: job.carModel,
          vin: job.vin || '',
      };

      if (!existingVehicle) {
          // Nếu xe chưa có trong hệ thống => Thêm mới
          const newVehicle: Vehicle = {
              id: crypto.randomUUID(),
              licensePlate: job.licensePlate, // Lưu biển số theo định dạng nhập vào lần đầu
              ...inputData,
              color: '',
              purchaseDate: undefined, // Fix: Use undefined instead of empty string for DB date columns
              uio: false 
          };

          try {
              const added = await apiService.addVehicle(newVehicle);
              dispatch({ type: 'ADD_VEHICLE', payload: added });
          } catch (e) {
              console.error("Failed to auto-add vehicle:", e);
          }
      } else {
          // Nếu xe đã có, kiểm tra xem có thay đổi thông tin quan trọng từ JobForm không
          // So sánh tương đối cho số VIN (nếu có) để tránh cập nhật không cần thiết do định dạng
          const isVinChanged = inputData.vin && normalize(existingVehicle.vin || '') !== normalize(inputData.vin);

          const hasChanged = 
            existingVehicle.customerName !== inputData.customerName ||
            existingVehicle.customerPhone !== inputData.customerPhone ||
            existingVehicle.carModel !== inputData.carModel ||
            isVinChanged;
          
          if (hasChanged) {
             try {
                 // Merge dữ liệu cũ với dữ liệu mới
                 // Cập nhật lại licensePlate theo định dạng mới nhất từ Job (chuẩn hóa hiển thị)
                 const updatedVehicle: Vehicle = { 
                     ...existingVehicle, 
                     ...inputData,
                     licensePlate: job.licensePlate, // Cập nhật lại định dạng biển số nếu người dùng nhập đẹp hơn
                     vin: inputData.vin || existingVehicle.vin 
                 };
                 
                 const result = await apiService.updateVehicle(updatedVehicle);
                 dispatch({ type: 'UPDATE_VEHICLE', payload: result });
             } catch (e) {
                 console.error("Failed to auto-update vehicle:", e);
             }
          }
      }
  }, [dispatch, state.vehicles]);

  const addJob = useCallback(async (job: Job) => {
    const newJobFromApi = await apiService.addJob(job);
    const hydratedJob = hydrateJobsAfterFetch([newJobFromApi])[0];
    dispatch({ type: 'ADD_JOB', payload: hydratedJob });
    
    // Kích hoạt học dữ liệu xe (Sẽ bị chặn nếu status không phải hoàn thành)
    checkAndUpsertVehicle(hydratedJob);
  }, [dispatch, checkAndUpsertVehicle]);

  const updateJob = useCallback(async (job: Job) => {
    const updatedJobFromApi = await apiService.updateJob(job);
    const hydratedJob = hydrateJobsAfterFetch([updatedJobFromApi])[0];
    dispatch({ type: 'UPDATE_JOB', payload: hydratedJob });
    
    // Kích hoạt học dữ liệu xe (Chỉ chạy khi status chuyển sang Hoàn thành/Sẵn sàng)
    checkAndUpsertVehicle(hydratedJob);
  }, [dispatch, checkAndUpsertVehicle]);

  const deleteJob = useCallback(async (jobId: string) => {
    await apiService.deleteJob(jobId);
    dispatch({ type: 'DELETE_JOB', payload: jobId });
  }, [dispatch]);
  
  const addUser = useCallback(async (user: User) => {
      const newUser = await apiService.addUser(user);
      dispatch({ type: 'ADD_USER', payload: newUser });
  }, [dispatch]);

  const updateUser = useCallback(async (user: User) => {
      const updatedUser = await apiService.updateUser(user);
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
  }, [dispatch]);

  const deleteUser = useCallback(async (userId: string) => {
      await apiService.deleteUser(userId);
      dispatch({ type: 'DELETE_USER', payload: userId });
  }, [dispatch]);

  const addBay = useCallback(async (bay: Bay) => {
      const newBay = await apiService.addBay(bay);
      dispatch({ type: 'ADD_BAY', payload: newBay });
  }, [dispatch]);

  const updateBay = useCallback(async (bay: Bay) => {
      const updatedBay = await apiService.updateBay(bay);
      dispatch({ type: 'UPDATE_BAY', payload: updatedBay });
  }, [dispatch]);

  const deleteBay = useCallback(async (bayId: string) => {
      await apiService.deleteBay(bayId);
      dispatch({ type: 'DELETE_BAY', payload: bayId });
  }, [dispatch]);

  const setLogo = useCallback((base64String: string) => {
      localStorage.setItem('app_custom_logo', base64String);
      dispatch({ type: 'SET_LOGO', payload: base64String });
  }, [dispatch]);

  const resetLogo = useCallback(() => {
      localStorage.removeItem('app_custom_logo');
      dispatch({ type: 'SET_LOGO', payload: DEFAULT_LOGO });
  }, [dispatch]);

  const importVehicles = useCallback(async (vehicles: Vehicle[]) => {
      await apiService.importVehicles(vehicles);
      // For import, we DO need to fetch the vehicle list again to update UI
      // But we can call fetchVehicles specifically
      const vehicleResult: any = await apiService.fetchVehicles();
      const updatedVehicles = vehicleResult.vehicles || [];
      
      // We also need fast data to keep the state consistent
      const fastResult: any = await apiService.fetchFastData();
      
      dispatch({ 
        type: 'SET_ALL_DATA', 
        payload: { 
            users: fastResult.users, 
            bays: fastResult.bays, 
            jobs: hydrateJobsAfterFetch(fastResult.jobs),
            vehicles: updatedVehicles,
        } 
      });
  }, [dispatch]);

  const setFacility = useCallback((facilityId: string) => {
      localStorage.setItem('activeFacilityId', facilityId);
      apiService.setApiFacilityId(facilityId);
      dispatch({ type: 'SET_FACILITY', payload: facilityId });
  }, [dispatch]);

  return (
    <AppContext.Provider value={{ 
        state, 
        dispatch,
        addJob,
        updateJob,
        deleteJob,
        addUser,
        updateUser,
        deleteUser,
        addBay,
        updateBay,
        deleteBay,
        checkAndUpsertVehicle,
        refreshData,
        setLogo,
        resetLogo,
        importVehicles,
        setFacility
    }}>
      {children}
    </AppContext.Provider>
  );
};
