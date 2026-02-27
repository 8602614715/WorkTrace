import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { taskAPI } from '../services/api';
import './CalendarView.css';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);

const isoDate = (date) => {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().split('T')[0];
};

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const isOverdueTask = (task) =>
  !!task?.dueDate && task.status !== 'completed' && startOfDay(task.dueDate) < todayDate;

const CalendarView = () => {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()));
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
  });

  const loadTasks = useCallback(async () => {
    try {
      const data = await taskAPI.getAll();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      addToast('Unable to load calendar tasks.', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const taskMap = useMemo(() => {
    return tasks.reduce((acc, task) => {
      if (!task.dueDate) return acc;
      if (!acc[task.dueDate]) acc[task.dueDate] = [];
      acc[task.dueDate].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const monthGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startOffset = first.getDay();
    const totalDays = last.getDate();
    const totalSlots = Math.ceil((startOffset + totalDays) / 7) * 7;
    const cells = [];
    for (let i = 0; i < totalSlots; i += 1) {
      const day = i - startOffset + 1;
      const cellDate = new Date(year, month, day);
      const inMonth = day >= 1 && day <= totalDays;
      cells.push({ date: cellDate, inMonth, key: isoDate(cellDate) });
    }
    return cells;
  }, [currentMonth]);

  const selectedTasks = useMemo(() => {
    const items = taskMap[selectedDate] || [];
    return [...items].sort((a, b) => {
      const statusRank = { todo: 0, inProgress: 1, completed: 2 };
      return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    });
  }, [selectedDate, taskMap]);

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) {
      addToast('Task title is required.', 'error');
      return;
    }
    try {
      setIsAdding(true);
      await taskAPI.create({
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        dueDate: selectedDate,
        priority: newTask.priority,
        status: newTask.status,
      });
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo' });
      addToast('Task added to calendar day.', 'success');
      await loadTasks();
    } catch (error) {
      addToast('Failed to add task.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const moveMonth = (offset) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className={`calendar-planner ${theme}`}>
      <div className="planner-main">
        <div className="calendar-header">
          <h2 className="section-title">Planner Calendar</h2>
          <div className="calendar-controls">
            <button type="button" onClick={() => moveMonth(-1)}>Prev</button>
            <span>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => moveMonth(1)}>Next</button>
          </div>
        </div>

        <div className="calendar-grid">
          {weekdayLabels.map((label) => (
            <div key={label} className="weekday-cell">{label}</div>
          ))}
          {monthGrid.map((cell) => {
            const dayTasks = taskMap[cell.key] || [];
            const isToday = cell.key === isoDate(new Date());
            const isSelected = cell.key === selectedDate;

            return (
              <button
                key={`${cell.key}-${cell.inMonth}`}
                type="button"
                className={`day-cell ${cell.inMonth ? '' : 'muted'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedDate(cell.key)}
              >
                <div className="day-head">
                  <span className="day-number">{cell.date.getDate()}</span>
                  <span className="day-count">{dayTasks.length || ''}</span>
                </div>
                <div className="day-tasks">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className={`calendar-task ${isOverdueTask(task) ? 'overdue' : ''}`}>
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && <div className="calendar-more">+{dayTasks.length - 3} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="day-panel">
        <div className="day-panel-header">
          <h3>{selectedDateLabel}</h3>
          <span>{selectedTasks.length} tasks</span>
        </div>

        <form className="quick-add-form" onSubmit={handleQuickAdd}>
          <input
            value={newTask.title}
            onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Add task for this day"
          />
          <textarea
            rows="2"
            value={newTask.description}
            onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Optional details"
          />
          <div className="quick-add-row">
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value }))}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={newTask.status}
              onChange={(e) => setNewTask((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="todo">To Do</option>
              <option value="inProgress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <button type="submit" disabled={isAdding}>{isAdding ? 'Adding...' : 'Add'}</button>
          </div>
        </form>

        <div className="day-task-list">
          {selectedTasks.length === 0 ? (
            <div className="panel-empty">No tasks for this day yet.</div>
          ) : (
            selectedTasks.map((task) => (
              <div key={task.id} className={`panel-task ${isOverdueTask(task) ? 'overdue' : ''}`}>
                <div className="panel-task-top">
                  <strong>{task.title}</strong>
                  <span className={`panel-status status-${task.status}`}>{task.status}</span>
                </div>
                {task.description && <p>{task.description}</p>}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};

export default CalendarView;
