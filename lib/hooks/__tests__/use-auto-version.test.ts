import { renderHook } from '@testing-library/react';
import { useProjectPath } from '../use-auto-version';

describe('useProjectPath', () => {
  it('should return null project path by default', () => {
    const { result } = renderHook(() => useProjectPath());

    expect(result.current.projectPath).toBeNull();
  });

  it('should provide setProjectPath function', () => {
    const { result } = renderHook(() => useProjectPath());

    expect(typeof result.current.setProjectPath).toBe('function');
  });

  it('should not throw when calling setProjectPath', () => {
    const { result } = renderHook(() => useProjectPath());

    // Should not throw (placeholder function)
    expect(() => {
      result.current.setProjectPath('/new/path');
    }).not.toThrow();
  });
});
