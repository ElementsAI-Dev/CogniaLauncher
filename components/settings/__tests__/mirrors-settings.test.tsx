import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MirrorsSettings } from '../mirrors-settings';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'settings.mirrors': 'Mirrors',
    'settings.mirrorsDesc': 'Configure package registry mirrors for faster downloads',
    'settings.npmRegistry': 'NPM Registry',
    'settings.npmRegistryDesc': 'NPM package registry URL',
    'settings.pypiIndex': 'PyPI Index',
    'settings.pypiIndexDesc': 'Python package index URL',
  };
  return translations[key] || key;
};

describe('MirrorsSettings', () => {
  const defaultProps = {
    localConfig: {
      'mirrors.npm': 'https://registry.npmjs.org',
      'mirrors.pypi': 'https://pypi.org/simple',
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render mirrors settings card', () => {
    render(<MirrorsSettings {...defaultProps} />);

    expect(screen.getByText('Mirrors')).toBeInTheDocument();
    expect(
      screen.getByText('Configure package registry mirrors for faster downloads')
    ).toBeInTheDocument();
  });

  it('should render NPM registry setting', () => {
    render(<MirrorsSettings {...defaultProps} />);

    expect(screen.getByText('NPM Registry')).toBeInTheDocument();
    expect(screen.getByText('NPM package registry URL')).toBeInTheDocument();
  });

  it('should render PyPI index setting', () => {
    render(<MirrorsSettings {...defaultProps} />);

    expect(screen.getByText('PyPI Index')).toBeInTheDocument();
  });

  it('should display current mirror URLs', () => {
    render(<MirrorsSettings {...defaultProps} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('https://registry.npmjs.org');
    expect(inputs[1]).toHaveValue('https://pypi.org/simple');
  });

  it('should call onValueChange when NPM registry is changed', () => {
    const onValueChange = jest.fn();
    render(<MirrorsSettings {...defaultProps} onValueChange={onValueChange} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], {
      target: { value: 'https://registry.npmmirror.com' },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      'mirrors.npm',
      'https://registry.npmmirror.com'
    );
  });

  it('should call onValueChange when PyPI index is changed', () => {
    const onValueChange = jest.fn();
    render(<MirrorsSettings {...defaultProps} onValueChange={onValueChange} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], {
      target: { value: 'https://pypi.tuna.tsinghua.edu.cn/simple' },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      'mirrors.pypi',
      'https://pypi.tuna.tsinghua.edu.cn/simple'
    );
  });

  it('should display validation errors for invalid URLs', () => {
    const errors = {
      'mirrors.npm': 'Must be a valid URL',
    };
    render(<MirrorsSettings {...defaultProps} errors={errors} />);

    expect(screen.getByText('Must be a valid URL')).toBeInTheDocument();
  });
});
