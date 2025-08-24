# Overview

This is a real-time log monitoring application built with React, TypeScript, and Express.js. It provides a web-based interface for uploading, parsing, and monitoring log files (particularly Tomcat logs) with features like real-time streaming, filtering, search functionality, and statistics tracking. The application uses WebSocket connections for live log updates and includes a comprehensive UI built with shadcn/ui components.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme configuration
- **State Management**: TanStack React Query for server state and local React state for UI
- **Routing**: Wouter for client-side routing
- **Real-time Communication**: WebSocket client for live log streaming

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with real-time WebSocket support
- **File Handling**: Multer for multipart file uploads
- **Log Processing**: Custom log parser supporting multiple Tomcat log formats

## Data Storage Solutions
- **ORM**: Drizzle ORM with PostgreSQL dialect configuration
- **Database**: PostgreSQL (configured via Neon serverless driver)
- **Development Storage**: In-memory storage implementation for development/testing
- **Schema**: Structured tables for log entries, log files, and filter settings

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Security**: Basic session-based authentication (no complex auth system implemented)

## Real-time Features
- **WebSocket Server**: Built-in WebSocket server for real-time log streaming
- **Live Updates**: Automatic log entry broadcasting to connected clients
- **Auto-scroll**: Configurable auto-scroll for real-time log viewing
- **Connection Management**: Automatic reconnection with exponential backoff

## Log Processing Engine
- **Parser**: Custom log parser supporting multiple Tomcat log formats
- **Filtering**: Advanced filtering by log level, keywords, and time ranges
- **Statistics**: Real-time calculation of error, warning, and total log counts
- **Search**: Client-side search functionality with keyword highlighting

# External Dependencies

## Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe ORM for database operations
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **express**: Node.js web framework
- **ws**: WebSocket library for real-time communication

## UI and Styling Dependencies
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Utility for managing component variants
- **lucide-react**: Icon library

## Development and Build Dependencies
- **vite**: Fast build tool and development server
- **typescript**: Type checking and compilation
- **drizzle-kit**: Database migration and schema management tools
- **tsx**: TypeScript execution engine for development

## File Processing Dependencies
- **multer**: Multipart form data handling for file uploads
- **date-fns**: Date manipulation and formatting utilities

## Replit-specific Dependencies
- **@replit/vite-plugin-runtime-error-modal**: Development error handling
- **@replit/vite-plugin-cartographer**: Development tooling integration