import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useErrorHandler } from '@/lib/useErrorHandler';

interface LogFile {
  name: string;
  size: number;
  lastModified: string;
  path: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: any;
}

export default function AdminLogs() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [lines, setLines] = useState(100);
  const { handleAsyncError } = useErrorHandler({ component: 'AdminLogs' });

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const loadFiles = async () => {
    const result = await handleAsyncError(async () => {
      const response = await fetch('/api/admin/logs', { headers });
      if (!response.ok) {
        if (response.status === 401) {
          setAuthenticated(false);
          throw new Error('未授權的存取');
        }
        throw new Error('Failed to load log files');
      }
      const data = await response.json();
      setFiles(data.files);
      setAuthenticated(true);
    });
  };

  const loadLogEntries = async (fileName: string, numLines: number = 100) => {
    setLoading(true);
    const result = await handleAsyncError(async () => {
      const response = await fetch(`/api/admin/logs?file=${fileName}&lines=${numLines}`, { headers });
      if (!response.ok) {
        throw new Error('Failed to load log entries');
      }
      const data = await response.json();
      setEntries(data.entries);
    });
    setLoading(false);
  };

  const deleteLogFile = async (fileName: string) => {
    if (!confirm(`確定要刪除日誌檔案 ${fileName} 嗎？`)) {
      return;
    }

    await handleAsyncError(async () => {
      const response = await fetch('/api/admin/logs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ file: fileName }),
      });
      if (!response.ok) {
        throw new Error('Failed to delete log file');
      }
      await loadFiles(); // Reload file list
      if (selectedFile === fileName) {
        setSelectedFile('');
        setEntries([]);
      }
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadFiles();
  };

  useEffect(() => {
    if (selectedFile) {
      loadLogEntries(selectedFile, lines);
    }
  }, [selectedFile, lines, loadLogEntries]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warn': return 'text-yellow-600 bg-yellow-50';
      case 'info': return 'text-blue-600 bg-blue-50';
      case 'debug': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!authenticated) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">管理員登入</h1>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                  存取金鑰
                </label>
                <input
                  type="password"
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                登入
              </button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">系統日誌管理</h1>
          <button
            onClick={loadFiles}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            重新載入
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File List */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">日誌檔案</h2>
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.name}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      selectedFile === file.path
                        ? 'bg-indigo-100 border border-indigo-300'
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <div
                      onClick={() => setSelectedFile(file.path)}
                      className="flex-1"
                    >
                      <div className="font-medium text-sm text-gray-900">{file.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(file.size)} • {new Date(file.lastModified).toLocaleString('zh-TW')}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLogFile(file.path);
                      }}
                      className="mt-2 text-xs text-red-600 hover:text-red-800"
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Log Entries */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedFile ? `日誌內容: ${selectedFile}` : '選擇日誌檔案'}
                </h2>
                {selectedFile && (
                  <div className="flex items-center space-x-2">
                    <label htmlFor="lines" className="text-sm text-gray-700">
                      顯示行數:
                    </label>
                    <select
                      id="lines"
                      value={lines}
                      onChange={(e) => setLines(parseInt(e.target.value))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                    </select>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-gray-600">載入中...</p>
                </div>
              ) : selectedFile && entries.length > 0 ? (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {entries.map((entry, index) => (
                    <div key={index} className="text-xs font-mono border-b border-gray-100 pb-1">
                      <div className="flex items-start space-x-2">
                        <span className="text-gray-500 whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString('zh-TW')}
                        </span>
                        <span className={`px-1 rounded text-xs font-semibold whitespace-nowrap ${getLevelColor(entry.level)}`}>
                          {entry.level.toUpperCase()}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap">{entry.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedFile ? (
                <div className="text-center py-8 text-gray-500">
                  日誌檔案為空或無法載入
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  請從左側選擇日誌檔案
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}