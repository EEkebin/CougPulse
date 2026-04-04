---
marp: true
theme: crimson-gray
paginate: true
size: 16:9
---

# CougPulse

Smart campus safety and study support for WSU Everett

---

## Theme Fit: Smart Campus

Admins build a digital map of their campus by tracing rooms over a map image. That map is the core of two features:

- **Students** see live noise levels per room to find a quiet place to study
- **Security** sees device feeds, facial recognition results, and alerts tied to each room

Rooms have cameras and microphones. Audio data drives the noise heatmap. Video data runs through facial recognition to identify unknown visitors and flagged individuals.

---

## Problem

**Students**
- No way to know which rooms are quiet right now
- No simple tool to find a better study spot

**Security & IT**
- The IT Director of WSU Everett wanted to detect possible unwelcomed persons with facial recognition but had no way to protect sensitive identity data with encryption.
- We rebuilt facial recognition with encryption, making it possible to use facial recognition on campus

---

## Solution

Two views:

- **Student Heatmap** — live noise levels shown on the campus map
- **Admin Console** — device feeds, facial recognition, and alerts by room

Cameras and microphones send data in near real time. Sensitive identity data is encrypted at rest.

---

## Technical Complexity

- Combines authorization, mapping, telemetry, facial recognition and audio
- Separate accounts for admin and device authorization
- Face matching with room checks and alerts
- Linking rooms, devices, readings, and persons
- Login throttling and encrypted and hashed sensitive fields

---

## Functionality

The full workflow runs end to end with live data.

1. Admin creates floors, rooms, and device accounts
2. Device logs in and starts sending audio and video feed
3. Room heatmap updates with live noise
4. Admin enrolls faces and flags persons
5. A recognized troublemaker match creates an alert
6. Security reviews and clears the alert

---

![bg contain](../../Screenshots/Admin_panel.png)

---

![bg contain](../../Screenshots/camera_device.png)

---

![bg contain](../../Screenshots/Heatmap.png)

---

## Scalability

- The map is not hardcoded, any building can be set up
- Upload a map image, then draw rooms on top of it
- Supports multiple floors and can scale to more buildings
- Scalar API docs included for onboarding and integration

---

## Security Design

- AES-256-GCM encryption for sensitive data at rest
- Argon2id hashing for admin and device passwords
- Separate auth tokens for admin and device routes
- Login throttling to limit brute-force attempts

Encrypted fields include face enrollment payloads, alert details, face snapshots, and security notes on flagged persons.

---

## Documentation

- README covers setup, routes, features, and workflows
- Interactive API docs at `/api/docs` (Scalar)
- Clear folder structure for routes, components, and shared libs

---

## Impact

- Helps students find quiet study spaces
- Addresses the encryption gap the WSU Everett IT Director identified
- Improves security with usable facial recognition
- One system for both student experience & security operations

---

## Demo Time

---

## Q&A

Thank you.