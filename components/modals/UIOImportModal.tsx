
import React, { useState, useRef } from 'react';
import { useApp } from '../../hooks/useApp';
import { Vehicle } from '../../types';

declare var XLSX: any;

interface UIOImportModalProps {
    onClose: () => void;
}

const UIOImportModal: React.FC<UIOImportModalProps> = ({ onClose }) => {
    const { importVehicles } = useApp();
    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const [parsedVehicles, setParsedVehicles] = useState<Vehicle[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadTemplate = () => {
        const templateData = [
            {
                "Biển số": "59A-123.45",
                "Tên Khách Hàng": "Nguyễn Văn A",
                "Số Điện Thoại": "0909123456",
                "Dòng Xe": "VF8",
                "Số VIN": "RL1234...",
                "Ngày Mua": "2023-01-01",
                "Màu Xe": "Trắng"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mau_UIO");
        XLSX.writeFile(wb, "Mau_Nhap_UIO_VinFast.xlsx");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                processData(data);
            } catch (err) {
                setError("Lỗi đọc file. Vui lòng đảm bảo file đúng định dạng Excel.");
                console.error(err);
            }
        };
        reader.readAsBinaryString(file);
    };

    const processData = (data: any[]) => {
        const vehicles: Vehicle[] = [];
        let errors = 0;

        data.forEach((row: any) => {
            // Mapping cột linh hoạt (chấp nhận tiếng Việt không dấu hoặc có dấu)
            const plate = row['Biển số'] || row['Bien so'] || row['License Plate'];
            const name = row['Tên Khách Hàng'] || row['Ten Khach Hang'] || row['Customer Name'];
            
            if (plate && name) {
                const vin = row['Số VIN'] || row['So VIN'] || row['VIN'] || '';
                const phone = row['Số Điện Thoại'] || row['So Dien Thoai'] || row['Phone'] || '';
                const model = row['Dòng Xe'] || row['Dong Xe'] || row['Car Model'] || 'Khác';
                const color = row['Màu Xe'] || row['Mau Xe'] || row['Color'] || '';
                const purchaseDate = row['Ngày Mua'] || row['Ngay Mua'] || row['Purchase Date'] || '';

                vehicles.push({
                    id: crypto.randomUUID(), // ID tạm, backend sẽ xử lý logic update/insert
                    licensePlate: String(plate).trim(),
                    customerName: String(name).trim(),
                    customerPhone: String(phone),
                    carModel: String(model),
                    vin: String(vin),
                    color: String(color),
                    purchaseDate: String(purchaseDate),
                    uio: true // Đánh dấu là xe trong UIO
                });
            } else {
                errors++;
            }
        });

        if (vehicles.length === 0) {
            setError("Không tìm thấy dữ liệu hợp lệ. Vui lòng kiểm tra lại file mẫu.");
        } else {
            setError(null);
            setParsedVehicles(vehicles);
            setStep('preview');
        }
    };

    const handleImport = async () => {
        setIsSubmitting(true);
        try {
            await importVehicles(parsedVehicles);
            alert(`Đã cập nhật thành công ${parsedVehicles.length} xe vào hệ thống.`);
            onClose();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
                <div className="p-4 bg-brand-blue flex justify-between items-center">
                    <h2 className="text-white font-bold text-lg">Cập nhật Danh sách Xe (UIO)</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl">&times;</button>
                </div>
                
                <div className="p-6">
                    {step === 'upload' ? (
                        <div className="space-y-6">
                            <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                                <p className="text-gray-600 mb-4">Bước 1: Tải file mẫu nếu chưa có</p>
                                <button 
                                    onClick={handleDownloadTemplate}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded inline-flex items-center"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Tải file mẫu (.xlsx)
                                </button>
                            </div>

                            <div className="text-center">
                                <p className="text-gray-600 mb-2">Bước 2: Chọn file Excel chứa dữ liệu</p>
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls"
                                    onChange={handleFileChange}
                                    ref={fileInputRef}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-brand-blue hover:file:bg-blue-100"
                                />
                                <p className="text-xs text-gray-400 mt-2">Hỗ trợ file .xlsx, .xls</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-4">
                             <div className="py-4">
                                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <h3 className="mt-2 text-lg font-medium text-gray-900">Sẵn sàng nhập liệu</h3>
                                <p className="mt-1 text-sm text-gray-500">Đã tìm thấy <span className="font-bold text-brand-blue">{parsedVehicles.length}</span> xe trong file.</p>
                                <p className="text-xs text-gray-400">Dữ liệu sẽ được thêm mới hoặc cập nhật nếu biển số đã tồn tại.</p>
                             </div>
                             
                             <div className="flex space-x-3 justify-center">
                                <button 
                                    onClick={() => { setStep('upload'); setParsedVehicles([]); setError(null); }}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded"
                                    disabled={isSubmitting}
                                >
                                    Chọn lại
                                </button>
                                <button 
                                    onClick={handleImport}
                                    className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-6 rounded flex items-center"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    {isSubmitting ? 'Đang xử lý...' : 'Cập nhật ngay'}
                                </button>
                             </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UIOImportModal;
