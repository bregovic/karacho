# Karacho Project Context (v6.0)

## Overview
Karacho is a professional bar-ready karaoke platform built for Web, TV, and Mobile. It handles complex synchronization across multiple screens, automatic cloud storage optimization, and shared session management with a premium local DJ experience.

## Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Auth**: NextAuth with Credentials & Role-based Access (USER/ADMIN).
- **Real-time Engine**: High-frequency Polling Sync (2.5s) with dedicated Master-Slave time persistence (`currentTime` in DB).
- **Storage**: R2 Cloud Storage (S3 API - via `@aws-sdk/client-s3`).

## Development Workflow (GitHub Issues)
Project management is handled via **GitHub Issues** (`bregovic/karacho`).
- **Trigger**: Antigravity should **always check GitHub Issues** at the start of any new session or when specifically requested by user.
- **Issues States (Labels)**: 
  - `🛠️ In Progress`: Task is currently being handled by Antigravity.
  - `🧪 To Test`: Deployed to Railway, waiting for User verification.
  - `✅ Done`: Verified and Closed.
  - `⚠️ Bug`: Reported issues.
- **Commit References**: Always link commits to issues using `#ID` (e.g. `ref #1`).

## User Profiles & History
- **Personalized UI**: Users can set **Nicknames**, **Profile Images** (URL), and manage email preferences.
- **Singing Statistics**: System tracks `SingingHistory` (automatically recorded on playback start).
- **Secure Auth**: Password changes are validated and encrypted using `bcryptjs`.

## Advanced Administration
- **Technical Configs**: Low-level parameters (Cloud, Exchange, API Keys) managed in `/admin/tech` protected by password `Admin123`.
- **Administrative Audit**: Every critical admin action (Create/Update/Delete Song, Config Change) is recorded in `AdminAction` log for transparency.

## Key Bar-Ready Features
- **Multiscreen Mirroring**: TV (Master) plays audio; Mobile (Slaves) can "Watch" in muted mode with real-time lyric sync.
- **Smart-Countdown**: Adaptive countdown (3, 2, 1...) for song intros and long instrumental solos (>15s).
- **Cloud Auto-Optimization**: 
  - Audio: Automatically compressed to **128kbps MP3** on upload.
  - Images: Automatically resized to max **1920x1080 @ 80% quality** (JPEG/WebP).
- **Master-Play Enforcement**: Overlay "READY TO ROCK?" ensures Fullscreen and Autoplay permissions are granted on TV/Master displays.
- **Shared Session Management**: Automated session IDs (5-digit numeric) for bar guest joining via QR or code.

## UI/UX Principles
- **Minimalist Control**: A glassmorphic corner widget for guests to control the session and mirror the stage.
- **Premium Aesthetics**: Teal, Gold, and Deep Navy palette. High-contrast typography for stage visibility.
- **Singer-First Logic**: Lyrics coloring with a **0.5s visual offset** (anticipatory guidance) for professional vocal performance.
- **Zero-Flicker Transitions**: Smooth handling between catalog browsing and live performance views.
