/* ================================================================
   perfil.js — Editar Perfil (Care+ Connect)
   Gerencia nome, e-mail e senha com persistência em localStorage.
   Nome padrão inicial: "Usuario(a)"
   ================================================================ */

const PERFIL_KEY = 'cc_perfil_v1';

/* ---------- Dados padrão ---------- */
const DEFAULT_PERFIL = {
  nome:  'Usuario(a)',
  email: 'usuario@email.com',
  senha: ''
};

/* ---------- Helpers ---------- */
function getPerfil() {
  try {
    const raw = localStorage.getItem(PERFIL_KEY);
    return raw ? { ...DEFAULT_PERFIL, ...JSON.parse(raw) } : { ...DEFAULT_PERFIL };
  } catch {
    return { ...DEFAULT_PERFIL };
  }
}

function savePerfil(data) {
  localStorage.setItem(PERFIL_KEY, JSON.stringify(data));
}

function avatarLetra(nome) {
  return (nome || 'U').trim().charAt(0).toUpperCase();
}

/* ---------- Atualiza a UI com os dados atuais ---------- */
function aplicarPerfil(perfil) {
  const letra = avatarLetra(perfil.nome);

  const profileName  = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const avatarCircle = document.getElementById('avatar-circle');

  if (profileName)  profileName.textContent  = perfil.nome;
  if (profileEmail) profileEmail.textContent = perfil.email;
  if (avatarCircle) {
    avatarCircle.childNodes[0].textContent = letra;
  }

  const sbNome   = document.getElementById('sb-user-name');
  const sbAvatar = document.getElementById('sb-avatar');
  if (sbNome)   sbNome.textContent   = perfil.nome;
  if (sbAvatar) sbAvatar.textContent = letra;
}

/* ---------- Abre o modal preenchendo os campos ---------- */
function abrirModalEditar() {
  const perfil = getPerfil();

  document.getElementById('edit-nome').value      = perfil.nome;
  document.getElementById('edit-email').value     = perfil.email;
  document.getElementById('edit-senha').value     = '';
  document.getElementById('edit-confirmar').value = '';

  ['edit-nome','edit-email','edit-senha','edit-confirmar'].forEach(id => {
    document.getElementById(id)?.classList.remove('is-invalid');
  });
  document.getElementById('modal-erro').textContent = '';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEditarPerfil')).show();
}

/* ---------- Salva as alterações ---------- */
function salvarPerfil() {
  const nome      = document.getElementById('edit-nome').value.trim();
  const email     = document.getElementById('edit-email').value.trim();
  const senha     = document.getElementById('edit-senha').value;
  const confirmar = document.getElementById('edit-confirmar').value;
  const erroEl    = document.getElementById('modal-erro');

  ['edit-nome','edit-email','edit-senha','edit-confirmar'].forEach(id =>
    document.getElementById(id)?.classList.remove('is-invalid')
  );
  erroEl.textContent = '';

  let ok = true;

  if (!nome) {
    document.getElementById('edit-nome').classList.add('is-invalid');
    erroEl.textContent = 'O nome não pode ficar em branco.';
    ok = false;
  }

  if (!email || !email.includes('@') || !email.includes('.')) {
    document.getElementById('edit-email').classList.add('is-invalid');
    if (ok) erroEl.textContent = 'Informe um e-mail válido.';
    ok = false;
  }

  if (senha && senha.length < 6) {
    document.getElementById('edit-senha').classList.add('is-invalid');
    if (ok) erroEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
    ok = false;
  }

  if (senha && senha !== confirmar) {
    document.getElementById('edit-confirmar').classList.add('is-invalid');
    if (ok) erroEl.textContent = 'As senhas não coincidem.';
    ok = false;
  }

  if (!ok) return;

  const perfil = getPerfil();
  perfil.nome  = nome;
  perfil.email = email;
  if (senha) perfil.senha = senha;
  savePerfil(perfil);

  aplicarPerfil(perfil);

  bootstrap.Modal.getInstance(document.getElementById('modalEditarPerfil')).hide();

  if (window.Toast) {
    Toast.show('✅ Perfil atualizado com sucesso!', 'success');
  }
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  aplicarPerfil(getPerfil());

  document.getElementById('btn-editar-perfil')?.addEventListener('click', abrirModalEditar);
  document.getElementById('btn-salvar-perfil')?.addEventListener('click', salvarPerfil);

  ['edit-nome','edit-email','edit-senha','edit-confirmar'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') salvarPerfil();
    });
  });

  document.querySelectorAll('[data-toggle-senha]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input   = document.getElementById(btn.dataset.toggleSenha);
      if (!input) return;
      const mostrar = input.type === 'password';
      input.type    = mostrar ? 'text' : 'password';
      btn.querySelector('i').className = mostrar ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  });
});