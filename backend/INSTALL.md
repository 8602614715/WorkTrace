# Backend Installation Guide

## Fixing Import Errors

If you're seeing import errors like:
- `Import "fastapi" could not be resolved`
- `Import "jose" could not be resolved`
- etc.

This means the Python packages are not installed. Follow these steps:

## Quick Setup (Windows)

1. **Open Command Prompt or PowerShell in the `backend` folder**

2. **Run the setup script:**
   ```bash
   setup.bat
   ```

   Or manually:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Start the server:**
   ```bash
   venv\Scripts\activate
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## Quick Setup (Linux/Mac)

1. **Open Terminal in the `backend` folder**

2. **Run the setup script:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

   Or manually:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Start the server:**
   ```bash
   source venv/bin/activate
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## Manual Installation

If the scripts don't work, follow these steps:

### Step 1: Create Virtual Environment

**Windows:**
```bash
python -m venv venv
```

**Linux/Mac:**
```bash
python3 -m venv venv
```

### Step 2: Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### Step 3: Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Verify Installation

```bash
python -c "import fastapi; print('FastAPI installed successfully')"
```

### Step 5: Start Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Troubleshooting

### "python: command not found"

- **Windows**: Use `py` instead of `python`
- **Linux/Mac**: Install Python 3.8+ or use `python3`

### "pip: command not found"

- Install pip: `python -m ensurepip --upgrade`
- Or use: `python -m pip install -r requirements.txt`

### "ModuleNotFoundError" when running

- Make sure virtual environment is activated (you should see `(venv)` in terminal)
- Reinstall packages: `pip install -r requirements.txt`

### Port 8000 already in use

- Change port in `main.py` (last line): `port=8000` to `port=5000`
- Update frontend `.env`: `REACT_APP_API_URL=http://localhost:5000/api`

## VS Code / IDE Setup

If your IDE still shows import errors after installation:

1. **Select Python Interpreter:**
   - Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
   - Type "Python: Select Interpreter"
   - Choose the interpreter from `backend/venv/Scripts/python.exe` (Windows) or `backend/venv/bin/python` (Linux/Mac)

2. **Reload Window:**
   - Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
   - Type "Developer: Reload Window"

## Verify Everything Works

1. **Start backend:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Test in browser:**
   - Visit: `http://localhost:8000/api/health`
   - Should see: `{"status": "ok", "message": "WorkTrace API is running"}`

3. **Check API docs:**
   - Visit: `http://localhost:8000/docs`

## Next Steps

Once backend is running:
1. Update frontend `.env` file: `REACT_APP_API_URL=http://localhost:8000/api`
2. Start frontend: `npm start`
3. Test registration and login
