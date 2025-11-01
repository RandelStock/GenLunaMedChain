import React, { useState, useEffect } from 'react';
import { FaLink, FaSearch, FaSync, FaExternalLinkAlt, FaCheckCircle, FaTimesCircle, FaDownload } from 'react-icons/fa';
import api from '../../api.js';

export default function BlockchainHistory() {
  const [blockchainData, setBlockchainData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [verificationStatus, setVerificationStatus] = useState({});

  const [stats, setStats] = useState({
    total: 0,
    medicines: 0,
    stocks: 0,
    receipts: 0,
    removals: 0
  });

  // Fetch blockchain hashes
  const fetchBlockchainData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use configured API client to avoid fetching the app HTML (which causes JSON parse errors)
      const { data } = await api.get('/blockchain/hashes');
      const hashes = data?.hashes || [];
      
      setBlockchainData(hashes);
      setFilteredData(hashes);
      calculateStats(hashes);
    } catch (err) {
      console.error('Error fetching blockchain data:', err);
      // Provide clearer error when frontend served HTML instead of JSON
      const message = err?.response?.data?.error || err?.message || 'Failed to fetch blockchain data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockchainData();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...blockchainData];

    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.hash?.toLowerCase().includes(searchLower) ||
        item.recordId?.toString().includes(searchLower) ||
        item.type?.toLowerCase().includes(searchLower) ||
        item.addedBy?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredData(filtered);
    calculateStats(filtered);
  }, [searchTerm, filterType, blockchainData]);

  const calculateStats = (data) => {
    setStats({
      total: data.length,
      medicines: data.filter(item => item.type === 'medicine').length,
      stocks: data.filter(item => item.type === 'stock').length,
      receipts: data.filter(item => item.type === 'receipt').length,
      removals: data.filter(item => item.type === 'removal').length
    });
  };

  const verifyHash = async (recordId, type, hash) => {
    try {
      const { data } = await api.post('/blockchain/verify', { recordId, type, hash });
      setVerificationStatus(prev => ({
        ...prev,
        [`${type}-${recordId}`]: data?.verified
      }));
    } catch (err) {
      console.error('Verification error:', err);
      setVerificationStatus(prev => ({
        ...prev,
        [`${type}-${recordId}`]: false
      }));
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTypeColor = (type) => {
    const colors = {
      'medicine': 'bg-blue-50 text-blue-700 border-blue-200',
      'stock': 'bg-purple-50 text-purple-700 border-purple-200',
      'receipt': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'removal': 'bg-red-50 text-red-700 border-red-200'
    };
    return colors[type] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'medicine': '💊',
      'stock': '📦',
      'receipt': '📋',
      'removal': '🗑️'
    };
    return icons[type] || '📄';
  };

  const handleExportCSV = () => {
    const csvContent = [
      ['Type', 'Record ID', 'Data Hash', 'Added By', 'Timestamp', 'Status', 'TX Hash'],
      ...filteredData.map(item => [
        item.type,
        item.recordId || 'N/A',
        item.hash || '',
        formatAddress(item.addedBy),
        formatTimestamp(item.timestamp),
        item.exists ? 'Active' : 'Deleted',
        item.txHash || 'N/A'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blockchain-hashes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Blockchain History Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Hashes: ${filteredData.length}`, 14, 34);
    
    let y = 44;
    doc.setFontSize(9);
    
    filteredData.slice(0, 200).forEach((item) => {
      const date = formatTimestamp(item.timestamp);
      const status = item.exists ? 'Active' : 'Deleted';
      const line = `${item.type.toUpperCase()} | #${item.recordId} | ${item.hash?.slice(0, 16)}... | ${formatAddress(item.addedBy)} | ${status}`;
      doc.text(line.substring(0, 110), 14, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    
    doc.save(`blockchain-hashes-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <h1 className="text-xl font-semibold text-gray-900">Blockchain History</h1>
              </div>
              <div className="h-6 w-px bg-gray-300"></div>
              <span className="text-sm text-gray-600">{stats.total} hashes</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={fetchBlockchainData}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaSync className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExportCSV}
                disabled={filteredData.length === 0}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaDownload className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                disabled={filteredData.length === 0}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaDownload className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600 mt-0.5">Total Hashes</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-2xl font-bold text-blue-600">{stats.medicines}</div>
              <div className="text-xs text-gray-600 mt-0.5">Medicines</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-2xl font-bold text-purple-600">{stats.stocks}</div>
              <div className="text-xs text-gray-600 mt-0.5">Stocks</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-2xl font-bold text-emerald-600">{stats.receipts}</div>
              <div className="text-xs text-gray-600 mt-0.5">Receipts</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-2xl font-bold text-red-600">{stats.removals}</div>
              <div className="text-xs text-gray-600 mt-0.5">Removals</div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              🔐 What are these hashes?
            </h3>
            <p className="text-xs text-blue-900 leading-relaxed">
              A <strong>hash</strong> is a unique cryptographic fingerprint of your data. When you create or update 
              a medicine, stock, receipt, or removal record, the system generates a hash (using SHA-256) of all 
              the record's data and stores it on the Ethereum blockchain. This makes the data:
            </p>
            <ul className="list-disc list-inside text-xs text-blue-900 mt-2 space-y-1">
              <li><strong>Tamper-proof:</strong> Any change to the original data will produce a different hash</li>
              <li><strong>Verifiable:</strong> You can verify data integrity by comparing hashes</li>
              <li><strong>Immutable:</strong> Once on the blockchain, it cannot be altered</li>
              <li><strong>Transparent:</strong> Anyone can verify the data hasn't been tampered with</li>
            </ul>
          </div>

          {/* Filters */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by hash, record ID, or address..."
                className="w-full pl-10 pr-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="medicine">Medicine</option>
              <option value="stock">Stock</option>
              <option value="receipt">Receipt</option>
              <option value="removal">Removal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-indigo-600 mb-4"></div>
            <p className="text-sm text-gray-600">Loading blockchain data...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FaLink className="text-6xl text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Hashes Found</h2>
            <p className="text-sm text-gray-600">
              {blockchainData.length === 0 
                ? "No hashes have been stored on the blockchain yet" 
                : "No hashes match your search criteria"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Record ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Hash
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Added By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border ${getTypeColor(item.type)}`}>
                          {getTypeIcon(item.type)} {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                        #{item.recordId}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900">{item.hash?.slice(0, 10)}...{item.hash?.slice(-8)}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(item.hash)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs"
                            title="Copy full hash"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className="font-mono text-gray-900">
                          {formatAddress(item.addedBy)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(item.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.exists ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <FaCheckCircle className="mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border bg-gray-50 text-gray-700 border-gray-200">
                            <FaTimesCircle className="mr-1" /> Deleted
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => verifyHash(item.recordId, item.type, item.hash)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Verify
                          </button>
                          {verificationStatus[`${item.type}-${item.recordId}`] !== undefined && (
                            <span className={verificationStatus[`${item.type}-${item.recordId}`] ? 'text-green-600' : 'text-red-600'}>
                              {verificationStatus[`${item.type}-${item.recordId}`] ? '✓' : '✗'}
                            </span>
                          )}
                          {item.txHash && (
                            <a
                              href={`https://amoy.polygonscan.com/tx/${item.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              title="View on Etherscan"
                            >
                              <FaExternalLinkAlt />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}