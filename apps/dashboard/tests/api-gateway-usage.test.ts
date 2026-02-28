import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CRITICAL: These tests ensure dashboard pages use the API gateway
 * instead of calling backend services directly.
 * 
 * Context: Dashboard was calling brand-service directly with Bearer token,
 * but brand-service requires X-API-Key. The API gateway handles this translation.
 */
describe('Dashboard API Gateway Usage - CRITICAL', () => {
  const appDir = path.join(__dirname, '../src/app');
  
  function getAllTsxFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllTsxFiles(fullPath));
      } else if (entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('should NOT call BRAND_SERVICE_URL directly (use NEXT_PUBLIC_DISTRIBUTE_API_URL instead)', () => {
    const files = getAllTsxFiles(appDir);
    const violations: { file: string; line: number }[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for direct brand-service calls
        if (line.includes('NEXT_PUBLIC_BRAND_SERVICE_URL') && line.includes('fetch')) {
          violations.push({ file: path.relative(appDir, file), line: index + 1 });
        }
        // Also check for hardcoded brand service URL
        if (line.includes('brand.distribute.you') && !line.includes('//')) {
          violations.push({ file: path.relative(appDir, file), line: index + 1 });
        }
      });
    }
    
    expect(
      violations,
      `Files calling brand-service directly:\n${violations.map(v => `  ${v.file}:${v.line}`).join('\n')}\n\nUse NEXT_PUBLIC_DISTRIBUTE_API_URL/v1/brands/... instead`
    ).toHaveLength(0);
  });

  it('should use NEXT_PUBLIC_DISTRIBUTE_API_URL for brand-related fetches', () => {
    const brandsDir = path.join(appDir, '(dashboard)/brands');
    if (!fs.existsSync(brandsDir)) {
      return; // Skip if brands folder doesn't exist
    }
    
    const files = getAllTsxFiles(brandsDir);
    const correctUsage: string[] = [];
    const incorrectUsage: { file: string; issue: string }[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(appDir, file);
      
      // Check if file has fetch calls
      if (content.includes('fetch(')) {
        // Good: uses API_URL for brand endpoints
        if (content.includes('NEXT_PUBLIC_DISTRIBUTE_API_URL') && content.includes('/v1/brands')) {
          correctUsage.push(relPath);
        }
        
        // Bad: uses campaign-service for brand data (old pattern)
        if (content.includes('NEXT_PUBLIC_CAMPAIGN_SERVICE_URL') && content.includes('/brands')) {
          incorrectUsage.push({ 
            file: relPath, 
            issue: 'Uses CAMPAIGN_SERVICE_URL for brands - should use API_URL/v1/brands' 
          });
        }
      }
    }
    
    expect(
      incorrectUsage,
      `Files with incorrect brand API usage:\n${incorrectUsage.map(v => `  ${v.file}: ${v.issue}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('should use API gateway for campaign filtering (not direct service calls)', () => {
    const files = getAllTsxFiles(appDir);
    const violations: { file: string; line: number; code: string }[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for direct campaign-service calls with brand filters
        if (
          line.includes('CAMPAIGN_SERVICE_URL') && 
          (line.includes('brandId') || line.includes('brandUrl'))
        ) {
          violations.push({ 
            file: path.relative(appDir, file), 
            line: index + 1,
            code: line.trim().substring(0, 80)
          });
        }
      });
    }
    
    expect(
      violations,
      `Files calling campaign-service directly for brand filtering:\n${violations.map(v => `  ${v.file}:${v.line}\n    ${v.code}`).join('\n')}\n\nUse NEXT_PUBLIC_DISTRIBUTE_API_URL instead`
    ).toHaveLength(0);
  });
});
