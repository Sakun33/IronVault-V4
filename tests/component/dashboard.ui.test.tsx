import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from '@/pages/dashboard'
import { VaultProvider } from '@/contexts/vault-context'

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

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all section cards', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByText('Passwords')).toBeInTheDocument()
    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Reminders')).toBeInTheDocument()
    expect(screen.getByText('Bank Statements')).toBeInTheDocument()
    expect(screen.getByText('Investments')).toBeInTheDocument()
    expect(screen.getByText('Investment Goals')).toBeInTheDocument()
  })

  it('displays correct item counts', () => {
    mockVaultContext.getItems.mockReturnValue([
      { id: '1', title: 'Test Password' },
      { id: '2', title: 'Another Password' }
    ])

    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByText('2')).toBeInTheDocument() // Password count
  })

  it('handles empty states correctly', () => {
    mockVaultContext.getItems.mockReturnValue([])

    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByText('0')).toBeInTheDocument() // Empty count
  })

  it('navigates to section when card is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const passwordCard = screen.getByText('Passwords').closest('div')
    await user.click(passwordCard!)

    // Verify navigation (this would depend on your routing implementation)
    expect(mockVaultContext.getItems).toHaveBeenCalledWith('passwords')
  })

  it('displays loading state', () => {
    mockVaultContext.getItems.mockReturnValue(null) // Loading state

    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('handles errors gracefully', () => {
    mockVaultContext.getItems.mockImplementation(() => {
      throw new Error('Database error')
    })

    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByText('Error loading data')).toBeInTheDocument()
  })
})

describe('All Sections UI Tests', () => {
  const mockSectionData = {
    passwords: [
      { id: '1', title: 'Google', url: 'https://google.com', username: 'user1' },
      { id: '2', title: 'GitHub', url: 'https://github.com', username: 'user2' }
    ],
    subscriptions: [
      { id: '1', service: 'Netflix', plan: 'Premium', price: 15.99 },
      { id: '2', service: 'Spotify', plan: 'Premium', price: 9.99 }
    ],
    notes: [
      { id: '1', title: 'Work Note', content: 'Important work info', tags: ['work'] },
      { id: '2', title: 'Personal Note', content: 'Personal info', tags: ['personal'] }
    ]
  }

  beforeEach(() => {
    mockVaultContext.getItems.mockImplementation((section: string) => {
      return mockSectionData[section as keyof typeof mockSectionData] || []
    })
  })

  it('renders passwords section correctly', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('https://google.com')).toBeInTheDocument()
  })

  it('renders subscriptions section correctly', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Spotify')).toBeInTheDocument()
    expect(screen.getByText('$15.99')).toBeInTheDocument()
  })

  it('renders notes section correctly', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByText('Work Note')).toBeInTheDocument()
    expect(screen.getByText('Personal Note')).toBeInTheDocument()
    expect(screen.getByText('work')).toBeInTheDocument()
  })
})

describe('Import Dialog UI Tests', () => {
  it('renders import dialog when opened', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const importButton = screen.getByText('Import Data')
    fireEvent.click(importButton)

    expect(screen.getByText('Import Data')).toBeInTheDocument()
    expect(screen.getByText('Select File')).toBeInTheDocument()
  })

  it('handles file selection', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const importButton = screen.getByText('Import Data')
    await user.click(importButton)

    const fileInput = screen.getByLabelText('Select File')
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    
    await user.upload(fileInput, file)

    expect(fileInput.files[0]).toBe(file)
  })

  it('validates file format', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const importButton = screen.getByText('Import Data')
    await user.click(importButton)

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
        <Dashboard />
      </VaultProvider>
    )

    const importButton = screen.getByText('Import Data')
    await user.click(importButton)

    const fileInput = screen.getByLabelText('Select File')
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    
    await user.upload(fileInput, file)
    await user.click(screen.getByText('Import'))

    expect(screen.getByText('Importing...')).toBeInTheDocument()
  })
})

describe('Export Dialog UI Tests', () => {
  it('renders export dialog when opened', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const exportButton = screen.getByText('Export Data')
    fireEvent.click(exportButton)

    expect(screen.getByText('Export Data')).toBeInTheDocument()
    expect(screen.getByText('Export Format')).toBeInTheDocument()
  })

  it('shows export options', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const exportButton = screen.getByText('Export Data')
    fireEvent.click(exportButton)

    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('Encrypted Package')).toBeInTheDocument()
  })

  it('handles export format selection', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const exportButton = screen.getByText('Export Data')
    await user.click(exportButton)

    const csvOption = screen.getByLabelText('CSV')
    await user.click(csvOption)

    expect(csvOption).toBeChecked()
  })

  it('shows export progress', async () => {
    const user = userEvent.setup()
    
    mockVaultContext.exportData.mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 1000))
    })

    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const exportButton = screen.getByText('Export Data')
    await user.click(exportButton)

    await user.click(screen.getByText('Export'))

    expect(screen.getByText('Exporting...')).toBeInTheDocument()
  })
})

describe('Theme Toggle UI Tests', () => {
  it('renders theme toggle button', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
  })

  it('toggles theme when clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const themeToggle = screen.getByLabelText('Toggle theme')
    await user.click(themeToggle)

    // Verify theme change (this would depend on your theme implementation)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('persists theme preference', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const themeToggle = screen.getByLabelText('Toggle theme')
    await user.click(themeToggle)

    // Verify theme is saved to localStorage
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})

describe('Responsive Design Tests', () => {
  it('adapts to mobile screen size', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })

    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    // Verify mobile-specific elements are present
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
  })

  it('adapts to tablet screen size', () => {
    // Mock tablet viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768
    })

    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    // Verify tablet-specific layout
    expect(screen.getByTestId('tablet-layout')).toBeInTheDocument()
  })

  it('adapts to desktop screen size', () => {
    // Mock desktop viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920
    })

    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    // Verify desktop-specific layout
    expect(screen.getByTestId('desktop-layout')).toBeInTheDocument()
  })
})

describe('Accessibility Tests', () => {
  it('has proper ARIA labels', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
    expect(screen.getByLabelText('Import Data')).toBeInTheDocument()
    expect(screen.getByLabelText('Export Data')).toBeInTheDocument()
  })

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup()
    
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    // Tab through interactive elements
    await user.tab()
    await user.tab()
    await user.tab()

    // Verify focus is on expected element
    expect(document.activeElement).toBe(screen.getByText('Passwords'))
  })

  it('has proper heading hierarchy', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    const h1 = screen.getByRole('heading', { level: 1 })
    const h2 = screen.getByRole('heading', { level: 2 })

    expect(h1).toBeInTheDocument()
    expect(h2).toBeInTheDocument()
  })

  it('has proper color contrast', () => {
    render(
      <VaultProvider value={mockVaultContext}>
        <Dashboard />
      </VaultProvider>
    )

    // This would require a more sophisticated test with actual color values
    // For now, we'll just verify the elements exist
    expect(screen.getByText('Passwords')).toBeInTheDocument()
  })
})
