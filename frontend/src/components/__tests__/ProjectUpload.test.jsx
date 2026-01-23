import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectUpload from '../ProjectUpload';

describe('ProjectUpload', () => {
  test('renders the create project form', () => {
    render(<ProjectUpload />);

    expect(screen.getByText(/Create New Project/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Subdivision A - Phase 1/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Project notes and details/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF Plat File/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Project/i })).toBeInTheDocument();
  });
});
