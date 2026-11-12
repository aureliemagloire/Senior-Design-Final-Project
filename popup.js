// Popup: shows the timer and sends commands to the background worker.
// The popup closes whenever the user clicks away, so it re-reads state from
// chrome.storage every time it opens and just counts down to `endTime`.

document.addEventListener('DOMContentLoaded', function() {

  const FOCUS_MINUTES = 25; 
  // only used for the idle display; keep in sync with background.js

  const els = {
    time: document.getElementById('time'),
    mode: document.getElementById('mode-label'),
    points: document.getElementById('points'),
    start: document.getElementById('start'),
    stop: document.getElementById('stop'),
    fill: document.getElementById('bar-fill'),
    skip: document.getElementById('skip'),

    // todo list
    todoInput: document.getElementById('todo-input'),
    addBtn: document.getElementById('add-btn'),
    todoList: document.getElementById('todo-list'),

    // tasksss
    currentTask: document.getElementById('current-task-name'),
    startHint: document.getElementById('start-hint')

  };

  let timer = { mode: 'idle', endTime: null, durationMs: 0 };
  let tasks = [];
  let currentTaskId = null;
  let editingId = null;
  let editDraft = '';

  function currentTask(){
    return tasks.find((t)=> t.id === currentTaskId && !t.done) ?? null;
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // timer 

  function renderTimer() {
    const running = timer.mode !== 'idle' && timer.endTime;
    const task = currentTask();

    document.body.classList.toggle('break', timer.mode === 'break');

    els.currentTask.textContent = task ? task.text : 'No task selected';
    els.currentTask.classList.toggle('is-empty', !task);

    if (!running) {
      els.time.textContent = formatTime(FOCUS_MINUTES * 60 * 1000);
      els.mode.textContent = 'Ready to focus';
      els.fill.style.width = '0%';
      els.start.hidden = false;
      els.start.disabled = !task; // doesnt start without task being selected
      els.startHint.hidden = !!task;
      els.stop.hidden = true;
      els.skip.hidden = true;
      return;
    }

    const remaining = timer.endTime - Date.now();
    const elapsed = timer.durationMs - remaining;

    els.time.textContent = formatTime(remaining);
    els.mode.textContent = timer.mode === 'focus' ? 'Focus time' : 'Break time';
    
    els.fill.style.width = `${Math.min(100, (elapsed / timer.durationMs) * 100)}%`;
    
    els.start.hidden = true;
    els.startHint.hidden = true;
    els.stop.hidden = false;
    els.skip.hidden = timer.mode !== 'break';
  }

  els.start.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'START_FOCUS' }));
  els.stop.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'STOP' }));
  els.skip.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'SKIP_BREAK' }));

  // to-dooo
  function iconButton(src, alt, label, onClick, disabled = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.disabled = disabled;
    btn.setAttribute('aria-label', label);
 
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.className = 'icon';
    img.width = 20;
    img.height = 20;
 
    btn.appendChild(img);
    btn.addEventListener('click', onClick);
    return btn;
  }
 
  async function addTask() {
    const text = els.todoInput.value.trim();
    if (text === '') {
      els.todoInput.focus();
      return;
    }
    const task = { id: crypto.randomUUID(), text, done: false };
    els.todoInput.value = '';
    await chrome.storage.local.set({ tasks: [...tasks, task] });
  }
 
  async function deleteTask(task) {
    const update = { tasks: tasks.filter((t) => t.id !== task.id) };
    if (task.id === currentTaskId) update.currentTaskId = null;
    if (task.id === editingId) editingId = null;
    await chrome.storage.local.set(update);
  }
 
  function startEdit(task) {
    editingId = task.id;
    editDraft = task.text;
    renderTodos();
    els.todoList.querySelector('.todo-edit-input')?.focus();
  }
 
  function cancelEdit() {
    editingId = null;
    renderTodos();
  }
 
  async function saveEdit(task) {
    const text = editDraft.trim();
    if (text === '') return; // task text can't be empty
    editingId = null;
    await chrome.storage.local.set({
      tasks: tasks.map((t) => (t.id === task.id ? { ...t, text } : t))
    });
  }
 
  function buildEditRow(task) {
    const row = document.createElement('div');
    row.className = 'todo-item';
 
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-edit-input';
    input.maxLength = 80;
    input.value = editDraft;
    input.setAttribute('aria-label', 'Edit task');
    input.addEventListener('input', () => { editDraft = input.value; });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') saveEdit(task);
      if (event.key === 'Escape') cancelEdit();
    });
 
    row.append(input, iconButton('icons/save.png', 'Save', 'Save changes', () => saveEdit(task)));
    return row;
  }
 
  function buildRow(task, focusLocked) {
    if (task.id === editingId && !task.done) return buildEditRow(task);
 
    const row = document.createElement('div');
    row.className = 'todo-item';
 
    if (task.done) {
      row.classList.add('todo-item--done');
      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = task.text;
      row.append(text, iconButton('icons/delete.png', 'Delete', `Delete "${task.text}"`, () => deleteTask(task)));
      return row;
    }
 
    // Radio = "this is the task I'm working on right now"
    const label = document.createElement('label');
    label.className = 'todo-select';
 
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'current-task';
    radio.checked = task.id === currentTaskId;
    radio.disabled = focusLocked; // don't switch tasks mid-focus-session
    radio.addEventListener('change', () => chrome.storage.local.set({ currentTaskId: task.id }));
 
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = task.text;
 
    label.append(radio, text);
 
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'todo-done-btn';
    doneBtn.textContent = 'Done';
    doneBtn.setAttribute('aria-label', `Mark "${task.text}" as done`);
    doneBtn.addEventListener('click', () =>
      chrome.runtime.sendMessage({ type: 'COMPLETE_TASK', taskId: task.id })
    );
 
    row.append(
      label,
      doneBtn,
      iconButton('icons/edit.png', 'Edit', `Edit "${task.text}"`, () => startEdit(task)),
      iconButton('icons/delete.png', 'Delete', `Delete "${task.text}"`, () => deleteTask(task),
        focusLocked && task.id === currentTaskId)
    );
    if (task.id === currentTaskId) row.classList.add('todo-item--current');
    return row;
  }
 
  function renderTodos() {
    const focusLocked = timer.mode === 'focus';
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
 
    // The task being edited may have been deleted or finished elsewhere
    if (editingId && !open.some((t) => t.id === editingId)) editingId = null;
 
    els.todoList.replaceChildren(...[...open, ...done].map((t) => buildRow(t, focusLocked)));
  }
 
  els.addBtn.addEventListener('click', addTask);
  els.todoInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addTask();
  });
  
  // load saved data

  async function loadState() {
    try {
      const data = await chrome.storage.local.get(['timer', 'brainPoints', 'tasks', 'currentTaskId']);
      
      timer = data.timer ?? timer;

      tasks = Array.isArray(data.tasks) ? data.tasks : [];

      currentTaskId = data.currentTaskId ?? null;

      els.points.textContent = data.brainPoints ?? 0;

      renderTimer()
      renderTodos();
    } catch (error){
    console.error('error loading daved data: ', error);
  }
}

  // Update instantly when the background changes state
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local')  loadState();
  });

    loadState();
    setInterval(renderTimer, 250);
  
  });