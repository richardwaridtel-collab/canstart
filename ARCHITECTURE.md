# CanStart Architecture

## System Overview

CanStart is a full-stack web application implementing a two-sided marketplace. This document describes the technical architecture and design decisions.

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interfaces                           │
│  ┌──────────────┐          ┌──────────────┐                 │
│  │  Web (React) │          │  Mobile Apps │                 │
│  │  Job Seekers │          │  (Future)    │                 │
│  │  Employers   │          │              │                 │
│  └──────────────┘          └──────────────┘                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   API Layer (REST)  │
        │  Authentication     │
        │  Validation         │
        └──────────┬──────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌────────────┐
│  Users  │  │   Jobs   │  │ Messaging  │
│ Service │  │ Service  │  │  Service   │
└─────────┘  └──────────┘  └────────────┘
    │              │              │
    └──────────────┼──────────────┘
                   │
        ┌──────────▼──────────┐
        │   PostgreSQL DB     │
        │   - Users           │
        │   - Jobs            │
        │   - Applications     │
        │   - Messages        │
        │   - Ratings         │
        └─────────────────────┘
```

## Core Services

### 1. Authentication Service
**Purpose:** Secure user authentication and authorization

**Responsibilities:**
- User registration (job seeker vs employer)
- Login/logout management
- JWT token generation and validation
- Password reset flow
- 2FA support (future)

**Technology:** NextAuth.js / Supabase Auth

### 2. User Service
**Purpose:** Manage user profiles and data

**Responsibilities:**
- Profile management (job seekers and employers)
- Verification status (work permit, business registration)
- User preferences and settings
- Profile picture uploads
- Account deletion

**Endpoints:**
- `GET /api/user/profile` – Get current user profile
- `PUT /api/user/profile` – Update profile
- `POST /api/user/verify` – Submit verification documents
- `GET /api/user/verification-status` – Check verification progress

### 3. Job Service
**Purpose:** Manage job postings and searching

**Responsibilities:**
- Create/edit/delete job postings
- Search and filter jobs
- Match algorithm
- Job analytics (views, applications)
- Job expiration management

**Endpoints:**
- `POST /api/jobs` – Create job posting
- `GET /api/jobs` – Search jobs with filters
- `GET /api/jobs/:id` – Get job details
- `PUT /api/jobs/:id` – Update job
- `DELETE /api/jobs/:id` – Delete job
- `GET /api/jobs/:id/matches` – Get matched candidates

### 4. Application Service
**Purpose:** Manage job applications

**Responsibilities:**
- Submit applications
- Track application status
- Withdraw applications
- Interview scheduling
- Offer management

**Endpoints:**
- `POST /api/applications` – Submit application
- `GET /api/applications` – Get user's applications
- `PUT /api/applications/:id/status` – Update status
- `DELETE /api/applications/:id` – Withdraw application

### 5. Messaging Service
**Purpose:** Enable communication between job seekers and employers

**Responsibilities:**
- Send and receive messages
- Message history
- Notifications
- Real-time updates (WebSocket)

**Endpoints:**
- `POST /api/messages` – Send message
- `GET /api/messages/:conversationId` – Get conversation
- `GET /api/conversations` – List conversations
- `WebSocket /ws/messages` – Real-time messaging

### 6. Matching Service
**Purpose:** Intelligent job-to-candidate matching

**Algorithm:**
```
Match Score = (Skills Match × 0.40) + 
              (Location Match × 0.30) + 
              (Availability Match × 0.15) + 
              (Experience Match × 0.15)

Skills Match: Does candidate have required skills?
Location Match: Is candidate in preferred location?
Availability Match: Can candidate start when needed?
Experience Match: Is experience level appropriate?
```

**Features:**
- Background matching (periodic evaluation)
- Ranked recommendations
- Learning from placement feedback

### 7. Rating & Review Service
**Purpose:** Build trust through verified feedback

**Responsibilities:**
- Submit ratings and reviews
- Retrieve ratings
- Fraud detection
- Review moderation

**Endpoints:**
- `POST /api/ratings` – Submit rating
- `GET /api/users/:id/ratings` – Get user's ratings
- `GET /api/users/:id/average-rating` – Get average rating

### 8. Verification Service
**Purpose:** Verify user identity and legitimacy

**Responsibilities:**
- Document upload and validation
- Manual review workflow
- Verification badge management
- Document storage (secure)

**Endpoints:**
- `POST /api/verification/upload` – Upload documents
- `GET /api/verification/status` – Check verification status
- `POST /api/verification/admin/review` – Admin review (internal)

## Database Schema (PostgreSQL)

### Core Tables

```sql
-- Users table (both job seekers and employers)
users
├── id (UUID, PK)
├── email (VARCHAR, UNIQUE)
├── password_hash (VARCHAR)
├── user_type (ENUM: 'job_seeker', 'employer')
├── is_verified (BOOLEAN)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- Job Seeker Profile
job_seeker_profiles
├── id (UUID, PK)
├── user_id (FK → users)
├── full_name (VARCHAR)
├── headline (VARCHAR)
├── bio (TEXT)
├── location (VARCHAR)
├── country_of_origin (VARCHAR)
├── years_experience (INTEGER)
├── skills (JSONB array)
├── languages (JSONB array)
├── availability_date (DATE)
├── work_type_preference (ENUM: 'full_time', 'part_time', 'volunteer')
├── willing_to_relocate (BOOLEAN)
└── profile_picture_url (VARCHAR)

-- Employer Profile
employer_profiles
├── id (UUID, PK)
├── user_id (FK → users)
├── company_name (VARCHAR)
├── company_size (ENUM: '1-10', '11-50', '51-200', '200+')
├── industry (VARCHAR)
├── location (VARCHAR)
├── website (VARCHAR)
├── company_description (TEXT)
├── logo_url (VARCHAR)
└── tax_id (VARCHAR, encrypted)

-- Jobs
jobs
├── id (UUID, PK)
├── employer_id (FK → users)
├── title (VARCHAR)
├── description (TEXT)
├── requirements (JSONB array)
├── skills_required (JSONB array)
├── salary_min (INTEGER, nullable)
├── salary_max (INTEGER, nullable)
├── location (VARCHAR)
├── work_type (ENUM: 'full_time', 'part_time', 'volunteer')
├── posted_date (TIMESTAMP)
├── expiration_date (DATE)
├── status (ENUM: 'active', 'filled', 'expired', 'draft')
└── view_count (INTEGER)

-- Applications
applications
├── id (UUID, PK)
├── job_id (FK → jobs)
├── applicant_id (FK → users)
├── status (ENUM: 'applied', 'viewed', 'interviewing', 'offered', 'rejected', 'withdrawn')
├── applied_date (TIMESTAMP)
├── cover_letter (TEXT, nullable)
├── interview_round (INTEGER)
└── feedback (TEXT, nullable)

-- Messages
messages
├── id (UUID, PK)
├── sender_id (FK → users)
├── receiver_id (FK → users)
├── content (TEXT)
├── job_id (FK → jobs, nullable)
├── application_id (FK → applications, nullable)
├── created_at (TIMESTAMP)
└── read_at (TIMESTAMP, nullable)

-- Ratings & Reviews
ratings
├── id (UUID, PK)
├── rater_id (FK → users)
├── rated_user_id (FK → users)
├── application_id (FK → applications)
├── score (INTEGER, 1-5)
├── comment (TEXT, nullable)
├── created_at (TIMESTAMP)
└── verified_hire (BOOLEAN)

-- Verification Documents
verification_documents
├── id (UUID, PK)
├── user_id (FK → users)
├── document_type (ENUM: 'id', 'work_permit', 'business_registration')
├── document_url (VARCHAR, encrypted)
├── status (ENUM: 'pending', 'approved', 'rejected')
├── submitted_date (TIMESTAMP)
└── reviewed_date (TIMESTAMP, nullable)
```

## Technology Stack

### Frontend
- **Framework:** React 18
- **Styling:** TailwindCSS
- **State Management:** Context API / Redux (TBD)
- **Build:** Vite
- **Testing:** Jest, React Testing Library

### Backend
- **Runtime:** Node.js
- **Framework:** Next.js (API routes)
- **Database:** PostgreSQL
- **ORM:** Prisma / TypeORM
- **Authentication:** NextAuth.js
- **File Storage:** Supabase Storage / AWS S3

### Infrastructure
- **Hosting:** Vercel (frontend) / Railway or Fly.io (backend)
- **Database:** Supabase PostgreSQL
- **Real-time:** WebSocket (Socket.io or Supabase Realtime)
- **Monitoring:** Sentry, LogRocket

## Security Considerations

### Authentication
- JWT tokens with 24-hour expiration
- Refresh token rotation
- Secure cookie storage
- HTTPS only

### Data Protection
- Encrypt sensitive documents (PII)
- Hash passwords with bcrypt
- GDPR compliance (right to deletion)
- Data retention policies

### Input Validation
- Server-side validation on all endpoints
- Sanitize user input
- Rate limiting on API endpoints
- CSRF protection

## Deployment Pipeline

```
Code Commit
    ↓
GitHub Actions
    ├─ Run tests
    ├─ Lint code
    └─ Build artifacts
    ↓
Staging Environment
    ├─ Run integration tests
    ├─ Manual QA
    └─ Performance testing
    ↓
Production Deployment
    ├─ Blue-green deployment
    ├─ Database migrations
    └─ Smoke tests
```

## Performance Optimization

### Caching
- Client-side caching (React Query, SWR)
- Redis for session management
- CDN for static assets

### Database
- Query optimization with indexes
- N+1 query prevention
- Batch operations where possible

### Frontend
- Code splitting
- Lazy loading
- Image optimization
- Tree shaking

## Monitoring & Observability

- Application performance monitoring (APM)
- Error tracking (Sentry)
- User session recording
- Custom analytics
- Database query performance logging

## Scaling Strategy

### Phase 1 (MVP)
- Single server deployment
- PostgreSQL single instance
- No caching layer needed

### Phase 2 (Growth)
- Horizontal scaling with load balancer
- Read replicas for database
- Redis for caching
- Queue system for async jobs

### Phase 3 (Scale)
- Microservices architecture
- Event-driven architecture
- Message queues (RabbitMQ/Kafka)
- Distributed tracing

---

**Architecture Decision Records (ADR):** TBD in `/adr/` directory

**Last Updated:** May 2024
