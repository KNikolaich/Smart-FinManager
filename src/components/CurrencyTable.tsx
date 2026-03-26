import React, { useEffect, useState } from 'react';
import { currencyService } from '../services/currencyService';
import { Currency } from '../types';

export const CurrencyTable: React.FC = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seed defaults if needed
    currencyService.seedDefaultCurrencies();

    const unsubscribe = currencyService.subscribeToCurrencies((data) => {
      setCurrencies(data.sort((a, b) => Number(a.id) - Number(b.id)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="p-4 text-gray-500">Loading currencies...</div>;

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm max-w-4xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Currency Table</h2>
        <span className="text-xs text-gray-400 uppercase tracking-wider">Default Data Seeded</span>
      </div>
      <div className="overflow-hidden border rounded shadow-inner">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-2 text-left font-medium text-gray-600 border-r w-16">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-500">123</span>
                  <span>ID</span>
                </div>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 border-r">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-500">A-Z</span>
                  <span>CUR_UID</span>
                </div>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 border-r">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-500">A-Z</span>
                  <span>NAME</span>
                </div>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-500">A-Z</span>
                  <span>ISO</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((cur) => (
              <tr key={cur.id} className="border-b last:border-b-0 hover:bg-blue-50/50 transition-colors">
                <td className="px-4 py-2 border-r text-gray-700">{cur.id}</td>
                <td className="px-4 py-2 border-r text-gray-700">{cur.curUid}</td>
                <td className="px-4 py-2 border-r text-gray-700">{cur.name}</td>
                <td className="px-4 py-2 text-gray-700">{cur.iso}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
