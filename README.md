# 🌿 Neighbor-to-Neighbor

A community support network that thoughtfully connects senior residents with verified local volunteers for everyday assistance, elder care, emergency help, and community support.

---

## ✨ Features

- **🔐 Real Mobile 6-Digit OTP Authentication (Fast2SMS Gateway)**
  - Real 6-digit random OTP authentication dispatched directly to Indian mobile numbers via Fast2SMS SMS REST API.
  - Rate-limited & 5-minute time-expiry protection.

- **🎙️ Groq AI Voice & Text Request Parsing**
  - AI-driven request creation powered by Groq (`llama-3.3-70b-versatile`).
  - Converts natural voice or text in English and Tamil into structured title, urgency, category, and skill tag extractions.
  - Includes a 5-second silence auto-submit timer.

- **📍 Interactive Google Maps Location Picker**
  - High-precision Google Maps roadmap tile layer and draggable pointer pin.
  - **Auto-Recentering & GPS**: Automatically locates the user's current position via browser Geolocation API on load and animates the pin.

- **🤝 Volunteer Skill Matching & Task Management**
  - Radius-based proximity matching (e.g. 5 km, 10 km).
  - Volunteer skill tag filtering (Groceries, Plumbing, Moving, Medical, etc.).
  - Real-time task status tracking (`Pending` $\rightarrow$ `Assigned` $\rightarrow$ `Completed`).

- **📹 WebRTC Video Calling & Real-Time Chat**
  - Socket.IO signaling server supporting peer-to-peer WebRTC video calling.
  - In-app live chat for residents and volunteers.

- **🛡️ Admin Governance & Audit Logging**
  - Admin dashboard for volunteer identity proof verification, user management, and compliance audit logging.

---

## 🛠️ Prerequisites

- **Node.js** (v18 or v22+)
- **Firebase Project** with Cloud Firestore enabled
- **Groq API Key** (for AI Voice & Text request extraction)
- **Fast2SMS API Key** (for Indian Mobile SMS OTP delivery)

---

## 🚀 Local Setup

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd Neighbor-to-Neighbor
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the `.env.example` template:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your API keys and credentials:
   ```env
   APP_URL="http://localhost:3000"
   FIREBASE_PROJECT_ID="your-firebase-project-id"
   GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
   GROQ_API_KEY="your-groq-api-key"
   FAST2SMS_API_KEY="your-fast2sms-api-key"
   CLOUDINARY_URL="cloudinary://your_api_key:your_api_secret@your_cloud_name"
   ```

4. **Firebase Service Account Setup**:
   - Obtain your Firebase Admin Service Account JSON key from Google Cloud / Firebase Console.
   - Save it as `service-account.json` in the root directory.

---

## 🗄️ Database Management Scripts

- **Seed Demo Accounts & Tasks**:
  ```bash
  node src/db/seed.js
  ```
  Seeds sandbox accounts: `Admin Control` (admin), `Jane Doe` (resident), and `Alice Green` (volunteer).

- **Clear All Database Collections (Publish Cleanup)**:
  ```bash
  node src/db/clear.js
  ```
  Wipes all collections (`users`, `tasks`, `task_claims`, `audit_log`, `ratings`, `flags`, `locations`, `chat_messages`) for production deployment.

---

## 💻 Running the Application

- **Development Server**:
  ```bash
  npm run dev
  ```
  Starts Vite dev server and Node backend API at `http://localhost:3000`.

- **Production Build**:
  ```bash
  npm run build
  npm start
  ```

---

## 📜 License

MIT License. Designed with care for senior care and community empowerment.
