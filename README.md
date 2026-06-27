# Stadium Night Cricket League 🏏

A premium full-stack cricket tournament dashboard and real-time scoring application built with React, TanStack Start (Vite + Server Functions), Tailwind CSS v4, and MongoDB.

---

## 🚀 Quick Start Guide for New Developers

Follow these steps to get the project running locally on your machine:

### 1. Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (installed automatically with Node.js)
- A [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) database or local MongoDB instance

---

### 2. Clone the Repository
Clone the repository from GitHub:
```bash
git clone https://github.com/akashop5646/Sports-.git
cd Sports-
```

---

### 3. Install Dependencies
Navigate into the `frontend` folder and install the required npm packages:
```bash
cd frontend
npm install
```

---

### 4. Configure Environment Variables
1. Duplicate the template environment file inside `frontend/`:
   ```bash
   cp .env.example .env
   ```
   *(On Windows Command Prompt, use `copy .env.example .env`)*

2. Open the new `.env` file and replace the placeholders with your actual secrets:
   - **`MONGODB_URI`**: Your MongoDB connection string.
   - **`GOOGLE_CLIENT_ID`**: Your Google Cloud Client ID (for OAuth authentication).
   - **`GOOGLE_CLIENT_SECRET`**: Your Google Cloud Client Secret.
   - **`GOOGLE_REDIRECT_URI`**: Set to `http://localhost:8080/auth/callback` for local development.
   - **`SESSION_SECRET`**: A long random secure string used to sign session cookies.

---

### 5. Run the Application
Start the local development server:
```bash
npm run dev
```

Once the server initializes, open your browser and navigate to:
👉 **[http://localhost:8080/](http://localhost:8080/)**

---

## 🛠️ Tech Stack & Architecture

- **Framework:** [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React router-based full-stack framework with SSR support).
- **Styling:** Tailwind CSS v4 featuring premium glassmorphism styles and active animations.
- **Background Effects:** High-performance, native WebGL custom canvas shader rendering space noise and glowing accents.
- **Database:** MongoDB for persistent user OAuth accounts, sessions, tournaments, and scoring cards.
- **State Management:** Zustand for client-side state sync.
