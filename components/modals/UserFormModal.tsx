import React, { useState, useEffect } from 'react';
import { User, Role } from '../../types';

interface UserFormModalProps {
  user: User | null;
  onSave: (user: User) => void;
  onClose: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    role: Role.ServiceAdvisor,
    password: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        id: user.id,
        name: user.name,
        role: user.role,
        password: '', // Do not show existing password for security
      });
    } else {
      setFormData({
        id: '',
        name: '',
        role: Role.ServiceAdvisor,
        password: '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isKTV = formData.role === Role.TechnicianSC || formData.role === Role.TechnicianDS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user) { // Editing existing user
        const updatedUser: User = {
            ...user,
            name: formData.name,
            role: formData.role,
        };
        if (formData.password) {
            updatedUser.password = formData.password;
        }
        onSave(updatedUser);
    } else { // Adding new user
        if (!formData.id || !formData.name || (!isKTV && !formData.password)) {
            alert(isKTV ? 'Mã NV và Tên là bắt buộc cho KTV mới.' : 'Mã NV, Tên, và Mật khẩu là bắt buộc cho nhân viên mới.');
            return;
        }
        const newUser: User = {
            id: formData.id,
            name: formData.name,
            role: formData.role,
            password: formData.password || undefined,
        };
        onSave(newUser);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{user ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên mới'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Mã NV</label>
            <input 
              type="text" 
              name="id" 
              value={formData.id || ''} 
              onChange={handleChange} 
              className={`mt-1 block w-full p-2 border border-gray-300 rounded-md ${user ? 'bg-gray-100' : ''}`} 
              required 
              readOnly={!!user} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tên nhân viên</label>
            <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Vai trò</label>
            <select name="role" value={formData.role || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
              {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mật khẩu {isKTV && <span className="text-gray-400 text-xs">(Không bắt buộc cho KTV)</span>}</label>
            <input 
              type="password" 
              name="password" 
              value={formData.password || ''} 
              onChange={handleChange} 
              placeholder={isKTV ? "KTV không cần đăng nhập" : (user ? "Để trống nếu không đổi" : "Nhập mật khẩu")}
              className={`mt-1 block w-full p-2 border border-gray-300 rounded-md ${isKTV ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              required={!user && !isKTV} 
              disabled={isKTV}
            />
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

export default UserFormModal;
