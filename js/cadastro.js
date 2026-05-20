/* ============================================================
   CARE+ CONNECT  ·  cadastro.js
   Lógica exclusiva da página de cadastro:
   ─ Sistema de Toast rico (com ícones e barra de progresso)
   ─ Toggle mostrar/ocultar senha
   ─ Máscara de telefone
   ─ Validação e submit do formulário
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   1. SISTEMA DE TOAST (específico do cadastro, com ícones SVG)
   ────────────────────────────────────────────────────────────── */
const CadastroToast = (() => {
  const ICONS = {
    error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  const TITLES = {
    error: 'Erro',
    success: 'Sucesso!',
    warning: 'Atenção',
    info: 'Informação',
  };

  const DURATION = {
    error: 4500,
    success: 3000,
    warning: 4000,
    info: 3500,
  };

  function show(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const duration = DURATION[type] ?? 3500;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      ${ICONS[type] ?? ICONS.info}
      <div class="toast-body">
        <div class="toast-title">${TITLES[type] ?? 'Aviso'}</div>
        <div class="toast-msg">${message}</div>
      </div>
      <button class="toast-close" aria-label="Fechar">&#x2715;</button>
      <div class="toast-progress" style="animation-duration:${duration}ms"></div>
    `;

    container.appendChild(el);

    el.querySelector('.toast-close').addEventListener('click', () => dismiss(el));

    const timer = setTimeout(() => dismiss(el), duration);
    el._timer = timer;
  }

  function dismiss(el) {
    if (el._dismissed) return;
    el._dismissed = true;
    clearTimeout(el._timer);
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  return { show };
})();


/* ──────────────────────────────────────────────────────────────
   2. TOGGLE MOSTRAR / OCULTAR SENHA
   ────────────────────────────────────────────────────────────── */
function setupEye(btnId, inputId) {
  const btn   = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('i').className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
  });
}


/* ──────────────────────────────────────────────────────────────
   3. MÁSCARA DE TELEFONE
   ────────────────────────────────────────────────────────────── */
function initPhoneMask() {
  const telInput = document.getElementById('cad-telefone');
  if (!telInput) return;

  telInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);

    if (v.length >= 11) {
      v = `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)}-${v.slice(7)}`;
    } else if (v.length >= 7) {
      v = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    } else if (v.length >= 3) {
      v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    }

    e.target.value = v;
  });
}


/* ──────────────────────────────────────────────────────────────
   4. VALIDAÇÃO E SUBMIT DO FORMULÁRIO DE CADASTRO
   ────────────────────────────────────────────────────────────── */
function initCadastroForm() {
  const form = document.getElementById('cadastro-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nome      = document.getElementById('cad-nome').value.trim();
    const sobrenome = document.getElementById('cad-sobrenome').value.trim();
    const email     = document.getElementById('cad-email').value.trim();
    const telefone  = document.getElementById('cad-telefone').value.trim();
    const senha     = document.getElementById('cad-senha').value;
    const confirma  = document.getElementById('cad-confirma-senha').value;
    const termos    = document.getElementById('cad-termos').checked;

    if (!nome || !sobrenome || !email || !senha || !confirma) {
      CadastroToast.show('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (senha.length < 8) {
      CadastroToast.show('A senha deve ter no mínimo 8 caracteres.', 'error');
      return;
    }

    if (senha !== confirma) {
      CadastroToast.show('As senhas não coincidem. Verifique e tente novamente.', 'error');
      return;
    }

    if (!termos) {
      CadastroToast.show('Você precisa aceitar os Termos de Uso para continuar.', 'warning');
      return;
    }

    // Persiste dados do perfil no localStorage para uso em outras páginas
    try {
      const perfilData = {
        nome:     `${nome} ${sobrenome}`,
        email:    email,
        telefone: telefone,
      };
      localStorage.setItem('cc_perfil_v1', JSON.stringify(perfilData));
    } catch (_) {}

    CadastroToast.show(`Conta criada com sucesso! Bem-vindo(a), ${nome}!`, 'success');
    setTimeout(() => { window.location.href = 'home.html'; }, 1800);
  });
}


/* ──────────────────────────────────────────────────────────────
   5. INICIALIZAÇÃO
   ────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setupEye('btn-eye-senha',    'cad-senha');
  setupEye('btn-eye-confirma', 'cad-confirma-senha');
  initPhoneMask();
  initCadastroForm();
});