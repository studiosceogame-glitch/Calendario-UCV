// ===== GLOBAL STATE =====
let currentUser = null;
let courses = [];
let currentCourse = null;
let currentEvent = null;
let events = [];
let comments = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// ===== INIT =====
function initializeDashboard(user) {
  currentUser = user;
  document.getElementById('profileAvatar').src = user.avatar || '';
  document.getElementById('profileName').textContent = user.name;
  document.getElementById('profileRole').textContent = user.role === 'admin' ? 'Administrador' : 'Estudiante';
  loadCourses();
}

function logout() {
  fetch('/auth/logout').then(() => window.location.href = '/');
}

// ===== NAVIGATION =====
function goHome() {
  showView('homeView');
  renderHomePage();
}

function showView(id) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== HOME =====
function renderHomePage() {
  showView('homeView');
  const grid = document.getElementById('homeCoursesGrid');
  grid.innerHTML = courses.map(c => `
    <div class="course-card" onclick="enterCourse('${c._id}')">
      <div class="course-color" style="background:${c.color || '#7c6aff'}"></div>
      <h4>${c.name}</h4>
      <p>${c.description || 'Sin descripción'}</p>
    </div>
  `).join('');

  if (currentUser.role === 'admin') {
    const btn = document.createElement('div');
    btn.className = 'course-card add-course-btn';
    btn.innerHTML = `
      <div class="add-course-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <span>Nuevo Curso</span>
    `;
    btn.onclick = openCreateCourseModal;
    grid.appendChild(btn);
  }
  renderSidebarCourses();
}

function renderSidebarCourses() {
  document.getElementById('coursesList').innerHTML = courses.map(c => `
    <button class="course-btn" onclick="enterCourse('${c._id}')">
      <div class="course-dot" style="background:${c.color || '#7c6aff'}"></div>
      <span>${c.name.substring(0, 18)}</span>
    </button>
  `).join('');
}

async function loadCourses() {
  try {
    const res = await fetch('/api/courses');
    courses = await res.json();
    renderHomePage();
  } catch (e) {
    showToast('Error cargando cursos', 'error');
  }
}

// ===== MODAL: CREAR CURSO =====
function openCreateCourseModal() {
  document.getElementById('courseName').value = '';
  document.getElementById('courseDescription').value = '';
  document.getElementById('courseColor').value = '#7c6aff';
  resetColorPicker('courseColorPicker', '#7c6aff');
  document.getElementById('createCourseModal').style.display = 'flex';
}
function closeCreateCourseModal() {
  document.getElementById('createCourseModal').style.display = 'none';
}
function selectCourseColor(btn) {
  document.querySelectorAll('#courseColorPicker .color-dot').forEach(d => d.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('courseColor').value = btn.dataset.color;
}
async function submitCreateCourse() {
  const name = document.getElementById('courseName').value.trim();
  if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
  try {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: document.getElementById('courseDescription').value.trim(),
        color: document.getElementById('courseColor').value
      })
    });
    const course = await res.json();
    if (course.error) throw new Error(course.error);
    courses.push(course);
    closeCreateCourseModal();
    renderHomePage();
    showToast('Curso creado', 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ===== COURSE VIEW =====
async function enterCourse(courseId) {
  currentCourse = courses.find(c => c._id === courseId);
  if (!currentCourse) return;

  showView('courseView');
  document.getElementById('courseTitle').textContent = currentCourse.name;

  const fab = document.getElementById('fabCreateEvent');
  fab.style.display = currentUser.role === 'admin' ? 'flex' : 'none';

  currentMonth = new Date().getMonth();
  currentYear = new Date().getFullYear();
  await loadCourseEvents();
  renderCourseCalendar();
}

async function loadCourseEvents() {
  try {
    const res = await fetch(`/api/courses/${currentCourse._id}/events`);
    events = await res.json();
  } catch (e) {
    events = [];
  }
}

// ===== CALENDAR =====
// Parse date string "YYYY-MM-DD" or ISO directly as UTC to avoid timezone shift
function parseDateUTC(dateVal) {
  if (!dateVal) return null;
  // Handle both "YYYY-MM-DD" and full ISO strings
  const s = typeof dateVal === 'string' ? dateVal : new Date(dateVal).toISOString();
  const [year, month, day] = s.substring(0, 10).split('-').map(Number);
  return { year, month: month - 1, day }; // month is 0-indexed
}

function renderCourseCalendar() {
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('monthYearDisplay').textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const grid = document.getElementById('courseCalendarGrid');
  grid.innerHTML = '';

  ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'calendar-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'calendar-day empty';
    grid.appendChild(el);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';

    const isToday = day === todayDay && currentMonth === todayMonth && currentYear === todayYear;
    if (isToday) cell.classList.add('today');

    // KEY FIX: parse date as "YYYY-MM-DD" substring to avoid any timezone issues
    const dayEvents = events.filter(e => {
      const p = parseDateUTC(e.date);
      return p && p.day === day && p.month === currentMonth && p.year === currentYear;
    });

    if (dayEvents.length > 0) {
      cell.classList.add('has-events');
      cell.onclick = () => openSlidePanel(day, dayEvents);

      const strips = dayEvents.slice(0, 4).map(e =>
        `<div class="event-strip" style="background:${e.color || '#7c6aff'}"></div>`
      ).join('');

      cell.innerHTML = `
        <div class="day-number">${day}</div>
        <div class="event-strips">${strips}</div>
      `;
    } else {
      cell.innerHTML = `<div class="day-number">${day}</div>`;
      if (isToday) cell.onclick = null;
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

// ===== SLIDE PANEL =====
function openSlidePanel(day, dayEvents) {
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  document.getElementById('slidePanelTitle').textContent = `${day} de ${monthNames[currentMonth]}`;
  document.getElementById('slidePanelSub').textContent =
    dayEvents.length === 1 ? '1 actividad' : `${dayEvents.length} actividades`;

  const content = document.getElementById('slidePanelContent');
  content.innerHTML = dayEvents.map(e => `
    <div class="slide-event-card" onclick="openEventFromPanel('${e._id}')">
      <div class="slide-event-color" style="background:${e.color || '#7c6aff'}"></div>
      <div class="slide-event-body">
        <div class="slide-event-type">
          <div class="type-dot" style="background:${e.color || '#7c6aff'}"></div>
          <span class="slide-event-type-label">${getTypeLabel(e.type)}</span>
        </div>
        <h4 class="slide-event-title">${e.title}</h4>
        ${e.description ? `<p class="slide-event-desc">${e.description}</p>` : ''}
        <div class="slide-event-author">
          <div class="author-dot"></div>
          <span>${e.authorName || 'Docente'}</span>
        </div>
      </div>
      <div class="slide-event-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  `).join('');

  document.getElementById('slideOverlay').classList.add('active');
  document.getElementById('slidePanel').classList.add('open');
}

function closeSlidePanel() {
  document.getElementById('slideOverlay').classList.remove('active');
  document.getElementById('slidePanel').classList.remove('open');
}

function openEventFromPanel(eventId) {
  closeSlidePanel();
  viewEvent(eventId);
}

// ===== MODAL: CREAR EVENTO =====
function openCreateEventModal() {
  document.getElementById('eventTitle').value = '';
  document.getElementById('eventDesc').value = '';
  document.getElementById('eventDate').value = '';
  document.getElementById('eventType').value = 'tarea';
  document.getElementById('eventColor').value = '#7c6aff';
  resetColorPicker('eventColorPicker', '#7c6aff');
  document.querySelectorAll('#typePicker .type-btn').forEach((b, i) => b.classList.toggle('selected', i === 0));
  document.getElementById('createEventModal').style.display = 'flex';
}
function closeCreateEventModal() {
  document.getElementById('createEventModal').style.display = 'none';
}
function selectEventColor(btn) {
  document.querySelectorAll('#eventColorPicker .color-dot').forEach(d => d.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('eventColor').value = btn.dataset.color;
}
function selectType(btn) {
  document.querySelectorAll('#typePicker .type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('eventType').value = btn.dataset.type;
}

async function createEvent(e) {
  e.preventDefault();
  if (!currentCourse || currentUser.role !== 'admin') return;

  const dateVal = document.getElementById('eventDate').value; // "YYYY-MM-DD"
  if (!dateVal) { showToast('Selecciona una fecha', 'error'); return; }

  const body = {
    title: document.getElementById('eventTitle').value.trim(),
    description: document.getElementById('eventDesc').value.trim(),
    date: dateVal,
    type: document.getElementById('eventType').value,
    color: document.getElementById('eventColor').value || '#7c6aff'
  };

  try {
    const res = await fetch(`/api/courses/${currentCourse._id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const event = await res.json();
    if (event.error) throw new Error(event.error);
    events.push(event);
    closeCreateEventModal();
    renderCourseCalendar();
    showToast('Evento creado', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== EVENT DETAIL VIEW =====
async function viewEvent(eventId) {
  currentEvent = events.find(e => e._id === eventId);
  if (!currentEvent) return;

  showView('eventView');

  const bar = document.getElementById('eventDetailColorBar');
  bar.style.background = currentEvent.color || '#7c6aff';

  document.getElementById('eventDetailTitle').textContent = currentEvent.title;

  const typeEl = document.getElementById('eventDetailType');
  typeEl.textContent = getTypeLabel(currentEvent.type);
  typeEl.style.background = (currentEvent.color || '#7c6aff') + '22';
  typeEl.style.color = currentEvent.color || '#7c6aff';
  typeEl.style.borderColor = (currentEvent.color || '#7c6aff') + '55';

  const p = parseDateUTC(currentEvent.date);
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const dayName = days[new Date(currentEvent.date).getUTCDay()];
  document.getElementById('eventDetailDate').textContent = `${dayName} ${p.day} de ${months[p.month]} ${p.year}`;
  document.getElementById('eventDetailAuthor').textContent = currentEvent.authorName || 'Docente';

  const descEl = document.getElementById('eventDetailDesc');
  descEl.textContent = currentEvent.description || '';
  descEl.style.display = currentEvent.description ? 'block' : 'none';

  const taskSection = document.getElementById('taskCompletionSection');
  taskSection.style.display = currentEvent.type === 'tarea' ? 'block' : 'none';
  if (currentEvent.type === 'tarea') updateCompletionStatus();

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
  } catch (e) { comments = []; }
}

function renderComments() {
  const list = document.getElementById('commentsList');
  if (!comments.length) {
    list.innerHTML = '<p class="empty-comments">Sin comentarios aún. Sé el primero.</p>';
    return;
  }
  list.innerHTML = comments.map(c => {
    const date = new Date(c.createdAt);
    const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
    return `
      <div class="comment">
        <div class="comment-header">
          <img src="${c.authorAvatar || ''}" alt="" class="comment-avatar" onerror="this.style.display='none'" />
          <div class="comment-author">
            <strong>${c.authorName}</strong>
            <span class="comment-date">${dateStr}</span>
          </div>
        </div>
        <p class="comment-text">${c.text}</p>
        <div class="comment-reactions">
          <button class="reaction-btn" onclick="addReaction('${c._id}','like')">
            <span class="react-count">${c.reactions?.like || 0}</span> Me gusta
          </button>
          <button class="reaction-btn" onclick="addReaction('${c._id}','love')">
            <span class="react-count">${c.reactions?.love || 0}</span> Genial
          </button>
          <button class="reaction-btn" onclick="addReaction('${c._id}','haha')">
            <span class="react-count">${c.reactions?.haha || 0}</span> Jajaja
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function submitComment() {
  const text = document.getElementById('newComment').value.trim();
  if (!text || !currentEvent) return;
  try {
    const res = await fetch(`/api/events/${currentEvent._id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const c = await res.json();
    comments.push(c);
    document.getElementById('newComment').value = '';
    renderComments();
    showToast('Comentario publicado', 'success');
  } catch (e) { showToast('Error', 'error'); }
}

async function addReaction(commentId, type) {
  try {
    await fetch(`/api/comments/${commentId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    await loadComments();
  } catch (e) {}
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
      showToast(completed ? 'Tarea completada' : 'Marcada incompleta', 'success');
    }
  } catch (e) { showToast('Error', 'error'); }
}

function updateCompletionStatus() {
  const uid = currentUser._id?.toString();
  const comp = currentEvent.completions?.find(c => c.userId?.toString() === uid);
  const statusDiv = document.getElementById('completionStatus');
  const btnDone = document.getElementById('markCompletedBtn');
  const btnNot = document.getElementById('markIncompleteBtn');

  if (comp?.completed) {
    const p = parseDateUTC(comp.completedAt);
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    statusDiv.innerHTML = `<span class="status-ok">Completada el ${p.day} ${months[p.month]} ${p.year}</span>`;
    btnDone.classList.add('active'); btnNot.classList.remove('active');
  } else if (comp) {
    statusDiv.innerHTML = `<span class="status-no">No completada</span>`;
    btnNot.classList.add('active'); btnDone.classList.remove('active');
  } else {
    statusDiv.innerHTML = `<span class="status-pending">Sin marcar</span>`;
    btnDone.classList.remove('active'); btnNot.classList.remove('active');
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
    showToast('Reaccion agregada', 'success');
  } catch (e) {}
}

// ===== UTILS =====
function getTypeLabel(type) {
  const m = { tarea:'Tarea', examen:'Examen', proyecto:'Proyecto', exposicion:'Exposicion', otro:'Otro' };
  return m[type] || type;
}

function resetColorPicker(pickerId, defaultColor) {
  document.querySelectorAll(`#${pickerId} .color-dot`).forEach(d => {
    d.classList.toggle('selected', d.dataset.color === defaultColor);
  });
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}
