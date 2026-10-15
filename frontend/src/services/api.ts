import { PublicVerificationResponse, MedicineBatch, CustodyEvent, UserSession } from '../types';

const API_BASE = '/api';

export const api = {
  // Public Verification (No Token Required!)
  async verifyBatch(batchId: string): Promise<PublicVerificationResponse> {
    const res = await fetch(`${API_BASE}/verify/${encodeURIComponent(batchId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Verification failed with HTTP ${res.status}`);
    }
    return res.json();
  },

  // Auth
  async login(email: string, password: string): Promise<UserSession> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Authentication failed');
    }
    return res.json();
  },

  // Batches
  async getBatches(token: string, role?: string): Promise<MedicineBatch[]> {
    const url = role ? `${API_BASE}/batches?role=${encodeURIComponent(role)}` : `${API_BASE}/batches`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch batches');
    const data = await res.json();
    return data.batches;
  },

  async getBatchDetails(token: string, batchId: string): Promise<{ batch: MedicineBatch; history: CustodyEvent[] }> {
    const res = await fetch(`${API_BASE}/batches/${encodeURIComponent(batchId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch batch details');
    return res.json();
  },

  async createBatch(token: string, payload: any): Promise<{ batch: MedicineBatch; txHash: string }> {
    const res = await fetch(`${API_BASE}/batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create batch');
    }
    return res.json();
  },

  async updateStatus(token: string, batchId: string, payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${encodeURIComponent(batchId)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update status');
    }
    return res.json();
  },

  async dispense(token: string, batchId: string, payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${encodeURIComponent(batchId)}/dispense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to dispense medication');
    }
    return res.json();
  },

  async recall(token: string, batchId: string, reason: string): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${encodeURIComponent(batchId)}/recall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to trigger recall');
    }
    return res.json();
  },

  // Stats & Network
  async getStats(): Promise<any> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },
};
