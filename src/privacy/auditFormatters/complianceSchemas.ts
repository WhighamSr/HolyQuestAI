import { AuditEntry } from './csvFormatter';

export type ComplianceSchema = 'hipaa' | 'soc2' | 'gdpr' | 'pci';

export interface ComplianceEntry extends AuditEntry {
  complianceFields: Record<string, string>;
}

/**
 * Apply compliance schema transformations to audit entries
 */
export function applySchema(
  entries: AuditEntry[],
  schema: ComplianceSchema
): ComplianceEntry[] {
  switch (schema) {
    case 'hipaa':
      return entries.map(e => applyHipaa(e));
    case 'soc2':
      return entries.map(e => applySoc2(e));
    case 'gdpr':
      return entries.map(e => applyGdpr(e));
    case 'pci':
      return entries.map(e => applyPci(e));
    default:
      return entries.map(e => ({ ...e, complianceFields: {} }));
  }
}

/**
 * HIPAA compliance fields
 */
function applyHipaa(entry: AuditEntry): ComplianceEntry {
  return {
    ...entry,
    complianceFields: {
      eventId: generateEventId(),
      dataClassification: classifyHipaaData(entry),
      authorizationBasis: 'Treatment, Payment, Healthcare Operations (45 CFR 164.506)',
      minimumNecessary: 'Automated privacy-preserving AI assistance - minimum data exposure',
      integrityControl: 'SHA-256 audit trail',
      accountabilityMeasure: 'Immutable timestamped log entry'
    }
  };
}

/**
 * SOC2 compliance fields
 */
function applySoc2(entry: AuditEntry): ComplianceEntry {
  return {
    ...entry,
    complianceFields: {
      eventId: generateEventId(),
      controlReference: determineSoc2Control(entry),
      trustServiceCriteria: 'Security (CC6.1, CC6.6)',
      riskLevel: assessRiskLevel(entry),
      monitoringControl: 'Real-time audit logging',
      evidenceType: 'System-generated audit trail'
    }
  };
}

/**
 * GDPR compliance fields
 */
function applyGdpr(entry: AuditEntry): ComplianceEntry {
  return {
    ...entry,
    complianceFields: {
      eventId: generateEventId(),
      lawfulBasis: 'Article 6(1)(f) - Legitimate Interests',
      dataSubjectRights: 'Right to erasure (Art. 17), Right to access (Art. 15)',
      processingPurpose: 'AI-assisted development with privacy protection',
      dataCategory: classifyGdprData(entry),
      retentionPeriod: 'Session-based, user-controlled deletion',
      securityMeasure: 'Encryption, pseudonymization, access controls'
    }
  };
}

/**
 * PCI-DSS compliance fields
 */
function applyPci(entry: AuditEntry): ComplianceEntry {
  return {
    ...entry,
    complianceFields: {
      eventId: generateEventId(),
      requirement: determinePciRequirement(entry),
      auditTrailIntegrity: 'Cryptographically secured (Req 10.5)',
      accessControl: 'Role-based, least privilege (Req 7)',
      sensitivityLevel: 'High - potential cardholder data environment',
      logReviewFrequency: 'Real-time + daily review'
    }
  };
}

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Classify data for HIPAA
 */
function classifyHipaaData(entry: AuditEntry): string {
  const action = entry.action.toLowerCase();
  if (action.includes('patient') || action.includes('medical') || action.includes('health')) {
    return 'PHI (Protected Health Information)';
  }
  return 'Non-PHI';
}

/**
 * Determine SOC2 control reference
 */
function determineSoc2Control(entry: AuditEntry): string {
  if (entry.action.includes('access') || entry.action.includes('auth')) {
    return 'CC6.1 - Logical and Physical Access Controls';
  }
  if (entry.action.includes('encrypt') || entry.action.includes('vault')) {
    return 'CC6.6 - Encryption of Data-at-Rest';
  }
  return 'CC6.7 - System Monitoring';
}

/**
 * Classify data for GDPR
 */
function classifyGdprData(entry: AuditEntry): string {
  const resource = entry.resource.toLowerCase();
  if (resource.includes('email') || resource.includes('name') || resource.includes('personal')) {
    return 'Personal Data (Art. 4(1))';
  }
  return 'Non-personal data';
}

/**
 * Determine PCI requirement
 */
function determinePciRequirement(entry: AuditEntry): string {
  if (entry.action.includes('access') || entry.action.includes('auth')) {
    return 'Requirement 7 - Restrict access to cardholder data';
  }
  if (entry.action.includes('encrypt')) {
    return 'Requirement 3 - Protect stored cardholder data';
  }
  return 'Requirement 10 - Track and monitor all access to network resources and cardholder data';
}

/**
 * Assess risk level
 */
function assessRiskLevel(entry: AuditEntry): string {
  if (entry.outcome === 'failure') {
    return 'High';
  }
  if (entry.action.includes('delete') || entry.action.includes('modify')) {
    return 'Medium';
  }
  return 'Low';
}

/**
 * Get schema-specific headers for CSV export
 */
export function getSchemaHeaders(schema: ComplianceSchema): string[] {
  const baseHeaders = ['Timestamp', 'Actor', 'Action', 'Resource', 'Outcome'];
  
  switch (schema) {
    case 'hipaa':
      return [...baseHeaders, 'EventId', 'DataClassification', 'AuthorizationBasis', 'MinimumNecessary'];
    case 'soc2':
      return [...baseHeaders, 'EventId', 'ControlReference', 'TrustServiceCriteria', 'RiskLevel'];
    case 'gdpr':
      return [...baseHeaders, 'EventId', 'LawfulBasis', 'DataSubjectRights', 'DataCategory'];
    case 'pci':
      return [...baseHeaders, 'EventId', 'Requirement', 'AuditTrailIntegrity', 'SensitivityLevel'];
    default:
      return baseHeaders;
  }
}
