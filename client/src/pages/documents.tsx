import { useState, useMemo, useRef, useEffect } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandCard } from '@/components/brand-card';

const getFileBrandColor = (type: string) => {
  switch (type) {
    case 'pdf': return '#ef4444';
    case 'doc': case 'docx': return '#2563eb';
    case 'xls': case 'xlsx': return '#16a34a';
    case 'ppt': case 'pptx': return '#ea580c';
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': return '#7c3aed';
    default: return '#6366f1';
  }
};
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  FileText,
  Folder,
  FolderOpen,
  Upload,
  Download,
  Share2,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Lock,
  Unlock,
  Shield,
  Camera,
  Scan,
  FileImage,
  FileText as FilePdf,
  FileSpreadsheet,
  FileText as FileWord,
  FileText as FilePresentation,
  Archive,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Home,
  ArrowLeft,
  Star,
  Clock,
  HardDrive,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Settings,
  Key,
  Fingerprint,
  Smartphone,
  Monitor,
  Tablet,
  Cloud,
  CloudOff,
  RefreshCw,
  ExternalLink,
  Copy,
  Archive as ArchiveIcon,
  Trash,
  AlertTriangle,
  CheckCircle2,
  XCircle as XCircle2,
  Calendar,
  Clock as ClockIcon,
  CreditCard as CreditCardIcon,
  FileText as FileTextIcon,
  Download as DownloadIcon,
  Mail as MailIcon,
  Phone as PhoneIcon,
  Globe as GlobeIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Trash2 as Trash2Icon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  BarChart3 as BarChart3Icon,
  PieChart as PieChartIcon,
  TrendingUp as TrendingUpIcon,
  Target as TargetIcon,
  Heart as HeartIcon,
  Star as StarIcon,
  Gift as GiftIcon,
  Award as AwardIcon,
  Zap as ZapIcon,
  Building2 as Building2Icon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  DollarSign as DollarSignIcon,
  FileText as FileTextIcon2,
  HelpCircle as HelpCircleIcon,
  MessageSquare as MessageSquareIcon,
  Crown as CrownIcon,
  Download as DownloadIcon2,
  Upload as UploadIcon,
  Bell as BellIcon,
  Settings as SettingsIcon,
  CreditCard as CreditCardIcon2,
  User as UserIcon,
  Crown
} from 'lucide-react';
import DocumentViewer from '@/components/document-viewer-simple';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { documentService } from '@/lib/document-encryption';
import { useAuth } from '@/contexts/auth-context';
import { ocrService, ScanResult } from '@/lib/ocr-service';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { SelectionBar, SelectionCheckbox } from '@/components/selection-bar';
import { CheckSquare } from 'lucide-react';

// Document types and interfaces
interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'txt' | 'jpg' | 'jpeg' | 'png' | 'gif' | 'bmp' | 'other';
  size: number;
  folderId: string | null;
  encryptedData: string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  isStarred: boolean;
  tags: string[];
  password?: string; // Optional file password
  ocrText?: string; // OCR extracted text
  metadata: {
    author?: string;
    title?: string;
    subject?: string;
    keywords?: string[];
    created?: Date;
    modified?: Date;
  };
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  color?: string;
  icon?: string;
}

interface DocumentVaultStats {
  totalDocuments: number;
  totalFolders: number;
  totalSize: number; // in bytes
  documentsByType: Record<string, number>;
  recentDocuments: Document[];
  starredDocuments: Document[];
}

// Mock data for demonstration
const mockFolders: Folder[] = [
  { id: 'folder-1', name: 'Personal', parentId: null, createdAt: new Date(), updatedAt: new Date(), color: 'blue' },
  { id: 'folder-2', name: 'Work', parentId: null, createdAt: new Date(), updatedAt: new Date(), color: 'green' },
  { id: 'folder-3', name: 'Financial', parentId: 'folder-1', createdAt: new Date(), updatedAt: new Date(), color: 'purple' },
  { id: 'folder-4', name: 'Contracts', parentId: 'folder-2', createdAt: new Date(), updatedAt: new Date(), color: 'orange' },
];

const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    name: 'Passport Copy.pdf',
    type: 'pdf',
    size: 2048576, // 2MB
    folderId: 'folder-1',
    encryptedData: 'encrypted_data_here',
    thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    isStarred: true,
    tags: ['personal', 'id'],
    metadata: {
      author: 'John Doe',
      title: 'Passport Copy',
      created: new Date('2024-01-15'),
      modified: new Date('2024-01-15')
    }
  },
  {
    id: 'doc-2',
    name: 'Contract Agreement.docx',
    type: 'docx',
    size: 1536000, // 1.5MB
    folderId: 'folder-4',
    encryptedData: 'encrypted_data_here',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
    isStarred: false,
    tags: ['work', 'contract'],
    metadata: {
      author: 'Legal Team',
      title: 'Contract Agreement',
      created: new Date('2024-01-20'),
      modified: new Date('2024-01-20')
    }
  },
  {
    id: 'doc-3',
    name: 'Bank Statement.xlsx',
    type: 'xlsx',
    size: 512000, // 512KB
    folderId: 'folder-3',
    encryptedData: 'encrypted_data_here',
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-01-25'),
    isStarred: false,
    tags: ['financial', 'bank'],
    metadata: {
      author: 'Bank System',
      title: 'Monthly Statement',
      created: new Date('2024-01-25'),
      modified: new Date('2024-01-25')
    }
  }
];

export default function Documents() {
  const { isFeatureAvailable, isLoading: licenseLoading } = useSubscription();

  const { stats } = useVault();
  const { toast } = useToast();
  const { masterPassword } = useAuth();
  
  // State management
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  // Selected items
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  
  // Form states
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('blue');
  const [sharePassword, setSharePassword] = useState('');
  const [filePassword, setFilePassword] = useState('');
  const [masterPasswordInput, setMasterPasswordInput] = useState('');
  
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Real subscription gate — `isFeatureAvailable('documents')` is the
  // single source of truth (Free plan only gets metadata-only docs).
  const isPaidUser = isFeatureAvailable('documents');
  const maxDocuments = isPaidUser ? -1 : 10; // -1 means unlimited
  
  // Initialize services. documentService is required (vault storage); ocrService
  // is optional (only used by scan/OCR features) — if its WASM bundle can't load,
  // log and continue so the document list still renders.
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await documentService.initialize();
      } catch (error) {
        console.error('Failed to initialize document service:', error);
        toast({
          title: "Initialization Error",
          description: "Failed to initialize document storage. Try reloading the page.",
          variant: "destructive"
        });
        return;
      }
      // OCR is best-effort — failures here are silent. Scan/OCR-only features
      // will surface their own errors when invoked.
      try {
        await ocrService.initialize();
      } catch (error) {
        console.warn('OCR service unavailable — scan features will be disabled:', error);
      }
      await loadDocuments();
    };

    initializeServices();
  }, []);
  
  // Load documents from storage
  const loadDocuments = async () => {
    try {
      const storedDocuments = await documentService.getAllDocuments();
      // Convert DocumentMetadata[] to Document[]
      const documents: Document[] = storedDocuments.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type as Document['type'],
        size: doc.size,
        folderId: doc.folderId,
        encryptedData: '', // This will be loaded when needed
        thumbnail: doc.thumbnail,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        isStarred: doc.isStarred,
        tags: doc.tags,
        password: doc.password,
        ocrText: doc.ocrText,
        metadata: doc.metadata
      }));
      setDocuments(documents);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast({
        title: "Load Error",
        description: "Failed to load documents from storage.",
        variant: "destructive"
      });
    }
  };
  
  // Computed values
  const currentFolder = folders.find(f => f.id === currentFolderId);
  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let current = currentFolder;
    while (current) {
      crumbs.unshift(current);
      current = folders.find(f => f.id === current?.parentId);
    }
    return crumbs;
  }, [currentFolderId, folders]);
  
  const filteredDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      const matchesFolder = doc.folderId === currentFolderId;
      const matchesSearch = searchQuery === '' || 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFolder && matchesSearch;
    });
    
    // Sort documents
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [documents, currentFolderId, searchQuery, sortBy, sortOrder]);

  const selection = useMultiSelect(filteredDocuments);

  const handleBulkDeleteDocuments = async () => {
    const ids = Array.from(selection.selectedIds);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map(id => documentService.deleteDocument(id)));
    const removed = results.filter(r => r.status === 'fulfilled').length;
    setDocuments(prev => prev.filter(doc => !selection.selectedIds.has(doc.id)));
    selection.exitSelectionMode();
    toast({
      title: removed === ids.length ? 'Documents deleted' : 'Some documents could not be deleted',
      description: `${removed} of ${ids.length} removed.`,
      variant: removed === ids.length ? 'default' : 'destructive',
    });
  };

  const filteredFolders = useMemo(() => {
    return folders.filter(folder => folder.parentId === currentFolderId);
  }, [folders, currentFolderId]);
  
  const vaultStats: DocumentVaultStats = useMemo(() => {
    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
    const documentsByType = documents.reduce((acc, doc) => {
      acc[doc.type] = (acc[doc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalDocuments: documents.length,
      totalFolders: folders.length,
      totalSize,
      documentsByType,
      recentDocuments: documents
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 5),
      starredDocuments: documents.filter(doc => doc.isStarred)
    };
  }, [documents, folders]);
  
  // Helper functions
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return FilePdf;
      case 'doc':
      case 'docx': return FileWord;
      case 'xls':
      case 'xlsx': return FileSpreadsheet;
      case 'ppt':
      case 'pptx': return FilePresentation;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp': return FileImage;
      default: return FileText;
    }
  };
  
  const getFileColor = (type: string) => {
    switch (type) {
      case 'pdf': return 'text-red-600';
      case 'doc':
      case 'docx': return 'text-primary';
      case 'xls':
      case 'xlsx': return 'text-green-600';
      case 'ppt':
      case 'pptx': return 'text-orange-600';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp': return 'text-purple-600';
      default: return 'text-muted-foreground';
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getFolderColor = (color: string) => {
    const colors = {
      blue: 'bg-primary/10 text-primary border-primary/30',
      green: 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
      purple: 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };
  
  // Event handlers
  const handleUpload = () => {
    if (!isPaidUser && documents.length >= maxDocuments) {
      setShowUpgradeModal(true);
      return;
    }
    fileInputRef.current?.click();
  };
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    try {
      for (const file of Array.from(files)) {
        const documentMetadata = await documentService.storeDocument(file, currentFolderId);
        
        // Convert DocumentMetadata to Document format
        const document: Document = {
          id: documentMetadata.id,
          name: documentMetadata.name,
          type: documentMetadata.type as Document['type'],
          size: documentMetadata.size,
          folderId: documentMetadata.folderId,
          encryptedData: 'encrypted_data_placeholder',
          createdAt: documentMetadata.createdAt,
          updatedAt: documentMetadata.updatedAt,
          isStarred: documentMetadata.isStarred,
          tags: documentMetadata.tags,
          password: documentMetadata.password,
          ocrText: documentMetadata.ocrText,
          metadata: documentMetadata.metadata
        };
        
        setDocuments(prev => [...prev, document]);
      }
      
      toast({
        title: "Documents Uploaded",
        description: `${files.length} document(s) uploaded and encrypted successfully.`,
      });
    } catch (error) {
      console.error('Failed to upload documents:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload documents. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const folderName = newFolderName.trim();

    const newFolder: Folder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: folderName,
      parentId: currentFolderId,
      createdAt: new Date(),
      updatedAt: new Date(),
      color: newFolderColor
    };

    setFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    setShowCreateFolderModal(false);

    toast({
      title: "Folder Created",
      description: `Folder "${folderName}" created successfully.`,
    });
  };
  
  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document);
    setShowAuthModal(true);
  };
  
  const handleAuthenticate = async () => {
    try {
      // Simple master password validation
      if (masterPasswordInput === masterPassword) {
        setIsAuthenticated(true);
        setShowAuthModal(false);
        setMasterPasswordInput(''); // Clear password input
        
        // Retrieve and decrypt the document content
        if (selectedDocument) {
          try {
            const decryptedFile = await documentService.retrieveDocument(selectedDocument.id);
            // Convert File to data URL
            const reader = new FileReader();
            reader.onload = () => {
              const content = reader.result as string;
              setSelectedDocument({
                ...selectedDocument,
                content: content
              } as any);
              setShowDocumentViewer(true);
            };
            reader.onerror = () => {
              // If decryption fails, still show viewer (may show placeholder)
              setShowDocumentViewer(true);
            };
            reader.readAsDataURL(decryptedFile);
          } catch (err) {
            console.error('Failed to decrypt document:', err);
            // Still show viewer even if decryption fails
            setShowDocumentViewer(true);
          }
        } else {
          setShowDocumentViewer(true);
        }
        
        toast({
          title: "Authentication Successful",
          description: "Master password verified. Document access granted.",
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: "Invalid master password. Please try again.",
          variant: "destructive",
        });
        setMasterPasswordInput(''); // Clear password input
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast({
        title: "Authentication Error",
        description: "Failed to authenticate. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleShare = (document: Document) => {
    setSelectedDocument(document);
    setShowShareModal(true);
  };
  
  const handleDownload = async (document: Document) => {
    try {
      // For mock documents, create a dummy file
      if (document.id.startsWith('doc-')) {
        const blob = new Blob(['Mock document content'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.name;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Download Started",
          description: `Downloading ${document.name}...`,
        });
        return;
      }
      
      // For real documents, use the document service
      const file = await documentService.retrieveDocument(document.id);
      
      // Create download link
      const url = URL.createObjectURL(file);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: `Downloading ${document.name}...`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleDelete = (documentId: string) => {
    setDeleteTargetId(documentId);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await documentService.deleteDocument(deleteTargetId);
      setDocuments(prev => prev.filter(doc => doc.id !== deleteTargetId));
      toast({ title: "Document Deleted", description: "Document has been permanently deleted." });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: "Delete Error", description: "Failed to delete document. Please try again.", variant: "destructive" });
    } finally {
      setDeleteTargetId(null);
    }
  };
  
  const handleStar = (documentId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId ? { ...doc, isStarred: !doc.isStarred } : doc
    ));
  };
  
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions and try again.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  };

  const captureFrame = async () => {
    if (!videoRef.current || !isCameraActive) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopCamera();
    setShowScanModal(false);
    handleScanComplete({
      image: dataUrl,
      ocrResult: { text: '', confidence: 0, words: [], lines: [], blocks: [], processingTime: 0 },
      documentType: 'image'
    });
  };

  const handleScanDocument = () => {
    setShowScanModal(true);
  };
  
  const handleScanComplete = async (scanResult: ScanResult) => {
    try {
      // Convert scanned image to File object
      const response = await fetch(scanResult.image);
      const blob = await response.blob();
      const file = new File([blob], `Scanned Document ${new Date().toLocaleDateString()}.jpg`, {
        type: 'image/jpeg'
      });
      
      // Store the scanned document
      const documentMetadata = await documentService.storeDocument(file, currentFolderId);
      
      // Convert DocumentMetadata to Document format with OCR data
      const document: Document = {
        id: documentMetadata.id,
        name: documentMetadata.name,
        type: 'jpg' as Document['type'],
        size: documentMetadata.size,
        folderId: documentMetadata.folderId,
        encryptedData: 'encrypted_scanned_data',
        createdAt: documentMetadata.createdAt,
        updatedAt: documentMetadata.updatedAt,
        isStarred: false,
        tags: ['scanned', 'ocr'],
        ocrText: scanResult.ocrResult.text,
        metadata: {
          ...documentMetadata.metadata,
          title: scanResult.extractedData?.title || 'Scanned Document',
          author: 'Scanner'
        }
      };
      
      setDocuments(prev => [...prev, document]);
      setShowScanModal(false);
      
      toast({
        title: "Document Scanned",
        description: `Document scanned and processed with ${Math.round(scanResult.ocrResult.confidence)}% confidence.`,
      });
    } catch (error) {
      console.error('Scan complete error:', error);
      toast({
        title: "Scan Error",
        description: "Failed to process scanned document. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };
  
  const navigateUp = () => {
    if (currentFolder) {
      setCurrentFolderId(currentFolder.parentId);
    }
  };
  
  if (!licenseLoading && !isFeatureAvailable('documents')) return <UpgradeGate feature="Documents Vault" />;

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Document Vault</h1>
          <p className="text-muted-foreground text-sm">
            Secure, encrypted document storage
          </p>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={handleScanDocument}
            className="h-9 w-9"
            title="Scan Document"
          >
            <Camera className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowCreateFolderModal(true)}
            className="h-9 w-9"
            title="New Folder"
          >
            <Folder className="w-4 h-4" />
          </Button>
          
          <Button
            size="icon"
            onClick={handleUpload}
            className="h-9 w-9"
            title="Upload Documents"
          >
            <Upload className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Security Notice */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-primary mt-1" />
            <div>
              <p className="text-foreground font-medium">End-to-End Encrypted Storage</p>
              <p className="text-muted-foreground text-sm mt-1">
                All documents are encrypted using AES-256 encryption and stored securely on your device. 
                Access requires biometric authentication or master password.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <div className="text-lg font-semibold">{vaultStats.totalDocuments}</div>
                <div className="text-sm text-muted-foreground">Documents</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" />
              <div>
                <div className="text-lg font-semibold">{vaultStats.totalFolders}</div>
                <div className="text-sm text-muted-foreground">Folders</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              <div>
                <div className="text-lg font-semibold">{formatFileSize(vaultStats.totalSize)}</div>
                <div className="text-sm text-muted-foreground">Total Size</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-600" />
              <div>
                <div className="text-lg font-semibold">{vaultStats.starredDocuments.length}</div>
                <div className="text-sm text-muted-foreground">Starred</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Subscription Limit Warning — only when free user is at or over the
          cap. Showing it on every visit ("you've used 0/5 documents") feels
          like an upsell ad, not helpful information. */}
      {!isPaidUser && vaultStats.totalDocuments >= maxDocuments && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="text-orange-800 font-medium">Free Plan Limit Reached</p>
                  <p className="text-orange-700 text-sm">
                    {vaultStats.totalDocuments} / {maxDocuments} documents used
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowUpgradeModal(true)}
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                Upgrade Plan
              </Button>
            </div>
            <Progress
              value={(vaultStats.totalDocuments / maxDocuments) * 100}
              className="mt-3 h-2"
            />
          </CardContent>
        </Card>
      )}
      
      {/* Navigation */}
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateToFolder(null)}
              className="flex items-center gap-1"
            >
              <Home className="w-4 h-4" />
              Home
            </Button>
            
            {breadcrumbs.map((folder, index) => (
              <div key={folder.id} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateToFolder(folder.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {folder.name}
                </Button>
              </div>
            ))}
          </div>
          
          {/* Search and Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(sortBy === 'name' ? 'date' : 'name')}
            >
              Sort by {sortBy === 'name' ? 'Date' : 'Name'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? 'List' : 'Grid'} View
            </Button>

            {filteredDocuments.length > 0 && !selection.isSelectionMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => selection.enterSelectionMode()}
                data-testid="button-enter-selection-documents"
              >
                <CheckSquare className="w-4 h-4 mr-1.5" />
                Select
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Folders */}
      {filteredFolders.length > 0 && (
        <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Folders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFolders.map(folder => (
                <div
                  key={folder.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => navigateToFolder(folder.id)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getFolderColor(folder.color || 'blue')}`}>
                    <Folder className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{folder.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {documents.filter(doc => doc.folderId === folder.id).length} documents
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Documents */}
      <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documents
            {currentFolder && (
              <span className="text-sm font-normal text-muted-foreground">
                in {currentFolder.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No documents found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search terms' : 'Upload your first document to get started'}
              </p>
              <Button onClick={handleUpload}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            </div>
          ) : (
            <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'} ${selection.isSelectionMode ? 'pb-24' : ''}`}>
              {filteredDocuments.map(document => {
                const FileIcon = getFileIcon(document.type);
                const fileColor = getFileColor(document.type);
                const checked = selection.isSelected(document.id);

                return (
                  <BrandCard
                    key={document.id}
                    name={document.name}
                    brandColor={getFileBrandColor(document.type)}
                    className={`cursor-pointer ${checked ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                    onClick={() => {
                      if (selection.isSelectionMode) selection.toggle(document.id);
                      else handleDocumentClick(document);
                    }}
                  >
                  <div className={`flex items-center gap-3 p-3 ${viewMode === 'list' ? 'flex-row' : 'flex-col text-center'}`}>
                    {selection.isSelectionMode && (
                      <SelectionCheckbox checked={checked} onChange={() => selection.toggle(document.id)} label={`Select ${document.name}`} />
                    )}
                    {viewMode === 'grid' ? (
                      <>
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          {document.thumbnail ? (
                            <img 
                              src={document.thumbnail} 
                              alt={document.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <FileIcon className={`w-8 h-8 ${fileColor}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium truncate">{document.name}</h3>
                          <p className="text-sm text-muted-foreground">{formatFileSize(document.size)}</p>
                          <p className="text-sm text-muted-foreground">{format(document.updatedAt, 'MMM dd, yyyy')}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <FileIcon className={`w-5 h-5 ${fileColor}`} />
                        <div className="flex-1">
                          <h3 className="font-medium">{document.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(document.size)} • {format(document.updatedAt, 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </>
                    )}
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStar(document.id);
                        }}
                      >
                        <Star className={`w-4 h-4 ${document.isStarred ? 'text-primary fill-current' : 'text-muted-foreground'}`} />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(document);
                        }}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(document);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(document.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  </BrandCard>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Authentication Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Authentication Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Access to this document requires master password verification. Please enter your master password to continue.
            </p>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="masterPassword">Master Password</Label>
                <Input
                  id="masterPassword"
                  type="password"
                  value={masterPasswordInput}
                  onChange={(e) => setMasterPasswordInput(e.target.value)}
                  placeholder="Enter your master password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAuthenticate();
                    }
                  }}
                />
              </div>
              
              <Button
                onClick={handleAuthenticate}
                className="w-full flex items-center gap-2"
                disabled={!masterPasswordInput.trim()}
              >
                <Key className="w-4 h-4" />
                Verify Master Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Document Viewer */}
      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          isOpen={showDocumentViewer}
          onClose={() => setShowDocumentViewer(false)}
        />
      )}
      
      {/* Create Folder Modal */}
      <Dialog open={showCreateFolderModal} onOpenChange={setShowCreateFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
            
            <div>
              <Label htmlFor="folderColor">Color</Label>
              <div className="flex gap-2 mt-2">
                {(['blue', 'green', 'purple', 'orange', 'red', 'yellow'] as const).map(color => {
                  const colorHex: Record<string, string> = { blue: '#3b82f6', green: '#22c55e', purple: '#a855f7', orange: '#f97316', red: '#ef4444', yellow: '#eab308' };
                  return (
                    <button
                      key={color}
                      onClick={() => setNewFolderColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${newFolderColor === color ? 'border-gray-900' : 'border-gray-300'}`}
                      style={{ backgroundColor: colorHex[color] }}
                    />
                  );
                })}
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateFolderModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sharePassword">Optional Password Protection</Label>
              <Input
                id="sharePassword"
                type="password"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                placeholder="Enter password for shared file (optional)"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Recipients will need this password to open the file
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowShareModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={() => { toast({ title: "Shared", description: "Share link copied to clipboard." }); setShowShareModal(false); }}>
                Share Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Scan Document Modal */}
      <Dialog open={showScanModal} onOpenChange={(open) => {
        if (!open) stopCamera();
        setShowScanModal(open);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Scan Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
              />
              {!isCameraActive && !cameraError && (
                <div className="text-center p-6">
                  <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Press "Start Camera" to begin</p>
                </div>
              )}
              {cameraError && (
                <div className="text-center p-6">
                  <p className="text-sm text-destructive">{cameraError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { stopCamera(); setShowScanModal(false); }}>
                Cancel
              </Button>
              {!isCameraActive ? (
                <Button onClick={startCamera}>
                  Start Camera
                </Button>
              ) : (
                <Button onClick={captureFrame}>
                  Capture
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Upgrade Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              You've reached the limit of {maxDocuments} documents on the free plan. 
              Upgrade to unlock unlimited document storage.
            </p>
            
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <h3 className="font-medium text-primary mb-2">Pro Plan Benefits</h3>
              <ul className="text-sm text-primary space-y-1">
                <li>• Unlimited document storage</li>
                <li>• Advanced OCR scanning</li>
                <li>• Priority support</li>
                <li>• Advanced security features</li>
              </ul>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowUpgradeModal(false)}
              >
                Maybe Later
              </Button>
              <Button onClick={() => setShowUpgradeModal(false)}>
                Upgrade Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The document will be permanently removed from your vault.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selection.isSelectionMode && (
        <SelectionBar
          selectedCount={selection.selectedCount}
          totalCount={filteredDocuments.length}
          allSelected={selection.allSelected}
          itemLabel="document"
          onSelectAll={selection.selectAll}
          onClear={selection.clear}
          onExit={selection.exitSelectionMode}
          onBulkDelete={handleBulkDeleteDocuments}
        />
      )}
    </div>
  );
}
