
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { GoogleDriveProvider } from './context/GoogleDriveContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <AuthProvider>
        <GoogleDriveProvider>
          <App />
        </GoogleDriveProvider>
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>
);