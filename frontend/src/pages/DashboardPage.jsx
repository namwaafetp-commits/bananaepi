import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import Navbar from '../components/Navbar';
import api from '../api/client';

export default function DashboardPage() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const { data: json } = await api.get(`/projects/${projectId}/dashboard`);
        setData(json);
      } catch (err) {
        const detail = err.response?.data?.detail
        setError(typeof detail === 'string' ? detail : err.message)
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      fetchDashboard();
    }
  }, [projectId]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />
      <div className="h-[calc(100vh-4rem)] bg-slate-50">
        {loading && (
          <div className="flex h-full items-center justify-center text-teal-600">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center p-6">
            <div className="bg-rose-50 border border-rose-200 p-6 rounded-xl max-w-lg text-center">
              <h2 className="text-xl font-bold mb-2 text-rose-700">Error Loading Dashboard</h2>
              <p className="text-rose-600">{error}</p>
            </div>
          </div>
        )}
        {!loading && !error && data && <DashboardLayout data={data} />}
      </div>
    </div>
  );
}
