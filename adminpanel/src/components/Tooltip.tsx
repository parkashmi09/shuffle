import React, { useState, ReactNode, MouseEventHandler } from 'react';

// Define a type for the Tooltip props
interface TooltipProps {
  message: string;
  children: ReactNode; // This type is provided by React and is suitable for any valid React child
  onClick: MouseEventHandler<HTMLDivElement>; // This type is suitable for click event handlers
}

const Tooltip: React.FC<TooltipProps> = ({ message, children, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
    >
      {children}
      {showTooltip && (
        <div className="absolute bottom-full mb-2 px-3 py-1 bg-black text-[#F9F9F9] text-sm rounded-md z-10">
          {message}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
