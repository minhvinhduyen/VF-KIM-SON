
import { useContext } from 'react';
import { GoogleDriveContext } from '../context/GoogleDriveContext';

export const useGoogleDrive = () => {
    const context = useContext(GoogleDriveContext);
    if (context === undefined) {
        throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
    }
    return context;
};
