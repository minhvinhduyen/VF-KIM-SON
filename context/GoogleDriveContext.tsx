

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useApp } from '../hooks/useApp';
import type { Job, User, Bay } from '../types';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const APP_FOLDER_NAME = 'BangTienDoXuongDichVu_Backups';

declare global {
    interface Window {
        gapi: any;
        google: any;
        tokenClient: any;
    }
}

interface GoogleUser {
    name: string;
    email: string;
    picture: string;
}

export interface DriveFile {
    id: string;
    name: string;
}

interface GoogleDriveContextType {
    isGoogleAuthReady: boolean;
    isSignedIn: boolean;
    googleUser: GoogleUser | null;
    authError: string | null;
    signIn: () => void;
    signOut: () => void;
    backupData: () => Promise<void>;
    listBackupFiles: () => Promise<DriveFile[]>;
    restoreData: (fileId: string) => Promise<void>;
    saveCredentials: (apiKey: string, clientId: string) => void;
    hasCredentials: boolean;
    clearCredentials: () => void;
}

export const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

const hydrateJobs = (jobs: any[]): Job[] => {
    if (!Array.isArray(jobs)) return [];
    return jobs.map(job => ({
        ...job,
        plannedStartTime: new Date(job.plannedStartTime),
        plannedEndTime: new Date(job.plannedEndTime),
        actualStartTime: job.actualStartTime ? new Date(job.actualStartTime) : undefined,
        actualEndTime: job.actualEndTime ? new Date(job.actualEndTime) : undefined,
        actualArrivalTime: job.actualArrivalTime ? new Date(job.actualArrivalTime) : undefined,
        stageHistory: job.stageHistory ? job.stageHistory.map((h: any) => ({
            ...h,
            startTime: new Date(h.startTime),
            endTime: h.endTime ? new Date(h.endTime) : undefined,
        })) : [],
    }));
};


export const GoogleDriveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { state: appState, dispatch } = useApp();
    const [isGoogleAuthReady, setIsGoogleAuthReady] = useState(false);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    
    const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('google_api_key'));
    const [clientId, setClientId] = useState<string | null>(() => localStorage.getItem('google_client_id'));
    const hasCredentials = !!(apiKey && clientId);

    const handleAuthResponse = useCallback(async (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
            window.gapi.auth.setToken(tokenResponse);
            try {
                const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
                });
                const profile = await profileResponse.json();
                setGoogleUser({ name: profile.name, email: profile.email, picture: profile.picture });
                setIsSignedIn(true);
            } catch (error) {
                console.error("Error fetching user profile:", error);
                setAuthError("Không thể lấy thông tin người dùng Google.");
            }
        }
    }, []);
    
    const initializeGoogleClient = useCallback((key: string, id: string) => {
        setAuthError(null);
        setIsGoogleAuthReady(false);
        try {
            window.gapi.load('client', () => {
                window.gapi.client.init({
                    apiKey: key,
                    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
                }).then(() => {
                    try {
                        window.tokenClient = window.google.accounts.oauth2.initTokenClient({
                            client_id: id,
                            scope: SCOPES,
                            callback: handleAuthResponse,
                            error_callback: (error: any) => {
                                if (error.type === "popup_closed" || error.type === "popup_failed_to_open") return;
                                console.error('Google Auth Error:', error);
                                setAuthError("Lỗi xác thực Google. Vui lòng kiểm tra lại cấu hình Client ID.");
                            }
                        });
                        setIsGoogleAuthReady(true);
                    } catch (initError) {
                        console.error("Error initializing Google Token Client:", initError);
                        setAuthError("Không thể khởi tạo Google Sign-In. Client ID có thể không hợp lệ.");
                        setIsGoogleAuthReady(true);
                    }
                }, (initError: any) => {
                    console.error("Error initializing Google API Client:", initError);
                    setAuthError("Không thể khởi tạo Google API. API Key có thể không hợp lệ.");
                    setIsGoogleAuthReady(true);
                });
            });
        } catch (loadError) {
            console.error("Error loading GAPI client:", loadError);
            setAuthError("Không thể tải thư viện Google API.");
            setIsGoogleAuthReady(true);
        }
    }, [handleAuthResponse]);

    useEffect(() => {
        const scriptLoadedCheck = setInterval(() => {
            if (window.gapi && window.google) {
                clearInterval(scriptLoadedCheck);
                if (apiKey && clientId) {
                    initializeGoogleClient(apiKey, clientId);
                } else {
                    setAuthError("Lỗi cấu hình: Google API Key hoặc Client ID chưa được thiết lập.");
                    setIsGoogleAuthReady(true);
                }
            }
        }, 100);
        return () => clearInterval(scriptLoadedCheck);
    }, [apiKey, clientId, initializeGoogleClient]);
    
    const saveCredentials = (newApiKey: string, newClientId: string) => {
        localStorage.setItem('google_api_key', newApiKey);
        localStorage.setItem('google_client_id', newClientId);
        setApiKey(newApiKey);
        setClientId(newClientId);
    };

    const clearCredentials = () => {
        localStorage.removeItem('google_api_key');
        localStorage.removeItem('google_client_id');
        setApiKey(null);
        setClientId(null);
        setIsSignedIn(false);
        setGoogleUser(null);
        setAuthError("Lỗi cấu hình: Google API Key hoặc Client ID chưa được thiết lập.");
    };

    const signIn = () => {
        if (window.tokenClient) {
            window.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            alert("Dịch vụ Google chưa sẵn sàng. Vui lòng thử lại sau giây lát.");
        }
    };

    const signOut = () => {
        const token = window.gapi.client.getToken();
        if (token) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {});
            window.gapi.client.setToken(null);
        }
        setIsSignedIn(false);
        setGoogleUser(null);
    };
    
    const findOrCreateAppFolder = async (): Promise<string> => {
        let response = await window.gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
            fields: 'files(id, name)',
        });
        if (response.result.files.length > 0) return response.result.files[0].id;
        
        const fileMetadata = { name: APP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' };
        response = await window.gapi.client.drive.files.create({ resource: fileMetadata, fields: 'id' });
        return response.result.id;
    };

    const backupData = async () => {
        if (!isSignedIn) throw new Error("User not signed into Google");
        const folderId = await findOrCreateAppFolder();
        const content = JSON.stringify({ 
            users: appState.users, 
            bays: appState.bays, 
            jobs: appState.jobs,
            vehicles: appState.vehicles 
        }, null, 2);
        const fileName = `BangTienDo_Backup_${new Date().toISOString().replace(/:/g, '-')}.json`;
        const metadata = { name: fileName, mimeType: 'application/json', parents: [folderId] };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'application/json' }));

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + window.gapi.client.getToken().access_token }),
            body: form
        });
    };

    const listBackupFiles = async (): Promise<DriveFile[]> => {
        if (!isSignedIn) throw new Error("User not signed into Google");
        const folderId = await findOrCreateAppFolder();
        const response = await window.gapi.client.drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
            fields: 'files(id, name)',
            orderBy: 'createdTime desc'
        });
        return response.result.files || [];
    };

    const restoreData = async (fileId: string) => {
        if (!isSignedIn) throw new Error("User not signed into Google");
        const response = await window.gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
        const restoredState = JSON.parse(response.body);
        const hydratedData = {
            users: restoredState.users || [],
            bays: restoredState.bays || [],
            jobs: hydrateJobs(restoredState.jobs || []),
            vehicles: restoredState.vehicles || [],
        };
        const { users, bays, jobs, vehicles } = hydratedData;
        dispatch({ type: 'FETCH_DATA_SUCCESS', payload: { jobs, bays, users, vehicles } });
    };

    return (
        <GoogleDriveContext.Provider value={{ 
            isGoogleAuthReady, isSignedIn, googleUser, authError, 
            signIn, signOut, backupData, listBackupFiles, restoreData, 
            saveCredentials, hasCredentials, clearCredentials
        }}>
            {children}
        </GoogleDriveContext.Provider>
    );
};
