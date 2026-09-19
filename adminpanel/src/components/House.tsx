import React, { useEffect, useState } from 'react';
import { API_BASE_URL, getStaffToken } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

/** These calls need a staff token; they were unauthenticated in legacy. */
const authHeader = () => {
  const token = getStaffToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface House {
  uid: string;
  name: string;
  max: number;
  current: number;
}

const House: React.FC = () => {
  const [transferDetails, setTransferDetails] = useState<House[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editData, setEditData] = useState<{ max: string; current: string; uid: string }[]>([]);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [mode, setMode] = useState(localStorage.getItem('mode') || 'manual');
  const [loading, setLoading] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchTransferDetails();

    if (mode === 'automatic') {
      const interval = setInterval(fetchTransferDetails, 3000); // Refresh every 3 seconds in automatic mode
      setIntervalId(interval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [mode]);

  const fetchTransferDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}${ENDPOINTS.casinoHouse.get}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: House[] = await response.json();
      setTransferDetails(data);
      const initialEditData = data.map(({ uid, max, current }) => ({ uid, max: max.toString(), current: current.toString() }));
      setEditData(initialEditData);
    } catch (error) {
      console.error(`Error fetching transfer details:`, error);
      setTransferDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (uid: string, field: 'max' | 'current', value: string) => {
    setEditData(editData.map(item => item.uid === uid ? { ...item, [field]: value } : item));
  };

  const handleEdit = async (uid: string) => {
    setUpdatingUid(uid);
    const item = editData.find(item => item.uid === uid);
    if (!item) {
      console.error('Edit data not found');
      setUpdatingUid(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${ENDPOINTS.casinoHouse.update}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, max: item.max, current: item.current }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      setTransferDetails(transferDetails.map(house => house.uid === uid ? { ...house, max: parseInt(item.max), current: parseInt(item.current) } : house));
    } catch (error) {
      console.error('Error updating house details:', error);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredDepositData = transferDetails.filter(item => {
    const uidStr = item.uid.toString();
    const searchTermLower = searchTerm.toLowerCase();
    return uidStr.includes(searchTerm) || item.name.toLowerCase().includes(searchTermLower);
  });

  const handleModeChange = async (mode: 'manual' | 'automatic') => {
    setMode(mode);
    localStorage.setItem('mode', mode);
    if (intervalId) clearInterval(intervalId);

    /**
     * The ticker is one POST with a `running` flag, not two GET endpoints.
     *
     * `/start-house` LEAKED A CRON JOB on every call — `task` was overwritten
     * rather than replaced, so the previous interval ran on with nothing
     * holding its handle.
     */
    const url = `${API_BASE_URL}${ENDPOINTS.casinoHouse.ticker}`;
    const running = mode !== 'manual';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ running }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      console.log(`${mode} mode activated:`, await response.json());
    } catch (error) {
      console.error(`Failed to activate ${mode} mode:`, error);
    }

    if (mode === 'automatic') {
      const interval = setInterval(fetchTransferDetails, 3000);
      setIntervalId(interval);
    }
  };

  const handleResetHouse = async () => {
    try {
      /**
        * A GET THAT WROTE EVERY ROW IN THE TABLE.
        *
        * `house` is not a display table: `Rule.js` reads it on every bet in
        * sixteen games, and when `current >= max` a WINNING roll is discarded
        * and replaced with a losing number — while the hash of the DISCARDED
        * roll is published. `/reset-house` did that to every player at once,
        * over a URL a browser prefetch or a crawler could fire.
        */
       const response = await fetch(`${API_BASE_URL}${ENDPOINTS.casinoHouse.bulk}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', ...authHeader() },
         body: JSON.stringify({ preset: 'reset' }),
       });
      if (!response.ok) throw new Error('Network response was not ok');
      console.log('House reset successfully:', await response.json());
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset house:', error);
    }
  };

  const handleWinHouse = async () => {
    try {
      // `max = 0, current = 0` for every player at once — nobody can win.
      const response = await fetch(`${API_BASE_URL}${ENDPOINTS.casinoHouse.bulk}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ preset: 'win' }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      console.log('House reset successfully:', await response.json());
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset house:', error);
    }
  };

  return (
    <div className=''>
      <div className="flex items-center mb-4 justify-between">
        <div className="flex">
          <button
            className={`text-2xl font-bold py-2 px-4 rounded mr-2 ${mode === 'manual' ? 'bg-[#0ECC68] text-[#F9F9F9]' : 'bg-[#E01B4F] text-[#F9F9F9]'}`}
            onClick={() => handleModeChange('manual')}
          >
            Manual
          </button>
          <button
            className={`text-2xl font-bold py-2 px-4 rounded ${mode === 'automatic' ? 'bg-[#0ECC68] text-[#F9F9F9]' : 'bg-[#E01B4F] text-[#F9F9F9]'}`}
            onClick={() => handleModeChange('automatic')}
          >
            Automatic
          </button>
        </div>

        <div className="flex">
          <button
            className="text-2xl font-bold py-2 px-4 rounded bg-[#E01B4F] text-[#F9F9F9] mr-2"
            onClick={handleResetHouse}
          >
            Reset House
          </button>
          <button
            className="text-2xl font-bold py-2 px-4 rounded bg-[#0ECC68] text-[#F9F9F9]"
            onClick={handleWinHouse}
          >
            Win House
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or UID"
          value={searchTerm}
          onChange={handleSearchChange}
          className="p-2 border rounded w-full"
          disabled={mode === 'automatic'}
        />
      </div>

      <div className={`h-[690px] overflow-scroll ${mode === 'manual' ? '' : 'opacity-50'}`}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="py-3 px-8 border-b border-[#1E2D55] bg-[#0E1831] text-left text-xs font-semibold text-[#878AA2] uppercase tracking-wider">S.No.</th>
              <th className="py-3 px-8 border-b border-[#1E2D55] bg-[#0E1831] text-left text-xs font-semibold text-[#878AA2] uppercase tracking-wider">UID</th>
              <th className="py-3 px-8 border-b border-[#1E2D55] bg-[#0E1831] text-left text-xs font-semibold text-[#878AA2] uppercase tracking-wider">Name</th>
              <th className="py-3 px-8 border-b border-[#1E2D55] bg-[#0E1831] text-left text-xs font-semibold text-[#878AA2] uppercase tracking-wider">MAX</th>
              <th className="py-3 px-8 border-b border-[#1E2D55] bg-[#0E1831] text-left text-xs font-semibold text-[#878AA2] uppercase tracking-wider">Current</th>
              <th className="py-3 px-8 border-b border-[#1E2D55] bg-[#0E1831] text-left text-xs font-semibold text-[#878AA2] uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredDepositData.map((request, index) => (
              <tr key={request.uid}>
                <td className="py-3 px-8 border-b border-[#1E2D55] text-[#F9F9F9]">{index + 1}</td>
                <td className="py-3 px-8 border-b border-[#1E2D55] text-[#F9F9F9]">{request.uid}</td>
                <td className="py-3 px-8 border-b border-[#1E2D55] text-[#F9F9F9]">{request.name}</td>
                <td className="py-3 px-8 border-b border-[#1E2D55] text-[#F9F9F9]">
                  <input
                    type="number"
                    defaultValue={request.max}
                    disabled={loading || mode === 'automatic' || updatingUid === request.uid}
                    onChange={(e) => handleEditChange(request.uid, 'max', e.target.value)}
                    className="p-1 border rounded w-full"
                  />
                </td>
                <td className="py-3 px-8 border-b border-[#1E2D55]">
                  <input
                    type="number"
                    defaultValue={request.current}
                    disabled={loading || mode === 'automatic' || updatingUid === request.uid}
                    onChange={(e) => handleEditChange(request.uid, 'current', e.target.value)}
                    className="p-1 border rounded w-full"
                  />
                </td>
                <td className="py-3 px-8 border-b border-[#1E2D55]">
                  <button
                    onClick={() => handleEdit(request.uid)}
                    disabled={loading || mode === 'automatic' || updatingUid === request.uid}
                    className={`py-2 px-4 rounded ${updatingUid === request.uid ? 'bg-[#1E2D55] text-[#F9F9F9]' : 'bg-[#0ECC68] text-[#F9F9F9]'}`}
                  >
                    {updatingUid === request.uid ? 'Updating...' : 'Update'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="text-center mt-4">Updating details, please wait...</p>}
      </div>
    </div>
  );
};

export default House;
