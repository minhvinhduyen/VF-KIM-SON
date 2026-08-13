import React, { useState, useEffect, useMemo } from 'react';
import { Bay, BayType, Role } from '../../types';
import { useApp } from '../../hooks/useApp';

interface BayFormModalProps {
  bay: Bay | null;
  onSave: (bay: Omit<Bay, 'id'>) => void;
  onClose: () => void;
}

const BayFormModal: React.FC<BayFormModalProps> = ({ bay, onSave, onClose }) => {
  const { state } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    type: BayType.General,
    technician: '',
    supportsLift: false,
  });

  useEffect(() => {
    if (bay) {
      setFormData({
        name: bay.name,
        type: bay.type,
        technician: bay.technician || '',
        supportsLift: bay.supportsLift,
      });
    }
  }, [bay]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const technicianOptions = useMemo(() => {
    const roleToFilter = formData.type === BayType.BodyShop ? Role.TechnicianDS : Role.TechnicianSC;
    return state.users.filter(u => u.role === roleToFilter).map(u => u.name).sort();
  }, [state.users, formData.type]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
     <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{bay ? 'Sửa thông tin khoang' : 'Thêm khoang mới'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Tên khoang</label>
            <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Loại khoang</label>
            <select name="type" value={formData.type || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
              {Object.values(BayType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tên KTV (nếu có)</label>
            <select name="technician" value={formData.technician || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                <option value="">-- Chọn KTV --</option>
                {technicianOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </select>
          </div>
          <div className="flex items-center pt-2">
               <input type="checkbox" id="supportsLift" name="supportsLift" checked={formData.supportsLift} onChange={handleChange} className="h-4 w-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue" />
               <label htmlFor="supportsLift" className="ml-2 block text-sm text-gray-900">Có cầu nâng</label>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">Hủy</button>
            <button type="submit" className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BayFormModal;
