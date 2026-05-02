// OCR Service for Offline Document Scanning
// Handles OCR processing using Tesseract.js for offline text extraction

export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
  blocks: OCRBlock[];
  processingTime: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OCRLine {
  text: string;
  confidence: number;
  words: OCRWord[];
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OCRBlock {
  text: string;
  confidence: number;
  lines: OCRLine[];
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface ScanResult {
  image: string; // Base64 encoded image
  ocrResult: OCRResult;
  documentType: 'text' | 'form' | 'receipt' | 'invoice' | 'contract' | 'other';
  extractedData?: {
    title?: string;
    date?: string;
    amount?: number;
    currency?: string;
    items?: Array<{
      description: string;
      quantity: number;
      price: number;
    }>;
  };
}

export class OCRService {
  private static instance: OCRService;
  private tesseractWorker: any = null;
  private isInitialized: boolean = false;
  private supportedLanguages: string[] = ['eng']; // Default to English

  private constructor() {}

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  // Initialize Tesseract.js worker
  public async initialize(): Promise<void> {
    try {
      // Dynamic import of Tesseract.js. v5 API: createWorker(lang) loads and
      // initialises the language in one call — loadLanguage/initialize were
      // removed in v3 and break the Documents page on initial mount.
      const { createWorker } = await import('tesseract.js');
      this.tesseractWorker = await createWorker('eng');
      this.isInitialized = true;
      console.log('OCR Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCR service:', error);
      throw new Error('OCR service initialization failed');
    }
  }

  // Process image with OCR
  public async processImage(imageData: string | File | HTMLImageElement): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.tesseractWorker) {
      throw new Error('OCR worker not initialized');
    }

    const startTime = Date.now();

    try {
      // Process the image
      const { data } = await this.tesseractWorker.recognize(imageData);
      
      const processingTime = Date.now() - startTime;

      // Transform Tesseract result to our format
      const result: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        words: data.words.map((word: any) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1
          }
        })),
        lines: data.lines.map((line: any) => ({
          text: line.text,
          confidence: line.confidence,
          words: line.words.map((word: any) => ({
            text: word.text,
            confidence: word.confidence,
            bbox: {
              x0: word.bbox.x0,
              y0: word.bbox.y0,
              x1: word.bbox.x1,
              y1: word.bbox.y1
            }
          })),
          bbox: {
            x0: line.bbox.x0,
            y0: line.bbox.y0,
            x1: line.bbox.x1,
            y1: line.bbox.y1
          }
        })),
        blocks: data.blocks.map((block: any) => ({
          text: block.text,
          confidence: block.confidence,
          lines: block.lines.map((line: any) => ({
            text: line.text,
            confidence: line.confidence,
            words: line.words.map((word: any) => ({
              text: word.text,
              confidence: word.confidence,
              bbox: {
                x0: word.bbox.x0,
                y0: word.bbox.y0,
                x1: word.bbox.x1,
                y1: word.bbox.y1
              }
            })),
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1
            }
          })),
          bbox: {
            x0: block.bbox.x0,
            y0: block.bbox.y0,
            x1: block.bbox.x1,
            y1: block.bbox.y1
          }
        })),
        processingTime
      };

      return result;
    } catch (error) {
      console.error('OCR processing error:', error);
      throw new Error('OCR processing failed');
    }
  }

  // Scan document from camera
  public async scanDocument(): Promise<ScanResult> {
    try {
      // Get camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });

      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Capture image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx?.drawImage(video, 0, 0);
      
      // Stop camera
      stream.getTracks().forEach(track => track.stop());
      
      // Convert to base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      // Process with OCR
      const ocrResult = await this.processImage(imageData);
      
      // Determine document type
      const documentType = this.detectDocumentType(ocrResult.text);
      
      // Extract structured data
      const extractedData = this.extractStructuredData(ocrResult.text, documentType);
      
      return {
        image: imageData,
        ocrResult,
        documentType,
        extractedData
      };
    } catch (error) {
      console.error('Document scanning error:', error);
      throw new Error('Document scanning failed');
    }
  }

  // Detect document type based on OCR text
  private detectDocumentType(text: string): ScanResult['documentType'] {
    const lowerText = text.toLowerCase();
    
    // Check for receipt indicators
    if (lowerText.includes('receipt') || 
        lowerText.includes('total:') || 
        lowerText.includes('subtotal:') ||
        lowerText.includes('tax:')) {
      return 'receipt';
    }
    
    // Check for invoice indicators
    if (lowerText.includes('invoice') || 
        lowerText.includes('bill to:') || 
        lowerText.includes('amount due:')) {
      return 'invoice';
    }
    
    // Check for contract indicators
    if (lowerText.includes('contract') || 
        lowerText.includes('agreement') || 
        lowerText.includes('terms and conditions')) {
      return 'contract';
    }
    
    // Check for form indicators
    if (lowerText.includes('form') || 
        lowerText.includes('application') || 
        lowerText.includes('please fill')) {
      return 'form';
    }
    
    return 'other';
  }

  // Extract structured data from OCR text
  private extractStructuredData(text: string, documentType: ScanResult['documentType']): ScanResult['extractedData'] {
    const extractedData: ScanResult['extractedData'] = {};
    
    // Extract title (first line or first few words)
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      extractedData.title = lines[0].trim();
    }
    
    // Extract date
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      extractedData.date = dateMatch[0];
    }
    
    // Extract amount and currency
    const amountRegex = /(\$|€|£|¥|₹)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
    const amountMatches = text.match(amountRegex);
    if (amountMatches) {
      const amount = amountMatches[amountMatches.length - 1]; // Usually the total
      const currencyMatch = amount.match(/(\$|€|£|¥|₹)/);
      const numberMatch = amount.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      
      if (currencyMatch) {
        extractedData.currency = currencyMatch[1];
      }
      if (numberMatch) {
        extractedData.amount = parseFloat(numberMatch[1].replace(/,/g, ''));
      }
    }
    
    // Extract items for receipts/invoices
    if (documentType === 'receipt' || documentType === 'invoice') {
      extractedData.items = this.extractItems(text);
    }
    
    return extractedData;
  }

  // Extract items from receipt/invoice text
  private extractItems(text: string): Array<{ description: string; quantity: number; price: number }> {
    const items: Array<{ description: string; quantity: number; price: number }> = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Look for lines with price patterns
      const priceMatch = line.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)$/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        const description = line.replace(priceMatch[0], '').trim();
        
        if (description.length > 0 && price > 0) {
          // Try to extract quantity
          const quantityMatch = description.match(/^(\d+)\s+/);
          const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
          const cleanDescription = quantityMatch ? description.replace(quantityMatch[0], '').trim() : description;
          
          items.push({
            description: cleanDescription,
            quantity,
            price
          });
        }
      }
    }
    
    return items;
  }

  // Load additional language packs
  public async loadLanguage(languageCode: string): Promise<void> {
    if (!this.tesseractWorker) {
      await this.initialize();
    }

    try {
      await this.tesseractWorker.loadLanguage(languageCode);
      await this.tesseractWorker.initialize(languageCode);
      
      if (!this.supportedLanguages.includes(languageCode)) {
        this.supportedLanguages.push(languageCode);
      }
      
      console.log(`Language ${languageCode} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load language ${languageCode}:`, error);
      throw new Error(`Failed to load language ${languageCode}`);
    }
  }

  // Get supported languages
  public getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  // Clean up resources
  public async cleanup(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
      this.isInitialized = false;
    }
  }

  // Check if OCR is available
  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           typeof window.Worker !== 'undefined' &&
           typeof window.createImageBitmap !== 'undefined';
  }
}

// Export singleton instance
export const ocrService = OCRService.getInstance();

// Utility function to check camera availability
export async function isCameraAvailable(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(device => device.kind === 'videoinput');
  } catch (error) {
    return false;
  }
}

// Utility function to check if we're in a secure context for camera access
export function canAccessCamera(): boolean {
  return typeof window !== 'undefined' && 
         window.isSecureContext && 
         typeof navigator.mediaDevices !== 'undefined' &&
         typeof navigator.mediaDevices.getUserMedia === 'function';
}
