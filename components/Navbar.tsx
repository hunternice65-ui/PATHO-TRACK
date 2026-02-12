
import React from 'react';

interface NavbarProps {
  user: string;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
      <div className="flex items-center space-x-2">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
          <i className="fas fa-microscope text-xl"></i>
        </div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
          PathoTrack
        </h1>
      </div>
      
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3 px-4 py-2 bg-slate-100 rounded-full">
          <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
            {user.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-slate-700">{user}</span>
        </div>
        <button 
          onClick={onLogout}
          className="text-slate-500 hover:text-red-500 transition-colors flex items-center space-x-2 font-medium"
        >
          <i className="fas fa-sign-out-alt"></i>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
