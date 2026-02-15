# Unlimited Cloud Storage (YouTube Edition) 💎

**Vault into YouTube** - Store any file as a lossless video on YouTube. Unlimited storage, zero costs, infinite redundancy.

[![GitHub Pages](https://img.shields.io/badge/Live-Web%20App-blue?style=for-the-badge&logo=github)](https://infoshubhjain.github.io/unlimited-cloud-storage-yt/)
[![License](https://img.shields.io/github/license/infoshubhjain/unlimited-cloud-storage-yt?style=for-the-badge)](LICENSE.txt)

## 🌐 Web Application (V2.0)
The fastest way to use this tool is via the web app. No installation required!
- **[Launch the Web App](https://infoshubhjain.github.io/unlimited-cloud-storage-yt/)**
- **Browser-Native**: Encodes files directly in your browser.
- **Auto-Publish**: Connect your YouTube account to upload automatically.

## 📦 What is this?
This project encodes any file into a lossless video stream (FFV1/MKV) and allows you to upload it to YouTube. Because YouTube allows unlimited video uploads, you effectively get unlimited cloud storage. 

Supports a modern **Web Interface**, a **Command-Line Interface (CLI)**, and a **Graphical User Interface (GUI)**.

## Features

- **File Encoding/Decoding**: Encode any file into a lossless video (FFV1/MKV) and decode it back
- **Fountain Codes**: Uses [Wirehair](https://github.com/catid/wirehair) fountain codes for redundancy and repair
- **Optional Encryption**: Encrypt files with a password using libsodium (XChaCha20-Poly1305)
- **Batch Processing**: Queue multiple files for batch encoding (GUI)
- **Progress Tracking**: Real-time progress bars and status updates (GUI)

## CI/CD Pipeline

Visit my [CI/CD pipeline](https://ci.brandonli.me), and click "Login as Guest". Visit the yt-media-storage project,
click on the latest passing build, and click "Artifacts" to download the latest build artifacts for both the CLI and
GUI. You may need to install some shared libraries (FFmpeg, Qt6, libsodium) to run the executables.

## Requirements

- CMake 3.22
- C++23 compiler
- FFmpeg
- libsodium
- OpenMP
- Qt6 (Core and Widgets)

## Installation

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install cmake build-essential qt6-base-dev \
  libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev \
  libsodium-dev libomp-dev ffmpeg
```

### Fedora/CentOS

```bash
sudo dnf install cmake gcc-c++ qt6-qtbase-devel ffmpeg-devel libsodium-devel libgomp
```

### Arch Linux

```bash
sudo pacman -S cmake qt6-base ffmpeg libsodium openmp
```

### macOS (Homebrew)

```bash
brew install cmake qt@6 ffmpeg libsodium libomp
```

### Windows (vcpkg)

```powershell
vcpkg install ffmpeg libsodium openmp qt6
```

Or install Qt6 separately via the [Qt Online Installer](https://www.qt.io/download-qt-installer) and FFmpeg/libsodium
via vcpkg.

## Building

```bash
mkdir build
cmake -B build
cmake --build build
```

This produces two executables:

- `media_storage` — Command-line interface
- `media_storage_gui` — Graphical user interface

## Usage

### CLI

```
./media_storage encode --input <file> --output <video> [--encrypt --password <pwd>]
./media_storage decode --input <video> --output <file>
```

### GUI

```
./media_storage_gui
```

#### Single File Operations

1. **Encode a file to video**:
    - Click "Browse..." next to "Input File" to select the file you want to encode
    - Click "Browse..." next to "Output File" to choose where to save the video
    - Click "Encode to Video" to start the process

2. **Decode a video to file**:
    - Click "Browse..." next to "Input File" to select the video file
    - Click "Browse..." next to "Output File" to choose where to save the decoded file
    - Click "Decode from Video" to start the process

#### Batch Operations

1. Click "Add Files" to add multiple files to the batch queue
2. Select an output directory for all encoded videos
3. Click "Batch Encode All" to process all files in sequence

#### Monitoring

- The progress bar shows the current operation progress
- Status label displays current operation status
- Logs panel provides detailed information about each step
- All operations run in separate threads to keep the UI responsive

## Technical Details

- **Encoding**: Files are chunked, encoded with fountain codes, and embedded into video frames
- **Decoding**: Packets are extracted from video frames and reconstructed into the original file
- **Video Format**: FFV1 codec in MKV container (lossless)
- **Frame Resolution**: 3840x2160 (4K) at 30 FPS
- **Encryption**: Optional XChaCha20-Poly1305 via libsodium

- **Encryption**: Optional XChaCha20-Poly1305 via libsodium

## 🗝️ YouTube API Setup Guide
To use the **Auto-Publish** feature in the web app, you must configure your own Google Cloud credentials:

1.  **Create Project**: Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2.  **Enable API**: Go to **APIs & Services > Library**, search for **"YouTube Data API v3"**, and click **Enable**.
3.  **Consent Screen**: Go to **OAuth consent screen**, choose **External**, and fill in the required app info. Add your email to **"Test Users"**.
4.  **Create Credentials**: Go to **Credentials > Create Credentials > OAuth client ID**.
    - Select **Web application**.
    - Add `https://infoshubhjain.github.io` to **Authorized JavaScript origins**.
5.  **Copy Client ID**: Paste the generated Client ID into the Web App's **Settings (gear icon)**.

## Troubleshooting

### Build Issues

- **Qt6 not found**: Ensure Qt6 development packages are installed
- **FFmpeg libraries missing**: Install FFmpeg development packages
- **libsodium missing**: Install libsodium development packages
- **OpenMP errors**: Install OpenMP development packages

### Runtime Issues

- **Cannot open input file**: Check file permissions and paths
- **Encoding fails**: Ensure sufficient disk space for output video
- **Decoding fails**: Verify the input file is a valid encoded video
- **Encode Error: failed to write header**: Make sure you have at least FFMPEG version 8 in-order to use FFV1 encoder on mp4. Otherwise, use mkv instead.

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version.
