import {
  parseError,
  formatError,
  isRecoverableError,
  isNetworkError,
  requiresElevation,
  ERROR_I18N_KEYS,
  type ErrorCode,
  type CogniaError,
} from '../errors';

describe('Error Utilities', () => {
  describe('parseError', () => {
    it('should parse network errors', () => {
      const result = parseError(new Error('Network error: connection refused'));
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.suggestion).toBeDefined();
    });

    it('should parse timeout errors as network errors', () => {
      const result = parseError(new Error('ETIMEDOUT'));
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('should parse connection refused as network error', () => {
      const result = parseError('ECONNREFUSED');
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('should parse download errors', () => {
      const result = parseError(new Error('Download failed: 404'));
      expect(result.code).toBe('DOWNLOAD_ERROR');
    });

    it('should parse permission denied errors', () => {
      const result = parseError(new Error('elevated privileges required'));
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('should parse administrator/sudo errors as permission denied', () => {
      const result = parseError('Requires administrator privileges');
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('should parse version not found errors', () => {
      const result = parseError(new Error('Version not found: 99.0.0'));
      expect(result.code).toBe('VERSION_NOT_FOUND');
    });

    it('should parse package not found errors', () => {
      const result = parseError('Package not found: nonexistent-pkg');
      expect(result.code).toBe('PACKAGE_NOT_FOUND');
    });

    it('should parse installation errors', () => {
      const result = parseError(new Error('Installation failed: disk full'));
      expect(result.code).toBe('INSTALLATION_ERROR');
    });

    it('should parse checksum mismatch errors', () => {
      const result = parseError('Checksum mismatch: expected abc123');
      expect(result.code).toBe('CHECKSUM_MISMATCH');
    });

    it('should parse cancelled errors', () => {
      const result = parseError(new Error('Operation cancelled by user'));
      expect(result.code).toBe('CANCELLED');
    });

    it('should parse provider not found errors', () => {
      const result = parseError('Provider not found: fnm');
      expect(result.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('should parse configuration errors', () => {
      const result = parseError(new Error('Configuration error: invalid JSON'));
      expect(result.code).toBe('CONFIG_ERROR');
    });

    it('should parse dependency resolution errors', () => {
      const result = parseError('Dependency resolution failed');
      expect(result.code).toBe('RESOLUTION_ERROR');
    });

    it('should parse dependency conflict errors', () => {
      const result = parseError(new Error('Dependency conflict detected'));
      expect(result.code).toBe('CONFLICT_ERROR');
    });

    it('should parse platform not supported errors', () => {
      const result = parseError('Platform not supported: Windows ARM');
      expect(result.code).toBe('PLATFORM_NOT_SUPPORTED');
    });

    it('should parse IO errors', () => {
      const result = parseError(new Error('IO error: file not found'));
      expect(result.code).toBe('IO_ERROR');
    });

    it('should parse database errors', () => {
      const result = parseError('Database error: corrupted index');
      expect(result.code).toBe('DATABASE_ERROR');
    });

    it('should parse parse errors', () => {
      const result = parseError(new Error('Parse error: invalid JSON'));
      expect(result.code).toBe('PARSE_ERROR');
    });

    it('should return unknown error for unrecognized errors', () => {
      const result = parseError(new Error('Some random error'));
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.suggestion).toBeDefined();
    });

    it('should handle string errors', () => {
      const result = parseError('Network error occurred');
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.message).toBe('Network error occurred');
    });

    it('should handle non-Error objects', () => {
      const result = parseError({ message: 'Custom object' });
      expect(result.message).toBeDefined();
    });
  });

  describe('formatError', () => {
    it('should format error with suggestion', () => {
      const formatted = formatError(new Error('Network error'));
      expect(formatted).toContain('Network error');
      expect(formatted).toContain('💡');
    });

    it('should include the original message', () => {
      const formatted = formatError('Download failed');
      expect(formatted).toContain('Download failed');
    });
  });

  describe('isRecoverableError', () => {
    it('should return true for network errors', () => {
      expect(isRecoverableError(new Error('Network error'))).toBe(true);
    });

    it('should return true for download errors', () => {
      expect(isRecoverableError('Download failed')).toBe(true);
    });

    it('should return true for installation errors', () => {
      expect(isRecoverableError(new Error('Installation failed'))).toBe(true);
    });

    it('should return false for cancelled errors', () => {
      expect(isRecoverableError('Operation cancelled')).toBe(false);
    });

    it('should return false for platform not supported', () => {
      expect(isRecoverableError(new Error('Platform not supported'))).toBe(false);
    });

    it('should return false for internal errors', () => {
      expect(isRecoverableError('Internal error occurred')).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      expect(isNetworkError(new Error('Network error'))).toBe(true);
    });

    it('should return true for download errors', () => {
      expect(isNetworkError('Download failed')).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(isNetworkError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should return false for permission errors', () => {
      expect(isNetworkError('Permission denied')).toBe(false);
    });

    it('should return false for installation errors', () => {
      expect(isNetworkError(new Error('Installation failed'))).toBe(false);
    });
  });

  describe('requiresElevation', () => {
    it('should return true for permission denied errors', () => {
      expect(requiresElevation(new Error('elevated privileges required'))).toBe(true);
    });

    it('should return true for administrator required errors', () => {
      expect(requiresElevation('Requires administrator')).toBe(true);
    });

    it('should return true for sudo errors', () => {
      expect(requiresElevation(new Error('Need sudo access'))).toBe(true);
    });

    it('should return false for network errors', () => {
      expect(requiresElevation('Network error')).toBe(false);
    });

    it('should return false for installation errors', () => {
      expect(requiresElevation(new Error('Installation failed'))).toBe(false);
    });
  });

  describe('ERROR_I18N_KEYS', () => {
    it('should have keys for all error codes', () => {
      const errorCodes: ErrorCode[] = [
        'CONFIG_ERROR',
        'PROVIDER_ERROR',
        'PROVIDER_NOT_FOUND',
        'PACKAGE_NOT_FOUND',
        'VERSION_NOT_FOUND',
        'VERSION_NOT_INSTALLED',
        'RESOLUTION_ERROR',
        'CONFLICT_ERROR',
        'INSTALLATION_ERROR',
        'CHECKSUM_MISMATCH',
        'DOWNLOAD_ERROR',
        'NETWORK_ERROR',
        'IO_ERROR',
        'DATABASE_ERROR',
        'PARSE_ERROR',
        'PLATFORM_NOT_SUPPORTED',
        'PERMISSION_DENIED',
        'CANCELLED',
        'INTERNAL_ERROR',
        'UNKNOWN_ERROR',
      ];

      for (const code of errorCodes) {
        expect(ERROR_I18N_KEYS[code]).toBeDefined();
        expect(typeof ERROR_I18N_KEYS[code]).toBe('string');
      }
    });

    it('should have valid i18n key format', () => {
      Object.values(ERROR_I18N_KEYS).forEach((key) => {
        expect(key).toMatch(/^errors\./);
      });
    });
  });

  describe('CogniaError type', () => {
    it('should allow creating error objects', () => {
      const error: CogniaError = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        suggestion: 'Check your internet connection',
      };
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('Connection failed');
      expect(error.suggestion).toBe('Check your internet connection');
    });

    it('should allow optional details', () => {
      const error: CogniaError = {
        code: 'INSTALLATION_ERROR',
        message: 'Failed to install',
        details: 'Disk space: 0 bytes remaining',
      };
      expect(error.details).toBe('Disk space: 0 bytes remaining');
    });
  });
});
