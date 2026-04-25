const API_URL = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

const handleAuthError = async (res: Response, endpoint: string) => {
  if (res.status === 401 || res.status === 403) {
    // If we're on login or register, it's just a normal error (invalid credentials)
    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register')) {
      const text = await res.text();
      try {
        const error = JSON.parse(text);
        if (error && typeof error.error === 'string') {
          throw new Error(error.error);
        }
        if (error && typeof error.message === 'string') {
          throw new Error(error.message);
        }
        throw new Error(JSON.stringify(error));
      } catch {
        throw new Error(text || `Error ${res.status}: ${res.statusText}`);
      }
    }
    
    // For other endpoints, it's a real session expiration
    localStorage.removeItem('token');
    throw new Error('Session expired. Please log in again.');
  }
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const text = await res.text();
    try {
      const error = JSON.parse(text);
      if (error && typeof error.error === 'string') {
        throw new Error(error.error);
      }
      if (error && typeof error.message === 'string') {
        throw new Error(error.message);
      }
      throw new Error(JSON.stringify(error));
    } catch {
      throw new Error(text || `Error ${res.status}: ${res.statusText}`);
    }
  }
  
  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  return text as any;
};

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
    await handleAuthError(res, endpoint);
    return handleResponse(res);
  },
  async post<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    await handleAuthError(res, endpoint);
    return handleResponse(res);
  },
  async put<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    await handleAuthError(res, endpoint);
    return handleResponse(res);
  },
  async delete<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleAuthError(res, endpoint);
    return handleResponse(res);
  },
};
