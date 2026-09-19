import React from 'react';
import { Bell } from 'lucide-react';

const MessageTab = () => {
  return (
    <div className="p-8 text-center">
      <Bell className="w-16 h-16 text-[#886CFF] mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-[#F9F9F9] mb-2">Message</h3>
      <p className="text-[#878AA2]">Message center and notifications.</p>
    </div>
  );
};

export default MessageTab; 