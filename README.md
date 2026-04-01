# XML Feed Viewer

![Tests](https://img.shields.io/badge/tests-4%20passing-brightgreen)
![React](https://img.shields.io/badge/React-UI-61dafb)
![Vite](https://img.shields.io/badge/Vite-Build-646cff)
![Status](https://img.shields.io/badge/status-active-success)

A lightweight XML feed viewer built to load, inspect, and validate property listing feeds in a visual interface.

## Features

- Load XML feeds from a URL
- Supports optional Basic Auth credentials
- Optional proxy mode for CORS-protected feeds
- Parses and previews listing data visually
- Displays listing cards, unit table, and raw XML
- Handles both listing-style and MITS-style feed structures
- Includes automated tests for core UI flows

## Tech Stack

- React
- Vite
- JavaScript / JSX
- Vitest
- React Testing Library

## Tested Flows

- Renders app heading
- Shows empty state before loading
- Loads and displays listing data from XML
- Shows error state when fetch fails

## Running Locally

```bash
npm install
npm run dev