import React, { useState, useEffect } from 'react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import type { DriveFile } from '../../context/GoogleDriveContext';
import ConfirmationModal from '../modals/ConfirmationModal';

const GoogleCredentialsForm: React.FC<{ onSave: (apiKey: string, clientId: string) => void; initialError: string }> = ({ onSave, initialError }) => {
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedOrigin, setCopiedOrigin] = useState(false);
    
    const currentOrigin = window.location.origin;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        onSave(apiKey, clientId);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(currentOrigin);
        setCopiedOrigin(true);
        setTimeout(() => setCopiedOrigin(false), 2000);
    };

    return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-xl font-bold text-red-800 text-center">Cần cấu hình</h3>
            <p className="text-red-600 mt-2 mb-4 text-center">{initialError}</p>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-left max-w-lg mx-auto">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Google API Key</label>
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md" 
                        required 
                        placeholder="Nhập API Key của bạn"
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Google Client ID</label>
                    <input 
                        type="password" 
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md" 
                        required 
                        placeholder="Nhập Client ID của bạn"
                    />
                </div>
                <div className="text-xs text-gray-500 pt-2 space-y-3">
                    <p>Lấy thông tin này từ <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a>.</p>
                    <p>1. Trong mục "APIs & Services" &gt; "Credentials", tạo một "API key" và một "OAuth 2.0 Client ID" (loại Web Application).</p>
                    <p className="font-bold text-red-600">2. QUAN TRỌNG: Bạn phải bật "Google Drive API" cho dự án. Vào mục "Library", tìm "Google Drive API" và nhấn "Enable".</p>
                    
                    <div className="mt-2 p-2 bg-gray-100 rounded border">
                        <p className="font-bold text-gray-700">3. Cấu hình Client ID</p>
                        <p className="mt-1">Dán URL dưới đây vào cả 2 phần: <strong className="text-gray-800">"Authorized JavaScript origins"</strong> và <strong className="text-gray-800">"Authorized redirect URIs"</strong>.</p>
                        <div className="flex items-center space-x-2 mt-1">
                            <input type="text" value={currentOrigin} readOnly className="w-full p-1 bg-white border border-gray-300 rounded font-mono text-sm text-gray-600" />
                            <button type="button" onClick={handleCopy} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded text-xs w-20 text-center">
                                {copiedOrigin ? 'Đã chép!' : 'Sao chép'}
                            </button>
                        </div>
                    </div>
                </div>
                <button type="submit" disabled={isLoading} className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full disabled:bg-gray-400">
                    {isLoading ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
            </form>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left max-w-lg mx-auto">
                <h4 className="font-bold text-yellow-800">Xử lý sự cố: Gặp lỗi "Lỗi 400: invalid_request"?</h4>
                <p className="text-sm text-yellow-700 mt-2">Lỗi này thường xảy ra khi ứng dụng của bạn trên Google Cloud đang ở chế độ "Testing".</p>
                <ol className="list-decimal list-inside text-sm text-yellow-700 mt-2 space-y-1">
                    <li>Vào <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">OAuth consent screen</a> trong Google Cloud Console.</li>
                    <li>Tìm mục <strong className="text-yellow-800">Publishing status</strong>. Nếu là <strong>"Testing"</strong>, tìm tiếp mục <strong className="text-yellow-800">Test users</strong>.</li>
                    <li>Nhấn vào <strong>"+ ADD USERS"</strong> và thêm email Google bạn muốn dùng để đăng nhập.</li>
                    <li>Lưu lại và thử kết nối lại.</li>
                </ol>
            </div>
        </div>
    );
};


const BackupRestore: React.FC = () => {
    const { 
        isSignedIn, signIn, signOut, googleUser, 
        backupData, listBackupFiles, restoreData, 
        isGoogleAuthReady, authError, saveCredentials, hasCredentials, clearCredentials
    } = useGoogleDrive();
    const [isLoading, setIsLoading] = useState(false);
    const [backups, setBackups] = useState<DriveFile[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [fileToRestore, setFileToRestore] = useState<DriveFile | null>(null);

    useEffect(() => {
        if (isSignedIn && !authError) {
            handleListBackups();
        } else {
            setBackups([]);
        }
    }, [isSignedIn, authError]);
    
    const handleBackup = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await backupData();
            alert('Sao lưu thành công!');
            await handleListBackups();
        } catch (err) {
            console.error(err);
            setError('Sao lưu thất bại. Vui lòng kiểm tra lại cấu hình API hoặc thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleListBackups = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const files = await listBackupFiles();
            setBackups(files);
        } catch (err) {
            console.error(err);
            setError('Không thể tải danh sách backup.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRestoreRequest = (file: DriveFile) => {
        setFileToRestore(file);
        setIsConfirmOpen(true);
    };

    const handleRestoreConfirm = async () => {
        if (!fileToRestore) return;
        setIsLoading(true);
        setError(null);
        try {
            await restoreData(fileToRestore.id);
            alert(`Phục hồi thành công từ file ${fileToRestore.name}!`);
        } catch (err) {
            console.error(err);
            setError('Phục hồi thất bại. File backup có thể bị lỗi.');
        } finally {
            setIsLoading(false);
            setIsConfirmOpen(false);
            setFileToRestore(null);
        }
    };
    
    if (!hasCredentials) {
         return <GoogleCredentialsForm onSave={saveCredentials} initialError={authError || "Lỗi cấu hình: Google API Key hoặc Client ID chưa được thiết lập."} />;
    }

    if (!isGoogleAuthReady) {
        return <p className="text-center p-4">Đang khởi tạo dịch vụ Google...</p>;
    }
    
    if (authError) {
        return (
            <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-xl font-bold text-red-800">Không thể kết nối</h3>
                <p className="text-red-600 mt-2">{authError}</p>
                <p className="text-sm text-gray-500 mt-2">Vui lòng kiểm tra lại API Key, Client ID, và chắc chắn rằng bạn đã bật Google Drive API.</p>
                <button onClick={clearCredentials} className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded">
                    Sửa lại cấu hình
                </button>
            </div>
        );
    }
    
    const renderSignedInView = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-3">
                    {googleUser?.picture && <img src={googleUser.picture} alt="avatar" className="w-10 h-10 rounded-full" />}
                    <div>
                        <p className="font-semibold">{googleUser?.name}</p>
                        <p className="text-sm text-gray-600">{googleUser?.email}</p>
                    </div>
                </div>
                <button onClick={signOut} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
                    Ngắt kết nối
                </button>
            </div>
            
            <div>
                <button onClick={handleBackup} disabled={isLoading} className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                    {isLoading ? 'Đang xử lý...' : 'Sao lưu dữ liệu ngay'}
                </button>
            </div>

            <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Phục hồi dữ liệu</h3>
                <p className="text-sm text-gray-600 mb-4">Chọn một file backup để phục hồi. <strong className="text-red-600">Lưu ý: Hành động này sẽ ghi đè toàn bộ dữ liệu hiện tại.</strong></p>
                {error && <p className="text-red-500 bg-red-50 p-2 rounded">{error}</p>}
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2 bg-gray-50">
                    {backups.length > 0 ? backups.map(file => (
                        <div key={file.id} className="flex justify-between items-center p-2 bg-white rounded border">
                            <span className="text-sm font-mono">{file.name}</span>
                            <button onClick={() => handleRestoreRequest(file)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-3 rounded">
                                Phục hồi
                            </button>
                        </div>
                    )) : <p className="text-gray-500 text-center p-4">{isLoading ? 'Đang tải...' : 'Chưa có file backup nào.'}</p>}
                </div>
            </div>
        </div>
    );
    
    const renderSignedOutView = () => (
        <div className="text-center p-8 border-2 border-dashed rounded-lg">
            <h3 className="text-xl font-bold text-gray-800">Kết nối với Google Drive</h3>
            <p className="text-gray-600 my-4">Để sử dụng tính năng sao lưu và phục hồi, bạn cần cấp quyền cho ứng dụng truy cập vào Google Drive của bạn.</p>
            <button onClick={signIn} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center space-x-2">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="currentColor"><path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" fill="#EA4335"/><path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" fill="#4285F4"/><path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" fill="#FBBC05"/><path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" fill="#34A853"/><path d="M0 0h48v48H0z" fill="none"/></svg>
                <span>Kết nối với Google Drive</span>
            </button>
        </div>
    );

    return (
        <div>
            {isConfirmOpen && fileToRestore && (
                <ConfirmationModal
                    message={`Bạn có chắc muốn phục hồi từ file "${fileToRestore.name}"? Tất cả dữ liệu hiện tại sẽ bị ghi đè.`}
                    onConfirm={handleRestoreConfirm}
                    onCancel={() => setIsConfirmOpen(false)}
                />
            )}
            {isSignedIn ? renderSignedInView() : renderSignedOutView()}
        </div>
    );
};

export default BackupRestore;