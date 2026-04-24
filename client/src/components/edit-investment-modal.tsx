import { useState, useEffect } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useLogging } from '@/contexts/logging-context';
import { useToast } from '@/hooks/use-toast';
import { Investment } from '@shared/schema';

interface EditInvestmentModalProps {
  investment: Investment | null;
  isOpen: boolean;
  onClose: () => void;
  onInvestmentUpdated?: () => void;
}

export function EditInvestmentModal({ investment, isOpen, onClose, onInvestmentUpdated }: EditInvestmentModalProps) {
  const { updateInvestment } = useVault();
  const { addLog } = useLogging();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState('');

  // Update current price when investment changes
  useEffect(() => {
    if (investment) {
      setCurrentPrice(investment.currentPrice?.toString() || '');
    }
  }, [investment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!investment) return;
    
    if (!currentPrice || isNaN(parseFloat(currentPrice))) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid current price.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const newCurrentPrice = parseFloat(currentPrice);
      const updates = {
        currentPrice: newCurrentPrice,
        currentValue: newCurrentPrice * investment.quantity,
        updatedAt: new Date()
      };

      await updateInvestment(investment.id, updates);
      
      addLog('Investment updated', 'system', `Updated current price for ${investment.name} to ${currentPrice}`);
      
      toast({
        title: "Investment Updated",
        description: `Current price updated for ${investment.name} to $${currentPrice}.`,
      });

      onClose();
      onInvestmentUpdated?.();
      
    } catch (error) {
      console.error('Failed to update investment:', error);
      addLog('Investment update failed', 'system', `Failed to update investment: ${investment.name}`);
      
      toast({
        title: "Error",
        description: "Failed to update investment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !investment) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[10000] p-5"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-card rounded-xl p-8 max-w-lg w-full shadow-2xl border border-border"
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid #e5e7eb'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            margin: '0 0 10px 0',
            color: '#1f2937'
          }}>
            ✏️ Edit Investment
          </h2>
          <p style={{ 
            fontSize: '16px', 
            color: '#6b7280',
            margin: 0
          }}>
            Update current price for: <strong>{investment.name}</strong>
          </p>
          <div style={{
            backgroundColor: '#f3f4f6',
            padding: '10px',
            borderRadius: '6px',
            marginTop: '10px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            DEBUG: Modal is rendering! Investment ID: {investment.id}
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '8px'
            }}>
              Current Price per Unit ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              placeholder="0.00"
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            <p style={{ 
              fontSize: '12px', 
              color: '#6b7280',
              margin: '4px 0 0 0'
            }}>
              Current value will be: ${currentPrice ? (parseFloat(currentPrice) * investment.quantity).toFixed(2) : '0.00'}
            </p>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '12px',
            marginTop: '30px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '10px 20px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: isLoading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Updating...' : 'Update Price'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}