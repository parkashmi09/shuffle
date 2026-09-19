import React from 'react';
import { Shield } from 'lucide-react';

const RiskManagementTab = () => {
  return (
    <div className="p-8 text-center">
      <Shield className="w-16 h-16 text-[#886CFF] mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-[#F9F9F9] mb-2">Risk Management</h3>
      <p className="text-[#878AA2]">Risk assessment and management tools.</p>
    </div>
  );
};

export default RiskManagementTab; 