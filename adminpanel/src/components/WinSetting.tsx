import React, { useState } from 'react';

const WinSettings = () => {
  const [activeTab, setActiveTab] = useState('winChance');
  const [winningChance, setWinningChance] = useState(90);
  const [houseEdge, setHouseEdge] = useState(2);

  const renderContent = () => {
    if (activeTab === 'winChance') {
      return (
        <div className="mb-4">
          <label className="block text-[#8384A5] text-sm font-bold mb-2" htmlFor="winningChance">
            Winning Chance
          </label>
          <div className="relative">
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-[#8384A5] leading-tight focus:outline-none focus:shadow-outline pr-8"
              id="winningChance"
              type="number"
              value={winningChance}
              onChange={(e) => setWinningChance(Number(e.target.value))}
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#878AA2]">%</span>
          </div>
        </div>
      );
    } else {
      return (
        <div className="mb-4">
          <label className="block text-[#8384A5] text-sm font-bold mb-2" htmlFor="houseEdge">
            House Edge
          </label>
          <div className="relative">
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-[#8384A5] leading-tight focus:outline-none focus:shadow-outline pr-8"
              id="houseEdge"
              type="number"
              value={houseEdge}
              onChange={(e) => setHouseEdge(Number(e.target.value))}
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#878AA2]">%</span>
          </div>
        </div>
      );
    }
  };

  return (

    <div className='p-4 '>
     <h1 className="text-3xl font-bold mb-8 text-[#F9F9F9]">Win Settings</h1>
    <div className="max-w-xl bg-[#0E1831] rounded-lg overflow-hidden shadow-lg">
      <div className="bg-[#886CFF] text-[#F9F9F9] text-xl font-semibold py-3 px-4">
        Win Setting
      </div>
      <div className="p-4">
        <div className="flex mb-4">
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-tl-lg rounded-bl-lg focus:outline-none ${
              activeTab === 'winChance' ? 'bg-[#886CFF] text-[#F9F9F9]' : 'bg-[#162140] text-[#8384A5]'
            }`}
            onClick={() => setActiveTab('winChance')}
          >
            Winning Chance
          </button>
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-tr-lg rounded-br-lg focus:outline-none ${
              activeTab === 'houseEdge' ? 'bg-[#886CFF] text-[#F9F9F9]' : 'bg-[#162140] text-[#8384A5]'
            }`}
            onClick={() => setActiveTab('houseEdge')}
          >
            House Edge
          </button>
        </div>
        {renderContent()}
        <div className="flex items-center justify-center w-full">
          <button className="w-full bg-[#0ECC68] hover:bg-[#0ECC68] text-[#F9F9F9] font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
           Update
          </button>
        </div>
      </div>
    </div>
    </div>
  );
};

export default WinSettings;