let isSignup = false;
let isPendingRedirect = false;

const btnSubmit  = document.getElementById('btn-submit');
const btnGoogle  = document.getElementById('btn-google');
const toggleLink = document.getElementById('toggle-link');
const toggleText = document.getElementById('toggle-text');
const inputEmail = document.getElementById('input-email');
const inputSenha = document.getElementById('input-senha');
const errorMsg   = document.getElementById('error-msg');

// Login por e-mail ou pelo Google em andamento: o botão de quem está
// entrando fica desativado do início ao fim (inclusive durante o
// redirecionamento do sucesso), e nada mais começa enquanto isso.
function emAndamento() {
  return btnSubmit.disabled || btnGoogle.disabled;
}

// Ação ignorada por já haver um login em andamento: avisa em vez de ficar mudo.
function avisarEmAndamento() {
  if (window.anunciar) window.anunciar('Aguarde: já há um login em andamento.');
}

auth.onAuthStateChanged(async user => {
  if (user && window.location.pathname.includes('login.html') && !isSignup && !isPendingRedirect) {
    try {
      await redirectAfterLogin(user.uid);
    } catch (err) {
      console.error('Erro ao verificar perfis, redirecionando para dashboard:', err);
      window.location.href = 'dashboard.html';
    }
  }
});

async function redirectAfterLogin(uid) {
  const snap = await db.collection('users').doc(uid).get();
  const hasProfiles = snap.exists && (snap.data()?.activeProfiles || []).length > 0;
  window.location.href = hasProfiles ? 'dashboard.html' : 'profile.html';
}

function handleLoginError(err) {
  const msg = (err.code && err.code.startsWith('auth/'))
    ? translateError(err.code)
    : 'Erro ao acessar dados da conta. Verifique sua conexão e tente novamente.';
  showError(msg);
}

// Entrar (signup = false) ou Criar minha conta (signup = true).
function aplicarModo(signup) {
  isSignup = signup;
  btnSubmit.textContent  = signup ? 'Cadastrar' : 'Entrar';
  toggleText.textContent = signup ? 'Já tem conta? ' : 'Não tem conta? ';
  toggleLink.textContent = signup ? 'Entrar' : 'Criar minha conta';
  // No cadastro o navegador deve sugerir senha nova, não preencher a salva.
  inputSenha.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
}

toggleLink.addEventListener('click', () => {
  // Trocar de modo no meio de um envio (e-mail ou Google) quebraria o fluxo.
  if (emAndamento()) return avisarEmAndamento();
  aplicarModo(!isSignup);
  // O foco fica no botão de alternar; quem usa leitor de tela precisa ouvir
  // que o formulário mudou de modo.
  if (window.anunciar) window.anunciar(isSignup ? 'Modo cadastro: crie sua conta.' : 'Modo entrada: entre na sua conta.');
  hideError();
});

// Um único caminho para o envio: o botão Entrar/Cadastrar, o Enter nos campos
// e o envio por script (form.requestSubmit) disparam o "submit".
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (emAndamento()) return avisarEmAndamento();

  const email = inputEmail.value.trim();
  const senha = inputSenha.value;
  if (!email || !senha) return showError('Preencha email e senha.');
  if (isSignup && senha.length < 6) return showError('Senha deve ter pelo menos 6 caracteres.');

  btnSubmit.disabled = true;
  hideError();

  try {
    if (isSignup) {
      const cred = await auth.createUserWithEmailAndPassword(email, senha);
      try {
        await db.collection('users').doc(cred.user.uid).set({
          email,
          name: email.split('@')[0],
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          activeProfiles: [],
          activeToggles: {}
        });
      } catch (fsErr) {
        await cred.user.delete().catch(async delErr => {
          console.error('Aviso: conta Auth criada mas Firestore falhou e conta não pôde ser excluída:', delErr);
          // Não deixa a pessoa logada numa conta sem cadastro no banco.
          await auth.signOut().catch(() => {});
        });
        throw fsErr;
      }
      window.location.href = 'profile.html';
    } else {
      isPendingRedirect = true;
      const cred = await auth.signInWithEmailAndPassword(email, senha);
      try {
        await redirectAfterLogin(cred.user.uid);
      } catch (perfilErr) {
        // Logado, mas a leitura do perfil falhou: mesmo plano B do
        // onAuthStateChanged, em vez de deixar a pessoa presa no login.
        console.error('Erro ao verificar perfis, redirecionando para dashboard:', perfilErr);
        window.location.href = 'dashboard.html';
      }
    }
  } catch (err) {
    handleLoginError(err);
    isPendingRedirect = false;
    // Só reativa quando falhou: no sucesso a página está sendo trocada, e um
    // segundo Enter durante o carregamento repetiria o login ou o cadastro.
    btnSubmit.disabled = false;
  }
});

btnGoogle.addEventListener('click', async () => {
  // Não abre o Google enquanto o login/cadastro por e-mail está em andamento.
  if (emAndamento()) return avisarEmAndamento();
  btnGoogle.disabled = true;
  isPendingRedirect = true;

  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const cred = await auth.signInWithPopup(provider);
    const userDoc = db.collection('users').doc(cred.user.uid);
    const snap = await userDoc.get();
    if (!snap.exists) {
      try {
        await userDoc.set({
          email: cred.user.email,
          name: cred.user.displayName,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          activeProfiles: [],
          activeToggles: {}
        });
      } catch (fsErr) {
        console.error('Erro ao criar doc do usuário Google:', fsErr);
        isPendingRedirect = false;
        await auth.signOut().catch(() => {});
        showError('Erro ao criar conta. Verifique sua conexão e tente novamente.');
        btnGoogle.disabled = false;
        return;
      }
      window.location.href = 'profile.html';
    } else {
      await redirectAfterLogin(cred.user.uid);
    }
  } catch (err) {
    handleLoginError(err);
    isPendingRedirect = false;
    // Como no e-mail: só reativa quando falhou, nunca durante o redirecionamento.
    btnGoogle.disabled = false;
  }
});

let erroPendente = 0;

function showError(msg) {
  // Mostra antes de escrever e escreve logo depois: o role="alert" precisa
  // estar visível e ver o texto mudar, inclusive quando o erro se repete,
  // para o leitor de tela anunciar. setTimeout e não requestAnimationFrame,
  // que pausa com a aba escondida (popup do Google no celular).
  clearTimeout(erroPendente);
  errorMsg.style.display = 'block';
  errorMsg.textContent = '';
  erroPendente = setTimeout(() => { errorMsg.textContent = msg; }, 30);
}

function hideError() {
  clearTimeout(erroPendente);
  errorMsg.style.display = 'none';
  errorMsg.textContent = '';
}

// Ao voltar para esta página pelo botão Voltar, o navegador pode restaurá-la
// do cache como estava no último envio (botões travados, modo cadastro).
// Só desfaz um envio que estava em andamento; se não havia envio, mantém o
// modo que a pessoa escolheu. Sem recarregar nem redirecionar.
window.addEventListener('pageshow', e => {
  if (!e.persisted || !emAndamento()) return;
  btnSubmit.disabled = false;
  btnGoogle.disabled = false;
  isPendingRedirect = false;
  aplicarModo(false);
  hideError();
});

function translateError(code) {
  const msgs = {
    'auth/user-not-found':       'Email não encontrado.',
    'auth/wrong-password':       'Senha incorreta.',
    'auth/invalid-credential':   'Email ou senha incorretos.',
    'auth/email-already-in-use': 'Email já cadastrado.',
    'auth/weak-password':        'Senha muito fraca (mínimo 6 caracteres).',
    'auth/invalid-email':        'Email inválido.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/popup-blocked':        'Popup bloqueado pelo navegador. Permita popups e tente novamente.'
  };
  return msgs[code] || 'Erro ao autenticar. Tente novamente.';
}
