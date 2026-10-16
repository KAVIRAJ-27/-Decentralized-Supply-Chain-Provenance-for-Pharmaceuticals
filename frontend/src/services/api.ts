import {
  PublicVerificationResponse,
  MedicineBatch,
  CustodyEvent,
  UserSession,
  Organization,
  User,
  Medicine,
  Delivery,
  ReceiptConfirmation,
} from '../types';

const API_BASE = '/api';

export const api = {
  // Public Verification (No Token Required!)
  async verifyBatch(batchId: string): Promise<PublicVerificationResponse> {
    const res = await fetch(`${API_BASE}/public/verify/${encodeURIComponent(batchId)}`);
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

  async logout(token: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      // Ignore network errors on logout
    }
  },

  async getCurrentUser(token: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to authenticate current session');
    }
    return res.json();
  },

  async changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to change password');
    }
  },

  // Organizations Management (Admin & Participants)
  async getOrganizations(
    token: string,
    filters?: { type?: string; status?: string; search?: string }
  ): Promise<Organization[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`${API_BASE}/organizations?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch organizations');
    }
    const json = await res.json();
    return json.data;
  },

  async getOrganizationDetails(token: string, organizationId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/organizations/${encodeURIComponent(organizationId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch organization details');
    const json = await res.json();
    return json.data;
  },

  async createOrganization(token: string, payload: any): Promise<Organization> {
    const res = await fetch(`${API_BASE}/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to register organization');
    }
    const json = await res.json();
    return json.data;
  },

  async updateOrganization(token: string, organizationId: string, payload: any): Promise<Organization> {
    const res = await fetch(`${API_BASE}/organizations/${encodeURIComponent(organizationId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update organization');
    }
    const json = await res.json();
    return json.data;
  },

  async setOrganizationStatus(token: string, organizationId: string, status: string, reason?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/organizations/${encodeURIComponent(organizationId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update organization status');
    }
    return res.json();
  },

  // Users Management (Admin)
  async getUsers(
    token: string,
    filters?: { organizationId?: string; role?: string; isActive?: boolean; search?: string }
  ): Promise<User[]> {
    const params = new URLSearchParams();
    if (filters?.organizationId) params.append('organizationId', filters.organizationId);
    if (filters?.role) params.append('role', filters.role);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`${API_BASE}/users?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch users');
    }
    const json = await res.json();
    return json.data;
  },

  async createUser(token: string, payload: any): Promise<User> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create user account');
    }
    const json = await res.json();
    return json.data;
  },

  async setUserStatus(token: string, userId: string, isActive: boolean, reason?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update user status');
    }
    return res.json();
  },

  // Admin Metrics & Activities
  async getAdminMetrics(token: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch admin metrics');
    }
    const json = await res.json();
    return json.data;
  },

  async getAdminActivities(token: string, limit = 50): Promise<any[]> {
    const res = await fetch(`${API_BASE}/admin/activities?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch administrative activities');
    }
    const json = await res.json();
    return json.data;
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

  async getBatchQr(token: string, batchId: string): Promise<{
    batchId: string;
    drugName: string;
    genericName?: string;
    dosage?: string;
    manufacturerName: string;
    verificationUrl: string;
    qrSvg: string;
    qrPngDataUrl?: string;
    digitalSignature?: {
      signature: string;
      algorithm: string;
      keyId: string;
      signedAt: string;
    };
    printableLabelHtml: string;
  }> {
    const res = await fetch(`${API_BASE}/batches/${encodeURIComponent(batchId)}/qr`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to retrieve batch QR code');
    }
    return res.json();
  },

  // Stats & Network
  async getStats(): Promise<any> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // Medicine Catalog (Manufacturer Module)
  async getMedicines(token: string, search?: string): Promise<Medicine[]> {
    const url = search ? `${API_BASE}/medicines?search=${encodeURIComponent(search)}` : `${API_BASE}/medicines`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch medicines');
    }
    const json = await res.json();
    return json.data;
  },

  async getMedicineById(token: string, medicineId: string): Promise<Medicine> {
    const res = await fetch(`${API_BASE}/medicines/${encodeURIComponent(medicineId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch medicine details');
    }
    const json = await res.json();
    return json.data;
  },

  async createMedicine(token: string, payload: any): Promise<Medicine> {
    const res = await fetch(`${API_BASE}/medicines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to register medicine');
    }
    const json = await res.json();
    return json.data;
  },

  async updateMedicine(token: string, medicineId: string, payload: any): Promise<Medicine> {
    const res = await fetch(`${API_BASE}/medicines/${encodeURIComponent(medicineId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update medicine details');
    }
    const json = await res.json();
    return json.data;
  },

  async getManufacturerStats(token: string): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/manufacturer/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch manufacturer statistics');
    }
    const json = await res.json();
    return json.stats;
  },

  // Deliveries & Inventory Management
  async getDeliveries(
    token: string,
    filters?: { status?: string; batchId?: string; direction?: 'inbound' | 'outbound' }
  ): Promise<Delivery[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.batchId) params.append('batchId', filters.batchId);
    if (filters?.direction) params.append('direction', filters.direction);

    const res = await fetch(`${API_BASE}/deliveries?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch deliveries');
    }
    const json = await res.json();
    return json.data;
  },

  async getDeliveryById(token: string, deliveryId: string): Promise<Delivery> {
    const res = await fetch(`${API_BASE}/deliveries/${encodeURIComponent(deliveryId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch delivery details');
    }
    const json = await res.json();
    return json.data;
  },

  async createDelivery(
    token: string,
    payload: {
      batchId: string;
      toOrganizationId: string;
      quantity: number;
      expectedDeliveryDate?: string;
      location?: string;
      temperatureCelsius?: number;
      notes?: string;
    }
  ): Promise<{ delivery: Delivery; batchRemainingQuantity: number }> {
    const res = await fetch(`${API_BASE}/deliveries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to dispatch delivery');
    }
    const json = await res.json();
    return { delivery: json.data, batchRemainingQuantity: json.batchRemainingQuantity };
  },

  async confirmDeliveryReceipt(
    token: string,
    deliveryId: string,
    payload?: {
      receivedQuantity?: number;
      remarks?: string;
      location?: string;
      temperatureCelsius?: number;
    }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/deliveries/${encodeURIComponent(deliveryId)}/confirm-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to confirm delivery receipt');
    }
    return res.json();
  },

  async cancelDelivery(token: string, deliveryId: string): Promise<Delivery> {
    const res = await fetch(`${API_BASE}/deliveries/${encodeURIComponent(deliveryId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to cancel delivery');
    }
    const json = await res.json();
    return json.data;
  },
};

