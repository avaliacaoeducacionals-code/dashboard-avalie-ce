/* Acesso do Eixo de avaliação: só a chave mestra. A senha em texto não fica no site. */
(function () {
  const CHAVE_SESSAO = "avalie-eixo-mestre";
  const $ = (id) => document.getElementById(id);

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
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);
    for (let i = 0; i < buf.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let t = 0; t < 64; t++) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
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

  function buscarLogin(login) {
    const chave = String(login || "").trim().toLowerCase();
    if (!chave) return null;
    const lista = Array.isArray(window.ACESSO_ESCOLAS) ? window.ACESSO_ESCOLAS : [];
    return lista.find((item) => String(item.login || "").toLowerCase() === chave) || null;
  }

  function lerSessao() {
    if (window.lerSessaoMestre) {
      const mestre = window.lerSessaoMestre();
      if (mestre) return mestre;
    }
    try {
      const bruto = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || "null");
      const item = buscarLogin(bruto && bruto.login);
      if (!item || !item.mestre) return null;
      return { login: item.login, mestre: true };
    } catch (e) {
      return null;
    }
  }

  function mostrar(liberado) {
    const form = $("eixoLogin");
    const banco = $("eixoBanco");
    if (form) form.hidden = !!liberado;
    if (banco) banco.hidden = !liberado;
    if (!liberado) {
      mostrarSenhas(false);
      mostrarAplicacao(false);
    }
  }

  function painelAberto(id) {
    const painel = $(id);
    return !!(painel && !painel.hidden);
  }

  function mostrarSenhas(aberto) {
    const painel = $("eixoSenhas");
    const cartoes = $("eixoCartoes");
    const aplicacao = $("eixoAplicacao");
    if (painel) painel.hidden = !aberto;
    if (aberto && aplicacao) aplicacao.hidden = true;
    if (cartoes) cartoes.hidden = !!aberto || painelAberto("eixoAplicacao");
  }

  function mostrarAplicacao(aberto) {
    const painel = $("eixoAplicacao");
    const cartoes = $("eixoCartoes");
    const senhas = $("eixoSenhas");
    if (painel) painel.hidden = !aberto;
    if (aberto && senhas) senhas.hidden = true;
    if (cartoes) cartoes.hidden = !!aberto || painelAberto("eixoSenhas");
  }

  const CHAVE_APLICACAO = "avalie-aplicacao-finalizada";

  function lerCadastroAvaliacoes() {
    try {
      const bruto = JSON.parse(localStorage.getItem("avalie-cadastro-avaliacoes") || "[]");
      if (!Array.isArray(bruto)) return [];
      return bruto.map((item) => String(item && item.nome || "").trim()).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function lerAplicacao() {
    try {
      const bruto = JSON.parse(localStorage.getItem(CHAVE_APLICACAO) || "{}");
      return bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto : {};
    } catch (e) {
      return {};
    }
  }

  function pintarAplicacao() {
    const lista = $("eixoAplicacaoLista");
    const aviso = $("eixoAplicacaoAviso");
    if (!lista) return;
    const nomes = lerCadastroAvaliacoes();
    const flags = lerAplicacao();
    lista.replaceChildren();
    if (!nomes.length) {
      if (aviso) aviso.textContent = "Cadastre uma avaliação no Banco antes de finalizar a aplicação.";
      return;
    }
    if (aviso) aviso.textContent = "Enquanto a aplicação não for finalizada, a escola continua lançando. Depois de finalizar, um lançamento novo só volta com o refazer daquele aluno.";
    nomes.forEach((nome) => {
      const linha = document.createElement("p");
      const finalizada = flags[nome] === true;
      linha.textContent = nome + " — " + (finalizada ? "Aplicação finalizada" : "Em aplicação");
      if (!finalizada) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "capa-btn";
        botao.textContent = "Finalizar aplicação de prova";
        botao.addEventListener("click", () => finalizarAplicacao(nome));
        linha.appendChild(document.createTextNode(" "));
        linha.appendChild(botao);
      }
      lista.appendChild(linha);
    });
  }

  function finalizarAplicacao(nome) {
    if (!lerSessao()) return;
    const segue = confirm("Finalizar a aplicação de " + nome + "?\n\nA escola não poderá lançar alunos novos desta avaliação, até um refazer liberar o aluno.");
    if (!segue) return;
    const flags = lerAplicacao();
    flags[nome] = true;
    try { localStorage.setItem(CHAVE_APLICACAO, JSON.stringify(flags)); } catch (e) { /* fica neste navegador */ }
    pintarAplicacao();
  }

  function abrirAplicacao() {
    if (!lerSessao()) return;
    mostrarAplicacao(true);
    pintarAplicacao();
  }

  function carregarSenhasLocais() {
    if (Array.isArray(window.SENHAS_LOCAIS)) return Promise.resolve(window.SENHAS_LOCAIS);
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "senhas-locais.js";
      script.onload = () => resolve(Array.isArray(window.SENHAS_LOCAIS) ? window.SENHAS_LOCAIS : []);
      script.onerror = () => resolve([]);
      document.head.appendChild(script);
    });
  }

  async function abrirSenhas() {
    if (!lerSessao()) return;
    const lista = $("eixoSenhasLista");
    const aviso = $("eixoSenhasAviso");
    mostrarSenhas(true);
    const locais = await carregarSenhasLocais();
    const mapa = new Map();
    locais.forEach((item) => {
      const login = String(item && item.login || "").trim().toLowerCase();
      if (login && item.senha) mapa.set(login, String(item.senha));
    });
    const escolas = (Array.isArray(window.ACESSO_ESCOLAS) ? window.ACESSO_ESCOLAS : [])
      .filter((item) => item && !item.mestre && item.login);
    if (aviso) {
      aviso.textContent = mapa.size
        ? "Senhas lidas neste computador. Elas não vão para o site publicado."
        : "A senha não pode ser lida a partir do hash. Aqui aparecem só os logins.";
    }
    if (!lista) return;
    lista.replaceChildren();
    escolas.forEach((item) => {
      const linha = document.createElement("p");
      const senha = mapa.get(String(item.login).toLowerCase());
      const escola = item.escola ? item.escola + " — " : "";
      linha.textContent = senha
        ? escola + item.login + " — " + senha
        : escola + item.login + " — senha indisponível neste computador";
      lista.appendChild(linha);
    });
  }

  async function entrar(ev) {
    ev.preventDefault();
    const loginEl = $("eixoLoginCampo");
    const senhaEl = $("eixoSenhaCampo");
    const erro = $("eixoErro");
    const botao = ev.currentTarget.querySelector("button[type='submit']");
    const login = loginEl ? loginEl.value.trim() : "";
    const senha = senhaEl ? senhaEl.value : "";
    if (erro) erro.textContent = "";
    if (!login || !senha) {
      if (erro) erro.textContent = "Informe o login e a senha.";
      return;
    }
    if (botao) botao.disabled = true;
    try {
      const item = buscarLogin(login);
      const hash = await hashSenha(senha);
      const esperado = item && item.senhaHash ? String(item.senhaHash).toLowerCase() : "";
      if (!item || hash !== esperado) {
        if (erro) erro.textContent = "Login ou senha incorretos.";
        return;
      }
      if (!item.mestre) {
        if (erro) erro.textContent = "Este acesso é somente da chave mestra.";
        return;
      }
      if (window.gravarSessaoMestre) window.gravarSessaoMestre(item.login);
      else sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({ login: item.login, mestre: true }));
      if (senhaEl) senhaEl.value = "";
      if (loginEl) loginEl.value = "";
      mostrar(true);
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  function sair() {
    if (window.sairSessaoMestre) window.sairSessaoMestre();
    else {
      try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* volta ao login */ }
    }
    if ($("eixoSenhaCampo")) $("eixoSenhaCampo").value = "";
    if ($("eixoLoginCampo")) $("eixoLoginCampo").value = "";
    if ($("eixoErro")) $("eixoErro").textContent = "";
    mostrar(false);
    const campo = $("eixoLoginCampo");
    if (campo) campo.focus();
  }

  function ligar() {
    const form = $("eixoLogin");
    if (!form) return;
    mostrar(!!lerSessao());
    form.addEventListener("submit", entrar);
    const sairBtn = $("eixoSair");
    if (sairBtn) sairBtn.addEventListener("click", sair);
    const abrirSenhasBtn = $("eixoAbrirSenhas");
    if (abrirSenhasBtn) abrirSenhasBtn.addEventListener("click", abrirSenhas);
    const voltarSenhas = $("eixoSenhasVoltar");
    if (voltarSenhas) voltarSenhas.addEventListener("click", () => mostrarSenhas(false));
    const abrirAplicacaoBtn = $("eixoAbrirAplicacao");
    if (abrirAplicacaoBtn) abrirAplicacaoBtn.addEventListener("click", abrirAplicacao);
    const voltarAplicacao = $("eixoAplicacaoVoltar");
    if (voltarAplicacao) voltarAplicacao.addEventListener("click", () => mostrarAplicacao(false));
    const abrir = document.querySelector("[data-capa-grupo='capaGrupoEixo']");
    if (abrir) abrir.addEventListener("click", () => mostrar(!!lerSessao()));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar);
  else ligar();
})();
