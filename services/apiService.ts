// --- API Service Implementation using Custom Express Backend ---

let activeFacilityId = localStorage.getItem('activeFacilityId') || 'facility_1';

export const setApiFacilityId = (id: string) => {
    activeFacilityId = id;
};

// PWA / Jamstack API URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Custom fetch wrapper to support dynamic API host (Netlify frontend -> cPanel backend)
const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' && input.startsWith('/') ? `${API_BASE_URL}${input}` : input;
    return window.fetch(url, init);
};

const getHeaders = () => {
    return {
        'Content-Type': 'application/json',
        'x-facility-id': activeFacilityId
    };
};

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${res.status}`);
    }
    return res.json();
};

// Truy vấn lấy toàn bộ dữ liệu (tương thích ngược)
export const fetchAllData = async () => {
    const res = await fetch('/api/all-data', {
        headers: getHeaders()
    });
    return handleResponse(res);
};

// Truy vấn nhanh (Jobs, Users, Bays)
export const fetchFastData = async () => {
    const res = await fetch('/api/fast-data', {
        headers: getHeaders()
    });
    return handleResponse(res);
};

// Truy vấn xe (Vehicles)
export const fetchVehicles = async () => {
    const res = await fetch('/api/vehicles', {
        headers: getHeaders()
    });
    return handleResponse(res);
};

// --- Job API ---

export const addJob = async (job: any) => {
    const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(job)
    });
    return handleResponse(res);
};

export const updateJob = async (job: any) => {
    const res = await fetch('/api/jobs', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(job)
    });
    return handleResponse(res);
};

export const deleteJob = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return handleResponse(res);
};

// --- User API ---

export const addUser = async (user: any) => {
    const res = await fetch('/api/users', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(user)
    });
    return handleResponse(res);
};

export const updateUser = async (user: any) => {
    const res = await fetch('/api/users', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(user)
    });
    return handleResponse(res);
};

export const deleteUser = async (userId: string) => {
    const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return handleResponse(res);
};

// --- Bay API ---

export const addBay = async (bay: any) => {
    const res = await fetch('/api/bays', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(bay)
    });
    return handleResponse(res);
};

export const updateBay = async (bay: any) => {
    const res = await fetch('/api/bays', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(bay)
    });
    return handleResponse(res);
};

export const deleteBay = async (bayId: string) => {
    const res = await fetch(`/api/bays/${bayId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return handleResponse(res);
};

// --- Vehicle API ---

export const addVehicle = async (vehicle: any) => {
    const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(vehicle)
    });
    return handleResponse(res);
};

export const updateVehicle = async (vehicle: any) => {
    const res = await fetch('/api/vehicles', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(vehicle)
    });
    return handleResponse(res);
};

export const importVehicles = async (vehicles: any[]) => {
    const res = await fetch('/api/vehicles/import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ vehicles })
    });
    return handleResponse(res);
};

// --- Authentication & Global Admin APIs ---

export const loginUser = async (username: string, pass: string) => {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass })
    });
    return handleResponse(res);
};

export const fetchSuperAdminOverview = async (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const res = await fetch(`/api/super-admin/overview${qs ? '?' + qs : ''}`, {
        headers: getHeaders()
    });
    return handleResponse(res);
};

export const fetchFacilities = async () => {
    const res = await fetch('/api/facilities', {
        headers: getHeaders()
    });
    return handleResponse(res);
};
