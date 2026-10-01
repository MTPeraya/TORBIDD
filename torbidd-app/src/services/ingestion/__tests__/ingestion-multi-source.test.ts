/**
 * @jest-environment node
 */
// =============================================================================
// services/ingestion/__tests__/ingestion-multi-source.test.ts
// Unit tests for multi-source health checks and discovery across all 3 government sources:
// 1. Bangkok Metropolitan Administration (egp2.bangkok.go.th)
// 2. Electronic Government Procurement (www.gprocurement.go.th)
// 3. Open Government Data of Thailand (data.go.th / opend.data.go.th)
// =============================================================================

import { IngestionService } from '../ingestion.service';
import { GovSpendingClient } from '../clients/govspending-client';
import { EgpClient } from '../clients/egp-client';
import { BmaClient } from '../clients/bma-client';

describe('IngestionService - All 3 External Government Data Sources', () => {
  it('checks health across BMA, e-GP, and Data.go.th simultaneously', async () => {
    const mockGovSpending = {
      checkHealth: jest.fn().mockResolvedValue({
        status: 'UP',
        statusCode: 200,
        latencyMs: 120,
        endpoint: 'https://opend.data.go.th/govspending/service/egp-contract',
        hasApiKey: true,
      }),
    } as unknown as GovSpendingClient;

    const mockEgp = {
      checkHealth: jest.fn().mockResolvedValue({
        status: 'UP',
        statusCode: 200,
        latencyMs: 95,
        endpoint: 'https://www.gprocurement.go.th',
      }),
    } as unknown as EgpClient;

    const mockBma = {
      checkHealth: jest.fn().mockResolvedValue({
        status: 'UP',
        statusCode: 200,
        latencyMs: 150,
        endpoint: 'http://egp2.bangkok.go.th',
      }),
    } as unknown as BmaClient;

    const service = new IngestionService({
      govSpendingClient: mockGovSpending,
      egpClient: mockEgp,
      bmaClient: mockBma,
    });

    const report = await service.checkAllSourcesHealth();

    expect(report.allReachable).toBe(true);
    expect(report.sources.bma.status).toBe('UP');
    expect(report.sources.egp.status).toBe('UP');
    expect(report.sources.dataGoTh.status).toBe('UP');
  });

  it('aggregates discovered projects across all 3 data sources', async () => {
    const mockGovSpending = {
      searchProjects: jest.fn().mockResolvedValue({
        total: 1,
        projects: [
          {
            externalProjectId: '67010011111',
            projectName: 'CKAN Cloud System',
            agencyName: 'สำนักการแพทย์',
            fiscalYear: 2568,
            source: 'CKAN_GOVSPENDING',
            sourceUrl: 'https://opend.data.go.th',
            budget: 1000000,
            procurementType: 'e-bidding',
          },
        ],
      }),
    } as unknown as GovSpendingClient;

    const mockBma = {
      searchProjects: jest.fn().mockResolvedValue({
        total: 1,
        projects: [
          {
            externalProjectId: '67010022222',
            projectName: 'BMA Smart School App',
            agencyName: 'กรุงเทพมหานคร',
            fiscalYear: 2568,
            source: 'BMA_EGP',
            sourceUrl: 'https://egp2.bangkok.go.th/project-detail/67010022222',
            budget: 2000000,
            procurementType: 'e-bidding',
          },
        ],
      }),
    } as unknown as BmaClient;

    const mockEgp = {
      pollAnnouncements: jest.fn().mockResolvedValue({
        total: 1,
        projects: [
          {
            externalProjectId: '67010033333',
            projectName: 'e-GP National ERP',
            agencyName: 'กรมบัญชีกลาง',
            fiscalYear: 2568,
            source: 'NATIONAL_EGP',
            sourceUrl: 'https://process5.gprocurement.go.th',
            budget: 3000000,
            procurementType: 'e-bidding',
          },
        ],
      }),
    } as unknown as EgpClient;

    const service = new IngestionService({
      govSpendingClient: mockGovSpending,
      egpClient: mockEgp,
      bmaClient: mockBma,
    });

    const result = await service.discoverFromAllSources();

    expect(result.totalProjects).toBe(3);
    expect(result.bySource.CKAN_GOVSPENDING).toBe(1);
    expect(result.bySource.BMA_EGP).toBe(1);
    expect(result.bySource.NATIONAL_EGP).toBe(1);
  });
});
