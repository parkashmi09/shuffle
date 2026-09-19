// import React, { useState, useEffect } from "react";
// import axios from "axios";

// interface WithdrawItem {
//   id: string;
//   uid: string;
//   date: string;
//   wallet: string;
//   amount: number;
//   coin: string;
//   name: string;
//   amount_usdt: number;
//   status: string;
// }

// const Withdraw = () => {
//   const [withdrawData, setWithdrawData] = useState<WithdrawItem[]>([]);
//   const [searchTerm, setSearchTerm] = useState("");

//   useEffect(() => {
//     fetchWithdrawData();
//   }, []);

//   const fetchWithdrawData = async () => {
//     try {
//       const response = await axios.get(`${API_BASE_URL}${ENDPOINTS.withdrawals.crypto}`);
//       const data = response.data;

//       if (Array.isArray(data)) {
//         // Sort data by date (newest first)
//         const sortedData = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//         setWithdrawData(sortedData);
//       } else {
//         console.error("Unexpected response structure:", data);
//         setWithdrawData([]);
//       }
//     } catch (error) {
//       console.error("Failed to fetch withdrawal data:", error);
//       setWithdrawData([]);
//     }
//   };

//   const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     setSearchTerm(event.target.value);
//   };

//   const handleStatusChange = async (withdrawId: string, newStatus: string) => {
//     try {
//       // The withdrawal id goes in the PATH and the decision in the body — see
        // `ENDPOINTS.withdrawals.decision`. There is no bare status write.
//       await axios.post("/updateWithdrawStatus", {
//         id: withdrawId,
//         status: newStatus,
//       });

//       setWithdrawData((prevData) =>
//         prevData.map((withdraw) =>
//           withdraw.id === withdrawId ? { ...withdraw, status: newStatus } : withdraw
//         )
//       );
//     } catch (error) {
//       console.error("Failed to update status:", error);
//     }
//   };

//   const filteredWithdrawData = searchTerm
//     ? withdrawData.filter(
//         (withdraw) =>
//           String(withdraw.uid).includes(searchTerm) ||
//           withdraw.name.toLowerCase().includes(searchTerm.toLowerCase())
//       )
//     : withdrawData;

//   return (
//     <div className="p-6 bg-[#0C0D1D] min-h-screen text-[#F9F9F9]">
//       {/* Search Bar */}
//       <div className="mb-6">
//         <input
//           type="text"
//           placeholder="Search by name or UID"
//           value={searchTerm}
//           onChange={handleSearchChange}
//           className="p-3 border rounded-lg w-full bg-[#0E1831] text-[#F9F9F9] placeholder-[#878AA2] focus:ring-2 focus:ring-[#886CFF]"
//         />
//       </div>

//       {/* List of Withdrawals (Card-Based) */}
//       <div className="space-y-4">
//         {filteredWithdrawData.length > 0 ? (
//           filteredWithdrawData.map((withdraw, index) => (
//             <div
//               key={withdraw.id}
//               className="bg-[#0E1831] p-5 rounded-xl shadow-lg hover:bg-[#162140] transition duration-300"
//             >
//               <div className="flex justify-between items-center">
//                 <div>
//                   <h2 className="text-lg font-semibold">
//                     {withdraw.name} <span className="text-sm text-[#878AA2]">(UID: {withdraw.uid})</span>
//                   </h2>
//                   <p className="text-sm text-[#878AA2]">{new Date(withdraw.date).toLocaleDateString()}</p>
//                 </div>
//                 <div className="text-right">
//                   <p className="text-lg font-bold text-[#0ECC68]">{withdraw.amount_usdt.toFixed(2)} USDT</p>
//                   <p className="text-sm text-[#878AA2]">{withdraw.amount} {withdraw.coin}</p>
//                 </div>
//               </div>

//               <div className="mt-4">
//                 <p className="text-[#8384A5] text-sm truncate">
//                   <span className="font-semibold">Wallet:</span> {withdraw.wallet}
//                 </p>
//               </div>

//               <div className="mt-4 flex justify-between items-center">
//                 <span
//                   className={`px-3 py-1 text-sm font-semibold rounded-full ${
//                     withdraw.status === "In Queue"
//                       ? "bg-yellow-500 text-black"
//                       : withdraw.status === "Processing"
//                       ? "bg-blue-500 text-[#F9F9F9]"
//                       : withdraw.status === "Done"
//                       ? "bg-green-500 text-[#F9F9F9]"
//                       : "bg-red-500 text-[#F9F9F9]"
//                   }`}
//                 >
//                   {withdraw.status}
//                 </span>

//                 <select
//                   value={withdraw.status}
//                   onChange={(e) => handleStatusChange(withdraw.id, e.target.value)}
//                   className="p-2 border rounded-lg bg-[#162140] text-[#F9F9F9] cursor-pointer hover:bg-[#1E2D55]"
//                 >
//                   <option value="In Queue">In Queue</option>
//                   <option value="Processing">Processing</option>
//                   <option value="Done">Done</option>
//                   <option value="Wager Not Completed">Wager Not Completed</option>
//                 </select>
//               </div>
//             </div>
//           ))
//         ) : (
//           <p className="text-center text-[#878AA2]">No withdrawal records found.</p>
//         )}
//       </div>
//     </div>
//   );
// };

// export default Withdraw;
import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL, buildPath, getStaffToken } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

/**
 * These were scoped by an `x-staff-id` REQUEST HEADER in legacy — the caller
 * sets it, and `x-staff-id: 1` is the platform owner. A staff token now.
 */
const authHeader = (): Record<string, string> => {
  const token = getStaffToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface WithdrawItem {
  id: string;
  uid: string;
  date: string;
  wallet: string;
  amount: number;
  coin: string;
  name: string;
  amount_usdt: number;
  status: string;
  chain: string;
}

interface FiatWithdrawItem {
  id: string;
  uid: string;
  date: string;
  amount: number;
  currency: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder_name: string;
  ifsc_code: string | null;
  upi_id: string | null;
  status: string;
  name: string;
}

const WithdrawSelf = () => {
  const [withdrawData, setWithdrawData] = useState<WithdrawItem[]>([]);
  const [fiatWithdrawData, setFiatWithdrawData] = useState<FiatWithdrawItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const activeTab: "crypto" | "fiat" = "fiat";
  const staffId = localStorage.getItem('currentUserId');

  useEffect(() => {
    fetchWithdrawData();
    fetchFiatWithdrawData();
  }, []);

  const fetchWithdrawData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}${ENDPOINTS.withdrawals.crypto}`, { headers: authHeader() });
      const data = response.data;

      if (Array.isArray(data)) {
        // Sort data by date (newest first)
        const sortedData = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setWithdrawData(sortedData);
      } else {
        console.error("Unexpected response structure:", data);
        setWithdrawData([]);
      }
    } catch (error) {
      console.error("Failed to fetch withdrawal data:", error);
      setWithdrawData([]);
    }
  };

  const fetchFiatWithdrawData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}${ENDPOINTS.withdrawals.fiat}`, { headers: authHeader() });
      const data = response.data;

      if (Array.isArray(data)) {
        // Sort data by date (newest first)
        const sortedData = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setFiatWithdrawData(sortedData);
      } else {
        console.error("Unexpected response structure:", data);
        setFiatWithdrawData([]);
      }
    } catch (error) {
      console.error("Failed to fetch fiat withdrawal data:", error);
      setFiatWithdrawData([]);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleStatusChange = async (withdrawId: string, newStatus: string) => {
    try {
      if (activeTab === "crypto") {
        // The withdrawal id goes in the PATH and the decision in the body — see
        // `ENDPOINTS.withdrawals.decision`. There is no bare status write.
        /**
         * The withdrawal id goes in the PATH and only the decision in the body.
         *
         * `POST /updateWithdrawStatus` was `UPDATE withdrawals SET status = $1
         * WHERE id = $2` — unauthenticated, with no state machine and no refund,
         * so rejecting a withdrawal left the held funds held. This runs the
         * state machine and refunds on rejection.
         *
         * `x-staff-id` is gone: the gateway strips it and the approver comes
         * from the staff token.
         */
        await axios.post(
          `${API_BASE_URL}${buildPath(ENDPOINTS.withdrawals.decision, { withdrawalId: withdrawId })}`,
          { status: newStatus },
          { headers: authHeader() }
        );

        setWithdrawData((prevData) =>
          prevData.map((withdraw) =>
            withdraw.id === withdrawId ? { ...withdraw, status: newStatus } : withdraw
          )
        );
      } else {
        await axios.post(
          `${API_BASE_URL}${ENDPOINTS.withdrawals.fiatStatus}`,
          { withdrawalId: withdrawId, status: newStatus },
          { headers: authHeader() }
        );

        setFiatWithdrawData((prevData) =>
          prevData.map((withdraw) =>
            withdraw.id === withdrawId ? { ...withdraw, status: newStatus } : withdraw
          )
        );
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const filteredWithdrawData = searchTerm
    ? withdrawData.filter(
      (withdraw) =>
        String(withdraw.uid).includes(searchTerm) ||
        withdraw.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : withdrawData;

  const filteredFiatWithdrawData = searchTerm
    ? fiatWithdrawData.filter(
      (withdraw) =>
        String(withdraw.uid).includes(searchTerm) ||
        withdraw.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdraw.account_holder_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : fiatWithdrawData;

  return (
    <div className="p-6 bg-[#0C0D1D] min-h-screen text-[#F9F9F9]">
      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder={activeTab === "crypto" ? "Search by name or UID" : "Search by name, UID or account holder"}
          value={searchTerm}
          onChange={handleSearchChange}
          className="p-3 border rounded-lg w-full bg-[#0E1831] text-[#F9F9F9] placeholder-[#878AA2] focus:ring-2 focus:ring-[#886CFF]"
        />
      </div>

      {/* List of Withdrawals (Card-Based) */}
      {activeTab === "crypto" ? (
        <div className="space-y-4">
          {filteredWithdrawData.length > 0 ? (
            filteredWithdrawData.map((withdraw) => (
              <div
                key={withdraw.id}
                className="bg-[#0E1831] p-5 rounded-xl shadow-lg hover:bg-[#162140] transition duration-300"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {withdraw.name} <span className="text-sm text-[#878AA2]">(UID: {withdraw.uid})</span>
                    </h2>
                    <p className="text-sm text-[#878AA2]">{new Date(withdraw.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#0ECC68]">{withdraw.amount_usdt.toFixed(2)}</p>
                    <p className="text-sm text-[#878AA2]">{withdraw.amount} {withdraw.coin}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[#8384A5] text-sm truncate">
                    <span className="font-semibold">Wallet:</span> {withdraw.wallet}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-[#8384A5] text-sm truncate">
                    <span className="font-semibold">Chain:</span> {withdraw.chain}
                  </p>
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <span
                    className={`px-3 py-1 text-sm font-semibold rounded-full ${withdraw.status === "In Queue"
                      ? "bg-[#FFC23F] text-black"
                      : withdraw.status === "Processing"
                        ? "bg-[#886CFF] text-[#F9F9F9]"
                        : withdraw.status === "Done"
                          ? "bg-[#0ECC68] text-[#F9F9F9]"
                          : "bg-[#E01B4F] text-[#F9F9F9]"
                      }`}
                  >
                    {withdraw.status}
                  </span>

                  <select
                    value={withdraw.status}
                    onChange={(e) => handleStatusChange(withdraw.id, e.target.value)}
                    className="p-2 border rounded-lg bg-[#162140] text-[#F9F9F9] cursor-pointer hover:bg-[#1E2D55]"
                  >
                    <option value="In Queue">In Queue</option>
                    <option value="Processing">Processing</option>
                    <option value="Done">Done</option>
                    <option value="Wager Not Completed">Wager Not Completed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-[#878AA2]">No cryptocurrency withdrawal records found.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFiatWithdrawData.length > 0 ? (
            filteredFiatWithdrawData.map((withdraw) => (
              <div
                key={withdraw.id}
                className="bg-[#0E1831] p-5 rounded-xl shadow-lg hover:bg-[#162140] transition duration-300"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {withdraw.name} <span className="text-sm text-[#878AA2]">(UID: {withdraw.uid})</span>
                    </h2>
                    <p className="text-sm text-[#878AA2]">{new Date(withdraw.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#0ECC68]">{withdraw.amount.toFixed(2)} {withdraw.currency}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <p className="text-[#8384A5] text-sm">
                    <span className="font-semibold">Account Holder:</span> {withdraw.account_holder_name}
                  </p>

                  {withdraw.bank_name && (
                    <p className="text-[#8384A5] text-sm">
                      <span className="font-semibold">Bank:</span> {withdraw.bank_name}
                    </p>
                  )}

                  {withdraw.account_number && (
                    <p className="text-[#8384A5] text-sm">
                      <span className="font-semibold">Account Number:</span> {withdraw.account_number}
                    </p>
                  )}

                  {withdraw.ifsc_code && (
                    <p className="text-[#8384A5] text-sm">
                      <span className="font-semibold">IFSC Code:</span> {withdraw.ifsc_code}
                    </p>
                  )}

                  {withdraw.upi_id && (
                    <p className="text-[#8384A5] text-sm">
                      <span className="font-semibold">UPI ID:</span> {withdraw.upi_id}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <span
                    className={`px-3 py-1 text-sm font-semibold rounded-full ${withdraw.status === "In Queue"
                      ? "bg-[#FFC23F] text-black"
                      : withdraw.status === "Processing"
                        ? "bg-[#886CFF] text-[#F9F9F9]"
                        : withdraw.status === "Done"
                          ? "bg-[#0ECC68] text-[#F9F9F9]"
                          : "bg-[#E01B4F] text-[#F9F9F9]"
                      }`}
                  >
                    {withdraw.status}
                  </span>

                  <select
                    value={withdraw.status}
                    onChange={(e) => handleStatusChange(withdraw.id, e.target.value)}
                    className="p-2 border rounded-lg bg-[#162140] text-[#F9F9F9] cursor-pointer hover:bg-[#1E2D55]"
                  >
                    <option value="In Queue">In Queue</option>
                    <option value="Processing">Processing</option>
                    <option value="Done">Done</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-[#878AA2]">No fiat withdrawal records found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default WithdrawSelf;