import React from 'react';
import { FileText } from 'lucide-react';

const BetListTab = () => {
  return (
    <div className="p-8 text-center">
      <FileText className="w-16 h-16 text-[#886CFF] mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-[#F9F9F9] mb-2">BetList</h3>
      <p className="text-[#878AA2]">Manage and view betting lists.</p>
    </div>
  );
};

export default BetListTab; 