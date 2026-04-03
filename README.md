# CougPulse

> **Smart Campus · WSU Everett Hackathon Project**
> *Work in Progress — Team of 5*

---

## Overview

**CougPulse** is a smart campus web application built for Washington State University Everett that provides a **real-time noise-level heatmap** of the campus building. The goal is to help students quickly find quiet spaces to study, while also integrating room availability data and intelligent occupancy estimation — all behind a secure, student-only login.

---

## Campus Context

WSU Everett is a single-building campus. CougPulse is purpose-built around that layout, offering a full-building heatmap view with room-level granularity for noise levels and availability.

---

## Features

### Noise Level Heatmap
- Visual heatmap overlaid on a floor plan of the WSU Everett building
- Displays real-time (and mocked) noise level data per room/zone
- Helps students identify quiet areas for studying at a glance

### Room Availability Integration
- Pulls data from **WSU Everett 25Live** to display which rooms are reserved or currently unavailable
- Combines availability and noise data for a complete picture of each space

### Secure Student Login
- Authentication required to access the application
- Restricts access to WSU students only — protecting locational and occupancy data from outside parties

### Noise Data Collection
- Noise levels are collected via **microphones placed throughout the building**
- *Current implementation:* One real microphone (phone-based); remaining sensor data points are **mocked/simulated**
- Audio data is **encrypted** in transit and at rest

### Camera-Based Security (Face Recognition)
- Cameras are theoretically distributed throughout the building for security monitoring
- *Current implementation:* One phone camera is used
- Uses **facial recognition** to identify whether individuals are students, staff, or faculty
- **Flags unrecognized individuals** who are not affiliated with WSU Everett
- All location and timestamp logs are **encrypted** for privacy

### Voice Recognition & Occupancy Estimation
- Uses voice/audio recognition to **estimate the number of people** present in each room
- **Admin view:** Enhanced capability to estimate or identify *who* is in each room based on voice and/or facial recognition data

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Student** | View noise heatmap, check room availability, find quiet study spaces |
| **Admin** | All student features + occupancy details, identity estimation per room, security flag review |

---

## Privacy & Security

- Student login required — no public access to location or occupancy data
- All audio data from microphones is **encrypted**
- All location logs and timestamps are **encrypted**
- Facial recognition flags are handled with access controls limited to authorized staff/admin

---

## Tech Stack

> *To be documented — details coming soon.*

---

## Getting Started

> *Setup and installation instructions coming soon.*

---

## Project Status

| Feature | Status |
|--------|--------|
| Noise Heatmap (UI) | In Progress |
| 25Live Integration | In Progress |
| Student Login / Auth | In Progress |
| Microphone Data (Mocked) | In Progress |
| Camera / Face Recognition | In Progress |
| Voice Occupancy Estimation | In Progress |
| Admin View | In Progress |
| Encryption Layer | In Progress |

---

## Team

Built by a team of **5** for the **Smart Campus Hackathon**.

> *Team member names and roles to be added.*

---

## Notes

- This project is a **hackathon prototype**. Some hardware components (microphones, cameras) are simulated or represented by a single mobile device.
- Additional features, tech stack details, and architectural decisions will be documented as the project evolves.

---

## License

> *To be determined.*

