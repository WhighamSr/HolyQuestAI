import { applySchema, getSchemaHeaders, ComplianceSchema } from '../privacy/auditFormatters/complianceSchemas';
import { AuditEntry } from '../privacy/auditFormatters/csvFormatter';

describe('complianceSchemas', () => {
  let testEntry: AuditEntry;

  beforeEach(() => {
    testEntry = {
      timestamp: 1640000000000,
      actor: 'user@test.com',
      action: 'access_patient_record',
      resource: 'medical_data.json',
      outcome: 'success',
      metadata: { recordId: '12345' }
    };
  });

  describe('applySchema - HIPAA', () => {
    it('should add HIPAA compliance fields', () => {
      const result = applySchema([testEntry], 'hipaa');
      expect(result[0].complianceFields).toBeDefined();
      expect(result[0].complianceFields.eventId).toBeDefined();
      expect(result[0].complianceFields.dataClassification).toBeDefined();
      expect(result[0].complianceFields.authorizationBasis).toContain('45 CFR');
    });

    it('should classify PHI correctly', () => {
      const result = applySchema([testEntry], 'hipaa');
      expect(result[0].complianceFields.dataClassification).toContain('PHI');
    });

    it('should classify non-PHI correctly', () => {
      const nonPHI = { ...testEntry, action: 'access_report' };
      const result = applySchema([nonPHI], 'hipaa');
      expect(result[0].complianceFields.dataClassification).toBe('Non-PHI');
    });

    it('should include minimum necessary justification', () => {
      const result = applySchema([testEntry], 'hipaa');
      expect(result[0].complianceFields.minimumNecessary).toBeDefined();
    });
  });

  describe('applySchema - SOC2', () => {
    it('should add SOC2 compliance fields', () => {
      const result = applySchema([testEntry], 'soc2');
      expect(result[0].complianceFields.controlReference).toBeDefined();
      expect(result[0].complianceFields.trustServiceCriteria).toContain('CC6');
      expect(result[0].complianceFields.riskLevel).toBeDefined();
    });

    it('should assess risk level based on outcome', () => {
      const failedEntry = { ...testEntry, outcome: 'failure' as const };
      const result = applySchema([failedEntry], 'soc2');
      expect(result[0].complianceFields.riskLevel).toBe('High');
    });

    it('should assess medium risk for delete/modify', () => {
      const deleteEntry = { ...testEntry, action: 'delete_record' };
      const result = applySchema([deleteEntry], 'soc2');
      expect(result[0].complianceFields.riskLevel).toBe('Medium');
    });

    it('should assess low risk for success read operations', () => {
      const readEntry = { ...testEntry, action: 'read_data' };
      const result = applySchema([readEntry], 'soc2');
      expect(result[0].complianceFields.riskLevel).toBe('Low');
    });
  });

  describe('applySchema - GDPR', () => {
    it('should add GDPR compliance fields', () => {
      const result = applySchema([testEntry], 'gdpr');
      expect(result[0].complianceFields.lawfulBasis).toContain('Article 6');
      expect(result[0].complianceFields.dataSubjectRights).toBeDefined();
      expect(result[0].complianceFields.dataCategory).toBeDefined();
    });

    it('should classify personal data', () => {
      const personalEntry = { ...testEntry, resource: 'email@example.com' };
      const result = applySchema([personalEntry], 'gdpr');
      expect(result[0].complianceFields.dataCategory).toContain('Personal Data');
    });

    it('should classify non-personal data', () => {
      const nonPersonal = { ...testEntry, resource: 'report.pdf' };
      const result = applySchema([nonPersonal], 'gdpr');
      expect(result[0].complianceFields.dataCategory).toBe('Non-personal data');
    });

    it('should include retention period', () => {
      const result = applySchema([testEntry], 'gdpr');
      expect(result[0].complianceFields.retentionPeriod).toBeDefined();
    });
  });

  describe('applySchema - PCI', () => {
    it('should add PCI-DSS compliance fields', () => {
      const result = applySchema([testEntry], 'pci');
      expect(result[0].complianceFields.requirement).toContain('Requirement');
      expect(result[0].complianceFields.auditTrailIntegrity).toBeDefined();
      expect(result[0].complianceFields.sensitivityLevel).toBeDefined();
    });

    it('should reference Requirement 7 for access actions', () => {
      const accessEntry = { ...testEntry, action: 'access_data' };
      const result = applySchema([accessEntry], 'pci');
      expect(result[0].complianceFields.requirement).toContain('Requirement 7');
    });

    it('should reference Requirement 3 for encryption actions', () => {
      const encryptEntry = { ...testEntry, action: 'encrypt_data' };
      const result = applySchema([encryptEntry], 'pci');
      expect(result[0].complianceFields.requirement).toContain('Requirement 3');
    });
  });

  describe('getSchemaHeaders', () => {
    it('should return HIPAA headers', () => {
      const headers = getSchemaHeaders('hipaa');
      expect(headers).toContain('EventId');
      expect(headers).toContain('DataClassification');
      expect(headers).toContain('AuthorizationBasis');
    });

    it('should return SOC2 headers', () => {
      const headers = getSchemaHeaders('soc2');
      expect(headers).toContain('ControlReference');
      expect(headers).toContain('RiskLevel');
    });

    it('should return GDPR headers', () => {
      const headers = getSchemaHeaders('gdpr');
      expect(headers).toContain('LawfulBasis');
      expect(headers).toContain('DataSubjectRights');
    });

    it('should return PCI headers', () => {
      const headers = getSchemaHeaders('pci');
      expect(headers).toContain('Requirement');
      expect(headers).toContain('AuditTrailIntegrity');
    });

    it('should include base headers for all schemas', () => {
      const schemas: ComplianceSchema[] = ['hipaa', 'soc2', 'gdpr', 'pci'];
      schemas.forEach(schema => {
        const headers = getSchemaHeaders(schema);
        expect(headers).toContain('Timestamp');
        expect(headers).toContain('Actor');
        expect(headers).toContain('Action');
      });
    });
  });
});
