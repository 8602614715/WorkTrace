# Full Stack Setup Guide - WorkTrace

This guide will help you set up both the React frontend and FastAPI backend to create a full-stack application.

## Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)
- pip (Python package manager)

## Step 1: Frontend Setup (React)

### 1.1 Install Dependencies

```bash
# In the root directory (WorkTrace)
npm install
```

### 1.2 Configure API URL

Create a `.env` file in the root directory:

```bash
# .env
REACT_APP_API_URL=http://localhost:5000/api
```

### 1.3 Start Frontend

```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Step 2: Backend Setup (FastAPI)

### 2.1 Navigate to Backend Directory

```bash
cd backend
```

### 2.2 Create Virtual Environment (Recommended)

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 2.3 Install Dependencies

```bash
pip install -r requirements.txt
```

### 2.4 Configure Environment

Create a `.env` file in the `backend` directory:

```bash
# backend/.env
SECRET_KEY=your-very-long-and-random-secret-key-change-this-in-production
ALGORITHM=HS256
```

### 2.5 Start Backend Server

```bash
# Using uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 5000

# Or using Python
python main.py
```

The backend will run on `http://localhost:5000`

## Step 3: Verify Connection

### 3.1 Check Backend Health

Open your browser and visit:
```
http://localhost:5000/api/health
```

You should see:
```json
{"status": "ok", "message": "WorkTrace API is running"}
```

### 3.2 Check API Documentation

Visit the Swagger UI:
```
http://localhost:5000/docs
```

### 3.3 Test Frontend Connection

1. Start both servers (frontend and backend)
2. Open `http://localhost:3000` in your browser
3. Try to register a new user
4. Check the browser console for any errors

## Troubleshooting

### Error: "Failed to fetch"

**Possible Causes:**

1. **Backend not running**
   - Solution: Make sure the FastAPI server is running on port 5000
   - Check: Visit `http://localhost:5000/api/health`

2. **CORS Error**
   - Solution: The backend CORS is already configured. Make sure your frontend URL matches one of the allowed origins in `backend/main.py`

3. **Wrong API URL**
   - Solution: Check your `.env` file has `REACT_APP_API_URL=http://localhost:5000/api`
   - Restart the React dev server after changing `.env`

4. **Port already in use**
   - Solution: Change the port in `backend/main.py` or stop the process using port 5000

### Error: "Module not found" (Backend)

**Solution:**
```bash
cd backend
pip install -r requirements.txt
```

### Error: "Cannot connect to backend"

**Check:**
1. Backend server is running
2. Port 5000 is not blocked by firewall
3. `.env` file has correct API URL
4. No proxy or VPN interfering

## Running Both Servers

### Option 1: Two Terminal Windows

**Terminal 1 (Frontend):**
```bash
npm start
```

**Terminal 2 (Backend):**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 5000
```

### Option 2: Using npm scripts (Recommended)

Add to `package.json`:

```json
{
  "scripts": {
    "start": "react-scripts start",
    "start:backend": "cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 5000",
    "dev": "concurrently \"npm start\" \"npm run start:backend\""
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

Then install concurrently:
```bash
npm install --save-dev concurrently
```

Run both:
```bash
npm run dev
```

## Production Deployment

### Frontend
1. Build the React app: `npm run build`
2. Serve the `build` folder using a web server (nginx, Apache, etc.)

### Backend
1. Use a production ASGI server like Gunicorn with Uvicorn workers
2. Set up proper environment variables
3. Use a real database (PostgreSQL, MongoDB, etc.)
4. Enable HTTPS
5. Configure proper CORS for your production domain

## Next Steps

1. Replace in-memory database with a real database
2. Add email verification for registration
3. Implement password reset functionality
4. Add file upload for avatars
5. Implement real-time updates with WebSockets
6. Add rate limiting and security middleware

## Support

If you encounter issues:
1. Check browser console for frontend errors
2. Check backend terminal for server errors
3. Verify both servers are running
4. Check network tab in browser DevTools for API requests
