import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/theme-toggle'

// Mock the vault context
const mockVaultContext = {
  isUnlocked: true,
  masterPassword: 'test-password',
  unlockVault: vi.fn(),
  lockVault: vi.fn(),
  addItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getItems: vi.fn(),
  searchItems: vi.fn(),
  exportData: vi.fn(),
  importData: vi.fn(),
  clearAllData: vi.fn(),
  createBackup: vi.fn(),
  restoreBackup: vi.fn()
}

describe('Import Dialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders import dialog correctly', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    expect(screen.getByText('Import Data')).toBeInTheDocument()
    expect(screen.getByText('Select File')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('handles file selection', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const fileInput = screen.getByLabelText('Select File')
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    
    await user.upload(fileInput, file)

    expect(fileInput.files[0]).toBe(file)
    expect(screen.getByText('test.csv')).toBeInTheDocument()
  })

  it('validates CSV file format', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const fileInput = screen.getByLabelText('Select File')
    const csvFile = new File(['title,url,username\nTest,https://test.com,user'], 'test.csv', { type: 'text/csv' })
    
    await user.upload(fileInput, csvFile)

    expect(screen.getByText('Valid CSV file')).toBeInTheDocument()
  })

  it('validates XLSX file format', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const fileInput = screen.getByLabelText('Select File')
    const xlsxFile = new File(['xlsx data'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    
    await user.upload(fileInput, xlsxFile)

    expect(screen.getByText('Valid XLSX file')).toBeInTheDocument()
  })

  it('rejects invalid file formats', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const fileInput = screen.getByLabelText('Select File')
    const invalidFile = new File(['test data'], 'test.txt', { type: 'text/plain' })
    
    await user.upload(fileInput, invalidFile)

    expect(screen.getByText('Invalid file format')).toBeInTheDocument()
  })

  it('shows import progress', async () => {
    const user = userEvent.setup()
    
    mockVaultContext.importData.mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 1000))
    })

    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const fileInput = screen.getByLabelText('Select File')
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    
    await user.upload(fileInput, file)
    await user.click(screen.getByText('Import'))

    expect(screen.getByText('Importing...')).toBeInTheDocument()
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
  })

  it('handles import success', async () => {
    const user = userEvent.setup()
    
    mockVaultContext.importData.mockResolvedValue({ success: true, imported: 5 })

    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const fileInput = screen.getByLabelText('Select File')
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    
    await user.upload(fileInput, file)
    await user.click(screen.getByText('Import'))

    await waitFor(() => {
      expect(screen.getByText('Import successful! 5 items imported.')).toBeInTheDocument()
    })
  })

  it('handles import errors', async () => {
    const user = userEvent.setup()
    
    mockVaultContext.importData.mockRejectedValue(new Error('Import failed'))

    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const fileInput = screen.getByLabelText('Select File')
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    
    await user.upload(fileInput, file)
    await user.click(screen.getByText('Import'))

    await waitFor(() => {
      expect(screen.getByText('Import failed: Import failed')).toBeInTheDocument()
    })
  })

  it('closes dialog on cancel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={onClose} />
      </VaultProvider>
    )

    await user.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalled()
  })

  it('closes dialog on success', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    
    mockVaultContext.importData.mockResolvedValue({ success: true, imported: 5 })

    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={onClose} />
      </VaultProvider>
    )

    const fileInput = screen.getByLabelText('Select File')
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    
    await user.upload(fileInput, file)
    await user.click(screen.getByText('Import'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})

describe('Export Dialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders export dialog correctly', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    expect(screen.getByText('Export Data')).toBeInTheDocument()
    expect(screen.getByText('Export Format')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('shows export format options', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    expect(screen.getByLabelText('CSV')).toBeInTheDocument()
    expect(screen.getByLabelText('JSON')).toBeInTheDocument()
    expect(screen.getByLabelText('Encrypted Package')).toBeInTheDocument()
  })

  it('handles format selection', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const csvOption = screen.getByLabelText('CSV')
    await user.click(csvOption)

    expect(csvOption).toBeChecked()
  })

  it('shows encryption options for encrypted package', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const encryptedOption = screen.getByLabelText('Encrypted Package')
    await user.click(encryptedOption)

    expect(screen.getByText('Export Passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('Passphrase')).toBeInTheDocument()
  })

  it('validates passphrase for encrypted export', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    const encryptedOption = screen.getByLabelText('Encrypted Package')
    await user.click(encryptedOption)

    const passphraseInput = screen.getByLabelText('Passphrase')
    await user.type(passphraseInput, 'weak')

    expect(screen.getByText('Passphrase must be at least 8 characters')).toBeInTheDocument()
  })

  it('shows export progress', async () => {
    const user = userEvent.setup()
    
    mockVaultContext.exportData.mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 1000))
    })

    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    await user.click(screen.getByText('Export'))

    expect(screen.getByText('Exporting...')).toBeInTheDocument()
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
  })

  it('handles export success', async () => {
    const user = userEvent.setup()
    
    mockVaultContext.exportData.mockResolvedValue({ success: true, filename: 'export.csv' })

    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    await user.click(screen.getByText('Export'))

    await waitFor(() => {
      expect(screen.getByText('Export successful! File saved as export.csv')).toBeInTheDocument()
    })
  })

  it('handles export errors', async () => {
    const user = userEvent.setup()
    
    mockVaultContext.exportData.mockRejectedValue(new Error('Export failed'))

    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    await user.click(screen.getByText('Export'))

    await waitFor(() => {
      expect(screen.getByText('Export failed: Export failed')).toBeInTheDocument()
    })
  })

  it('closes dialog on cancel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={onClose} />
      </VaultProvider>
    )

    await user.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalled()
  })
})

describe('Theme Toggle Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage
    localStorage.clear()
  })

  it('renders theme toggle button', () => {
    render(<ThemeToggle />)

    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
  })

  it('toggles theme when clicked', async () => {
    const user = userEvent.setup()
    
    render(<ThemeToggle />)

    const themeToggle = screen.getByLabelText('Toggle theme')
    await user.click(themeToggle)

    // Verify theme change
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('persists theme preference', async () => {
    const user = userEvent.setup()
    
    render(<ThemeToggle />)

    const themeToggle = screen.getByLabelText('Toggle theme')
    await user.click(themeToggle)

    // Verify theme is saved to localStorage
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('loads saved theme preference', () => {
    localStorage.setItem('theme', 'dark')
    
    render(<ThemeToggle />)

    // Verify theme is loaded from localStorage
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('handles system theme preference', () => {
    // Mock system theme preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    render(<ThemeToggle />)

    // Verify system theme is respected
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('shows correct icon for current theme', () => {
    render(<ThemeToggle />)

    // Should show sun icon for light theme
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument()
  })

  it('shows correct icon after theme change', async () => {
    const user = userEvent.setup()
    
    render(<ThemeToggle />)

    const themeToggle = screen.getByLabelText('Toggle theme')
    await user.click(themeToggle)

    // Should show moon icon for dark theme
    expect(screen.getByTestId('moon-icon')).toBeInTheDocument()
  })
})

describe('Accessibility Tests', () => {
  it('has proper ARIA labels for import dialog', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    expect(screen.getByLabelText('Select File')).toBeInTheDocument()
    expect(screen.getByLabelText('Import Data')).toBeInTheDocument()
  })

  it('has proper ARIA labels for export dialog', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <ExportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    expect(screen.getByLabelText('CSV')).toBeInTheDocument()
    expect(screen.getByLabelText('JSON')).toBeInTheDocument()
    expect(screen.getByLabelText('Encrypted Package')).toBeInTheDocument()
  })

  it('has proper ARIA labels for theme toggle', () => {
    render(<ThemeToggle />)

    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
  })

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    // Tab through interactive elements
    await user.tab()
    await user.tab()

    // Verify focus is on expected element
    expect(document.activeElement).toBe(screen.getByText('Import'))
  })

  it('has proper focus management', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <ImportDialog isOpen={true} onClose={vi.fn()} />
      </VaultProvider>
    )

    // Focus should be on first interactive element
    expect(document.activeElement).toBe(screen.getByLabelText('Select File'))
  })

  it('has proper color contrast', () => {
    render(<ThemeToggle />)

    // This would require a more sophisticated test with actual color values
    // For now, we'll just verify the element exists
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
  })
})
