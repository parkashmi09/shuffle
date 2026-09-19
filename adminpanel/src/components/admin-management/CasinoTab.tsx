import React from 'react';
import { Plus } from 'lucide-react';

const CasinoTab = () => {
  return (
    <div className="p-8 text-center">
      <Plus className="w-16 h-16 text-[#886CFF] mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-[#F9F9F9] mb-2">Casino</h3>
      <p className="text-[#878AA2]">Casino games and management.</p>
    </div>
  );
};

export default CasinoTab; 