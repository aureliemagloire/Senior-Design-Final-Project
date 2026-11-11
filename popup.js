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
    todoList: document.getElementById('todo-list')

  };

  let timer = { mode: 'idle', endTime: null, durationMs: 0 };
  let todos = [];

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function renderTimer() {
    const running = timer.mode !== 'idle' && timer.endTime;
    document.body.classList.toggle('break', timer.mode === 'break');

    if (!running) {
      els.time.textContent = formatTime(FOCUS_MINUTES * 60 * 1000);
      els.mode.textContent = 'Ready to focus';
      els.fill.style.width = '0%';
      els.start.hidden = false;
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
    els.stop.hidden = false;
    els.skip.hidden = timer.mode !== 'break';
  }

  // load saved data

  async function loadState() {
    try {
      const [localData, syncData] = await Promise.all([
      chrome.storage.local.get(['timer', 'brainPoints']),
      chrome.storage.sync.get('todos')
      ]);

      timer = localData.timer ?? timer;
      els.points.textContent = localData.brainPoints ?? 0;

      //saved todos
      todos = Array.isArray(syncData.todos) ? syncData.todos : [];

      renderTimer()
      renderTodos();
  } catch (error){
    console.error('error loading daved data: ', error);
  }
}

  els.start.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'START_FOCUS' }));
  els.stop.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'STOP' }));
  els.skip.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'STOP'}));

  // todo list functions
  els.addBtn.addEventListener('click', function () {
        const taskTitle = els.todoInput.value.trim();

        if (taskTitle === '') {
            alert('Please enter a task!');
            return;
        }

        todos.push({ title: taskTitle });

        els.todoInput.value = '';

        saveAndRender();
    });

    // Allow users to press Enter to add a task
    els.todoInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            els.addBtn.click();
        }
    });

    // Save tasks to Chrome sync storage
    async function saveAndRender() {
        try {
            await chrome.storage.sync.set({ todos: todos });
            renderTodos();
        } catch (error) {
            console.error('Error saving tasks:', error);
            alert('Unable to save your tasks. Please try again.');
        }
    }

    // Display all tasks
    function renderTodos() {
        els.todoList.innerHTML = '';

        todos.forEach((todo, index) => {
            const divEl = document.createElement('div');
            divEl.className = 'todo-item';
            divEl.id = `todo-${index}`;

            // Task text
            const textEl = document.createElement('span');
            textEl.className = 'todo-text';
            textEl.textContent = todo.title;

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'icon-btn';
            editBtn.type = 'button';

            const editImg = document.createElement('img');
            editImg.src = 'icons/edit.png';
            editImg.alt = 'Edit';
            editImg.className = 'icon';
            editImg.width = 20;
            editImg.height = 20;

            editBtn.appendChild(editImg);

            editBtn.addEventListener('click', function () {
                editTodo(index);
            });

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-btn';
            deleteBtn.type = 'button';

            const deleteImg = document.createElement('img');
            deleteImg.src = 'icons/delete.png';
            deleteImg.alt = 'Delete';
            deleteImg.className = 'icon';
            deleteImg.width = 20;
            deleteImg.height = 20;

            deleteBtn.appendChild(deleteImg);

            deleteBtn.addEventListener('click', function () {
                deleteTodo(index);
            });

            // Add elements to the task container
            divEl.appendChild(textEl);
            divEl.appendChild(editBtn);
            divEl.appendChild(deleteBtn);

            els.todoList.appendChild(divEl);
        });
    }

     // Delete a task
    function deleteTodo(index) {
        todos.splice(index, 1);
        saveAndRender();
    }

    // Change a task into edit mode
    function editTodo(index) {
        const taskDiv = document.getElementById(`todo-${index}`);

        // Clear the task container
        taskDiv.innerHTML = '';

        // Create an input field
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.id = `edit-${index}`;
        editInput.value = todos[index].title;

        // Create a save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'icon-btn';
        saveBtn.type = 'button';

        const saveImg = document.createElement('img');
        saveImg.src = 'icons/save.png';
        saveImg.alt = 'Save';
        saveImg.className = 'icon';
        saveImg.width = 20;
        saveImg.height = 20;

        saveBtn.appendChild(saveImg);

        saveBtn.addEventListener('click', function () {
            saveTodo(index);
        });

        // Press Enter to save the edited task
        editInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                saveTodo(index);
            }
        });

        taskDiv.appendChild(editInput);
        taskDiv.appendChild(saveBtn);

        editInput.focus();
    }

    // Save an edited task
    function saveTodo(index) {
        const editEl = document.getElementById(`edit-${index}`);
        const newValue = editEl.value.trim();

        if (newValue === '') {
            alert('Task cannot be empty!');
            return;
        }

        todos[index].title = newValue;

        saveAndRender();
    }

  // Update instantly when the background changes state
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.timer || changes.brainPoints)) {
            loadState();
        }

        // Update tasks if sync storage changes
    if (area === 'sync' && changes.todos) {
        todos = Array.isArray(changes.todos.newValue)
                ? changes.todos.newValue
                : [];

            renderTodos();
        }
    });

    loadState();
    setInterval(renderTimer, 250);
  
  });