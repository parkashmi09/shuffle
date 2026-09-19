import React from 'react';
import { Settings } from 'lucide-react';

const SettingsTab = () => {
  return (
    <div className="p-8 text-center">
      <Settings className="w-16 h-16 text-[#886CFF] mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-[#F9F9F9] mb-2">Settings</h3>
      <p className="text-[#878AA2]">Settings configuration will be implemented here.</p>
    </div>
  );
};

export default SettingsTab; 