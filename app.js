// ===== GLOBAL STATE =====
let currentUser = null;
let courses = [];
let currentCourse = null;
let currentEvent = null;
let events = [];
let comments = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// ===== INITIALIZATION =====
// Removed DOMContentLoaded listener since each page handles its own init

// ===== AUTHENTICATION =====
function initializeDashboard(user) {
  currentUser = user;
  showDashboard();
  loadCourses();
}

function showDashboard() {
  // Set profile info
  document.getElementById('profileAvatar').src = currentUser.avatar || '';
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileRole').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Estudiante';
  
  // Show admin section if admin
  if (currentUser.role === 'admin') {
    document.getElementById('adminSection').style.display = 'block';
  }
}

function logout() {
  fetch('/auth/logout').then(() => window.location.href = '/');
}

// ===== NAVIGATION =====
function goHome() {
  showView('homeView');
  renderHomePage();
}

function showView(viewId) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

// ===== HOME PAGE =====
function renderHomePage() {
  showView('homeView');
  const grid = document.getElementById('homeCoursesGrid');
  grid.innerHTML = courses.map(course => `
    <div class="course-card" onclick="enterCourse('${course._id}')">
      <div class="course-color" style="background: ${course.color || '#7c6aff'}"></div>
      <h4>${course.name}</h4>
      <p>${course.description || 'Sin descripción'}</p>
    </div>
  `).join('');

  if (currentUser.role === 'admin') {
    const createBtn = document.createElement('button');
    createBtn.className = 'course-card add-course-btn';
    createBtn.innerHTML = '<span class="plus-icon">+</span> Nuevo Curso';
    createBtn.onclick = createNewCourse;
    grid.appendChild(createBtn);
  }

  renderSidebarCourses();
}

function renderSidebarCourses() {
  const list = document.getElementById('coursesList');
  list.innerHTML = courses.map(course => `
    <button class="course-btn" onclick="enterCourse('${course._id}')" title="${course.name}">
      <div class="course-dot" style="background: ${course.color || '#7c6aff'}"></div>
      <span>${course.name.substring(0, 15)}</span>
    </button>
  `).join('');
}

async function loadCourses() {
  try {
    const res = await fetch('/api/courses');
    courses = await res.json();
    renderHomePage();
  } catch (err) {
    console.error('Error loading courses:', err);
    showToast('Error cargando cursos', 'error');
  }
}

async function createNewCourse() {
  const name = prompt('Nombre del curso:');
  if (!name) return;
  const description = prompt('Descripción (opcional):');
  const color = prompt('Color (ej: #ff5733):', '#7c6aff');

  try {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color })
    });
    const course = await res.json();
    courses.push(course);
    renderHomePage();
    showToast('Curso creado exitosamente', 'success');
  } catch (err) {
    console.error('Error creating course:', err);
    showToast('Error creando curso', 'error');
  }
}

// ===== COURSE VIEW =====
async function enterCourse(courseId) {
  currentCourse = courses.find(c => c._id === courseId);
  if (!currentCourse) return;

  showView('courseView');
  document.getElementById('courseTitle').textContent = currentCourse.name;
  
  // Reset calendar to current month
  currentMonth = new Date().getMonth();
  currentYear = new Date().getFullYear();
  
  await loadCourseEvents();
  renderCourseCalendar();
}

async function loadCourseEvents() {
  if (!currentCourse) return;
  try {
    const res = await fetch(`/api/courses/${currentCourse._id}/events`);
    events = await res.json();
  } catch (err) {
    console.error('Error loading events:', err);
    events = [];
  }
}

function renderCourseCalendar() {
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  document.getElementById('monthYearDisplay').textContent = `${monthNames[currentMonth]} ${currentYear}`;
  
  const grid = document.getElementById('courseCalendarGrid');
  grid.innerHTML = '';

  // Day headers
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  dayNames.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = day;
    grid.appendChild(header);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Empty cells
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    grid.appendChild(empty);
  }

  // Days with events
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';

    const dayEvents = events.filter(e => {
      const d = new Date(e.date);
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    if (dayEvents.length > 0) {
      cell.classList.add('has-events');
      cell.innerHTML = `
        <div class="day-number">${day}</div>
        <div class="event-badge">${dayEvents.length}</div>
      `;
      cell.onclick = () => showDayEventsModal(day, dayEvents);
    } else {
      cell.innerHTML = `<div class="day-number">${day}</div>`;
    }

    grid.appendChild(cell);
  }
}

function showDayEventsModal(day, dayEvents) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="close-modal" onclick="this.parentElement.parentElement.remove()">✕</button>
      <h3>${dayEvents[0]?.authorName ? '' : ''}Eventos del ${day}</h3>
      <div class="day-events">
        ${dayEvents.map(e => `
          <div class="day-event-item" onclick="viewEvent('${e._id}')">
            <div class="event-color" style="border-left: 4px solid ${e.color || '#7c6aff'}"></div>
            <div>
              <h4>${e.title}</h4>
              <p>${e.type}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function previousMonth() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCourseCalendar();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCourseCalendar();
}

// ===== EVENT MANAGEMENT =====
async function createEvent(e) {
  e.preventDefault();
  if (!currentCourse || currentUser.role !== 'admin') return;

  const eventData = {
    title: document.getElementById('eventTitle').value,
    description: document.getElementById('eventDesc').value,
    date: document.getElementById('eventDate').value,
    type: document.getElementById('eventType').value,
    color: '#7c6aff'
  };

  try {
    const res = await fetch(`/api/courses/${currentCourse._id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    const event = await res.json();
    events.push(event);
    renderCourseCalendar();
    document.querySelector('.event-form').reset();
    showToast('Evento creado exitosamente', 'success');
  } catch (err) {
    console.error('Error creating event:', err);
    showToast('Error creando evento', 'error');
  }
}

async function viewEvent(eventId) {
  currentEvent = events.find(e => e._id === eventId);
  if (!currentEvent) return;

  showView('eventView');
  document.getElementById('eventDetailTitle').textContent = currentEvent.title;
  document.getElementById('eventDetailType').textContent = `Tipo: ${currentEvent.type}`;
  document.getElementById('eventDetailDate').textContent = `Fecha: ${new Date(currentEvent.date).toLocaleDateString('es-ES')}`;
  document.getElementById('eventDetailAuthor').textContent = `Autor: ${currentEvent.authorName}`;
  document.getElementById('eventDetailDesc').textContent = currentEvent.description;

  // Show task completion controls only for tasks
  const taskSection = document.getElementById('taskCompletionSection');
  if (currentEvent.type === 'tarea') {
    taskSection.style.display = 'block';
    updateCompletionStatus();
  } else {
    taskSection.style.display = 'none';
  }

  await loadComments();
}

function backToCalendar() {
  showView('courseView');
}

// ===== COMMENTS =====
async function loadComments() {
  if (!currentEvent) return;
  try {
    const res = await fetch(`/api/events/${currentEvent._id}/comments`);
    comments = await res.json();
    renderComments();
  } catch (err) {
    console.error('Error loading comments:', err);
    comments = [];
  }
}

function renderComments() {
  const list = document.getElementById('commentsList');
  list.innerHTML = comments.map(comment => `
    <div class="comment">
      <div class="comment-header">
        <img src="${comment.authorAvatar || ''}" alt="" class="comment-avatar" />
        <div class="comment-author">
          <strong>${comment.authorName}</strong>
          <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <p class="comment-text">${comment.text}</p>
      <div class="comment-reactions">
        <button class="reaction-btn" onclick="addReaction('${comment._id}', 'like')">
          <span class="reaction-icon">□</span> ${comment.reactions?.like || 0}
        </button>
        <button class="reaction-btn" onclick="addReaction('${comment._id}', 'love')">
          <span class="reaction-icon">♥</span> ${comment.reactions?.love || 0}
        </button>
        <button class="reaction-btn" onclick="addReaction('${comment._id}', 'haha')">
          <span class="reaction-icon">◇</span> ${comment.reactions?.haha || 0}
        </button>
      </div>
    </div>
  `).join('');
}

async function submitComment() {
  if (!currentEvent) return;
  const text = document.getElementById('newComment').value.trim();
  if (!text) return;

  try {
    const res = await fetch(`/api/events/${currentEvent._id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const comment = await res.json();
    comments.push(comment);
    document.getElementById('newComment').value = '';
    renderComments();
    showToast('Comentario publicado', 'success');
  } catch (err) {
    console.error('Error adding comment:', err);
    showToast('Error publicando comentario', 'error');
  }
}

async function addReaction(commentId, type) {
  try {
    const res = await fetch(`/api/comments/${commentId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    await res.json();
    await loadComments();
  } catch (err) {
    console.error('Error adding reaction:', err);
  }
}

// ===== TASK COMPLETION =====
async function toggleTaskCompletion(completed) {
  if (!currentEvent) return;

  try {
    const res = await fetch(`/api/events/${currentEvent._id}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed })
    });

    if (res.ok) {
      const updatedEvent = await res.json();
      currentEvent = updatedEvent;
      updateCompletionStatus();
      showToast(completed ? 'Tarea marcada como completada' : 'Tarea marcada como incompleta', 'success');
    } else {
      showToast('Error al actualizar tarea', 'error');
    }
  } catch (err) {
    console.error('Error updating task completion:', err);
    showToast('Error al actualizar tarea', 'error');
  }
}

function updateCompletionStatus() {
  const statusDiv = document.getElementById('completionStatus');
  const userCompletion = currentEvent.completions?.find(c => c.userId === currentUser._id);

  if (userCompletion) {
    if (userCompletion.completed) {
      statusDiv.innerHTML = `<span style="color: #10b981;">✅ Completada el ${new Date(userCompletion.completedAt).toLocaleDateString()}</span>`;
      document.getElementById('markCompletedBtn').classList.add('active');
      document.getElementById('markIncompleteBtn').classList.remove('active');
    } else {
      statusDiv.innerHTML = '<span style="color: #6b7280;">❌ No completada</span>';
      document.getElementById('markIncompleteBtn').classList.add('active');
      document.getElementById('markCompletedBtn').classList.remove('active');
    }
  } else {
    statusDiv.innerHTML = '<span style="color: #6b7280;">No has marcado esta tarea aún</span>';
    document.getElementById('markCompletedBtn').classList.remove('active');
    document.getElementById('markIncompleteBtn').classList.remove('active');
  }
}

// ===== EVENT REACTIONS =====
async function addEventReaction(reactionType) {
  if (!currentEvent) return;

  try {
    const res = await fetch(`/api/events/${currentEvent._id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: reactionType })
    });

    if (res.ok) {
      showToast(`Reacción ${reactionType} agregada`, 'success');
    } else {
      showToast('Error al agregar reacción', 'error');
    }
  } catch (err) {
    console.error('Error adding event reaction:', err);
    showToast('Error al agregar reacción', 'error');
  }
}

// ===== UTILITIES =====
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}
