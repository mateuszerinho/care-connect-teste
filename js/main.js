/* ============================================================
   CARE+ CONNECT  ·  main.js
   UI interactions only — toasts, menus, modais,
   validações, animações e efeitos visuais.
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   1. TOAST / NOTIFICAÇÃO VISUAL
   ────────────────────────────────────────────────────────────── */
const Toast = (() => {
  let container;

  function _getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Exibe um toast na tela.
   * @param {string} msg     Mensagem a exibir
   * @param {'default'|'success'|'error'} type
   * @param {number} duration  Duração em ms (padrão 3000)
   */
  function show(msg, type = 'default', duration = 3000) {
    const el = document.createElement('div');
    el.className = 'cc-toast' + (type !== 'default' ? ' ' + type : '');
    el.textContent = msg;
    _getContainer().appendChild(el);

    setTimeout(() => {
      el.style.animation = 'toastOut .3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  return { show };
})();

/* ──────────────────────────────────────────────────────────────
   2. LOGIN — Validação de formulário e toggle de senha
   ────────────────────────────────────────────────────────────── */
function initLogin() {
  const form    = document.getElementById('login-form');
  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-password');
  const eyeBtn  = document.getElementById('btn-eye');
  const eyeIcon = document.getElementById('eye-icon');

  if (!form) return;

  // Toggle mostrar/ocultar senha
  eyeBtn?.addEventListener('click', () => {
    const show = passEl.type === 'password';
    passEl.type = show ? 'text' : 'password';
    eyeIcon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
  });

  // Validação e redirecionamento
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    const pass  = passEl.value;

    if (!email) {
      Toast.show('⚠️ Informe seu e-mail.', 'error');
      emailEl.focus();
      return;
    }
    if (!email.includes('@')) {
      Toast.show('⚠️ E-mail inválido.', 'error');
      emailEl.focus();
      return;
    }
    if (!pass || pass.length < 4) {
      Toast.show('⚠️ Senha muito curta.', 'error');
      passEl.focus();
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Entrando…';

    setTimeout(() => window.location.href = 'pages/home.html', 700);
  });

  // Login via Google / Care Plus ID
  document.getElementById('btn-google')?.addEventListener('click', () => {
    Toast.show('Conectando com Google…', 'default', 1500);
    setTimeout(() => window.location.href = 'pages/home.html', 900);
  });

  document.getElementById('btn-careplus')?.addEventListener('click', () => {
    Toast.show('Conectando com Care Plus ID…', 'default', 1500);
    setTimeout(() => window.location.href = 'pages/home.html', 900);
  });
}

/* ──────────────────────────────────────────────────────────────
   3. CONSULTAS — Abas, seleção de especialidade, médico, horário
   ────────────────────────────────────────────────────────────── */
function initConsultas() {
  /* ---- Abas Marcar Nova / Reagendar ---- */
  const tabBtns   = document.querySelectorAll('.tab-btn[data-tab]');
  const tabPanels = document.querySelectorAll('.tab-panel[data-panel]');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      tabPanels.forEach(p => p.classList.toggle('d-none', p.dataset.panel !== target));
    });
  });

  /* ---- Seleção de especialidade ---- */
  document.querySelectorAll('.spec-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.spec-card').forEach(c => {
        c.classList.remove('selected');
        c.style.background = '';
      });
      card.classList.add('selected');
      card.style.background = card.dataset.bg || '';

      // Exibe médicos da especialidade selecionada
      const specId = card.dataset.spec;
      document.querySelectorAll('.doctor-group').forEach(g => {
        g.classList.toggle('d-none', g.dataset.spec !== specId);
      });
      document.getElementById('doctor-placeholder')?.classList.add('d-none');
    });
  });

  /* ---- Seleção de médico ---- */
  document.querySelectorAll('.doctor-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.doctor-row').forEach(r => {
        r.classList.remove('selected');
        r.querySelector('.doctor-check')?.classList.add('d-none');
      });
      row.classList.add('selected');
      row.querySelector('.doctor-check')?.classList.remove('d-none');
    });
  });

  /* ---- Seleção de horário ---- */
  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
    });
  });

  /* ---- Confirmar agendamento ---- */
  document.getElementById('btn-confirmar')?.addEventListener('click', () => {
    const spec   = document.querySelector('.spec-card.selected');
    const doctor = document.querySelector('.doctor-row.selected');
    const day    = document.querySelector('.cal-day.selected');
    const time   = document.querySelector('.time-slot.selected');

    if (!spec)   { Toast.show('⚠️ Selecione uma especialidade.', 'error'); return; }
    if (!doctor) { Toast.show('⚠️ Selecione um médico.', 'error');         return; }
    if (!day)    { Toast.show('⚠️ Selecione um dia.', 'error');            return; }
    if (!time)   { Toast.show('⚠️ Selecione um horário.', 'error');        return; }

    Toast.show('🎉 Consulta agendada com sucesso! +20 pontos!', 'success', 3500);

    // Reset das seleções
    setTimeout(() => {
      ['.spec-card', '.doctor-row', '.cal-day', '.time-slot'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.classList.remove('selected');
          if (sel === '.spec-card') el.style.background = '';
        });
      });
      // Volta para aba de reagendar
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'reagendar'));
      tabPanels.forEach(p => p.classList.toggle('d-none', p.dataset.panel !== 'reagendar'));
    }, 400);
  });

  /* ---- Cancelar consulta agendada ---- */
  document.querySelectorAll('[data-action="cancelar-consulta"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Deseja cancelar esta consulta?')) {
        const card = btn.closest('.sched-card');
        card.style.transition = 'opacity .3s, transform .3s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(40px)';
        setTimeout(() => card.remove(), 300);
        Toast.show('Consulta cancelada.', 'default');
      }
    });
  });
}

/* ──────────────────────────────────────────────────────────────
   4. CALENDÁRIO — Navegação entre meses
   ────────────────────────────────────────────────────────────── */
function initCalendar() {
  const wrapper = document.getElementById('calendar-body');
  if (!wrapper) return;

  const monthLabel = document.getElementById('cal-month-label');
  const btnPrev    = document.getElementById('cal-prev');
  const btnNext    = document.getElementById('cal-next');

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  let currentMonth = parseInt(wrapper.dataset.month ?? 9);  // 0-indexed; 9 = Outubro
  let currentYear  = parseInt(wrapper.dataset.year  ?? 2025);

  function renderCalendar() {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
    const today       = new Date();

    monthLabel.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

    let html = '';
    for (let i = 0; i < firstDay; i++)
      html += '<div class="cal-day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        d === today.getDate() &&
        currentMonth === today.getMonth() &&
        currentYear  === today.getFullYear();
      html += `<div class="cal-day${isToday ? ' today' : ''}"
                    data-day="${d}" data-month="${currentMonth}" data-year="${currentYear}"
                    role="button" tabindex="0">${d}</div>`;
    }

    wrapper.innerHTML = html;

    // Re-bind click on new days
    wrapper.querySelectorAll('.cal-day:not(.empty)').forEach(day => {
      day.addEventListener('click', () => {
        wrapper.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
        day.classList.add('selected');
      });
    });
  }

  btnPrev?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });

  btnNext?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });

  // Click nos dias do calendário estático (primeiro render)
  wrapper.querySelectorAll('.cal-day:not(.empty)').forEach(day => {
    day.addEventListener('click', () => {
      wrapper.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
      day.classList.add('selected');
    });
  });
}

/* ──────────────────────────────────────────────────────────────
   5. NOTIFICAÇÕES — Filtro por categoria e dismiss
   ────────────────────────────────────────────────────────────── */
function initNotificacoes() {
  /* ---- Chips de filtro ---- */
  const chips = document.querySelectorAll('.chip[data-category]');
  const cards = document.querySelectorAll('.notif-card[data-category]');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const cat = chip.dataset.category;
      let visible = 0;

      cards.forEach(card => {
        const show = cat === 'Todos' || card.dataset.category === cat;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      const empty = document.getElementById('notif-empty');
      if (empty) empty.style.display = visible === 0 ? 'flex' : 'none';
    });
  });

  /* ---- Dismiss com clique longo (600ms) ---- */
  let pressTimer;
  cards.forEach(card => {
    card.addEventListener('pointerdown', () => {
      pressTimer = setTimeout(() => {
        card.classList.add('dismissed');
        setTimeout(() => card.remove(), 350);
        Toast.show('Notificação removida.');
      }, 600);
    });
    card.addEventListener('pointerup',    () => clearTimeout(pressTimer));
    card.addEventListener('pointerleave', () => clearTimeout(pressTimer));
  });
}

/* ──────────────────────────────────────────────────────────────
   6. RECOMPENSAS — Resgatar reward
   ────────────────────────────────────────────────────────────── */
function initRecompensas() {
  document.querySelectorAll('.reward-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('locked-btn')) {
        const pts = btn.closest('.reward-card')?.dataset.points || '???';
        Toast.show(`🔒 Você precisa de ${pts} pts para resgatar.`, 'error');
        return;
      }

      const name = btn.closest('.reward-card')?.dataset.name || 'Recompensa';
      Toast.show(`🎉 "${name}" resgatado com sucesso!`, 'success');

      // ▼ NOVO — muda o botão para "Resgatado" e desativa
      btn.textContent = '✅ Resgatado';
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.style.cursor = 'default';
    });
  });
}

/* ──────────────────────────────────────────────────────────────
   7. PERFIL / CONFIGURAÇÕES — Toggles e logout
   ────────────────────────────────────────────────────────────── */
function initPerfil() {
  // Feedback visual nos toggles
  document.querySelectorAll('.cc-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const label = toggle.closest('.setting-row, .reminder-row')
                         ?.querySelector('.setting-lbl')?.textContent ?? 'Configuração';
      Toast.show(toggle.checked ? `✅ ${label} ativado` : `${label} desativado`);
    });
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('Deseja sair da conta?')) {
      Toast.show('Até logo! 👋', 'default', 1200);
      setTimeout(() => window.location.href = '../index.html', 800);
    }
  });

  // Editar perfil (placeholder)
  document.getElementById('btn-editar-perfil')?.addEventListener('click', () => {
    Toast.show('✏️ Funcionalidade em breve!');
  });
}

/* ──────────────────────────────────────────────────────────────
   8. HOME — Próximas Consultas dinâmicas (lê do localStorage)
   ────────────────────────────────────────────────────────────── */
function initHome() {
  _renderHomeAppointments();
}

function _renderHomeAppointments() {
  const container = document.getElementById('home-appt-list');
  if (!container) return;

  const STORAGE_KEY = 'cc_appointments_v2';
  const ACCENT_COLORS = ['#0ea5e9','#f97316','#10b981','#8b5cf6','#f59e0b','#ef4444'];
  const DAYS_PT   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  let appointments = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const now  = new Date();
      appointments = (data.appointments || [])
        .filter(a => new Date(a.date + 'T' + a.time) >= now)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 3);
    }
  } catch (_) {}

  if (appointments.length === 0) {
    container.innerHTML = `
      <div class="home-appt-empty">
        <i class="bi bi-calendar-plus"></i>
        <p>Nenhuma consulta agendada</p>
        <a href="consultas.html" class="appt-btn btn-reschedule"
           style="display:inline-block;padding:10px 20px;border-radius:999px">
          + Agendar consulta
        </a>
      </div>`;
    return;
  }

  container.innerHTML = '';
  appointments.forEach((apt, idx) => {
    const color    = ACCENT_COLORS[idx % ACCENT_COLORS.length];
    const isOnline = apt.modality === 'online';
    const d        = new Date(apt.date + 'T' + apt.time);
    const dateStr  = DAYS_PT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_PT[d.getMonth()] + ' ' + d.getFullYear();

    const card = document.createElement('div');
    card.className = 'appt-card';
    card.style.borderLeftColor = color;
    card.dataset.aptId = apt.id;
    card.innerHTML =
      '<div class="appt-badges">' +
        (isOnline
          ? '<span class="appt-badge badge-online">📹 Online</span>'
          : '<span class="appt-badge badge-presencial">🏥 Presencial</span>') +
        '<span class="appt-badge badge-confirmed"><i class="bi bi-check-circle-fill"></i> Confirmada</span>' +
      '</div>' +
      '<div class="appt-doctor">' + apt.doctorAvatar + ' ' + apt.doctorName + '</div>' +
      '<div class="appt-spec">' + apt.specIcon + ' ' + apt.specName + '</div>' +
      '<div class="appt-detail"><i class="bi bi-calendar3" style="color:' + color + '"></i> ' + dateStr + '</div>' +
      '<div class="appt-detail"><i class="bi bi-clock" style="color:' + color + '"></i> ' + apt.time + '</div>' +
      (apt.notes ? '<div class="appt-detail" style="font-style:italic;color:var(--muted-fg)"><i class="bi bi-chat-text" style="color:' + color + '"></i> ' + apt.notes + '</div>' : '') +
      (isOnline ? '<button class="btn-video">🎥 Entrar na consulta online</button>' : '') +
      '<div class="appt-actions">' +
        '<a href="consultas.html" class="appt-btn btn-reschedule text-center">Reagendar</a>' +
        '<button class="appt-btn btn-cancel" data-action="cancelar-consulta" data-apt-id="' + apt.id + '">Cancelar</button>' +
      '</div>';

    card.querySelector('[data-action="cancelar-consulta"]').addEventListener('click', function() {
      if (!confirm('Deseja cancelar esta consulta?')) return;
      const aptId = this.dataset.aptId;
      try {
        const raw  = localStorage.getItem(STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        data.appointments = (data.appointments || []).filter(function(a) { return a.id !== aptId; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (_) {}
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(40px)';
      setTimeout(function() {
        card.remove();
        Toast.show('Consulta cancelada.');
        _renderHomeAppointments();
      }, 320);
    });

    container.appendChild(card);
  });
}

(function _injectHomeStyles() {
  if (document.getElementById('home-extra-styles')) return;
  const s = document.createElement('style');
  s.id = 'home-extra-styles';
  s.textContent =
    '.home-appt-empty{text-align:center;padding:28px 16px;color:var(--muted-fg);display:flex;flex-direction:column;align-items:center;gap:10px}' +
    '.home-appt-empty i{font-size:40px}' +
    '.home-appt-empty p{font-size:14px;margin:0}';
  document.head.appendChild(s);
})();

/* ──────────────────────────────────────────────────────────────
   9. ANIMAÇÃO DE ENTRADA NAS BARRAS DE PROGRESSO
   ────────────────────────────────────────────────────────────── */
function animateProgressBars() {
  const bars = document.querySelectorAll('.prog-fill, .bar-fill');
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el  = entry.target;
        const pct = el.dataset.pct || el.style.width || '0%';
        el.style.width = '0%';
        requestAnimationFrame(() => {
          el.style.transition = 'width .7s ease';
          el.style.width = pct;
        });
        io.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  bars.forEach(bar => {
    // Salva a largura original antes de zerar
    bar.dataset.pct = bar.style.width;
    io.observe(bar);
  });
}

/* ──────────────────────────────────────────────────────────────
   10. INICIALIZAÇÃO — Detecta qual página está carregada
   ────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || '';

  switch (page) {
    case 'login':         initLogin();      break;
    case 'home':          initHome();       break;
    case 'consultas':
      // initConsultasV2 é carregado por js/consultas.js (script separado)
      if (typeof initConsultasV2 === 'function') initConsultasV2();
      else { initConsultas(); initCalendar(); } // fallback
      break;
    case 'recompensas':   initRecompensas(); break;
    case 'perfil':        initPerfil();     break;
    case 'configuracoes': initPerfil();     break;
    case 'notificacoes':  initNotificacoes(); break;
  }

  // Animações de barras em qualquer página
  animateProgressBars();

  // Setas de voltar — navega para a página anterior do histórico
  initBackButtons();
});

/* ──────────────────────────────────────────────────────────────
   11. BACK BUTTONS — Voltar para a última página visitada
   ────────────────────────────────────────────────────────────── */
function initBackButtons() {
  document.querySelectorAll('.g-header-btn .bi-arrow-left').forEach(icon => {
    const btn = icon.closest('.g-header-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      history.back();
    });
  });
}