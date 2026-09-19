import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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


interface FiatPayment {
  transaction_id: string;
  provider_name: string;
  screenshot_path: string;
  is_manual_deposit: any;
  deposit_id: number;
  bank_name: any;
  upi_id: string;
  user_id: number;
  id: number;
  userid: string;
  currency: string;
  // Backend rewrites `currency` to 'INR' for the converted amount; the real
  // deposit currency comes back as `original_currency`.
  original_currency?: string;
  original_amount?: number | string;
  orderid: string;
  utr_no: string;
  amount: number;
  created_at: string;
  updated_at: string;
  status: string;
  image: string;
  username: string;
}

interface FiatStats {
  total_transactions: number;
  total_amount: number;
  successful_amount: number;
  processing_amount: number;
  successful_transactions: number;
  processing_transactions: number;
  failed_transactions: number;
}
interface PaymentStats {
  total_transactions: number;
  total_amount: number;
  successful_amount: number;
  processing_amount: number;
  successful_transactions: number;
  processing_transactions: number;
  failed_transactions: number;
}

interface FiatPayment extends Payment { }

interface FiatStats extends PaymentStats { }

// Interfaces
interface PaymentStats {
  total_transactions: number;
  total_amount: number;
  successful_amount: number;
  processing_amount: number;
  successful_transactions: number;
  processing_transactions: number;
  failed_transactions: number;
}

interface Payment {
  id: number;
  userid: string;
  coinid: number;
  price: number;
  orderid: string;
  chain: string;
  deposit_address: string;
  amount: number;
  memo: string;
  checkout_url: string;
  confirms_needed: number;
  created_at: string;
  updated_at: string;
  status: string;
  username: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// Stats Card Component
const StatsCard = ({
  title,
  value,
  colorClass = "text-[#F9F9F9]"
}: {
  title: string;
  value: number | string;
  colorClass?: string;
}) => (
  <div className="bg-[#0E1831] p-4 rounded-lg shadow">
    <h3 className="text-[#878AA2] text-sm font-medium">{title}</h3>
    <p className={`text-2xl font-semibold ${colorClass}`}>{value}</p>
  </div>
);

// Pagination Component
const Pagination = ({
  paginationInfo,
  onPageChange
}: {
  paginationInfo: PaginationInfo;
  onPageChange: (page: number) => void;
}) => {
  const { currentPage, totalPages } = paginationInfo;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <div className="flex items-center">
        <p className="text-sm text-[#8384A5]">
          Showing page {currentPage} of {totalPages}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#121E38]"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {[...Array(Math.min(5, totalPages))].map((_, idx) => {
          let pageNumber;
          if (totalPages <= 5) {
            pageNumber = idx + 1;
          } else if (currentPage <= 3) {
            pageNumber = idx + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNumber = totalPages - (4 - idx);
          } else {
            pageNumber = currentPage - 2 + idx;
          }

          return (
            <button
              key={idx}
              onClick={() => onPageChange(pageNumber)}
              className={`px-3 py-1 rounded-md ${currentPage === pageNumber
                ? 'bg-[#886CFF] text-[#F9F9F9]'
                : 'hover:bg-[#121E38]'
                }`}
            >
              {pageNumber}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#121E38]"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Main Deposit Component
const DepositSelf = () => {
  // State declarations
  const [activeTab, setActiveTab] = useState<'crypto' | 'fiat'>('crypto');
  const staffId = localStorage.getItem('currentUserId');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState('');
  const [fiatPayments, setFiatPayments] = useState<FiatPayment[]>([]);
  const [fiatStats, setFiatStats] = useState<FiatStats | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState('INR');
  const CURRENCY_TABS = ['BDT', 'NPR', 'INR', 'PKR'];
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });
  // Add these functions near your other handlers

  const handleViewScreenshot = async (depositId: number) => {
    setLoadingAction(depositId);
    try {
      // Fetch the image as a blob
      const response = await fetch(`${API_BASE_URL}${buildPath(ENDPOINTS.deposits.screenshot, { depositId })}`, {

      });

      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setCurrentScreenshot(objectUrl);
        setModalOpen(true);
      } else {
        alert("Failed to load screenshot");
      }
    } catch (err) {
      console.error('Failed to load screenshot:', err);
      alert("Failed to load screenshot");
    }
    setLoadingAction(null);
  };
  const handleApproveDeposit = async (depositId: number) => {
    setLoadingAction(depositId);
    try {
      const response = await axios.put(`${API_BASE_URL}${buildPath(ENDPOINTS.deposits.approve, { depositId })}`, {
        admin_comment: "Verified and approved"
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      if (response.data.success) {
        // Refresh the list after successful approval
        fetchFiatPayments();
        fetchFiatStats();
        alert("Deposit approved successfully");
      }
    } catch (err) {
      console.error('Failed to approve deposit:', err);
      alert("Failed to approve deposit");
    }
    setLoadingAction(null);
  };

  const handleRejectDeposit = async (depositId: number) => {
    setLoadingAction(depositId);
    try {
      const response = await axios.put(`${API_BASE_URL}${buildPath(ENDPOINTS.deposits.reject, { depositId })}`, {
        admin_comment: "Rejected by admin"
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      if (response.data.success) {
        // Refresh the list after successful rejection
        fetchFiatPayments();
        fetchFiatStats();
        alert("Deposit rejected successfully");
      }
    } catch (err) {
      console.error('Failed to reject deposit:', err);
      alert("Failed to reject deposit");
    }
    setLoadingAction(null);
  };
  // Fetch payments with pagination
  const fetchPayments = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}${ENDPOINTS.transactionHistory.cryptoDeposits}`;
      const params = new URLSearchParams();

      params.append('page', paginationInfo.currentPage.toString());
      params.append('limit', paginationInfo.itemsPerPage.toString());

      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchTerm) params.append('userid', searchTerm);

      url += `?${params.toString()}`;

      const response = await axios.get(url, {
        headers: {

          "x-staff-id": staffId ?? ""
        }
      });
      if (response.data.success) {
        setPayments(response.data.data);
        setPaginationInfo(prev => ({
          ...prev,
          currentPage: response.data.page,
          totalPages: Math.ceil(response.data.total / prev.itemsPerPage),
          totalItems: response.data.total
        }));
      }
    } catch (err) {
      setError('Failed to fetch payments');
      console.error(err);
    }
    setLoading(false);
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}${ENDPOINTS.transactionHistory.cryptoStats}`, {
        headers: {

          "x-staff-id": staffId ?? ""
        }
      });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchFiatPayments = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}${ENDPOINTS.transactionHistory.fiatDeposits}`;
      const params = new URLSearchParams();

      params.append('page', paginationInfo.currentPage.toString());
      params.append('limit', paginationInfo.itemsPerPage.toString());

      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchTerm) params.append('userid', searchTerm);
      if (currencyFilter) params.append('currency', currencyFilter);

      url += `?${params.toString()}`;

      // Fetch regular fiat payments
      const response = await axios.get(url);

      // Fetch manual deposits from new API
      const manualDepositsResponse = await axios.get(`${API_BASE_URL}${ENDPOINTS.deposits.list}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          "x-staff-id": staffId ?? ""
        }
      });

      let combinedData: FiatPayment[] = [];
      if (response.data.success) {
        combinedData = [...response.data.data];
      }

      // Add manual deposits, mapping to match the FiatPayment interface
      if (manualDepositsResponse.data.success) {
        const manualDeposits = manualDepositsResponse.data.data
          // Manual-deposit endpoint has no currency param, so filter client-side
          // to keep tab-specific data consistent with the regular fiat endpoint.
          .filter((deposit: any) =>
            !currencyFilter ||
            String(deposit.currency || 'INR').toUpperCase() === currencyFilter.toUpperCase()
          )
          .map((deposit: any) => ({
            id: deposit.deposit_id,
            user_id: deposit.user_id,
            userid: deposit.user_id.toString(),
            currency: deposit.currency || 'INR',
            orderid: deposit.transaction_id,
            utr_no: deposit.transaction_id,
            amount: deposit.amount,
            created_at: deposit.created_at,
            updated_at: deposit.updated_at,
            // Fix status mapping to display correctly
            status: deposit.status === 'pending' ? 'pending' :
              deposit.status === 'approved' ? 'approved' :
                deposit.status === 'rejected' ? 'rejected' : deposit.status,
            image: deposit.screenshot_path,
            username: deposit.username,
            // Additional props for the new API
            deposit_id: deposit.deposit_id,
            bank_name: deposit.bank_name,
            account_number: deposit.account_number,
            ifsc_code: deposit.ifsc_code,
            account_holder_name: deposit.account_holder_name,
            upi_id: deposit.upi_id,
            admin_comment: deposit.admin_comment,
            screenshot_path: deposit.screenshot_path,
            is_manual_deposit: true // Flag to identify manual deposits
          }));

        combinedData = [...combinedData, ...manualDeposits];
      }

      // Sort by created_at date in descending order (latest first)
      combinedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setFiatPayments(combinedData);
      setPaginationInfo(prev => ({
        ...prev,
        currentPage: response.data.page,
        totalPages: Math.ceil((response.data.total +
          (manualDepositsResponse.data?.data?.length || 0)) /
          prev.itemsPerPage),
        totalItems: response.data.total + (manualDepositsResponse.data?.data?.length || 0)
      }));
    } catch (err) {
      setError('Failed to fetch fiat payments');
      console.error(err);
    }
    setLoading(false);
  };

  // const fetchFiatPayments = async () => {
  //   setLoading(true);
  //   try {
  //     let url = `${API_BASE_URL}${ENDPOINTS.transactionHistory.fiatDeposits}`;
  //     const params = new URLSearchParams();

  //     params.append('page', paginationInfo.currentPage.toString());
  //     params.append('limit', paginationInfo.itemsPerPage.toString());

  //     if (statusFilter) params.append('status', statusFilter);
  //     if (startDate) params.append('startDate', startDate);
  //     if (endDate) params.append('endDate', endDate);
  //     if (searchTerm) params.append('userid', searchTerm);
  //     if (currencyFilter) params.append('currency', currencyFilter);

  //     url += `?${params.toString()}`;

  //     // Fetch regular fiat payments
  //     const response = await axios.get(url);

  //     // Fetch manual deposits from new API
  //     const manualDepositsResponse = await axios.get(`${API_BASE_URL}${ENDPOINTS.deposits.list}`, {
  //       headers: {
  //         'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
  //       }
  //     });

  //     let combinedData: any[] | ((prevState: FiatPayment[]) => FiatPayment[]) = [];
  //     if (response.data.success) {
  //       combinedData = [...response.data.data];
  //     }

  //     // Add manual deposits, mapping to match the FiatPayment interface
  //     if (manualDepositsResponse.data.success) {
  //       const manualDeposits = manualDepositsResponse.data.data.map((deposit: any) => ({
  //         id: deposit.deposit_id,
  //         user_id: deposit.user_id,
  //         userid: deposit.user_id.toString(),
  //         currency: deposit.currency || 'INR',
  //         orderid: deposit.transaction_id,
  //         utr_no: deposit.transaction_id,
  //         amount: deposit.amount,
  //         created_at: deposit.created_at,
  //         updated_at: deposit.updated_at,
  //         status: deposit.status === 'pending' ? 'Processing' : 
  //                 deposit.status === 'approved' ? 'Accepted' : 'rejected',
  //         image: deposit.screenshot_path,
  //         username: deposit.username,
  //         // Additional props for the new API
  //         deposit_id: deposit.deposit_id,
  //         bank_name: deposit.bank_name,
  //         account_number: deposit.account_number,
  //         ifsc_code: deposit.ifsc_code,
  //         account_holder_name: deposit.account_holder_name,
  //         upi_id: deposit.upi_id,
  //         admin_comment: deposit.admin_comment,
  //         screenshot_path: deposit.screenshot_path,
  //         is_manual_deposit: true // Flag to identify manual deposits
  //       }));

  //       combinedData = [...combinedData, ...manualDeposits];
  //     }

  //     setFiatPayments(combinedData);
  //     setPaginationInfo(prev => ({
  //       ...prev,
  //       currentPage: response.data.page,
  //       totalPages: Math.ceil((response.data.total + 
  //                              (manualDepositsResponse.data?.data?.length || 0)) / 
  //                              prev.itemsPerPage),
  //       totalItems: response.data.total + (manualDepositsResponse.data?.data?.length || 0)
  //     }));
  //   } catch (err) {
  //     setError('Failed to fetch fiat payments');
  //     console.error(err);
  //   }
  //   setLoading(false);
  // };
  const fetchFiatStats = async () => {
    try {
      // Fetch regular fiat stats — scoped to the currently selected currency tab.
      const statsParams = new URLSearchParams();
      if (currencyFilter) statsParams.append('currency', currencyFilter);
      const response = await axios.get(
        `${API_BASE_URL}${ENDPOINTS.transactionHistory.fiatStats}${statsParams.toString() ? `?${statsParams.toString()}` : ''}`
      );

      // Fetch manual deposit stats by calculating from the data
      const manualDepositsResponse = await axios.get(`${API_BASE_URL}${ENDPOINTS.deposits.list}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      let manualStats = {
        total_transactions: 0,
        total_amount: 0,
        successful_amount: 0,
        processing_amount: 0,
        successful_transactions: 0,
        processing_transactions: 0,
        failed_transactions: 0
      };

      if (manualDepositsResponse.data.success) {
        // Filter manual deposits by the currently selected currency tab so the
        // stats match the table rows.
        const deposits = manualDepositsResponse.data.data.filter((deposit: any) =>
          !currencyFilter ||
          String(deposit.currency || 'INR').toUpperCase() === currencyFilter.toUpperCase()
        );
        manualStats.total_transactions = deposits.length;

        deposits.forEach((deposit: any) => {
          const amt = Number(deposit.amount) || 0;
          manualStats.total_amount += amt;

          if (deposit.status === 'approved') {
            manualStats.successful_transactions += 1;
            manualStats.successful_amount += amt;
          } else if (deposit.status === 'pending') {
            manualStats.processing_transactions += 1;
            manualStats.processing_amount += amt;
          } else if (deposit.status === 'rejected') {
            manualStats.failed_transactions += 1;
          }
        });
      }

      // Combine both stats
      if (response.data.success) {
        const regularStats = response.data.data;
        setFiatStats({
          total_transactions: (regularStats.total_transactions || 0) + manualStats.total_transactions,
          total_amount: (regularStats.total_amount || 0) + manualStats.total_amount,
          successful_amount: (regularStats.successful_amount || 0) + manualStats.successful_amount,
          processing_amount: (regularStats.processing_amount || 0) + manualStats.processing_amount,
          successful_transactions: (regularStats.successful_transactions || 0) + manualStats.successful_transactions,
          processing_transactions: (regularStats.processing_transactions || 0) + manualStats.processing_transactions,
          failed_transactions: (regularStats.failed_transactions || 0) + manualStats.failed_transactions
        });
      } else {
        setFiatStats(manualStats);
      }
    } catch (err) {
      console.error('Failed to fetch fiat stats:', err);
    }
  };


  // Effect hooks
  useEffect(() => {
    if (activeTab === 'crypto') {
      fetchPayments();
      fetchStats();
    } else {
      fetchFiatPayments();
      fetchFiatStats();
    }
  }, [activeTab, paginationInfo.currentPage, statusFilter, startDate, endDate, currencyFilter]);

  // Handlers
  const handlePageChange = (newPage: number) => {
    setPaginationInfo(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    // Currency is selected via the top tabs — don't clear it from here
    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
  };
  const getStatusColor = (status: string | number) => {
    // Convert numeric status to string representation
    let statusStr = '';
    if (typeof status === 'number') {
      switch (status) {
        case 0:
          statusStr = 'processing';
          break;
        case 1:
          statusStr = 'success';
          break;
        default:
          statusStr = 'unknown';
      }
    } else {
      statusStr = String(status || '').toLowerCase();
    }

    switch (statusStr) {
      case 'success':
      case '1':
        return 'bg-green-100 text-green-800';
      case 'processing':
      case '0':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-[#121E38] text-[#F9F9F9]';
    }
  };


  return (
    <div className="p-4 ">
      {/* Crypto / Fiat tab switcher */}
      <div className="bg-[#0E1831] border border-[#1E2D55] rounded-lg mb-6 overflow-x-auto">
        <div className="flex">
          {(['crypto', 'fiat'] as const).map(t => {
            const active = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => {
                  if (t === activeTab) return;
                  setActiveTab(t);
                  setSearchTerm('');
                  setStatusFilter('');
                  setStartDate('');
                  setEndDate('');
                  setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                }}
                className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  active
                    ? 'text-[#886CFF] border-[#886CFF] bg-[rgba(136,108,255,0.08)]'
                    : 'text-[#8384A5] border-transparent hover:text-[#F9F9F9] hover:bg-[#162140]'
                }`}
              >
                {t === 'crypto' ? 'Crypto' : 'Fiat'}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'crypto' && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatsCard
                title="Total Transactions"
                value={stats.total_transactions}
              />
              <StatsCard
                title="Total Amount"
                value={`₹${stats.total_amount != null ? Number(stats.total_amount).toFixed(2) : '0.00'} INR`}
              />
              <StatsCard
                title="Successful Amount"
                value={`₹${stats.successful_amount != null ? Number(stats.successful_amount).toFixed(2) : '0.00'} INR`}
                colorClass="text-green-600"
              />
              <StatsCard
                title="Pending Amount"
                value={`₹${stats.processing_amount != null ? Number(stats.processing_amount).toFixed(2) : '0.00'} INR`}
                colorClass="text-yellow-600"
              />
              <StatsCard
                title="Successful"
                value={stats.successful_transactions}
                colorClass="text-green-600"
              />
              <StatsCard
                title="Processing"
                value={stats.processing_transactions}
                colorClass="text-yellow-600"
              />
              <StatsCard
                title="Failed"
                value={stats.failed_transactions}
                colorClass="text-red-600"
              />
            </div>
          )}

          {/* Filters */}
          <div className="bg-[#0E1831] p-4 rounded-lg shadow mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search by User ID or Order ID"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">All</option>
                  <option value="Success">Success</option>
                  <option value="processing">Processing</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-[#162140] text-[#8384A5] rounded-lg hover:bg-[#1E2D55]"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Payments Table */}
          <div className="bg-[#0E1831] rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#0E1831]">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">User ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">User Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Chain</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Created At</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">Loading...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-[#E01B4F]">{error}</td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">No payments found</td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-[#1E2D55]">
                      <td className="px-4 py-2">{payment.userid}</td>
                      <td className="px-4 py-2">{payment.username}</td>
                      <td className="px-4 py-2">{payment.chain}</td>
                      <td className="px-4 py-2">{payment.amount}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {new Date(payment.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs">{payment.deposit_address}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && !error && payments.length > 0 && (
              <Pagination
                paginationInfo={paginationInfo}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        </>
      )}
      {activeTab === 'fiat' && (
        <>
          {/* Currency tabs — each shows that currency's deposit data */}
          <div className="bg-[#0E1831] border border-[#1E2D55] rounded-lg mb-6 overflow-x-auto">
            <div className="flex">
              {CURRENCY_TABS.map(c => {
                const active = currencyFilter.toUpperCase() === c;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      setCurrencyFilter(c);
                      setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                    }}
                    className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                      active
                        ? 'text-[#886CFF] border-[#886CFF] bg-[rgba(136,108,255,0.08)]'
                        : 'text-[#8384A5] border-transparent hover:text-[#F9F9F9] hover:bg-[#162140]'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatsCard
                title="Total Transactions"
                value={fiatStats?.total_transactions ?? 0}
              />
              <StatsCard
                title="Total Amount"
                value={`${(fiatStats?.total_amount ?? 0).toFixed(2)} ${currencyFilter || 'INR'}`}
              />
              <StatsCard
                title="Successful Amount"
                value={`${(fiatStats?.successful_amount ?? 0).toFixed(2)} ${currencyFilter || 'INR'}`}
                colorClass="text-green-600"
              />
              <StatsCard
                title="Pending Amount"
                value={`${(fiatStats?.processing_amount ?? 0).toFixed(2)} ${currencyFilter || 'INR'}`}
                colorClass="text-yellow-600"
              />
              <StatsCard
                title="Successful"
                value={fiatStats?.successful_transactions ?? 0}
                colorClass="text-green-600"
              />
              <StatsCard
                title="Processing"
                value={fiatStats?.processing_transactions ?? 0}
                colorClass="text-yellow-600"
              />
              <StatsCard
                title="Failed"
                value={fiatStats?.failed_transactions ?? 0}
                colorClass="text-red-600"
              />

            </div>
          )}

          {/* Filters */}
          <div className="bg-[#0E1831] p-4 rounded-lg shadow mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search by User ID"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">All</option>
                  <option value="approved">Approved</option>
                  <option value="processing">Processing</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {/* Currency dropdown removed — currency is now selected via the tabs above */}
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPaginationInfo(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-[#162140] text-[#8384A5] rounded-lg hover:bg-[#1E2D55]"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Fiat Payments Table */}
          <div className="bg-[#0E1831] rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#0E1831]">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">User ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">User Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Currency</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Provider</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Order Id</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Created At</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#878AA2] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">Loading...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-[#E01B4F]">{error}</td>
                  </tr>
                ) : fiatPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">No payments found</td>
                  </tr>
                ) : (
                  fiatPayments.map((payment) => {
                    // Show the real deposit currency/amount when the backend
                    // returns them; fall back to the converted-to-INR fields.
                    const displayCurrency = payment.original_currency || payment.currency;
                    const displayAmount = payment.original_amount ?? payment.amount;
                    return (
                    <tr key={payment.id} className="border-t border-[#1E2D55]">
                      <td className="px-4 py-2">{payment.user_id}</td>
                      <td className="px-4 py-2">{payment.username}</td>
                      <td className="px-4 py-2">{displayCurrency}</td>
                      <td className="px-4 py-2">{displayAmount}</td>
                      <td className="px-4 py-2">{payment.provider_name}</td>
                      <td className="px-4 py-2">{payment.transaction_id}</td>
                      <td className="px-4 py-2">
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getStatusColor(payment.status)}`}>
                            {typeof payment.status === 'number'
                              ? payment.status === 1
                                ? 'Success'
                                : payment.status === 0
                                  ? 'Processing'
                                  : 'Unknown'
                              : payment.status}
                          </span>
                        </td>
                      </td>
                      <td className="px-4 py-2">
                        {new Date(payment.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        {/* Screenshot Modal */}

                        {/* Only show for manual deposits and if status is pending */}
                        {payment.is_manual_deposit && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewScreenshot(payment.deposit_id)}
                              className="px-2 py-1 bg-[#886CFF] text-[#F9F9F9] rounded-md hover:bg-[#9B82FF] text-xs"
                            >
                              View Screenshot
                            </button>

                            {(payment.status === '0' || payment.status === 'pending') && (
                              <>
                                <button
                                  onClick={() => handleApproveDeposit(payment.deposit_id)}
                                  disabled={loadingAction === payment.deposit_id}
                                  className="px-2 py-1 bg-[#0ECC68] text-[#F9F9F9] rounded-md hover:bg-[#0ECC68] text-xs disabled:opacity-50"
                                >
                                  {loadingAction === payment.deposit_id ? 'Loading...' : 'Approve'}
                                </button>

                                <button
                                  onClick={() => handleRejectDeposit(payment.deposit_id)}
                                  disabled={loadingAction === payment.deposit_id}
                                  className="px-2 py-1 bg-[#E01B4F] text-[#F9F9F9] rounded-md hover:bg-[#E01B4F] text-xs disabled:opacity-50"
                                >
                                  {loadingAction === payment.deposit_id ? 'Loading...' : 'Reject'}
                                </button>
                              </>
                            )}

                            {/* Show additional information like payment details */}
                            {payment.bank_name && (
                              <div className="text-xs text-[#878AA2]">
                                {payment.bank_name} / {payment.upi_id || 'No UPI'}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {!loading && !error && fiatPayments.length > 0 && (
              <Pagination
                paginationInfo={paginationInfo}
                onPageChange={handlePageChange}
              />
            )}
          </div>
          {/* Screenshot Modal */}
          {/* Screenshot Modal */}
          {modalOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setModalOpen(false)}
            >
              <div
                className="bg-[#0E1831] rounded-lg p-6 max-w-3xl max-h-[90vh] w-[90vw] relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setModalOpen(false)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-[#162140] hover:bg-[#1E2D55]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h2 className="text-lg font-semibold mb-4">Payment Screenshot</h2>
                <div className="overflow-auto max-h-[70vh] flex justify-center items-center">
                  {/* Replace iframe with img and add error handling */}
                  <img
                    src={currentScreenshot}
                    alt="Payment Screenshot"
                    className="max-w-full max-h-[60vh] object-contain"
                    onError={(e: any) => {
                      e.target.onerror = null;
                      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                      e.target.alt = "Image failed to load";
                    }}
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 bg-[#886CFF] text-[#F9F9F9] rounded-md hover:bg-[#9B82FF]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DepositSelf;