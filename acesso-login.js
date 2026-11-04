/* Tela de login. Compara o hash SHA-256 e não guarda a senha. */
(function () {
  const CHAVE = "avalie-acesso";
  const MSG_ERRO = "Login ou senha incorretos.";
  const MSG_VAZIO = "Informe o login e a senha.";
  const ROTULO_MESTRE = "Secretaria Municipal de Educação";

  function rotr(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
  }

  function sha256Hex(mensagem) {
    const K = new Uint32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    const bytes = new TextEncoder().encode(mensagem);
    const bitLen = bytes.length * 8;
    const comUm = bytes.length + 1;
    const zeros = (56 - (comUm % 64) + 64) % 64;
    const total = bytes.length + 1 + zeros + 8;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[bytes.length] = 0x80;
    const view = new DataView(buf.buffer);
    view.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
    view.setUint32(total - 4, bitLen >>> 0);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let i = 0; i < buf.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;
      for (let t = 0; t < 64; t++) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, "0")).join("");
  }

  async function hashSenha(senha) {
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      const dados = new TextEncoder().encode(senha);
      const buf = await crypto.subtle.digest("SHA-256", dados);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256Hex(senha);
  }

  function catalogo() {
    return Array.isArray(window.ACESSO_ESCOLAS) ? window.ACESSO_ESCOLAS : [];
  }

  function buscarLogin(login) {
    const chave = String(login || "").trim().toLowerCase();
    if (!chave) return null;
    return catalogo().find((item) => String(item.login || "").toLowerCase() === chave) || null;
  }

  function sessaoDoItem(item) {
    if (!item) return null;
    if (item.mestre) return { login: item.login, mestre: true };
    return { login: item.login, escola: item.escola || "" };
  }

  function lerBruto() {
    try {
      const raw = sessionStorage.getItem(CHAVE);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* sessão inválida */ }
    try {
      if (window.opener && !window.opener.closed) {
        const raw = window.opener.sessionStorage.getItem(CHAVE);
        if (raw) {
          sessionStorage.setItem(CHAVE, raw);
          return JSON.parse(raw);
        }
      }
    } catch (e) { /* outra janela sem acesso */ }
    return null;
  }

  function sessaoAtual() {
    const bruto = lerBruto();
    if (!bruto || !bruto.login) return null;
    return sessaoDoItem(buscarLogin(bruto.login));
  }

  function gravarSessao(item) {
    const sessao = sessaoDoItem(item);
    sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
    return sessao;
  }

  function rotulo(sessao) {
    if (!sessao) return "";
    if (sessao.mestre) return ROTULO_MESTRE;
    return sessao.escola || "";
  }

  function pintarRotulo() {
    const texto = rotulo(sessaoAtual());
    document.querySelectorAll(".acesso-escola-nome").forEach((el) => {
      el.textContent = texto;
    });
  }

  function abrirConteudo() {
    document.documentElement.classList.add("acesso-ok");
    pintarRotulo();
    if (document.body.classList.contains("corretor-solo")) return;
    if (typeof mostrarCapa === "function") mostrarCapa();
  }

  function limparFormulario() {
    const login = document.getElementById("acessoLogin");
    const senha = document.getElementById("acessoSenha");
    const erro = document.getElementById("acessoErro");
    if (login) login.value = "";
    if (senha) senha.value = "";
    if (erro) erro.textContent = "";
  }

  function sair() {
    try { sessionStorage.removeItem(CHAVE); } catch (e) { /* segue para a tela */ }
    if (typeof sairModoSlide === "function") sairModoSlide();
    if (typeof limparIdleSlide === "function") limparIdleSlide();
    document.documentElement.classList.remove("acesso-ok");
    limparFormulario();
    pintarRotulo();
    const login = document.getElementById("acessoLogin");
    if (login) login.focus();
  }

  function aplicarSessaoInicial() {
    const sessao = sessaoAtual();
    if (!sessao) {
      document.documentElement.classList.remove("acesso-ok");
      limparFormulario();
      const login = document.getElementById("acessoLogin");
      if (login) login.focus();
      return;
    }
    gravarSessao(buscarLogin(sessao.login));
    document.documentElement.classList.add("acesso-ok");
    pintarRotulo();
  }

  async function entrar(ev) {
    ev.preventDefault();
    const loginEl = document.getElementById("acessoLogin");
    const senhaEl = document.getElementById("acessoSenha");
    const erro = document.getElementById("acessoErro");
    const botao = ev.currentTarget.querySelector("button[type='submit']");
    const login = loginEl ? loginEl.value.trim() : "";
    const senha = senhaEl ? senhaEl.value.trim() : "";
    if (erro) erro.textContent = "";
    if (!login || !senha) {
      if (erro) erro.textContent = MSG_VAZIO;
      return;
    }
    if (botao) botao.disabled = true;
    try {
      const item = buscarLogin(login);
      const hash = await hashSenha(senha);
      const esperado = item && item.senhaHash ? String(item.senhaHash).toLowerCase() : "";
      if (!item || hash !== esperado) {
        if (erro) erro.textContent = MSG_ERRO;
        return;
      }
      gravarSessao(item);
      if (senhaEl) senhaEl.value = "";
      abrirConteudo();
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  document.querySelectorAll("[data-acesso-sair]").forEach((botao) => {
    botao.addEventListener("click", sair);
  });
  const form = document.getElementById("acessoForm");
  if (form) form.addEventListener("submit", entrar);
  aplicarSessaoInicial();
})();
