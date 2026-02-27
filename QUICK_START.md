# Quick Start Guide - WorkTrace Full Stack

## 🚀 Quick Setup (5 minutes)

### Step 1: Frontend Setup

```bash
# Install dependencies
npm install

# Create .env file
echo "REACT_APP_API_URL=http://localhost:8000/api" > .env

# Start frontend (in one terminal)
npm start
```

### Step 2: Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment (Windows)
python -m venv venv
venv\Scripts\activate

# OR (Linux/Mac)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "SECRET_KEY=your-secret-key-change-in-production" > .env

# Start backend (in another terminal)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Test It!

1. **Backend Health Check**: Open `http://localhost:8000/api/health`
2. **API Docs**: Open `http://localhost:8000/docs`
3. **Frontend**: Open `http://localhost:3000`
4. **Register**: Create a new account
5. **Login**: Use your credentials

## ✅ Verification Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] Can access `http://localhost:8000/api/health`
- [ ] Can register a new user
- [ ] Can login with registered user
- [ ] Dashboard loads after login

## 🔧 Troubleshooting

### "Failed to fetch" Error

**Solution:**
1. Make sure backend is running: `http://localhost:8000/api/health`
2. Check `.env` file has `REACT_APP_API_URL=http://localhost:8000/api`
3. Restart React dev server after creating `.env`
4. If you see import errors in Python, see `backend/INSTALL.md`

### Port Already in Use

**Solution:**
- Change backend port in `backend/main.py` (line with `port=5000`)
- Update `REACT_APP_API_URL` in frontend `.env`

### Module Not Found / Import Errors (Backend)

**Solution:**
1. Make sure virtual environment is activated (you should see `(venv)` in terminal)
2. Install dependencies:
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # Windows
   # OR: source venv/bin/activate  # Linux/Mac
   pip install -r requirements.txt
   ```
3. See `backend/INSTALL.md` for detailed instructions

## 📝 Next Steps

1. Read `SETUP_GUIDE.md` for detailed instructions
2. Read `backend/README.md` for backend-specific info
3. Read `BACKEND_API.md` for API documentation

## 🎯 What's Working

- ✅ User Registration
- ✅ User Login/Logout
- ✅ Task CRUD Operations
- ✅ Project Overview
- ✅ Team Members
- ✅ Deadlines
- ✅ Analytics
- ✅ Role-Based Access Control
- ✅ Light/Dark Theme
