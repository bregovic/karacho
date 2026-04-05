# Karacho Project Context (v5.2)

## Overview
Karacho is a professional bar-ready karaoke platform built for Web, TV, and Mobile. It handles complex synchronization across multiple screens, automatic cloud storage optimization, and shared session management with a premium local DJ experience.

## Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Real-time Engine**: High-frequency Polling Sync (2.5s) with dedicated Master-Slave time persistence (`currentTime` in DB).
- **Storage**: R2 Cloud Storage (S3 API)
- **Media Engine**: FFmpeg (Server-side audio compression) & Sharp (Server-side image optimization).
- **Frontend Logic**: Reactive Context-based session state (`SessionContext`).

## Key Bar-Ready Features
- **Multiscreen Mirroring**: TV (Master) plays audio; Mobily (Slaves) can "Watch" in muted mode with real-time lyric sync.
- **Smart-Countdown**: Adaptive countdown (3, 2, 1...) for song intros and long instrumental solos (>15s).
- **Cloud Auto-Optimization**: 
  - Audio: Automatically compressed to **128kbps MP3** on upload.
  - Images: Automatically resized to max **1920x1080 @ 80% quality** (JPEG/WebP).
- **Master-Play Enforcement**: Overlay "READY TO ROCK?" ensures Fullscreen and Autoplay permissions are granted on TV/Master displays.
- **Shared Session Management**: Automated session IDs (5-digit numeric) for bar guest joining via QR or code.
- **Smart Queueing**: First song added automatically becomes "Current" and starts in `PAUSED` state to eliminate silence.

## UI/UX Principles
- **Minimalist Control**: A glassmorphic corner widget for guests to control the session and mirror the stage.
- **Premium Aesthetics**: Teal, Gold, and Deep Navy palette. High-contrast typography for stage visibility.
- **Singer-First Logic**: Lyrics coloring with a **0.5s visual offset** (anticipatory guidance) for professional vocal performance.
- **Zero-Flicker Transitions**: Smooth handling between catalog browsing and live performance views.
