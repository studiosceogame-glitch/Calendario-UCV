// ===== GLOBAL STATE =====
let currentUser = null;
let courses = [];
let currentCourse = null;
let currentEvent = null;
let events = [];
let comments = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// ===== AUTHENTICATION =====
function initializeDashboard(user) {
  currentUser = user;
  showDashboard();
  loadCourses();
}

function showDashboard() {
  document.getElementById('profileAvatar').src = currentUser.avatar || '';
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileRole').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Estudiante';
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
    showToast('Error creando curso', 'error');
  }
}

// ===== COURSE VIEW =====
async function enterCourse(courseId) {
  currentCourse = courses.find(c => c._id === courseId);
  if (!currentCourse) return;

  showView('courseView');
  document.getElementById('courseTitle').textContent = currentCourse.name;

  // Mostrar FAB solo para admin
  const fab = document.getElementById('fabCreateEvent');
  if (fab) fab.style.display = currentUser.role === 'admin' ? 'flex' : 'none';

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

  // Cabeceras días
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  dayNames.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = day;
    grid.appendChild(header);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();

  // Celdas vacías
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    grid.appendChild(empty);
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';

    // Marcar hoy
    if (day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      cell.classList.add('today');
    }

    const dayEvents = events.filter(e => {
      const d = new Date(e.date);
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    if (dayEvents.length > 0) {
      cell.classList.add('has-events');
      cell.onclick = () => showDayEventsModal(day, dayEvents);

      // Rayitas de color por evento (máximo 3 visibles)
      const dots = dayEvents.slice(0, 3).map(e =>
        `<div class="event-strip" style="background:${e.color || '#7c6aff'}"></div>`
      ).join('');

      cell.innerHTML = `
        <div class="day-number">${day}</div>
        <div class="event-strips">${dots}</div>
      `;
    } else {
      cell.innerHTML = `<div class="day-number">${day}</div>`;
    }

    grid.appendChild(cell);
  }
}

function showDayEventsModal(day, dayEvents) {
  // Cerrar modales anteriores
  document.querySelectorAll('.modal-overlay.day-modal').forEach(m => m.remove());

  const modal = document.createElement('div');
  modal.className = 'modal-overlay day-modal';
  modal.innerHTML = `
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">✕</button>
      <h3 style="margin:0 0 1.5rem 0;">📅 Eventos del ${day} de ${getMonthName(currentMonth)}</h3>
      <div class="day-events">
        ${dayEvents.map(e => `
          <div class="day-event-item" onclick="closeDayModalAndView('${e._id}')">
            <div class="event-color-bar" style="background:${e.color || '#7c6aff'}"></div>
            <div class="event-item-info">
              <h4>${e.title}</h4>
              <p>${getEventTypeLabel(e.type)}</p>
              ${e.description ? `<p class="event-item-desc">${e.description}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  modal.onclick = (ev) => { if (ev.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function closeDayModalAndView(eventId) {
  document.querySelectorAll('.modal-overlay.day-modal').forEach(m => m.remove());
  viewEvent(eventId);
}

function getMonthName(month) {
  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return names[month];
}

function getEventTypeLabel(type) {
  const labels = {
    tarea: '📝 Tarea',
    examen: '📋 Examen',
    proyecto: '🗂 Proyecto',
    exposicion: '🎤 Exposición',
    otro: '📌 Otro'
  };
  return labels[type] || type;
}

function previousMonth() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCourseCalendar();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCourseCalendar();
}

// ===== MODAL CREAR EVENTO =====
function openCreateEventModal() {
  const modal = document.getElementById('createEventModal');
  if (modal) {
    modal.style.display = 'flex';
    // Reset form
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDesc').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventType').value = 'tarea';
    document.getElementById('eventColor').value = '#7c6aff';
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
    const first = document.querySelector('.color-dot');
    if (first) first.classList.add('selected');
  }
}

function closeCreateEventModal() {
  const modal = document.getElementById('createEventModal');
  if (modal) modal.style.display = 'none';
}

function handleModalBackdropClick(e) {
  if (e.target === document.getElementById('createEventModal')) {
    closeCreateEventModal();
  }
}

function selectColor(btn) {
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('eventColor').value = btn.dataset.color;
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
    color: document.getElementById('eventColor').value || '#7c6aff'
  };

  try {
    const res = await fetch(`/api/courses/${currentCourse._id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    const event = await res.json();
    events.push(event);
    closeCreateEventModal();
    renderCourseCalendar();
    showToast('Evento creado exitosamente', 'success');
  } catch (err) {
    showToast('Error creando evento', 'error');
  }
}

async function viewEvent(eventId) {
  currentEvent = events.find(e => e._id === eventId);
  if (!currentEvent) return;

  showView('eventView');
  document.getElementById('eventDetailTitle').textContent = currentEvent.title;
  document.getElementById('eventDetailType').textContent = getEventTypeLabel(currentEvent.type);
  document.getElementById('eventDetailDate').textContent = `📅 ${new Date(currentEvent.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  document.getElementById('eventDetailAuthor').textContent = `👤 ${currentEvent.authorName}`;
  document.getElementById('eventDetailDesc').textContent = currentEvent.description || '';

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
    comments = [];
  }
}

function renderComments() {
  const list = document.getElementById('commentsList');
  list.innerHTML = comments.map(comment => `
    <div class="comment">
      <div class="comment-header">
        <img src="${comment.authorAvatar || ''}" alt="" class="comment-avatar" onerror="this.style.display='none'" />
        <div class="comment-author">
          <strong>${comment.authorName}</strong>
          <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString('es-ES')}</span>
        </div>
      </div>
      <p class="comment-text">${comment.text}</p>
      <div class="comment-reactions">
        <button class="reaction-btn" onclick="addReaction('${comment._id}', 'like')">👍 ${comment.reactions?.like || 0}</button>
        <button class="reaction-btn" onclick="addReaction('${comment._id}', 'love')">❤️ ${comment.reactions?.love || 0}</button>
        <button class="reaction-btn" onclick="addReaction('${comment._id}', 'haha')">😂 ${comment.reactions?.haha || 0}</button>
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
    showToast('Error publicando comentario', 'error');
  }
}

async function addReaction(commentId, type) {
  try {
    await fetch(`/api/comments/${commentId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
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
      currentEvent = await res.json();
      updateCompletionStatus();
      showToast(completed ? 'Tarea marcada como completada' : 'Tarea marcada como incompleta', 'success');
    }
  } catch (err) {
    showToast('Error al actualizar tarea', 'error');
  }
}

function updateCompletionStatus() {
  const statusDiv = document.getElementById('completionStatus');
  const userCompletion = currentEvent.completions?.find(c => c.userId === currentUser._id);

  if (userCompletion?.completed) {
    statusDiv.innerHTML = `<span style="color:#10b981;">✅ Completada el ${new Date(userCompletion.completedAt).toLocaleDateString('es-ES')}</span>`;
    document.getElementById('markCompletedBtn').classList.add('active');
    document.getElementById('markIncompleteBtn').classList.remove('active');
  } else if (userCompletion) {
    statusDiv.innerHTML = '<span style="color:#6b7280;">❌ No completada</span>';
    document.getElementById('markIncompleteBtn').classList.add('active');
    document.getElementById('markCompletedBtn').classList.remove('active');
  } else {
    statusDiv.innerHTML = '<span style="color:#6b7280;">No has marcado esta tarea aún</span>';
    document.getElementById('markCompletedBtn').classList.remove('active');
    document.getElementById('markIncompleteBtn').classList.remove('active');
  }
}

// ===== EVENT REACTIONS =====
async function addEventReaction(reactionType) {
  if (!currentEvent) return;
  try {
    await fetch(`/api/events/${currentEvent._id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: reactionType })
    });
    showToast('Reacción agregada', 'success');
  } catch (err) {
    showToast('Error al agregar reacción', 'error');
  }
}

// ===== UTILITIES =====
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
