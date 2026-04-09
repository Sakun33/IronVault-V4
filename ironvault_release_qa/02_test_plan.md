# Test Plan — IronVault Full Sweep

## A. Onboarding & Auth
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| A1 | Load login page — shows unlock or create vault UI | Positive | P0 |
| A2 | Wrong master password rejected with error | Negative | P0 |
| A3 | Correct master password → Dashboard | Positive | P0 |
| A4 | Show/hide password toggle works | Positive | P1 |
| A5 | Create new vault with customer info dialog | Positive | P0 |
| A6 | Vault lock: lock button locks and returns to login | Positive | P0 |
| A7 | Session persistence across page refresh | Positive | P1 |
| A8 | Brute-force: 5+ wrong attempts behavior | Negative | P1 |
| A9 | Empty password field validation | Negative | P1 |

## B. Dashboard
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| B1 | Summary cards render with correct counts | Positive | P0 |
| B2 | Sidebar navigation to all major routes | Positive | P0 |
| B3 | Password generator accessible | Positive | P1 |
| B4 | Quick-add actions work | Positive | P1 |
| B5 | Activity log widget shows recent actions | Positive | P2 |

## C. Passwords Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| C1 | Add password entry (all fields) | Positive | P0 |
| C2 | Copy password from list | Positive | P0 |
| C3 | Edit password entry | Positive | P0 |
| C4 | Delete password entry | Positive | P0 |
| C5 | Search/filter passwords | Positive | P1 |
| C6 | Favorite toggle | Positive | P1 |
| C7 | Password strength indicator | Positive | P1 |
| C8 | Empty state when no passwords | Edge | P1 |
| C9 | Special characters in password fields | Edge | P1 |

## D. Notes Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| D1 | Create note | Positive | P0 |
| D2 | Edit note | Positive | P0 |
| D3 | Delete note | Positive | P0 |
| D4 | Search notes | Positive | P1 |

## E. Reminders Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| E1 | Create reminder with date | Positive | P0 |
| E2 | Edit reminder | Positive | P0 |
| E3 | Delete reminder | Positive | P0 |
| E4 | Past-date reminder behavior | Edge | P1 |

## F. Subscriptions Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| F1 | Add subscription | Positive | P0 |
| F2 | Edit subscription | Positive | P0 |
| F3 | Delete subscription | Positive | P0 |
| F4 | Monthly cost calculation | Positive | P1 |

## G. Expenses Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| G1 | Add expense | Positive | P0 |
| G2 | Edit expense | Positive | P0 |
| G3 | Delete expense | Positive | P0 |
| G4 | CSV import | Positive | P0 |
| G5 | Filter by category/date | Positive | P1 |

## H. Bank Statements Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| H1 | Add bank statement | Positive | P0 |
| H2 | Edit statement | Positive | P0 |
| H3 | Delete statement | Positive | P0 |

## I. Investments & Goals Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| I1 | Add investment/goal | Positive | P0 |
| I2 | Edit investment/goal | Positive | P0 |
| I3 | Delete investment/goal | Positive | P0 |

## J. Documents Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| J1 | Add document record | Positive | P0 |
| J2 | Edit document record | Positive | P0 |
| J3 | Delete document record | Positive | P0 |
| J4 | Download/view document | Positive | P1 |

## K. API Keys Module
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| K1 | Add API key | Positive | P0 |
| K2 | Copy API key value | Positive | P0 |
| K3 | Edit API key | Positive | P0 |
| K4 | Delete API key | Positive | P0 |

## L. Profile
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| L1 | Profile section opens (KNOWN BUG) | Positive | P0 |
| L2 | Edit display name / email | Positive | P0 |
| L3 | Change master password | Positive | P0 |
| L4 | Account deletion path visible | Positive | P0 |

## M. Settings
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| M1 | All 10 themes apply correctly (KNOWN PARITY BUG) | Positive | P0 |
| M2 | Language/locale setting | Positive | P1 |
| M3 | Auto-lock timeout setting | Positive | P1 |
| M4 | Notification settings | Positive | P1 |

## N. Export / Import / Backup
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| N1 | Export vault to JSON | Positive | P0 |
| N2 | Import vault from JSON | Positive | P0 |
| N3 | Backup vault | Positive | P0 |
| N4 | Restore from backup | Positive | P0 |
| N5 | Import malformed JSON → error message | Negative | P1 |

## O. Pricing / Subscription Plans
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| O1 | Pricing page renders all 4 plans | Positive | P0 |
| O2 | Free plan limits enforced (50 pw, 5 notes, 10 reminders) | Positive | P0 |
| O3 | Pro-gated routes show upgrade prompt for free users | Positive | P0 |
| O4 | Upgrade flow reachable | Positive | P1 |

## P. Admin Console
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| P1 | Login with admin/admin123 | Positive | P0 |
| P2 | Dashboard stats visible | Positive | P0 |
| P3 | Customer list loads | Positive | P0 |
| P4 | View customer details | Positive | P0 |
| P5 | Change customer plan | Positive | P0 |
| P6 | Support tickets visible | Positive | P0 |
| P7 | Email center / broadcasts | Positive | P1 |
| P8 | Promotions CRUD | Positive | P1 |
| P9 | Activity logs | Positive | P1 |
| P10 | System info / settings | Positive | P2 |

## Q. Frontend ↔ Admin Connectivity
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| Q1 | User created on frontend → appears in admin customer list | Positive | P0 |
| Q2 | Plan changed in admin → frontend permissions update | Positive | P0 |
| Q3 | Support ticket from frontend → visible in admin | Positive | P1 |
| Q4 | Promo code from admin → usable on frontend | Positive | P1 |
| Q5 | Broadcast from admin → user sees notification | Positive | P1 |

## R. Mobile / Responsive / Store-Readiness
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| R1 | 390px viewport (iPhone 14) — no horizontal overflow | Positive | P0 |
| R2 | Bottom content not hidden (KNOWN BUG) | Positive | P0 |
| R3 | Touch targets ≥ 44px | Positive | P1 |
| R4 | Keyboard does not overlap inputs | Positive | P1 |
| R5 | Privacy policy / Terms links present | Positive | P0 |
| R6 | Account deletion path documented | Positive | P0 |
| R7 | Subscription disclosure visible on pricing page | Positive | P0 |
| R8 | PWA manifest / installability | Positive | P2 |
| R9 | Offline behavior (IndexedDB-backed) | Edge | P1 |

## S. Security Basics
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| S1 | Vault data encrypted at rest (IndexedDB) | Positive | P0 |
| S2 | JWT/session does not leak in localStorage plaintext | Positive | P0 |
| S3 | No sensitive data in URL query params | Positive | P0 |
| S4 | HTTPS enforced | Positive | P0 |
| S5 | Content-Security-Policy header present | Positive | P1 |

## T. Landing Page
| ID | Scenario | Type | Priority |
|----|----------|------|----------|
| T1 | Landing page renders correctly (KNOWN BUG) | Positive | P0 |
| T2 | CTA buttons navigate correctly | Positive | P0 |
| T3 | Blog / Changelog / Status info pages load | Positive | P1 |
