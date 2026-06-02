let isSignup = false;
let isPendingRedirect = false;

auth.onAuthStateChanged(async user => {
  if (user && window.location.pathname.includes('login.html') && !isSignup && !isPendingRedirect) {
    try {
      await redirectAfterLogin(user.uid);
    } catch {
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

document.getElementById('toggle-link').addEventListener('click', () => {
  isSignup = !isSignup;
  document.getElementById('btn-submit').textContent = isSignup ? 'Cadastrar' : 'Entrar';
  document.getElementById('toggle-text').textContent = isSignup ? 'Já tem conta? ' : 'Não tem conta? ';
  document.getElementById('toggle-link').textContent = isSignup ? 'Entrar' : 'Criar minha conta';
  hideError();
});

document.getElementById('btn-submit').addEventListener('click', async () => {
  const email = document.getElementById('input-email').value.trim();
  const senha = document.getElementById('input-senha').value;
  if (!email || !senha) return showError('Preencha email e senha.');
  if (isSignup && senha.length < 6) return showError('Senha deve ter pelo menos 6 caracteres.');

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  hideError();

  let loginSucceeded = false;
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
        await cred.user.delete().catch(delErr => {
          console.error('Aviso: conta Auth criada mas Firestore falhou e conta não pôde ser excluída:', delErr);
        });
        throw fsErr;
      }
      window.location.href = 'profile.html';
    } else {
      isPendingRedirect = true;
      const cred = await auth.signInWithEmailAndPassword(email, senha);
      await redirectAfterLogin(cred.user.uid);
    }
    loginSucceeded = true;
  } catch (err) {
    handleLoginError(err);
  } finally {
    btn.disabled = false;
    if (!loginSucceeded) isPendingRedirect = false;
  }
});

document.getElementById('btn-google').addEventListener('click', async () => {
  const btn = document.getElementById('btn-google');
  btn.disabled = true;
  isPendingRedirect = true;

  let loginSucceeded = false;
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
        await auth.signOut().catch(() => {});
        showError('Erro ao criar conta. Verifique sua conexão e tente novamente.');
        return;
      }
      window.location.href = 'profile.html';
    } else {
      await redirectAfterLogin(cred.user.uid);
    }
    loginSucceeded = true;
  } catch (err) {
    handleLoginError(err);
  } finally {
    btn.disabled = false;
    if (!loginSucceeded) isPendingRedirect = false;
  }
});

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('error-msg').style.display = 'none';
}

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
