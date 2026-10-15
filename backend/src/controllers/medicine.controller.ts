import { Response } from 'express';
import { db, MedicineRecord } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * List Medicines
 * Manufacturers only see medicines registered under their organization.
 * Admins can inspect all or filter by manufacturer organization.
 */
export function listMedicines(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { search, manufacturerOrganizationId } = req.query as {
    search?: string;
    manufacturerOrganizationId?: string;
  };

  const targetOrgId = user.role === 'ADMIN' ? manufacturerOrganizationId : user.organizationId;
  const medicines = db.listMedicines(targetOrgId, search);

  return res.json({
    success: true,
    data: medicines,
    count: medicines.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get Medicine Details by ID
 */
export function getMedicineById(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { medicineId } = req.params;

  const medicine = db.findMedicineById(medicineId);
  if (!medicine) {
    return res.status(404).json({
      success: false,
      error: `Medicine with ID '${medicineId}' was not found.`,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
  }

  // Cross-organization boundary isolation
  if (user.role !== 'ADMIN' && medicine.manufacturerOrganizationId !== user.organizationId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You do not have authorization to view this medicine record.',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    success: true,
    data: medicine,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Register a New Medicine
 * Enforces server-derived organization assignment so clients cannot spoof another manufacturer.
 */
export function createMedicine(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const {
    medicineId,
    name,
    genericName,
    description,
    dosageForm,
    strength,
    packaging,
  } = req.body;

  // Validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Commercial medicine name is required', code: 'VALIDATION_ERROR' });
  }

  if (!genericName || typeof genericName !== 'string' || !genericName.trim()) {
    return res.status(400).json({ success: false, error: 'Generic active pharmaceutical ingredient (API) is required', code: 'VALIDATION_ERROR' });
  }

  if (!dosageForm || typeof dosageForm !== 'string' || !dosageForm.trim()) {
    return res.status(400).json({ success: false, error: 'Dosage form is required (e.g., Tablet, Capsule, Injection)', code: 'VALIDATION_ERROR' });
  }

  if (!strength || typeof strength !== 'string' || !strength.trim()) {
    return res.status(400).json({ success: false, error: 'Medicine strength is required (e.g., 625mg, 1000mg/100mL)', code: 'VALIDATION_ERROR' });
  }

  const resolvedMedicineId = (medicineId && typeof medicineId === 'string' && medicineId.trim())
    ? medicineId.trim().toUpperCase()
    : `MED-DRUG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  // Duplicate Check
  const existing = db.findMedicineById(resolvedMedicineId);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: `Medicine with identifier '${resolvedMedicineId}' is already registered.`,
      code: 'DUPLICATE_MEDICINE',
      timestamp: new Date().toISOString(),
    });
  }

  // Server-enforced organization ownership
  const manufacturerOrgId = user.role === 'ADMIN' && req.body.manufacturerOrganizationId
    ? req.body.manufacturerOrganizationId
    : user.organizationId;

  const newMedicine: MedicineRecord = {
    medicineId: resolvedMedicineId,
    name: name.trim(),
    genericName: genericName.trim(),
    description: (description && typeof description === 'string') ? description.trim() : '',
    manufacturerOrganizationId: manufacturerOrgId,
    dosageForm: dosageForm.trim(),
    strength: strength.trim(),
    packaging: (packaging && typeof packaging === 'string') ? packaging.trim() : 'Standard Institutional Packaging',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const created = db.createMedicine(newMedicine);

  return res.status(201).json({
    success: true,
    message: `Medicine '${created.name}' successfully registered in catalog.`,
    data: created,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Update Permitted Medicine Details
 */
export function updateMedicine(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { medicineId } = req.params;
  const { name, genericName, description, dosageForm, strength, packaging } = req.body;

  const existing = db.findMedicineById(medicineId);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: `Medicine '${medicineId}' not found.`,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
  }

  // Ownership verification
  if (user.role !== 'ADMIN' && existing.manufacturerOrganizationId !== user.organizationId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You cannot modify medicines belonging to another manufacturer.',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString(),
    });
  }

  const updates: Partial<MedicineRecord> = {};
  if (name && typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (genericName && typeof genericName === 'string' && genericName.trim()) updates.genericName = genericName.trim();
  if (description !== undefined && typeof description === 'string') updates.description = description.trim();
  if (dosageForm && typeof dosageForm === 'string' && dosageForm.trim()) updates.dosageForm = dosageForm.trim();
  if (strength && typeof strength === 'string' && strength.trim()) updates.strength = strength.trim();
  if (packaging && typeof packaging === 'string' && packaging.trim()) updates.packaging = packaging.trim();

  const updated = db.updateMedicine(medicineId, updates);

  return res.json({
    success: true,
    message: `Medicine '${updated.name}' details updated successfully.`,
    data: updated,
    timestamp: new Date().toISOString(),
  });
}
