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
      <div class="course-color" style="background:${course.color || '#7c6aff'}"></div>
      <h4>${course.name}</h4>
      <p>${course.description || 'Sin descripción'}</p>
    </div>
  `).join('');

  if (currentUser.role === 'admin') {
    const btn = document.createElement('div');
    btn.className = 'course-card add-course-btn';
    btn.innerHTML = '<span class="plus-icon">+</span> Nuevo Curso';
    btn.onclick = openCreateCourseModal;
    grid.appendChild(btn);
  }

  renderSidebarCourses();
}

function renderSidebarCourses() {
  const list = document.getElementById('coursesList');
  list.innerHTML = courses.map(course => `
    <button class="course-btn" onclick="enterCourse('${course._id}')" title="${course.name}">
      <div class="course-dot" style="background:${course.color || '#7c6aff'}"></div>
      <span>${course.name.substring(0, 18)}</span>
    </button>
  `).join('');
}

async function loadCourses() {
  try {
    const res = await fetch('/api/courses');
    courses = await res.json();
    renderHomePage();
  } catch (err) {
    showToast('Error cargando cursos', 'error');
  }
}

// ===== MODAL: CREAR CURSO =====
function openCreateCourseModal() {
  document.getElementById('courseName').value = '';
  document.getElementById('courseDescription').value = '';
  document.getElementById('courseColor').value = '#7c6aff';
  document.querySelectorAll('#createCourseModal .color-dot').forEach((d, i) => d.classList.toggle('selected', i === 0));
  document.getElementById('createCourseModal').style.display = 'flex';
}

function closeCreateCourseModal() {
  document.getElementById('createCourseModal').style.display = 'none';
}

function selectCourseColor(btn) {
  document.querySelectorAll('#createCourseModal .color-dot').forEach(d => d.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('courseColor').value = btn.dataset.color;
}

async function submitCreateCourse() {
  const name = document.getElementById('courseName').value.trim();
  if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
  const description = document.getElementById('courseDescription').value.trim();
  const color = document.getElementById('courseColor').value;

  try {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color })
    });
    const course = await res.json();
    if (course.error) throw new Error(course.error);
    courses.push(course);
    closeCreateCourseModal();
    renderHomePage();
    showToast('Curso creado exitosamente', 'success');
  } catch (err) {
    showToast('Error creando curso: ' + err.message, 'error');
  }
}

// ===== COURSE VIEW =====
async function enterCourse(courseId) {
  currentCourse = courses.find(c => c._id === courseId);
  if (!currentCourse) return;

  showView('courseView');
  document.getElementById('courseTitle').textContent = currentCourse.name;

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
    events = [];
  }
}

// ===== CALENDAR =====
// FIX: parse date as UTC to avoid timezone day-shift
function getEventUTCDate(event) {
  const d = new Date(event.date);
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
    year: d.getUTCFullYear()
  };
}

function renderCourseCalendar() {
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  document.getElementById('monthYearDisplay').textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const grid = document.getElementById('courseCalendarGrid');
  grid.innerHTML = '';

  // Cabeceras
  ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'calendar-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div');
    e.className = 'calendar-day empty';
    grid.appendChild(e);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';

    const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
    if (isToday) cell.classList.add('today');

    // FIX: compare using UTC date parts
    const dayEvents = events.filter(e => {
      const utc = getEventUTCDate(e);
      return utc.day === day && utc.month === currentMonth && utc.year === currentYear;
    });

    if (dayEvents.length > 0) {
      cell.classList.add('has-events');
      cell.onclick = () => showDayEventsModal(day, dayEvents);

      // Rayitas de color (máx 3)
      const strips = dayEvents.slice(0, 3).map(e =>
        `<div class="event-strip" style="background:${e.color || '#7c6aff'}"></div>`
      ).join('');

      cell.innerHTML = `
        <div class="day-number ${isToday ? 'today-dot' : ''}">${day}</div>
        <div class="event-strips">${strips}</div>
      `;
    } else {
      cell.innerHTML = `<div class="day-number ${isToday ? 'today-dot' : ''}">${day}</div>`;
    }

    grid.appendChild(cell);
  }
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

// ===== MODAL: EVENTOS DEL DÍA =====
function showDayEventsModal(day, dayEvents) {
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  document.getElementById('dayModalTitle').textContent = `📅 ${day} de ${monthNames[currentMonth]} ${currentYear}`;

  const list = document.getElementById('dayEventsList');
  list.innerHTML = dayEvents.map(e => `
    <div class="day-event-item" onclick="closeDayModalAndView('${e._id}')">
      <div class="event-color-bar" style="background:${e.color || '#7c6aff'}"></div>
      <div class="event-item-info">
        <h4>${e.title}</h4>
        <span class="event-tag-small" style="background:${e.color || '#7c6aff'}22; color:${e.color || '#7c6aff'}">${getEventTypeLabel(e.type)}</span>
        ${e.description ? `<p class="event-item-desc">${e.description}</p>` : ''}
      </div>
      <span class="event-arrow">→</span>
    </div>
  `).join('');

  document.getElementById('dayEventsModal').style.display = 'flex';
}

function closeDayModal() {
  document.getElementById('dayEventsModal').style.display = 'none';
}

function closeDayModalAndView(eventId) {
  closeDayModal();
  viewEvent(eventId);
}

// ===== MODAL: CREAR EVENTO =====
function openCreateEventModal() {
  document.getElementById('eventTitle').value = '';
  document.getElementById('eventDesc').value = '';
  document.getElementById('eventDate').value = '';
  document.getElementById('eventType').value = 'tarea';
  document.getElementById('eventColor').value = '#7c6aff';
  document.querySelectorAll('#createEventModal .color-dot').forEach((d, i) => d.classList.toggle('selected', i === 0));
  document.getElementById('createEventModal').style.display = 'flex';
}

function closeCreateEventModal() {
  document.getElementById('createEventModal').style.display = 'none';
}

function selectEventColor(btn) {
  document.querySelectorAll('#createEventModal .color-dot').forEach(d => d.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('eventColor').value = btn.dataset.color;
}

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
    if (event.error) throw new Error(event.error);
    events.push(event);
    closeCreateEventModal();
    renderCourseCalendar();
    showToast('Evento creado exitosamente', 'success');
  } catch (err) {
    showToast('Error creando evento: ' + err.message, 'error');
  }
}

// ===== EVENT VIEW =====
async function viewEvent(eventId) {
  currentEvent = events.find(e => e._id === eventId);
  if (!currentEvent) return;

  showView('eventView');

  // Barra de color superior
  const colorBar = document.getElementById('eventDetailColorBar');
  if (colorBar) colorBar.style.background = currentEvent.color || '#7c6aff';

  document.getElementById('eventDetailTitle').textContent = currentEvent.title;
  document.getElementById('eventDetailType').textContent = getEventTypeLabel(currentEvent.type);
  document.getElementById('eventDetailType').style.background = (currentEvent.color || '#7c6aff') + '22';
  document.getElementById('eventDetailType').style.color = currentEvent.color || '#7c6aff';

  // FIX: show UTC date correctly
  const utc = getEventUTCDate(currentEvent);
  const dateStr = new Date(currentEvent.date).toLocaleDateString('es-ES', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('eventDetailDate').textContent = `📅 ${dateStr}`;
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
  if (!comments.length) {
    list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:1rem;">Aún no hay comentarios. ¡Sé el primero!</p>';
    return;
  }
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
  } catch (err) {}
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
      showToast(completed ? 'Tarea completada ✅' : 'Tarea marcada incompleta', 'success');
    }
  } catch (err) {
    showToast('Error al actualizar tarea', 'error');
  }
}

function updateCompletionStatus() {
  const statusDiv = document.getElementById('completionStatus');
  const userCompletion = currentEvent.completions?.find(c => c.userId?.toString() === currentUser._id?.toString());

  if (userCompletion?.completed) {
    statusDiv.innerHTML = `<span style="color:#10b981;">✅ Completada el ${new Date(userCompletion.completedAt).toLocaleDateString('es-ES')}</span>`;
    document.getElementById('markCompletedBtn').classList.add('active');
    document.getElementById('markIncompleteBtn').classList.remove('active');
  } else if (userCompletion) {
    statusDiv.innerHTML = '<span style="color:#6b7280;">❌ Marcada como no completada</span>';
    document.getElementById('markIncompleteBtn').classList.add('active');
    document.getElementById('markCompletedBtn').classList.remove('active');
  } else {
    statusDiv.innerHTML = '<span style="color:#6b7280;">No has marcado esta tarea aún</span>';
    document.getElementById('markCompletedBtn').classList.remove('active');
    document.getElementById('markIncompleteBtn').classList.remove('active');
  }
}

// ===== EVENT REACTIONS =====
async function addEventReaction(type) {
  if (!currentEvent) return;
  try {
    await fetch(`/api/events/${currentEvent._id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    showToast('Reacción agregada', 'success');
  } catch (err) {}
}

// ===== UTILS =====
function getEventTypeLabel(type) {
  const labels = { tarea:'📝 Tarea', examen:'📋 Examen', proyecto:'🗂 Proyecto', exposicion:'🎤 Exposición', otro:'📌 Otro' };
  return labels[type] || type;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
