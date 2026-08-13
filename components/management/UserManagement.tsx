
import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { User, Role } from '../../types';
import UserFormModal from '../modals/UserFormModal';
import ConfirmationModal from '../modals/ConfirmationModal';

const UserManagement: React.FC = () => {
  const { state, addUser, updateUser, deleteUser } = useApp();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleAdd = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteRequest = (user: User) => {
    setUserToDelete(user);
    setIsConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
        try {
            await deleteUser(userToDelete.id);
        } catch(e) {
            alert("Lỗi khi xóa người dùng: " + (e as Error).message);
        }
    }
    setIsConfirmOpen(false);
    setUserToDelete(null);
  };

  const handleFormSave = async (user: User) => {
    try {
        if (selectedUser) {
            await updateUser(user);
        } else {
            if (state.users.some(u => u.id === user.id)) {
                alert(`Mã nhân viên ${user.id} đã tồn tại.`);
                return;
            }
            await addUser(user);
        }
        setIsFormOpen(false);
    } catch (e) {
         alert("Lỗi khi lưu người dùng: " + (e as Error).message);
    }
  };

  return (
    <div>
      {isFormOpen && <UserFormModal user={selectedUser} onSave={handleFormSave} onClose={() => setIsFormOpen(false)} />}
      {isConfirmOpen && userToDelete && (
        <ConfirmationModal
          message={`Bạn có chắc muốn xóa nhân viên ${userToDelete.name}?`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Quản lý nhân viên</h2>
        <button onClick={handleAdd} className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          + Thêm nhân viên
        </button>
      </div>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mã NV</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vai trò</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
            </tr>
          </thead>
          <tbody>
            {state.users.map(user => (
              <tr key={user.id}>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{user.id}</td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{user.name}</td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{user.role}</td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                  <button onClick={() => handleEdit(user)} className="text-indigo-600 hover:text-indigo-900 mr-4">Sửa</button>
                  <button onClick={() => handleDeleteRequest(user)} className="text-red-600 hover:text-red-900">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
