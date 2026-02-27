# WorkTrace - Task & Project Management Dashboard

A modern, full-stack task and project management dashboard built with React (Frontend) and FastAPI (Backend), featuring authentication, role-based access control, light and dark theme support, smooth animations, and a beautiful UI.

## 🚀 Quick Start

See [QUICK_START.md](./QUICK_START.md) for a 5-minute setup guide.

## Features

- ✅ **User Authentication**: Registration, Login, and Logout
- 🔐 **Role-Based Access Control**: Admin, Manager, and User roles
- ✅ **Task Management**: Full CRUD operations with Kanban-style board
- 📊 **Project Overview**: Circular progress indicator showing project completion
- 👥 **Team Members**: Track team member activities and task assignments
- 📅 **Upcoming Deadlines**: View and manage project deadlines
- 📈 **Analytics & Insights**: Task completion rate charts and productivity scores
- 🌓 **Theme Toggle**: Switch between light and dark themes
- 🎨 **Smooth Animations**: Beautiful transitions and hover effects
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🔄 **Dynamic Data**: All data fetched from FastAPI backend

## Tech Stack

### Frontend
- React 18.2.0
- React Icons
- CSS3 with animations
- Context API for state management

### Backend
- FastAPI (Python)
- JWT Authentication
- CORS enabled
- Pydantic for data validation

## Installation

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
REACT_APP_API_URL=http://localhost:5000/api
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file:
```bash
SECRET_KEY=your-secret-key-change-in-production
```

5. Start the backend server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 5000
```

6. API will be available at [http://localhost:5000](http://localhost:5000)
7. API Documentation at [http://localhost:5000/docs](http://localhost:5000/docs)

## Project Structure

```
WorkTrace/
├── src/                      # React Frontend
│   ├── components/          # React components
│   │   ├── Dashboard.js
│   │   ├── Header.js
│   │   ├── Login.js
│   │   ├── MyTasks.js
│   │   └── ...
│   ├── context/             # React contexts
│   │   ├── AuthContext.js
│   │   └── ThemeContext.js
│   ├── services/            # API services
│   │   └── api.js
│   └── App.js
├── backend/                 # FastAPI Backend
│   ├── main.py              # Main FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── README.md            # Backend documentation
├── .env                     # Frontend environment variables
└── README.md
```

## Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 5-minute setup guide
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Detailed setup instructions
- **[BACKEND_API.md](./BACKEND_API.md)** - Complete API documentation
- **[backend/README.md](./backend/README.md)** - Backend-specific documentation

## API Endpoints

All endpoints are prefixed with `/api`:

- **Auth**: `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/me`
- **Tasks**: `/api/tasks` (GET, POST), `/api/tasks/{id}` (GET, PUT, DELETE, PATCH)
- **Projects**: `/api/projects/overview`
- **Team**: `/api/team/members`
- **Deadlines**: `/api/deadlines`
- **Analytics**: `/api/analytics/task-completion`, `/api/analytics/productivity`

## Theme Support

The application supports both light and dark themes. The theme preference is saved to localStorage and persists across sessions. Toggle the theme using the sun/moon icon in the header.

## Troubleshooting

### "Failed to fetch" Error

1. Ensure backend is running on port 5000
2. Check `.env` file has `REACT_APP_API_URL=http://localhost:5000/api`
3. Restart React dev server after creating `.env`
4. Check browser console for detailed error messages

### Backend Connection Issues

1. Verify backend is running: Visit `http://localhost:5000/api/health`
2. Check CORS configuration in `backend/main.py`
3. Ensure no firewall blocking port 5000

## Build for Production

### Frontend
```bash
npm run build
```
This creates an optimized production build in the `build` folder.

### Backend
Use a production ASGI server like Gunicorn with Uvicorn workers.

## License

MIT
