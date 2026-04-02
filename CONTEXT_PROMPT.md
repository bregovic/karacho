# Karacho Project Context

## Overview
Karacho is a modern, playful karaoke platform built for web, TV, and mobile. It features a text timing editor (Designer), a cross-device synchronized player (Remote Control), and a shared song queue system.

## Tech Stack
- **Framework**: Next.js (App Router)
- **Database**: PostgreSQL (via Prisma)
- **Authentication**: Auth.js (NextAuth)
- **Styling**: Vanilla CSS (Modern, Playful, Teal/Gold/Navy)
- **Real-time**: Supabase Realtime (for Remote Control & Shared Queue)
- **Storage**: External (Supabase/Cloudinary) for Audio/GIF/Video

## Key Features
- **Song Management**: Metadata (Title, Author, Genre, Tags, Year, Play Count, Rating).
- **Song States**: `New` -> `Pending Timing` -> `Animation` -> `Testing` -> `Active`.
- **Admin**: Only users with admin rights can create, edit, or delete songs/tracks.
- **Tracks**: Multiple audio tracks per song (Original, Instrumental, etc.).
- **Designer**: Tool to define text animation timing (Saves to DB).
- **Player**: Supports Image/GIF/Video backgrounds and dynamic text animations.
- **Remote Control**: Session ID based sync between TV (Display) and Mobile (Controller).
- **Shared Queue**: Users in the same session can add songs to a common queue.

## Design Principles
- **Vibrant & Energized**: No purple. Use Teal, Gold, and Deep Navy.
- **Micro-Animations**: Smooth transitions, hover effects, and playful UI.
- **Glassmorphism**: Modern frosted glass effects for overlays.
- **Accessibility**: Legible fonts (high contrast) for karaoke text.
