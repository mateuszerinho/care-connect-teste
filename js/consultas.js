/* ============================================================
   CARE+ CONNECT  ·  consultas.js  v2.0
   Módulo completo de Agendamentos e Reagendamentos

   Funcionalidades:
   ─ Wizard multi-etapa com progresso visual
   ─ Gerenciamento de estado centralizado (AppointmentStore)
   ─ Persistência via localStorage (com TTL de 7 dias)
   ─ Validação por etapa com feedback rico
   ─ Detecção de conflito de horários
   ─ Recomendações inteligentes de horário
   ─ Countdown para próxima consulta
   ─ Undo ao cancelar (toast com botão de desfazer)
   ─ Swipe-to-dismiss nos cards (mobile)
   ─ Filtro e ordenação das consultas agendadas
   ─ Notificação de lembrete in-app
   ─ Animação skeleton loading
   ─ Drag-over highlight no calendário
   ─ Points preview antes de confirmar
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   CONSTANTES DE CONFIGURAÇÃO
   ────────────────────────────────────────────────────────────── */
const CONFIG = {
  STORAGE_KEY:      'cc_appointments_v2',
  STORAGE_TTL_DAYS: 7,
  POINTS_MORNING:   40,   // pontos extras para consultas no período da manhã
  POINTS_BASE:      20,   // pontos base por agendamento
  POINTS_CONFIRM:   10,   // pontos por confirmar com antecedência
  UNDO_TIMEOUT:     5000, // ms para desfazer cancelamento
  SWIPE_THRESHOLD:  80,   // px para confirmar swipe
  REMINDER_ADVANCE: 120,  // minutos de antecedência para notificação in-app
};

/* ──────────────────────────────────────────────────────────────
   DADOS: Médicos, disponibilidade e horários bloqueados
   ────────────────────────────────────────────────────────────── */
const DOCTORS_DB = {
  card: [
    { id: 'dr-carlos',   name: 'Dr. Carlos Mendes',   crm: '12345', avatar: '🧑‍⚕️', rating: 4.9, wait: '~10 min', modalities: ['online', 'presencial'] },
    { id: 'dra-fernanda', name: 'Dra. Fernanda Lima',  crm: '67890', avatar: '👩‍⚕️', rating: 4.8, wait: '~5 min',  modalities: ['online'] },
  ],
  derm: [
    { id: 'dra-julia',  name: 'Dra. Julia Ramos',  crm: '11111', avatar: '👩‍⚕️', rating: 4.7, wait: '~15 min', modalities: ['presencial'] },
    { id: 'dr-rafael',  name: 'Dr. Rafael Costa',  crm: '22222', avatar: '🧑‍⚕️', rating: 4.6, wait: '~20 min', modalities: ['presencial'] },
  ],
  orto: [
    { id: 'dra-ana',    name: 'Dra. Ana Paula Costa', crm: '33333', avatar: '👩‍⚕️', rating: 4.9, wait: '~8 min',  modalities: ['presencial'] },
    { id: 'dr-bruno',   name: 'Dr. Bruno Alves',       crm: '44444', avatar: '🧑‍⚕️', rating: 4.5, wait: '~25 min', modalities: ['presencial'] },
  ],
  endo: [
    { id: 'dr-marcos',  name: 'Dr. Marcos Faria',  crm: '55555', avatar: '🧑‍⚕️', rating: 4.8, wait: '~12 min', modalities: ['online', 'presencial'] },
    { id: 'dra-carla',  name: 'Dra. Carla Vieira', crm: '66666', avatar: '👩‍⚕️', rating: 4.7, wait: '~18 min', modalities: ['online'] },
  ],
  clin: [
    { id: 'dr-leo',     name: 'Dr. Leonardo Souza',  crm: '77777', avatar: '🧑‍⚕️', rating: 4.6, wait: '~5 min',  modalities: ['online', 'presencial'] },
    { id: 'dra-pat',    name: 'Dra. Patrícia Santos', crm: '88888', avatar: '👩‍⚕️', rating: 4.9, wait: '~10 min', modalities: ['online', 'presencial'] },
  ],
  ped: [
    { id: 'dr-andre',   name: 'Dr. André Campos', crm: '99999', avatar: '🧑‍⚕️', rating: 4.8, wait: '~15 min', modalities: ['presencial'] },
    { id: 'dra-renata', name: 'Dra. Renata Luz',   crm: '10101', avatar: '👩‍⚕️', rating: 4.9, wait: '~8 min',  modalities: ['online', 'presencial'] },
  ],
};

const SPEC_NAMES = {
  card: 'Cardiologia', derm: 'Dermatologia', orto: 'Ortopedia',
  endo: 'Endocrinologia', clin: 'Clínico Geral', ped: 'Pediatria',
};

const SPEC_ICONS = {
  card: '❤️', derm: '✨', orto: '🦴', endo: '⚡', clin: '🩺', ped: '👶',
};

// Horários bloqueados por médico (simulação de agenda real)
const BLOCKED_SLOTS = {
  'dr-carlos':   { '2025-10-24': ['14:00', '14:30'], '2025-10-25': ['09:00'] },
  'dra-fernanda': { '2025-10-24': ['09:30', '10:00'] },
  'dra-ana':     { '2025-10-25': ['10:30'] },
};

const ALL_SLOTS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                   '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'];

const MORNING_SLOTS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30'];

/* ──────────────────────────────────────────────────────────────
   STORE — Gerenciamento de estado centralizado
   ────────────────────────────────────────────────────────────── */
const AppointmentStore = (() => {
  let state = {
    appointments: [],
    draft: {
      step: 1,
      spec: null,
      doctor: null,
      date: null,
      time: null,
      modality: null,
      notes: '',
      isRescheduling: false,
      rescheduleId: null,
    },
    filters: { sort: 'date-asc', status: 'all' },
    undoQueue: [],
    totalPoints: 320,
  };

  const listeners = [];

  function subscribe(fn) { listeners.push(fn); }
  function notify(event, payload) { listeners.forEach(fn => fn(event, payload)); }

  function getState() { return state; }

  // ── Persistência ──────────────────────────────────────────
  function save() {
    const payload = {
      appointments: state.appointments,
      totalPoints:  state.totalPoints,
      savedAt:      Date.now(),
    };
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(payload)); } catch (_) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return _seedInitialData();
      const data = JSON.parse(raw);
      const ageMs = Date.now() - (data.savedAt || 0);
      if (ageMs > CONFIG.STORAGE_TTL_DAYS * 86400000) return _seedInitialData();
      state.appointments = data.appointments || [];
      state.totalPoints  = data.totalPoints  || 320;
    } catch (_) { _seedInitialData(); }
  }

  function _seedInitialData() {
    state.appointments = [
      {
        id: 'apt-001', spec: 'card', specName: 'Cardiologia', specIcon: '❤️',
        doctorId: 'dr-carlos', doctorName: 'Dr. Carlos Mendes', doctorAvatar: '🧑‍⚕️',
        date: '2025-10-24', time: '14:00', modality: 'online',
        status: 'confirmed', notes: '', createdAt: Date.now() - 86400000,
      },
      {
        id: 'apt-002', spec: 'orto', specName: 'Ortopedia', specIcon: '🦴',
        doctorId: 'dra-ana', doctorName: 'Dra. Ana Paula Costa', doctorAvatar: '👩‍⚕️',
        date: '2025-10-25', time: '10:30', modality: 'presencial',
        status: 'confirmed', notes: 'Trazer exames de raio-X', createdAt: Date.now() - 172800000,
      },
    ];
    save();
  }

  // ── Draft (wizard state) ─────────────────────────────────
  function setDraftField(field, value) {
    state.draft[field] = value;
    notify('draft:change', { field, value });
  }

  function resetDraft(isRescheduling = false, rescheduleId = null) {
    state.draft = {
      step: 1, spec: null, doctor: null, date: null, time: null,
      modality: null, notes: '', isRescheduling, rescheduleId,
    };
    if (rescheduleId) {
      const apt = state.appointments.find(a => a.id === rescheduleId);
      if (apt) {
        state.draft.spec   = apt.spec;
        state.draft.doctor = DOCTORS_DB[apt.spec]?.find(d => d.id === apt.doctorId) || null;
        state.draft.step   = 2; // pula direto para médico
      }
    }
    notify('draft:reset', state.draft);
  }

  // ── Appointments CRUD ────────────────────────────────────
  function addAppointment(aptData) {
    const newApt = {
      id: 'apt-' + Date.now(),
      ...aptData,
      status: 'confirmed',
      createdAt: Date.now(),
    };
    state.appointments.push(newApt);
    state.totalPoints += _calcPoints(aptData);
    save();
    notify('appointment:added', newApt);
    return newApt;
  }

  function updateAppointment(id, changes) {
    const idx = state.appointments.findIndex(a => a.id === id);
    if (idx === -1) return null;
    state.appointments[idx] = { ...state.appointments[idx], ...changes };
    save();
    notify('appointment:updated', state.appointments[idx]);
    return state.appointments[idx];
  }

  function removeAppointment(id) {
    const apt = state.appointments.find(a => a.id === id);
    if (!apt) return;
    state.appointments = state.appointments.filter(a => a.id !== id);
    save();
    notify('appointment:removed', apt);
    return apt;
  }

  function enqueueUndo(apt) {
    const entry = { apt, timer: null };
    entry.timer = setTimeout(() => {
      state.undoQueue = state.undoQueue.filter(e => e.apt.id !== apt.id);
    }, CONFIG.UNDO_TIMEOUT);
    state.undoQueue.push(entry);
  }

  function executeUndo(aptId) {
    const entry = state.undoQueue.find(e => e.apt.id === aptId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    state.undoQueue = state.undoQueue.filter(e => e.apt.id !== aptId);
    state.appointments.push(entry.apt);
    save();
    notify('appointment:restored', entry.apt);
    return true;
  }

  // ── Helpers ───────────────────────────────────────────────
  function _calcPoints(aptData) {
    let pts = CONFIG.POINTS_BASE;
    if (MORNING_SLOTS.includes(aptData.time)) pts += CONFIG.POINTS_MORNING;
    return pts;
  }

  function isSlotBlocked(doctorId, dateStr, time) {
    const blocked = BLOCKED_SLOTS[doctorId]?.[dateStr] || [];
    // também bloqueia se já existe outro agendamento nesse slot
    const hasConflict = state.appointments.some(
      a => a.doctorId === doctorId && a.date === dateStr && a.time === time
    );
    return blocked.includes(time) || hasConflict;
  }

  function getFilteredAppointments() {
    let list = [...state.appointments];
    if (state.filters.status !== 'all') {
      list = list.filter(a => a.status === state.filters.status);
    }
    if (state.filters.sort === 'date-asc') {
      list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    } else if (state.filters.sort === 'date-desc') {
      list.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    }
    return list;
  }

  function getNextAppointment() {
    const now = new Date();
    return state.appointments
      .filter(a => new Date(`${a.date}T${a.time}`) > now)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null;
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    notify('filter:change', state.filters);
  }

  return {
    load, save, getState, subscribe,
    setDraftField, resetDraft,
    addAppointment, updateAppointment, removeAppointment,
    enqueueUndo, executeUndo,
    isSlotBlocked, getFilteredAppointments, getNextAppointment,
    setFilter,
  };
})();


/* ──────────────────────────────────────────────────────────────
   TOAST RICO (com botão de ação opcional)
   ────────────────────────────────────────────────────────────── */
const RichToast = (() => {
  let container;

  function _getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'rich-toast-container';
      Object.assign(container.style, {
        position: 'fixed', bottom: '90px', left: '50%',
        transform: 'translateX(-50%)', zIndex: '9999',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '8px', pointerEvents: 'none', width: '90%', maxWidth: '380px',
      });
      document.body.appendChild(container);
    }
    return container;
  }

  function show({ msg, type = 'default', duration = 3000, action = null }) {
    const el = document.createElement('div');
    el.className = 'cc-toast rich-toast';
    el.style.cssText = `
      background:${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#1e293b'};
      color:#fff; padding:12px 16px; border-radius:12px;
      font-size:14px; font-weight:500; box-shadow:0 4px 20px rgba(0,0,0,.25);
      width:100%; text-align:left; pointer-events:all;
      display:flex; align-items:center; gap:10px;
      animation:toastIn .3s ease;
    `;

    const msgSpan = document.createElement('span');
    msgSpan.style.flex = '1';
    msgSpan.textContent = msg;
    el.appendChild(msgSpan);

    if (action) {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.style.cssText = `
        background:rgba(255,255,255,.25); border:none; border-radius:8px;
        color:#fff; font-size:13px; font-weight:700; padding:5px 12px;
        cursor:pointer; font-family:var(--font); flex-shrink:0;
        transition:background .15s;
      `;
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,.4)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,.25)');
      btn.addEventListener('click', () => {
        action.fn();
        el.remove();
      });
      el.appendChild(btn);
    }

    _getContainer().appendChild(el);

    const timer = setTimeout(() => _dismiss(el), duration);
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target === msgSpan) { clearTimeout(timer); _dismiss(el); }
    });
  }

  function _dismiss(el) {
    el.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }

  return { show };
})();


/* ──────────────────────────────────────────────────────────────
   WIZARD RENDERER — Renderiza cada etapa do formulário
   ────────────────────────────────────────────────────────────── */
const WizardRenderer = (() => {

  function renderStep(step, container) {
    const renderers = { 1: _step1, 2: _step2, 3: _step3, 4: _step4, 5: _step5 };
    const fn = renderers[step];
    if (!fn || !container) return;

    container.style.opacity = '0';
    container.style.transform = 'translateX(20px)';
    container.innerHTML = '';
    fn(container);

    requestAnimationFrame(() => {
      container.style.transition = 'opacity .28s ease, transform .28s ease';
      container.style.opacity = '1';
      container.style.transform = 'translateX(0)';
    });
  }

  // ── Step 1: Especialidade ─────────────────────────────────
  function _step1(el) {
    const { draft } = AppointmentStore.getState();
    el.innerHTML = `
      <div class="wizard-step-header">
        <div class="wizard-step-icon">🏥</div>
        <div>
          <div class="wizard-step-title">Qual especialidade você precisa?</div>
          <div class="wizard-step-sub">Selecione a área médica desejada</div>
        </div>
      </div>
      <div class="spec-grid wizard-spec-grid" id="wiz-spec-grid"></div>
    `;

    const grid = el.querySelector('#wiz-spec-grid');
    Object.entries(SPEC_NAMES).forEach(([key, name]) => {
      const card = document.createElement('div');
      card.className = 'spec-card wizard-spec-card' + (draft.spec === key ? ' selected' : '');
      card.dataset.spec = key;
      if (draft.spec === key) card.style.background = _getSpecBg(key);
      card.innerHTML = `
        <span class="spec-icon">${SPEC_ICONS[key]}</span>
        <span class="spec-label">${name}</span>
        <span class="spec-doctor-count">${DOCTORS_DB[key].length} médicos</span>
      `;
      card.addEventListener('click', () => {
        grid.querySelectorAll('.spec-card').forEach(c => {
          c.classList.remove('selected');
          c.style.background = '';
        });
        card.classList.add('selected');
        card.style.background = _getSpecBg(key);
        AppointmentStore.setDraftField('spec', key);
        AppointmentStore.setDraftField('doctor', null);
        AppointmentStore.setDraftField('time', null);
      });
      grid.appendChild(card);
    });
  }

  // ── Step 2: Médico + Modalidade ───────────────────────────
  function _step2(el) {
    const { draft } = AppointmentStore.getState();
    if (!draft.spec) {
      el.innerHTML = `<div class="wizard-empty"><i class="bi bi-arrow-left-circle"></i><p>Volte e selecione uma especialidade</p></div>`;
      return;
    }
    const doctors = DOCTORS_DB[draft.spec] || [];

    el.innerHTML = `
      <div class="wizard-step-header">
        <div class="wizard-step-icon">${SPEC_ICONS[draft.spec]}</div>
        <div>
          <div class="wizard-step-title">${SPEC_NAMES[draft.spec]}</div>
          <div class="wizard-step-sub">Escolha seu médico</div>
        </div>
      </div>
      <div id="wiz-doctor-list"></div>
      <div id="wiz-modality-wrap" style="display:none;margin-top:16px">
        <div class="wizard-section-label">Modalidade da consulta</div>
        <div id="wiz-modality-btns" class="modality-group"></div>
      </div>
    `;

    const list = el.querySelector('#wiz-doctor-list');
    doctors.forEach(doc => {
      const row = document.createElement('div');
      row.className = 'doctor-row wizard-doctor-row' + (draft.doctor?.id === doc.id ? ' selected' : '');
      row.innerHTML = `
        <span class="doctor-avatar">${doc.avatar}</span>
        <div class="doctor-info">
          <div class="doctor-name">${doc.name}</div>
          <div class="doctor-meta">
            <span class="doctor-crm">CRM ${doc.crm}</span>
            <span class="doctor-rating"><i class="bi bi-star-fill"></i> ${doc.rating}</span>
            <span class="doctor-wait"><i class="bi bi-clock"></i> ${doc.wait}</span>
          </div>
          <div class="doctor-modalities">${doc.modalities.map(m => `<span class="modality-tag modality-${m}">${m === 'online' ? '📹 Online' : '🏥 Presencial'}</span>`).join('')}</div>
        </div>
        <i class="bi bi-check-circle-fill doctor-check${draft.doctor?.id === doc.id ? '' : ' d-none'}"></i>
      `;
      row.addEventListener('click', () => {
        list.querySelectorAll('.doctor-row').forEach(r => {
          r.classList.remove('selected');
          r.querySelector('.doctor-check')?.classList.add('d-none');
        });
        row.classList.add('selected');
        row.querySelector('.doctor-check')?.classList.remove('d-none');
        AppointmentStore.setDraftField('doctor', doc);
        AppointmentStore.setDraftField('modality', doc.modalities[0]);
        _renderModalityPicker(el, doc);
      });
      list.appendChild(row);
    });

    if (draft.doctor) _renderModalityPicker(el, draft.doctor);
  }

  function _renderModalityPicker(el, doc) {
    const wrap = el.querySelector('#wiz-modality-wrap');
    const btns = el.querySelector('#wiz-modality-btns');
    if (!wrap || !btns) return;
    wrap.style.display = 'block';
    btns.innerHTML = '';
    const { draft } = AppointmentStore.getState();
    doc.modalities.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'modality-btn' + (draft.modality === m ? ' active' : '');
      btn.innerHTML = m === 'online'
        ? '<i class="bi bi-camera-video-fill"></i> Online (Videochamada)'
        : '<i class="bi bi-building"></i> Presencial (Clínica)';
      btn.addEventListener('click', () => {
        btns.querySelectorAll('.modality-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppointmentStore.setDraftField('modality', m);
      });
      btns.appendChild(btn);
    });
  }

  // ── Step 3: Calendário ────────────────────────────────────
  function _step3(el) {
    const { draft } = AppointmentStore.getState();
    el.innerHTML = `
      <div class="wizard-step-header">
        <div class="wizard-step-icon">📅</div>
        <div>
          <div class="wizard-step-title">Quando você prefere?</div>
          <div class="wizard-step-sub">Selecione a data da consulta</div>
        </div>
      </div>
      <div id="wiz-calendar-wrap"></div>
      <div id="wiz-date-tip" class="wiz-tip" style="display:none"></div>
    `;
    _buildCalendar(el.querySelector('#wiz-calendar-wrap'));
  }

  function _buildCalendar(container) {
    const { draft } = AppointmentStore.getState();
    const today = new Date();
    let month = today.getMonth(), year = today.getFullYear();
    if (draft.date) { const d = new Date(draft.date + 'T12:00'); month = d.getMonth(); year = d.getFullYear(); }

    const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    function render() {
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const selectedStr = draft.date || '';

      container.innerHTML = `
        <div class="calendar-wrap wiz-calendar">
          <div class="cal-header">
            <button class="cal-nav-btn" id="wiz-cal-prev"><i class="bi bi-chevron-left"></i></button>
            <span class="cal-month-label">${MONTHS[month]} ${year}</span>
            <button class="cal-nav-btn" id="wiz-cal-next"><i class="bi bi-chevron-right"></i></button>
          </div>
          <div class="cal-weekdays">
            ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => `<div class="cal-wd">${d}</div>`).join('')}
          </div>
          <div class="cal-days" id="wiz-cal-days"></div>
        </div>
      `;

      const daysEl = container.querySelector('#wiz-cal-days');
      for (let i = 0; i < firstDay; i++) {
        daysEl.innerHTML += '<div class="cal-day empty"></div>';
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const isPast  = new Date(dateStr) < new Date(today.toDateString());
        const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;
        const isSelected = dateStr === selectedStr;

        const dayEl = document.createElement('div');
        dayEl.className = [
          'cal-day',
          isToday    ? 'today'    : '',
          isPast     ? 'past'     : '',
          isWeekend  ? 'weekend'  : '',
          isSelected ? 'selected' : '',
        ].filter(Boolean).join(' ');
        dayEl.textContent = d;
        dayEl.dataset.date = dateStr;

        if (!isPast && !isWeekend) {
          dayEl.addEventListener('click', () => {
            daysEl.querySelectorAll('.cal-day').forEach(x => x.classList.remove('selected'));
            dayEl.classList.add('selected');
            AppointmentStore.setDraftField('date', dateStr);
            AppointmentStore.setDraftField('time', null);
            _showDateTip(container.closest('[id]')?.closest('.wizard-step-body'), dateStr);
          });
        }
        daysEl.appendChild(dayEl);
      }

      container.querySelector('#wiz-cal-prev')?.addEventListener('click', () => {
        month--; if (month < 0) { month = 11; year--; } render();
      });
      container.querySelector('#wiz-cal-next')?.addEventListener('click', () => {
        month++; if (month > 11) { month = 0; year++; } render();
      });
    }

    render();
  }

  function _showDateTip(container, dateStr) {
    if (!container) return;
    const tip = container.querySelector('#wiz-date-tip');
    if (!tip) return;
    const d = new Date(dateStr + 'T12:00');
    const weekday = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][d.getDay()];
    tip.style.display = 'flex';
    tip.innerHTML = `<i class="bi bi-info-circle-fill"></i> <span><strong>${weekday}</strong> — Consultas matinais ganham <strong>+${CONFIG.POINTS_MORNING} pts</strong> extras!</span>`;
  }

  // ── Step 4: Horário ───────────────────────────────────────
  function _step4(el) {
    const { draft } = AppointmentStore.getState();
    if (!draft.date || !draft.doctor) {
      el.innerHTML = `<div class="wizard-empty"><i class="bi bi-arrow-left-circle"></i><p>Volte e selecione data e médico</p></div>`;
      return;
    }

    const isMorning = (t) => MORNING_SLOTS.includes(t);
    const isBlocked = (t) => AppointmentStore.isSlotBlocked(draft.doctor.id, draft.date, t);

    // Sugestão inteligente: 1º horário livre da manhã
    const recommended = ALL_SLOTS.find(t => isMorning(t) && !isBlocked(t));

    el.innerHTML = `
      <div class="wizard-step-header">
        <div class="wizard-step-icon">⏰</div>
        <div>
          <div class="wizard-step-title">Escolha o horário</div>
          <div class="wizard-step-sub">${_formatDate(draft.date)} · ${draft.doctor.name}</div>
        </div>
      </div>
      ${recommended ? `
        <div class="slot-recommendation">
          <i class="bi bi-stars"></i>
          <span>Recomendado: <strong>${recommended}</strong> — manhã garante <strong>+${CONFIG.POINTS_MORNING} pts</strong></span>
          <button class="slot-rec-btn" data-time="${recommended}">Usar</button>
        </div>` : ''}
      <div class="slot-section-label">Manhã</div>
      <div class="time-grid wiz-time-grid" id="wiz-slots-morning"></div>
      <div class="slot-section-label">Tarde</div>
      <div class="time-grid wiz-time-grid" id="wiz-slots-afternoon"></div>
      <div class="slot-legend">
        <span class="slot-leg free">Livre</span>
        <span class="slot-leg blocked">Indisponível</span>
        <span class="slot-leg morning-bonus">+${CONFIG.POINTS_MORNING} pts</span>
      </div>
    `;

    const afternoon = ALL_SLOTS.filter(t => !MORNING_SLOTS.includes(t));
    _renderSlots(el.querySelector('#wiz-slots-morning'), MORNING_SLOTS, isBlocked, isMorning);
    _renderSlots(el.querySelector('#wiz-slots-afternoon'), afternoon, isBlocked, isMorning);

    // Botão "Usar recomendação"
    el.querySelector('.slot-rec-btn')?.addEventListener('click', function() {
      const time = this.dataset.time;
      el.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      el.querySelector(`.time-slot[data-time="${time}"]`)?.classList.add('selected');
      AppointmentStore.setDraftField('time', time);
    });
  }

  function _renderSlots(container, slots, isBlocked, isMorning) {
    if (!container) return;
    const { draft } = AppointmentStore.getState();
    slots.forEach(t => {
      const blocked = isBlocked(t);
      const morning = isMorning(t);
      const btn = document.createElement('button');
      btn.className = [
        'time-slot wiz-slot',
        blocked   ? 'slot-blocked'  : '',
        morning   ? 'slot-morning'  : '',
        draft.time === t ? 'selected' : '',
      ].filter(Boolean).join(' ');
      btn.dataset.time = t;
      btn.disabled = blocked;
      btn.innerHTML = `${t}${morning && !blocked ? `<span class="slot-pts">+${CONFIG.POINTS_MORNING}</span>` : ''}`;
      if (!blocked) {
        btn.addEventListener('click', () => {
          container.closest('.wizard-step-body')
            ?.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
          btn.classList.add('selected');
          AppointmentStore.setDraftField('time', t);
        });
      }
      container.appendChild(btn);
    });
  }

  // ── Step 5: Confirmação + Notas ───────────────────────────
  function _step5(el) {
    const { draft } = AppointmentStore.getState();
    const isMorning  = MORNING_SLOTS.includes(draft.time);
    const pts        = CONFIG.POINTS_BASE + (isMorning ? CONFIG.POINTS_MORNING : 0);
    const modIcon    = draft.modality === 'online' ? '📹' : '🏥';
    const modLabel   = draft.modality === 'online' ? 'Online (Videochamada)' : 'Presencial (Clínica)';

    el.innerHTML = `
      <div class="wizard-step-header">
        <div class="wizard-step-icon">✅</div>
        <div>
          <div class="wizard-step-title">Confirme os dados</div>
          <div class="wizard-step-sub">Revise antes de finalizar</div>
        </div>
      </div>

      <div class="confirm-summary">
        <div class="confirm-row">
          <span class="confirm-icon">${SPEC_ICONS[draft.spec]}</span>
          <div><div class="confirm-label">Especialidade</div><div class="confirm-val">${SPEC_NAMES[draft.spec]}</div></div>
        </div>
        <div class="confirm-row">
          <span class="confirm-icon">${draft.doctor.avatar}</span>
          <div><div class="confirm-label">Médico</div><div class="confirm-val">${draft.doctor.name}</div></div>
        </div>
        <div class="confirm-row">
          <span class="confirm-icon">📅</span>
          <div><div class="confirm-label">Data</div><div class="confirm-val">${_formatDate(draft.date)}</div></div>
        </div>
        <div class="confirm-row">
          <span class="confirm-icon">⏰</span>
          <div><div class="confirm-label">Horário</div><div class="confirm-val">${draft.time}${isMorning ? ' <span class="morning-chip">Manhã +'+CONFIG.POINTS_MORNING+' pts</span>' : ''}</div></div>
        </div>
        <div class="confirm-row">
          <span class="confirm-icon">${modIcon}</span>
          <div><div class="confirm-label">Modalidade</div><div class="confirm-val">${modLabel}</div></div>
        </div>
      </div>

      <div class="confirm-points-preview">
        <i class="bi bi-trophy-fill"></i>
        <span>Você ganhará <strong>+${pts} pontos</strong> ao confirmar esta consulta!</span>
      </div>

      <div class="confirm-notes-wrap">
        <label class="wizard-section-label" for="wiz-notes">Observações (opcional)</label>
        <textarea id="wiz-notes" class="wiz-notes-textarea" placeholder="Ex: Trazer exames, alergias, informações relevantes..." maxlength="300" rows="3">${draft.notes}</textarea>
        <div class="notes-char-count"><span id="wiz-notes-count">${draft.notes.length}</span>/300</div>
      </div>
    `;

    el.querySelector('#wiz-notes')?.addEventListener('input', function() {
      AppointmentStore.setDraftField('notes', this.value);
      el.querySelector('#wiz-notes-count').textContent = this.value.length;
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function _getSpecBg(key) {
    const map = { card:'#fce7f3', derm:'#fef3c7', orto:'#fef9c3', endo:'#fffbeb', clin:'#eff6ff', ped:'#fce7f3' };
    return map[key] || '#f1f5f9';
  }

  function _formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00');
    const DAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }

  return { renderStep };
})();


/* ──────────────────────────────────────────────────────────────
   WIZARD CONTROLLER — Controla navegação, validação e envio
   ────────────────────────────────────────────────────────────── */
const WizardController = (() => {
  const TOTAL_STEPS = 5;
  let currentStep = 1;
  let progressBar, stepBody, btnPrev, btnNext, stepLabel;

  function init() {
    progressBar = document.getElementById('wiz-progress-fill');
    stepBody    = document.getElementById('wizard-step-body');
    btnPrev     = document.getElementById('wiz-btn-prev');
    btnNext     = document.getElementById('wiz-btn-next');
    stepLabel   = document.getElementById('wiz-step-label');

    if (!stepBody) return;

    btnPrev?.addEventListener('click', () => goTo(currentStep - 1));
    btnNext?.addEventListener('click', () => {
      if (currentStep === TOTAL_STEPS) return _submit();
      if (_validate(currentStep)) goTo(currentStep + 1);
    });

    AppointmentStore.subscribe((event) => {
      if (event === 'draft:reset') {
        const { draft } = AppointmentStore.getState();
        currentStep = draft.step || 1;
        _render();
      }
    });

    _render();
  }

  function goTo(step) {
    if (step < 1 || step > TOTAL_STEPS) return;
    if (step > currentStep && !_validate(currentStep)) return;
    currentStep = step;
    _render();
  }

  function _render() {
    _updateProgress();
    WizardRenderer.renderStep(currentStep, stepBody);
    _updateButtons();
  }

  function _updateProgress() {
    const pct = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
    if (progressBar) progressBar.style.width = pct + '%';
    if (stepLabel) stepLabel.textContent = `Etapa ${currentStep} de ${TOTAL_STEPS}`;

    // Atualiza dots de progresso
    document.querySelectorAll('.wiz-dot').forEach((dot, i) => {
      dot.classList.toggle('done',   i + 1 < currentStep);
      dot.classList.toggle('active', i + 1 === currentStep);
    });
  }

  function _updateButtons() {
    if (!btnPrev || !btnNext) return;
    btnPrev.style.display = currentStep === 1 ? 'none' : '';
    btnNext.textContent   = currentStep === TOTAL_STEPS ? '🎉 Confirmar Agendamento' : 'Continuar →';
    btnNext.className     = currentStep === TOTAL_STEPS
      ? 'wiz-btn-next btn-confirm wiz-btn-confirm'
      : 'wiz-btn-next btn-confirm';
  }

  function _validate(step) {
    const { draft } = AppointmentStore.getState();
    const errors = {
      1: [!draft.spec,   '⚠️ Selecione uma especialidade.'],
      2: [!draft.doctor, '⚠️ Selecione um médico.'],
      3: [!draft.date,   '⚠️ Selecione uma data.'],
      4: [!draft.time,   '⚠️ Selecione um horário.'],
      5: [false, ''],
    };
    const [invalid, msg] = errors[step] || [false, ''];
    if (invalid) {
      RichToast.show({ msg, type: 'error', duration: 2500 });
      _shakeStep();
      return false;
    }
    return true;
  }

  function _shakeStep() {
    if (!stepBody) return;
    stepBody.style.animation = 'none';
    requestAnimationFrame(() => {
      stepBody.style.animation = 'wizardShake .4s ease';
    });
  }

  function _submit() {
    const { draft } = AppointmentStore.getState();
    if (!_validate(TOTAL_STEPS)) return;

    const btn = document.getElementById('wiz-btn-next');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

    setTimeout(() => {
      const aptData = {
        spec:        draft.spec,
        specName:    SPEC_NAMES[draft.spec],
        specIcon:    SPEC_ICONS[draft.spec],
        doctorId:    draft.doctor.id,
        doctorName:  draft.doctor.name,
        doctorAvatar:draft.doctor.avatar,
        date:        draft.date,
        time:        draft.time,
        modality:    draft.modality,
        notes:       draft.notes,
      };

      if (draft.isRescheduling && draft.rescheduleId) {
        AppointmentStore.updateAppointment(draft.rescheduleId, {
          ...aptData, updatedAt: Date.now(),
        });
        RichToast.show({ msg: '🔄 Consulta reagendada com sucesso!', type: 'success', duration: 4000 });
      } else {
        AppointmentStore.addAppointment(aptData);
        const pts = CONFIG.POINTS_BASE + (MORNING_SLOTS.includes(draft.time) ? CONFIG.POINTS_MORNING : 0);
        RichToast.show({ msg: `🎉 Consulta agendada! +${pts} pontos!`, type: 'success', duration: 4000 });
        _triggerConfetti();
      }

      AppointmentStore.resetDraft();

      // Volta para aba de reagendar
      const tabBtns   = document.querySelectorAll('.tab-btn[data-tab]');
      const tabPanels = document.querySelectorAll('.tab-panel[data-panel]');
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'reagendar'));
      tabPanels.forEach(p => p.classList.toggle('d-none', p.dataset.panel !== 'reagendar'));

      ScheduledListController.render();

      if (btn) { btn.disabled = false; }
      CountdownController.refresh();
    }, 700);
  }

  function _triggerConfetti() {
    for (let i = 0; i < 18; i++) {
      setTimeout(() => {
        const dot = document.createElement('div');
        const colors = ['#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ef4444','#f97316'];
        dot.style.cssText = `
          position:fixed; width:${6+Math.random()*8}px; height:${6+Math.random()*8}px;
          background:${colors[Math.floor(Math.random()*colors.length)]};
          border-radius:50%; top:30%; left:${20+Math.random()*60}%;
          z-index:9999; pointer-events:none; opacity:1;
          animation:confettiFall ${0.8+Math.random()*0.8}s ease forwards;
        `;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 1800);
      }, i * 60);
    }
  }

  return { init, goTo };
})();


/* ──────────────────────────────────────────────────────────────
   SCHEDULED LIST — Renderiza e gerencia consultas agendadas
   ────────────────────────────────────────────────────────────── */
const ScheduledListController = (() => {

  function render() {
    const container = document.getElementById('scheduled-list');
    if (!container) return;

    const apts = AppointmentStore.getFilteredAppointments();

    if (apts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px 0">
          <i class="bi bi-calendar-x" style="font-size:48px;color:var(--muted-fg)"></i>
          <p>Nenhuma consulta agendada</p>
          <button class="btn-confirm" style="width:auto;padding:10px 24px;margin-top:8px"
            onclick="document.querySelector('.tab-btn[data-tab=nova]')?.click()">
            + Agendar consulta
          </button>
        </div>`;
      return;
    }

    container.innerHTML = '<div class="dg-row dg-2" id="sched-cards-grid"></div>';
    const grid = container.querySelector('#sched-cards-grid');

    apts.forEach(apt => {
      const card = _buildCard(apt);
      grid.appendChild(card);
      _initSwipe(card, apt);
    });
  }

  function _buildCard(apt) {
    const isPast    = new Date(`${apt.date}T${apt.time}`) < new Date();
    const isOnline  = apt.modality === 'online';
    const dateLabel = _formatDateFull(apt.date, apt.time);

    const card = document.createElement('div');
    card.className = 'sched-card wizard-sched-card';
    card.dataset.aptId = apt.id;
    if (isPast) card.classList.add('sched-past');

    card.innerHTML = `
      <div class="sched-card-swipe-hint"><i class="bi bi-arrow-right"></i> Deslize para cancelar</div>
      <div class="sched-card-inner">
        <div class="sched-header">
          <span class="sched-avatar">${apt.doctorAvatar}</span>
          <div style="flex:1;min-width:0">
            <div class="sched-title-row">
              <span class="sched-doctor">${apt.doctorName}</span>
              ${isPast
                ? '<span class="status-badge badge-past">Passada</span>'
                : '<span class="confirmed-badge"><i class="bi bi-check-circle-fill"></i> Confirmada</span>'}
            </div>
            <div class="sched-spec">${apt.specIcon} ${apt.specName}</div>
          </div>
          <span class="sched-modality-icon" title="${apt.modality}">${isOnline ? '📹' : '🏥'}</span>
        </div>
        <div class="sched-details">
          <div class="sched-detail"><i class="bi bi-calendar3" style="color:var(--primary)"></i> ${dateLabel}</div>
          <div class="sched-detail"><i class="bi bi-clock" style="color:var(--primary)"></i> ${apt.time}</div>
          ${apt.notes ? `<div class="sched-detail sched-notes"><i class="bi bi-chat-text"></i> ${apt.notes}</div>` : ''}
        </div>
        ${!isPast && isOnline ? `<button class="btn-video">🎥 Entrar na consulta online</button>` : ''}
        <div class="sched-actions">
          ${!isPast ? `<button class="appt-btn btn-reschedule sched-reschedule-btn" data-id="${apt.id}">↺ Reagendar</button>` : ''}
          ${!isPast ? `<button class="appt-btn btn-cancel sched-cancel-btn" data-id="${apt.id}">Cancelar</button>` : ''}
          ${isPast  ? `<button class="appt-btn btn-reschedule" style="flex:1" onclick="document.querySelector('.tab-btn[data-tab=nova]')?.click()">+ Nova consulta</button>` : ''}
        </div>
      </div>
    `;

    card.querySelector('.sched-reschedule-btn')?.addEventListener('click', () => {
      _initiateReschedule(apt.id);
    });
    card.querySelector('.sched-cancel-btn')?.addEventListener('click', () => {
      _initiateCancel(apt.id, card);
    });

    return card;
  }

  function _initiateReschedule(aptId) {
    AppointmentStore.resetDraft(true, aptId);

    const tabBtns   = document.querySelectorAll('.tab-btn[data-tab]');
    const tabPanels = document.querySelectorAll('.tab-panel[data-panel]');
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'nova'));
    tabPanels.forEach(p => p.classList.toggle('d-none', p.dataset.panel !== 'nova'));

    // Scroll para o topo do form
    document.querySelector('.page-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    RichToast.show({ msg: '🔄 Reagendamento iniciado. Escolha nova data e horário.', type: 'warn', duration: 3500 });
  }

  function _initiateCancel(aptId, card) {
    // Usa o modal global injetado pelo main.js
    if (window._ativarCancelarConsulta) {
      // Cria um botão fantasma apenas para reutilizar a lógica do modal
      const _phantom = document.createElement('button');
      window._ativarCancelarConsulta(_phantom, () => _executarCancel(aptId, card));
      _phantom.click();
      return;
    }
    // Fallback caso o modal não esteja disponível
    if (!confirm('Tem certeza que deseja cancelar esta consulta?')) return;
    _executarCancel(aptId, card);
  }

  function _executarCancel(aptId, card) {
    const apt = AppointmentStore.removeAppointment(aptId);
    if (!apt) return;

    AppointmentStore.enqueueUndo(apt);

    // Animação de saída
    card.style.transition = 'opacity .35s, transform .35s, max-height .35s, margin .35s, padding .35s';
    card.style.opacity    = '0';
    card.style.transform  = 'translateX(60px)';
    card.style.maxHeight  = card.offsetHeight + 'px';

    setTimeout(() => {
      card.style.maxHeight = '0';
      card.style.margin    = '0';
      card.style.padding   = '0';
    }, 200);

    setTimeout(() => {
      card.remove();
      if (!document.querySelector('.sched-card')) render(); // mostra empty state
    }, 550);

    RichToast.show({
      msg: 'Consulta cancelada.',
      type: 'default',
      duration: CONFIG.UNDO_TIMEOUT,
      action: {
        label: 'Desfazer',
        fn: () => {
          const ok = AppointmentStore.executeUndo(aptId);
          if (ok) { render(); RichToast.show({ msg: 'Consulta restaurada!', type: 'success' }); }
        },
      },
    });

    CountdownController.refresh();
  }

  // ── Swipe-to-dismiss (mobile) ─────────────────────────────
  function _initSwipe(card, apt) {
    const inner = card.querySelector('.sched-card-inner');
    if (!inner) return;

    let startX = 0, currentX = 0, dragging = false;

    function onStart(e) {
      startX   = e.touches ? e.touches[0].clientX : e.clientX;
      dragging = true;
      inner.style.transition = 'none';
    }
    function onMove(e) {
      if (!dragging) return;
      currentX = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
      if (currentX < 0) return; // só direita→esquerda
      inner.style.transform = `translateX(${currentX}px)`;
      card.querySelector('.sched-card-swipe-hint').style.opacity = Math.min(currentX / CONFIG.SWIPE_THRESHOLD, 1);
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      inner.style.transition = 'transform .3s ease';
      if (currentX > CONFIG.SWIPE_THRESHOLD) {
        inner.style.transform = 'translateX(100%)';
        setTimeout(() => _initiateCancel(apt.id, card), 300);
      } else {
        inner.style.transform = '';
        card.querySelector('.sched-card-swipe-hint').style.opacity = '0';
      }
      currentX = 0;
    }

    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove',  onMove,  { passive: true });
    card.addEventListener('touchend',   onEnd);
  }

  function _formatDateFull(dateStr, time) {
    const d = new Date(`${dateStr}T${time}`);
    const DAYS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  return { render };
})();


/* ──────────────────────────────────────────────────────────────
   COUNTDOWN — Conta regressiva para a próxima consulta
   ────────────────────────────────────────────────────────────── */
const CountdownController = (() => {
  let intervalId = null;

  function init() {
    const el = document.getElementById('next-apt-countdown');
    if (!el) return;
    refresh();
  }

  function refresh() {
    const el = document.getElementById('next-apt-countdown');
    if (!el) return;

    clearInterval(intervalId);
    const apt = AppointmentStore.getNextAppointment();
    if (!apt) {
      el.innerHTML = '<span class="countdown-none">Nenhuma consulta próxima</span>';
      return;
    }

    const target = new Date(`${apt.date}T${apt.time}`);

    function tick() {
      const diff = target - new Date();
      if (diff <= 0) {
        el.innerHTML = '<span class="countdown-now">🟢 Consulta em andamento!</span>';
        clearInterval(intervalId);
        return;
      }
      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000) / 60000);
      const secs  = Math.floor((diff % 60000) / 1000);

      el.innerHTML = `
        <span class="countdown-label">Próxima: ${apt.doctorName.split(' ')[0]} ${apt.doctorName.split(' ')[1]}</span>
        <div class="countdown-clock">
          ${days > 0 ? `<div class="countdown-unit"><span class="cu-val">${days}</span><span class="cu-lbl">dias</span></div>` : ''}
          <div class="countdown-unit"><span class="cu-val">${String(hours).padStart(2,'0')}</span><span class="cu-lbl">hrs</span></div>
          <div class="countdown-unit countdown-sep">:</div>
          <div class="countdown-unit"><span class="cu-val">${String(mins).padStart(2,'0')}</span><span class="cu-lbl">min</span></div>
          <div class="countdown-unit countdown-sep">:</div>
          <div class="countdown-unit"><span class="cu-val">${String(secs).padStart(2,'0')}</span><span class="cu-lbl">seg</span></div>
        </div>
      `;

      // Lembrete in-app
      if (diff <= CONFIG.REMINDER_ADVANCE * 60000 && diff > (CONFIG.REMINDER_ADVANCE * 60000 - 10000)) {
        RichToast.show({
          msg: `⏰ Lembrete: consulta com ${apt.doctorName} em ${CONFIG.REMINDER_ADVANCE} minutos!`,
          type: 'warn',
          duration: 8000,
        });
      }
    }

    tick();
    intervalId = setInterval(tick, 1000);
  }

  return { init, refresh };
})();


/* ──────────────────────────────────────────────────────────────
   FILTER CONTROLLER — Ordenação e filtros das consultas
   ────────────────────────────────────────────────────────────── */
const FilterController = (() => {
  function init() {
    const sortEl   = document.getElementById('sched-sort');
    const statusEl = document.getElementById('sched-status-filter');

    sortEl?.addEventListener('change', () => {
      AppointmentStore.setFilter('sort', sortEl.value);
      ScheduledListController.render();
    });

    statusEl?.addEventListener('change', () => {
      AppointmentStore.setFilter('status', statusEl.value);
      ScheduledListController.render();
    });

    AppointmentStore.subscribe((event) => {
      if (event === 'appointment:added' || event === 'appointment:updated' || event === 'appointment:removed') {
        ScheduledListController.render();
      }
    });
  }

  return { init };
})();


/* ──────────────────────────────────────────────────────────────
   INJEÇÃO DE ESTILOS — CSS específico do wizard
   ────────────────────────────────────────────────────────────── */
function injectWizardStyles() {
  if (document.getElementById('consultas-wizard-styles')) return;

  const style = document.createElement('style');
  style.id = 'consultas-wizard-styles';
  style.textContent = `
    /* ── Wizard wrapper ── */
    .wizard-shell {
      background: var(--card); border-radius: var(--radius);
      padding: 20px; box-shadow: var(--shadow); margin-bottom: 20px;
    }

    /* ── Progress bar ── */
    .wiz-progress-wrap {
      display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;
    }
    .wiz-progress-meta {
      display: flex; justify-content: space-between; align-items: center;
    }
    .wiz-step-label { font-size: 13px; color: var(--muted-fg); font-weight: 500; }
    .wiz-dots { display: flex; gap: 8px; align-items: center; }
    .wiz-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--muted); transition: all .25s;
    }
    .wiz-dot.done   { background: var(--accent); transform: scale(1.1); }
    .wiz-dot.active { background: var(--primary); transform: scale(1.3); box-shadow: 0 0 0 3px rgba(14,165,233,.2); }
    .wiz-progress-track {
      height: 6px; background: var(--muted); border-radius: 3px; overflow: hidden;
    }
    .wiz-progress-fill {
      height: 100%; background: var(--gradient); border-radius: 3px;
      transition: width .4s cubic-bezier(.4,0,.2,1); width: 0%;
    }

    /* ── Step header ── */
    .wizard-step-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 18px;
      padding-bottom: 14px; border-bottom: 1px solid var(--border);
    }
    .wizard-step-icon {
      width: 48px; height: 48px; border-radius: 14px; background: var(--blue-lt);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; flex-shrink: 0;
    }
    .wizard-step-title { font-size: 16px; font-weight: 800; color: var(--text); line-height: 1.2; }
    .wizard-step-sub   { font-size: 13px; color: var(--muted-fg); margin-top: 2px; }
    .wizard-section-label { font-size: 12px; font-weight: 700; color: var(--muted-fg); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; display: block; }

    /* ── Spec cards (wizard version) ── */
    .wizard-spec-card { position: relative; }
    .spec-doctor-count { display: block; font-size: 11px; color: var(--muted-fg); margin-top: 2px; }

    /* ── Doctor row (wizard version) ── */
    .wizard-doctor-row { border: 1.5px solid transparent; border-radius: var(--radius-sm); margin-bottom: 6px; }
    .wizard-doctor-row.selected { border-color: var(--primary); }
    .doctor-info { flex: 1; }
    .doctor-meta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
    .doctor-rating, .doctor-wait { font-size: 12px; color: var(--muted-fg); display: flex; align-items: center; gap: 3px; }
    .doctor-rating i { color: var(--warning); font-size: 11px; }
    .doctor-modalities { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
    .modality-tag {
      font-size: 11px; font-weight: 600; padding: 3px 8px;
      border-radius: var(--radius-pill);
    }
    .modality-online     { background: var(--blue-lt);  color: var(--primary); }
    .modality-presencial { background: var(--green-lt); color: var(--accent); }

    /* ── Modality picker ── */
    .modality-group { display: flex; gap: 8px; flex-wrap: wrap; }
    .modality-btn {
      flex: 1; min-width: 120px; padding: 10px 14px;
      border: 1.5px solid var(--border); border-radius: var(--radius-sm);
      background: var(--card); color: var(--text); font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all .18s; display: flex; align-items: center; gap: 6px;
      justify-content: center; font-family: var(--font);
    }
    .modality-btn.active { border-color: var(--primary); background: var(--blue-lt); color: var(--primary); font-weight: 700; }

    /* ── Calendar (wizard) ── */
    .wiz-calendar { box-shadow: none; padding: 0; }
    .cal-day.past    { opacity: .3; cursor: default; }
    .cal-day.weekend { opacity: .45; cursor: default; }

    /* ── Time slots (wizard) ── */
    .slot-section-label { font-size: 12px; font-weight: 700; color: var(--muted-fg); text-transform: uppercase; letter-spacing: .06em; margin: 12px 0 6px; }
    .wiz-time-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 4px; }
    .wiz-slot { position: relative; font-size: 13px; padding: 10px 6px; }
    .wiz-slot.slot-blocked { background: var(--muted); color: var(--muted-fg); opacity: .5; cursor: not-allowed; }
    .wiz-slot.slot-morning { border: 1.5px solid rgba(245,158,11,.3); }
    .wiz-slot.slot-morning.selected { border-color: var(--warning); }
    .slot-pts {
      display: block; font-size: 9px; font-weight: 700;
      color: var(--warning); margin-top: 2px; line-height: 1;
    }
    .wiz-slot.slot-blocked .slot-pts { display: none; }
    .slot-recommendation {
      background: var(--green-lt); border: 1px solid rgba(16,185,129,.2);
      border-radius: var(--radius-sm); padding: 10px 12px;
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: #065f46; margin-bottom: 12px;
    }
    .slot-recommendation i { color: var(--accent); font-size: 16px; flex-shrink: 0; }
    .slot-recommendation span { flex: 1; }
    .slot-rec-btn {
      background: var(--accent); color: #fff; border: none;
      border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700;
      cursor: pointer; flex-shrink: 0; font-family: var(--font);
    }
    .slot-legend { display: flex; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
    .slot-leg { font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 5px; color: var(--muted-fg); }
    .slot-leg::before { content:''; display:inline-block; width:12px; height:12px; border-radius:4px; }
    .slot-leg.free::before     { background: var(--card); border: 1.5px solid var(--border); }
    .slot-leg.blocked::before  { background: var(--muted); }
    .slot-leg.morning-bonus::before { background: rgba(245,158,11,.2); border: 1.5px solid rgba(245,158,11,.4); }

    /* ── Confirm summary ── */
    .confirm-summary {
      background: var(--muted); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 14px;
    }
    .confirm-row {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 0; border-bottom: 1px solid var(--border);
    }
    .confirm-row:last-child { border-bottom: none; }
    .confirm-icon { font-size: 22px; width: 32px; text-align: center; flex-shrink: 0; }
    .confirm-label { font-size: 12px; color: var(--muted-fg); }
    .confirm-val   { font-size: 14px; font-weight: 700; color: var(--text); }
    .morning-chip {
      background: var(--yellow-lt); color: #92400e;
      font-size: 11px; font-weight: 600; padding: 2px 8px;
      border-radius: var(--radius-pill); margin-left: 6px;
    }
    .confirm-points-preview {
      background: var(--gradient); color: #fff;
      border-radius: var(--radius-sm); padding: 12px 14px;
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; margin-bottom: 14px;
    }
    .confirm-points-preview i { font-size: 18px; flex-shrink: 0; }

    /* ── Notes textarea ── */
    .wiz-notes-textarea {
      width: 100%; background: var(--muted); border: none;
      border-radius: var(--radius-sm); padding: 12px;
      font-size: 14px; color: var(--text); resize: none;
      font-family: var(--font); outline: none; transition: box-shadow .2s;
    }
    .wiz-notes-textarea:focus { box-shadow: 0 0 0 2px rgba(14,165,233,.3); }
    .notes-char-count { text-align: right; font-size: 12px; color: var(--muted-fg); margin-top: 4px; }

    /* ── Wizard nav buttons ── */
    .wizard-nav {
      display: flex; gap: 10px; margin-top: 20px; padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .wiz-btn-prev {
      padding: 13px 20px; border-radius: var(--radius-pill);
      background: var(--muted); border: none; color: var(--text);
      font-size: 14px; font-weight: 600; cursor: pointer;
      font-family: var(--font); transition: opacity .2s;
    }
    .wiz-btn-prev:hover { opacity: .8; }
    .wiz-btn-next { flex: 1; }
    .wiz-btn-confirm { background: var(--gradient) !important; }

    /* ── Tip ── */
    .wiz-tip {
      background: var(--blue-lt); border-radius: var(--radius-sm); padding: 10px 12px;
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: #1e40af; margin-top: 10px;
    }
    .wiz-tip i { flex-shrink: 0; color: var(--primary); }

    /* ── Scheduled card (wizard version) ── */
    .wizard-sched-card { position: relative; overflow: hidden; }
    .sched-card-swipe-hint {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(239,68,68,.15));
      display: flex; align-items: center; justify-content: flex-end;
      padding-right: 20px; font-size: 13px; color: var(--danger);
      font-weight: 600; opacity: 0; pointer-events: none; z-index: 0;
      transition: opacity .15s;
    }
    .sched-card-inner { position: relative; z-index: 1; }
    .sched-past { opacity: .7; }
    .sched-notes { font-style: italic; color: var(--muted-fg) !important; }
    .sched-modality-icon { font-size: 20px; flex-shrink: 0; }
    .status-badge {
      font-size: 11px; font-weight: 600; padding: 3px 8px;
      border-radius: var(--radius-pill); display: inline-flex; align-items: center; gap: 4px;
    }
    .badge-past { background: var(--muted); color: var(--muted-fg); }

    /* ── Filter bar ── */
    .sched-filter-bar {
      display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
      margin-bottom: 16px; background: var(--card); padding: 12px 14px;
      border-radius: var(--radius-sm); box-shadow: var(--shadow-sm);
    }
    .sched-filter-label { font-size: 13px; font-weight: 600; color: var(--text); flex-shrink: 0; }
    .sched-filter-select {
      flex: 1; min-width: 120px; padding: 8px 10px; background: var(--muted);
      border: none; border-radius: 8px; font-size: 13px;
      font-family: var(--font); color: var(--text); cursor: pointer; outline: none;
    }

    /* ── Countdown ── */
    .next-apt-banner {
      background: var(--gradient); border-radius: var(--radius);
      padding: 16px 20px; margin-bottom: 20px; color: #fff;
    }
    .next-apt-title { font-size: 12px; opacity: .8; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 6px; }
    .countdown-label { font-size: 13px; opacity: .9; display: block; margin-bottom: 4px; }
    .countdown-clock { display: flex; align-items: center; gap: 4px; }
    .countdown-unit  { display: flex; flex-direction: column; align-items: center; min-width: 36px; }
    .cu-val { font-size: 22px; font-weight: 800; line-height: 1; }
    .cu-lbl { font-size: 10px; opacity: .75; margin-top: 1px; }
    .countdown-sep { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
    .countdown-none { font-size: 14px; opacity: .85; }
    .countdown-now  { font-size: 15px; font-weight: 700; }

    /* ── Empty state ── */
    .wizard-empty {
      text-align: center; padding: 32px 0; color: var(--muted-fg);
    }
    .wizard-empty i { font-size: 40px; margin-bottom: 10px; display: block; }
    .wizard-empty p { font-size: 14px; }

    /* ── Animations ── */
    @keyframes wizardShake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-8px); }
      40%     { transform: translateX(8px); }
      60%     { transform: translateX(-5px); }
      80%     { transform: translateX(5px); }
    }
    @keyframes confettiFall {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
    }

    /* ── Responsive adjustments ── */
    @media (max-width: 767px) {
      .wiz-time-grid { grid-template-columns: repeat(3, 1fr); }
      .wiz-btn-prev { padding: 13px 14px; font-size: 13px; }
    }
    @media (min-width: 1024px) {
      .sched-filter-bar { padding: 14px 18px; }
      .wiz-time-grid { grid-template-columns: repeat(4, 1fr); }
    }
  `;
  document.head.appendChild(style);
}


/* ──────────────────────────────────────────────────────────────
   DOM BUILDER — Injeta o wizard no painel "Marcar Nova"
   ────────────────────────────────────────────────────────────── */
function buildConsultasUI() {
  const novaPanel = document.querySelector('.tab-panel[data-panel="nova"]');
  if (!novaPanel) return;

  novaPanel.innerHTML = `
    <!-- Countdown próxima consulta -->
    <div class="next-apt-banner">
      <div class="next-apt-title">⏱ Próxima consulta</div>
      <div id="next-apt-countdown"><span class="countdown-none">Carregando…</span></div>
    </div>

    <!-- Wizard shell -->
    <div class="wizard-shell">
      <div class="wiz-progress-wrap">
        <div class="wiz-progress-meta">
          <span id="wiz-step-label" class="wiz-step-label">Etapa 1 de 5</span>
          <div class="wiz-dots">
            ${[1,2,3,4,5].map((_, i) => `<div class="wiz-dot${i === 0 ? ' active' : ''}"></div>`).join('')}
          </div>
        </div>
        <div class="wiz-progress-track">
          <div class="wiz-progress-fill" id="wiz-progress-fill"></div>
        </div>
      </div>

      <div class="wizard-step-body" id="wizard-step-body"></div>

      <div class="wizard-nav">
        <button class="wiz-btn-prev" id="wiz-btn-prev" style="display:none">← Voltar</button>
        <button class="btn-confirm wiz-btn-next" id="wiz-btn-next">Continuar →</button>
      </div>
    </div>
  `;

  // Painel reagendar
  const reagendarPanel = document.querySelector('.tab-panel[data-panel="reagendar"]');
  if (reagendarPanel) {
    reagendarPanel.innerHTML = `
      <div class="sched-filter-bar">
        <span class="sched-filter-label">Ordenar por:</span>
        <select class="sched-filter-select" id="sched-sort">
          <option value="date-asc">Data (mais próxima)</option>
          <option value="date-desc">Data (mais recente)</option>
        </select>
        <span class="sched-filter-label" style="margin-left:4px">Status:</span>
        <select class="sched-filter-select" id="sched-status-filter">
          <option value="all">Todos</option>
          <option value="confirmed">Confirmados</option>
        </select>
      </div>
      <div id="scheduled-list"></div>
    `;
  }
}


/* ──────────────────────────────────────────────────────────────
   ENTRY POINT — Inicializa tudo na página de consultas
   ────────────────────────────────────────────────────────────── */
function initConsultasV2() {
  AppointmentStore.load();
  injectWizardStyles();
  buildConsultasUI();
  WizardController.init();
  ScheduledListController.render();
  CountdownController.init();
  FilterController.init();

  // Rebinda as abas para garantir que o wizard seja inicializado corretamente
  const tabBtns   = document.querySelectorAll('.tab-btn[data-tab]');
  const tabPanels = document.querySelectorAll('.tab-panel[data-panel]');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      tabPanels.forEach(p => p.classList.toggle('d-none', p.dataset.panel !== target));
      if (target === 'reagendar') ScheduledListController.render();
    });
  });
}

// Exporta para o main.js
window.initConsultasV2 = initConsultasV2;