const API_URL = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      window.location.reload();
      throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async post<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      window.location.reload();
      throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async put<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      window.location.reload();
      throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async delete<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      window.location.reload();
      throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
