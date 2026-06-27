# Stadium Night Cricket League 🏏

A premium full-stack cricket tournament dashboard and real-time scoring application built with React, Express, MongoDB, and Tailwind CSS.

---

## 🚀 Quick Start Guide for Developers

Follow these steps to get the project running locally:

### 1. Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (installed automatically with Node.js)
- [MongoDB](https://www.mongodb.com/try/download/community) (either a running local MongoDB instance or a MongoDB Atlas connection string)

---

### 2. Configure Environment Variables
Environment variables are configured in the `frontend/.env` file. 

1. Duplicate the template environment file inside `frontend/`:
   ```bash
   cp frontend/.env.example frontend/.env
   ```
   *(On Windows Command Prompt, use `copy frontend\.env.example frontend\.env`)*

2. Open `frontend/.env` and replace the values with your actual configuration:
   - **`MONGODB_URI`**: Your MongoDB connection string (e.g. `mongodb://localhost:27017/stadium-night`).
   - **`GOOGLE_CLIENT_ID`**: Your Google Cloud Client ID (for OAuth authentication).
   - **`GOOGLE_CLIENT_SECRET`**: Your Google Cloud Client Secret.
   - **`GOOGLE_REDIRECT_URI`**: Set to `http://localhost:8080/auth/callback` for local development.

*(Note: The backend automatically reads environment variables directly from `frontend/.env`)*

---

### 3. Install Dependencies
Install all backend and frontend dependencies from the root directory:
```bash
npm run install:all
```

---

### 4. Run the Application
Start both the React frontend dev server and the Express backend server concurrently:
```bash
npm run dev
```

Once both servers have started:
- The React frontend is available at: 👉 **[http://localhost:8080/](http://localhost:8080/)**
- The Express backend API is available at: 👉 **[http://localhost:5000/](http://localhost:5000/)**

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React, React Router, Tailwind CSS, Lucide icons, Shadcn UI components.
- **Backend**: Express API server handling authentication, tournament operations, live scoring state, and stats.
- **Database**: MongoDB for persistent data storing tournaments, teams, match scorecards, players, user profiles, and session cookies.
- **Scoring Engine**: Full cricket scoring controls enabling live ball-by-ball updates, extras, fall-of-wickets, and automated player run/wicket calculations.
