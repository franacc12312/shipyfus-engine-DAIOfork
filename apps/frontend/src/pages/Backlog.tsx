import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface BacklogItem {
  id: string;
  title: string;
  description: string;
  source: string;
  scores: {
    viralPotential?: number;
    executionEase?: number;
    distributionClarity?: number;
    moatScore?: number;
    totalScore?: number;
  };
  market_data: any;
  template: string;
  status: string;
  priority: number;
  created_at: string;
  expires_at: string;
}

export default function Backlog() {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    loadItems();
  }, [filter]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await api.get<BacklogItem[]>(`/backlog?status=${filter}`);
      setItems(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function addItem() {
    if (!newTitle.trim()) return;
    try {
      await api.post('/backlog', { title: newTitle, description: newDesc });
      setNewTitle('');
      setNewDesc('');
      setShowAddForm(false);
      loadItems();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function updateStatus(id: string, status: string) {
    await api.patch(`/backlog/${id}`, { status });
    loadItems();
  }

  function daysLeft(expiresAt: string) {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Backlog</h1>
        <div className="flex gap-2">
          {['pending', 'approved', 'shipped', 'rejected', 'expired'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded text-sm ${filter === s ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="mb-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm"
      >
        + Add Idea
      </button>

      {showAddForm && (
        <div className="mb-4 p-4 bg-gray-900 rounded border border-gray-800">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Idea title..."
            className="w-full mb-2 p-2 bg-gray-800 border border-gray-700 rounded text-white"
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description..."
            className="w-full mb-2 p-2 bg-gray-800 border border-gray-700 rounded text-white h-20"
          />
          <button onClick={addItem} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
            Save
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No {filter} ideas</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="p-4 bg-gray-900 rounded border border-gray-800">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-medium">{item.title}</h3>
                  {item.description && <p className="text-gray-400 text-sm mt-1">{item.description}</p>}
                  <div className="flex gap-2 mt-2">
                    {item.template && <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">{item.template}</span>}
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">{item.source}</span>
                    {item.scores?.totalScore && (
                      <span className={`px-2 py-0.5 rounded text-xs ${item.scores.totalScore >= 13 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        Score: {item.scores.totalScore}/25
                      </span>
                    )}
                    {item.expires_at && item.status === 'pending' && (
                      <span className={`px-2 py-0.5 rounded text-xs ${daysLeft(item.expires_at) <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
                        {daysLeft(item.expires_at)}d left
                      </span>
                    )}
                  </div>
                </div>
                {item.status === 'pending' && (
                  <div className="flex gap-1">
                    <button onClick={() => updateStatus(item.id, 'approved')} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs">Ship</button>
                    <button onClick={() => updateStatus(item.id, 'rejected')} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs">Skip</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
