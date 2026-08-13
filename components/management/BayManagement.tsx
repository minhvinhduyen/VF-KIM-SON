
import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Bay } from '../../types';
import BayFormModal from '../modals/BayFormModal';
import ConfirmationModal from '../modals/ConfirmationModal';

const BayManagement: React.FC = () => {
  const { state, addBay, updateBay, deleteBay } = useApp();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [bayToDelete, setBayToDelete] = useState<Bay | null>(null);

  const handleAdd = () => {
    setSelectedBay(null);
    setIsFormOpen(true);
  };

  const handleEdit = (bay: Bay) => {
    setSelectedBay(bay);
    setIsFormOpen(true);
  };
  
  const handleDeleteRequest = (bay: Bay) => {
    setBayToDelete(bay);
    setIsConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (bayToDelete) {
      try {
        await deleteBay(bayToDelete.id);
      } catch (e) {
        alert("Lỗi khi xóa khoang: " + (e as Error).message);
      }
    }
    setIsConfirmOpen(false);
    setBayToDelete(null);
  };


  const handleFormSave = async (bayData: Omit<Bay, 'id'>) => {
    try {
        if (selectedBay) {
            await updateBay({ ...bayData, id: selectedBay.id });
        } else {
            const newBay = { ...bayData, id: crypto.randomUUID() };
            await addBay(newBay);
        }
        setIsFormOpen(false);
    } catch (e) {
        alert("Lỗi khi lưu khoang: " + (e as Error).message);
    }
  };

  return (
    <div>
      {isFormOpen && <BayFormModal bay={selectedBay} onSave={handleFormSave} onClose={() => setIsFormOpen(false)} />}
      {isConfirmOpen && bayToDelete && (
        <ConfirmationModal
          message={`Bạn có chắc muốn xóa khoang ${bayToDelete.name}?`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Quản lý khoang</h2>
        <button onClick={handleAdd} className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          + Thêm khoang
        </button>
      </div>
       <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên khoang</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Loại</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">KTV</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Có cầu nâng</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
            </tr>
          </thead>
          <tbody>
            {state.bays.map(bay => (
              <tr key={bay.id}>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{bay.name}</td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{bay.type}</td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{bay.technician || 'N/A'}</td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{bay.supportsLift ? 'Có' : 'Không'}</td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                  <button onClick={() => handleEdit(bay)} className="text-indigo-600 hover:text-indigo-900 mr-4">Sửa</button>
                  <button onClick={() => handleDeleteRequest(bay)} className="text-red-600 hover:text-red-900">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BayManagement;
