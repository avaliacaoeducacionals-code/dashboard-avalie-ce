/* Corretor por ano. Dados só neste navegador. */
(function () {
  const ANOS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
  const CHAVE = "avalie-corretor-v1";
  const NUM_FALA = {
    UM: 1, UMA: 1, DOIS: 2, DUAS: 2, TRES: 3, QUATRO: 4, CINCO: 5,
    SEIS: 6, SETE: 7, OITO: 8, NOVE: 9, DEZ: 10, ONZE: 11, DOZE: 12,
    TREZE: 13, CATORZE: 14, QUATORZE: 14, QUINZE: 15, DEZESSEIS: 16,
    DEZESSETE: 17, DEZOITO: 18, DEZENOVE: 19, VINTE: 20,
  };
  const SITUACOES_ALUNO = ["N.D", "Falta", "Transferência"];

  const $ = (id) => document.getElementById(id);
  let pack = null;
  let anoAtual = "1º";
  let editIndex = -1;
  let chartsRelatorio = [];
  let recognition = null;
  let ouvindo = false;
  let iniciado = false;
  let iniciando = false;
  let provaEmTela = "";
  let gabaritoDomDaProva = "";
  let acessoRealizar = null;

  function soltarRotulosGlobais() {
    try {
      if (window.Chart && window.ChartDataLabels) Chart.unregister(ChartDataLabels);
    } catch (e) { /* o plugin pode não ter se registrado */ }
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function disciplinasPadrao() {
    return [
      { id: "d-portugues", nome: "Português" },
      { id: "d-matematica", nome: "Matemática" },
    ];
  }

  function anoVazio() {
    return {
      escolaId: "",
      disciplinaId: "",
      turmaId: "",
      nome: "",
      data: "",
      matriculados: "",
      nQuestoes: 10,
      escalas: [
        { nome: "Crítico", min: 0, max: 30 },
        { nome: "Básico", min: 31, max: 60 },
        { nome: "Adequado", min: 61, max: 100 },
      ],
      questions: [],
      students: [],
    };
  }

  function packVazio() {
    const anos = {};
    ANOS.forEach((a) => { anos[a] = anoVazio(); });
    return { escolas: [], disciplinas: disciplinasPadrao(), turmas: [], alunos: [], anos, fechamentos: {} };
  }

  function carregar() {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (!raw) return packVazio();
      const data = JSON.parse(raw);
      const base = packVazio();
      base.escolas = Array.isArray(data.escolas) ? data.escolas.filter((e) => e && e.id && e.nome) : [];
      if (Array.isArray(data.disciplinas)) {
        base.disciplinas = data.disciplinas.filter((d) => d && d.id && d.nome);
      }
      base.turmas = Array.isArray(data.turmas)
        ? data.turmas
          .filter((t) => t && t.id && t.nome)
          .map((t) => ({ id: String(t.id), nome: normalizarTurma(t.nome), rede: !!t.rede }))
          .filter((t) => t.nome)
        : [];
      base.alunos = Array.isArray(data.alunos)
        ? data.alunos
          .filter((a) => a && a.id && a.nome)
          .map((a) => ({
            id: String(a.id),
            nome: normalizarAluno(a.nome),
            escolaId: a.escolaId ? String(a.escolaId) : "",
            ano: ANOS.includes(a.ano) ? a.ano : "",
            turmaId: a.turmaId ? String(a.turmaId) : "",
            rede: !!a.rede,
          }))
          .filter((a) => a.nome)
        : [];
      ANOS.forEach((a) => {
        const salvo = data.anos && data.anos[a];
        if (salvo && typeof salvo === "object") base.anos[a] = { ...anoVazio(), ...salvo };
        garantirProvas(base.anos[a], base.disciplinas);
        carregarProva(base.anos[a], base.anos[a].disciplinaId || "");
      });
      base.fechamentos = {};
      if (data.fechamentos && typeof data.fechamentos === "object" && !Array.isArray(data.fechamentos)) {
        Object.keys(data.fechamentos).forEach((chave) => {
          const item = data.fechamentos[chave];
          if (!item || typeof item !== "object" || Array.isArray(item)) return;
          const reabertos = Array.isArray(item.reabertos)
            ? item.reabertos.map((id) => String(id || "")).filter(Boolean)
            : [];
          base.fechamentos[chave] = { quando: item.quando ? String(item.quando) : "", reabertos };
        });
      }
      base.turmas = deduplicarTurmas(base.turmas, base.anos, base.alunos, base.fechamentos);
      return base;
    } catch (e) {
      return packVazio();
    }
  }

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(pack)); } catch (e) { /* armazenamento cheio ou bloqueado */ }
  }

  function atual() {
    return pack.anos[anoAtual];
  }

  function nomeEscola(id) {
    const hit = pack.escolas.find((e) => e.id === id);
    return hit ? hit.nome : "";
  }

  function nomeDisciplina(id) {
    const hit = pack.disciplinas.find((d) => d.id === id);
    return hit ? hit.nome : "";
  }

  function idPortuguesDe(lista) {
    const hit = (lista || []).find((d) => fold(d.nome) === "PORTUGUES");
    return hit ? hit.id : "d-portugues";
  }

  function copiarQuestao(q) {
    const base = q && typeof q === "object" ? { ...q } : {};
    const type = base.type === "5" || base.type === "2" ? base.type : "4";
    return { ...base, type, correct: base.correct ? String(base.correct) : "1" };
  }

  function garantirProvas(ano, disciplinas) {
    if (!ano.provas || typeof ano.provas !== "object" || Array.isArray(ano.provas)) ano.provas = {};
    const temProva = Object.keys(ano.provas).some((id) => ano.provas[id] && Array.isArray(ano.provas[id].questions));
    const legado = Array.isArray(ano.questions) ? ano.questions.map(copiarQuestao) : [];
    if (!temProva && legado.length) {
      const destino = ano.disciplinaId || idPortuguesDe(disciplinas || (pack && pack.disciplinas));
      ano.provas[destino] = {
        nQuestoes: Math.max(1, Number(ano.nQuestoes) || legado.length || 10),
        questions: legado,
      };
      ano.gabaritoLegadoEm = destino;
    }
    Object.keys(ano.provas).forEach((id) => {
      const prova = ano.provas[id];
      if (!prova || typeof prova !== "object" || Array.isArray(prova)) {
        ano.provas[id] = { nQuestoes: 10, questions: [] };
        return;
      }
      prova.questions = Array.isArray(prova.questions) ? prova.questions.map(copiarQuestao) : [];
      prova.nQuestoes = Math.max(1, Number(prova.nQuestoes) || prova.questions.length || 10);
    });
    return ano.provas;
  }

  function carregarProva(ano, id) {
    const provas = garantirProvas(ano);
    if (!id) {
      ano.nQuestoes = 10;
      ano.questions = [];
      return;
    }
    if (!provas[id]) provas[id] = { nQuestoes: 10, questions: [] };
    ano.nQuestoes = provas[id].nQuestoes;
    ano.questions = provas[id].questions;
  }

  function gravarProva(ano, id) {
    if (!id) return;
    const provas = garantirProvas(ano);
    provas[id] = {
      nQuestoes: Math.max(1, Number(ano.nQuestoes) || 10),
      questions: Array.isArray(ano.questions) ? ano.questions.map(copiarQuestao) : [],
    };
    ano.nQuestoes = provas[id].nQuestoes;
    ano.questions = provas[id].questions;
  }

  function lerNumeroQuestoesDoDom(ano) {
    if (!$("crNQuest")) return Math.max(1, Number(ano.nQuestoes) || 10);
    return Math.max(1, Number($("crNQuest").value) || ano.nQuestoes || 10);
  }

  function definirDisciplina(novaId) {
    const a = atual();
    const dono = provaEmTela || "";
    const domOk = !!dono && gabaritoDomDaProva === dono;
    if (domOk) {
      a.nQuestoes = lerNumeroQuestoesDoDom(a);
      if (document.querySelector("#crGabarito .corretor-q")) a.questions = lerQuestoesDoDom();
      gravarProva(a, dono);
    }
    a.disciplinaId = novaId || "";
    carregarProva(a, a.disciplinaId);
    provaEmTela = a.disciplinaId;
    gabaritoDomDaProva = "";
    if ($("crDisciplina")) $("crDisciplina").value = a.disciplinaId;
    ["crLancDisciplina", "crAbrirDisciplina"].forEach((campo) => {
      const el = $(campo);
      if (!el) return;
      const existe = [...el.options].some((op) => op.value === a.disciplinaId);
      if (existe) el.value = a.disciplinaId;
    });
  }

  function atualizarTelaDaProva() {
    pintarCampos();
    pintarGabarito();
    pintarRespostas();
    pintarAlunos();
    pintarAbrir();
    const aviso = $("crSemGabarito");
    if (aviso) aviso.hidden = atual().questions.length > 0;
  }

  function normalizarTurma(nome) {
    return String(nome || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/º/g, "")
      .replace(/\bANO\b/gi, "")
      .replace(/[^0-9A-Za-z]/g, "")
      .toLocaleUpperCase("pt-BR");
  }

  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleUpperCase("pt-BR");
  }

  function idEstavel(prefixo, texto) {
    let a = 2166136261;
    let b = 5381;
    const s = String(texto);
    for (let i = 0; i < s.length; i += 1) {
      a ^= s.charCodeAt(i);
      a = Math.imul(a, 16777619);
      b = (Math.imul(b, 33) ^ s.charCodeAt(i)) >>> 0;
    }
    return prefixo + (a >>> 0).toString(36) + (b >>> 0).toString(36);
  }

  function normalizarAluno(nome) {
    return String(nome || "").replace(/\s+/g, " ").trim();
  }

  function nomeTurma(id) {
    const hit = (pack.turmas || []).find((t) => t.id === id);
    return hit ? hit.nome : "";
  }

  function deduplicarTurmas(lista, anos, alunos, fechamentosMap) {
    const porNome = new Map();
    const alias = new Map();
    (lista || []).forEach((t) => {
      const nome = normalizarTurma(t.nome);
      if (!nome) return;
      if (!porNome.has(nome)) porNome.set(nome, { id: String(t.id), nome, rede: !!t.rede });
      else alias.set(String(t.id), porNome.get(nome).id);
    });
    const aplicar = (id) => (id && alias.get(String(id))) || id || "";
    if (anos) {
      ANOS.forEach((ano) => {
        if (anos[ano]) anos[ano].turmaId = aplicar(anos[ano].turmaId);
      });
    }
    (alunos || []).forEach((aluno) => {
      aluno.turmaId = aplicar(aluno.turmaId);
    });
    if (fechamentosMap && alias.size) {
      Object.keys(fechamentosMap).forEach((chave) => {
        const partes = String(chave).split("|");
        if (partes.length !== 4) return;
        const novo = alias.get(partes[3]);
        if (!novo || novo === partes[3]) return;
        const novaChave = [partes[0], partes[1], partes[2], novo].join("|");
        if (!fechamentosMap[novaChave]) fechamentosMap[novaChave] = fechamentosMap[chave];
        delete fechamentosMap[chave];
      });
    }
    return [...porNome.values()];
  }

  function turmasDaAvaliacao(ano, escolaId, turmaIdAtual) {
    const todas = pack.turmas || [];
    const numero = String(ano || "").replace(/\D/g, "");
    let lista = todas.filter((t) => String(t.nome).startsWith(numero));
    const idsDaEscola = () => new Set(
      (pack.alunos || [])
        .filter((aluno) => aluno.ano === ano && aluno.escolaId === escolaId && aluno.turmaId)
        .map((aluno) => aluno.turmaId)
    );
    if (escolaTravada() && escolaId) {
      return todas.filter((t) => idsDaEscola().has(t.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
    }
    const temRede = (pack.alunos || []).some((aluno) => aluno.rede);
    if (temRede && escolaId) {
      const ids = idsDaEscola();
      const daEscola = lista.filter((t) => ids.has(t.id));
      if (daEscola.length) lista = daEscola;
    }
    if (turmaIdAtual && !lista.some((t) => t.id === turmaIdAtual)) {
      const extra = todas.find((t) => t.id === turmaIdAtual);
      if (extra) lista = lista.concat([extra]);
    }
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  }

  function alunosDoLancamento() {
    const a = atual();
    if (!a.escolaId || !a.turmaId) return [];
    return (pack.alunos || [])
      .filter((aluno) => aluno.ano === anoAtual && aluno.escolaId === a.escolaId && aluno.turmaId === a.turmaId)
      .filter((aluno) => !escolaTravada() || aluno.escolaId === idEscolaTravada())
      .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  }

  function mapaFechamentos() {
    if (!pack.fechamentos || typeof pack.fechamentos !== "object" || Array.isArray(pack.fechamentos)) {
      pack.fechamentos = {};
    }
    return pack.fechamentos;
  }

  function chaveFechamento(ctx) {
    return [ctx.escolaId || "", ctx.ano || "", ctx.disciplinaId || "", ctx.turmaId || ""].join("|");
  }

  function contextoLancamento() {
    const a = atual();
    return {
      escolaId: a.escolaId || "",
      ano: anoAtual,
      disciplinaId: a.disciplinaId || "",
      turmaId: a.turmaId || "",
    };
  }

  function contextoCompleto(ctx) {
    return !!(ctx.escolaId && ctx.ano && ctx.disciplinaId && ctx.turmaId);
  }

  function lancamentoFinalizado(ctx) {
    const atualCtx = ctx || contextoLancamento();
    if (!contextoCompleto(atualCtx)) return false;
    return !!mapaFechamentos()[chaveFechamento(atualCtx)];
  }

  function idReabertura(aluno) {
    const id = (aluno && (aluno.alunoId || aluno.id)) || "";
    const nome = fold((aluno && (aluno.name || aluno.nome)) || "");
    return id || (nome ? "nome:" + nome : "");
  }

  function listaReabertos(ctx) {
    const item = mapaFechamentos()[chaveFechamento(ctx || contextoLancamento())];
    if (!item) return [];
    if (!Array.isArray(item.reabertos)) item.reabertos = [];
    return item.reabertos;
  }

  function alunoReabertoAgora(escolhido) {
    const aluno = escolhido || alunoDoSelect();
    const marca = idReabertura(aluno);
    if (!marca) return false;
    const ctx = contextoLancamento();
    if (!lancamentoFinalizado(ctx)) return false;
    return listaReabertos(ctx).includes(marca);
  }

  function turmaTravadaNoLancamento() {
    if (alunoReabertoAgora()) return false;
    return lancamentoFinalizado();
  }

  function mesmaDisciplina(student) {
    const disc = (atual().disciplinaId) || "";
    if (!student || !student.disciplinaId || !disc) return true;
    return student.disciplinaId === disc;
  }

  function alunosDoContexto(lista) {
    return (lista || []).filter((s) => mesmaDisciplina(s));
  }

  function indiceDoAlunoSalvo(cadastro) {
    if (!cadastro) return -1;
    const lista = atual().students || [];
    return lista.findIndex((s) => {
      const mesmo = (cadastro.id && s.alunoId === cadastro.id) || s.name === cadastro.nome;
      return !!mesmo && mesmaDisciplina(s);
    });
  }

  function indicePorEscolhido(escolhido) {
    if (!escolhido || !escolhido.name) return -1;
    return indiceDoAlunoSalvo({ id: escolhido.alunoId, nome: escolhido.name });
  }

  function alunoJaSalvoNoLancamento() {
    if (!lancamentoVisivel()) return false;
    return indicePorEscolhido(alunoDoSelect()) >= 0;
  }

  function cadastroDoLancado(student) {
    const todos = pack.alunos || [];
    if (student && student.alunoId) {
      const porId = todos.find((aluno) => aluno.id === student.alunoId);
      if (porId) return porId;
    }
    if (!student || !student.name) return null;
    return todos.find((aluno) => aluno.ano === anoAtual && aluno.nome === student.name) || null;
  }

  function alunoCongelado(student) {
    if (lancamentoFinalizado()) return true;
    const cadastro = cadastroDoLancado(student);
    const disciplinaId = atual().disciplinaId || "";
    if (!cadastro || !disciplinaId || !cadastro.escolaId || !cadastro.turmaId || !cadastro.ano) return false;
    return lancamentoFinalizado({
      escolaId: cadastro.escolaId,
      ano: cadastro.ano,
      disciplinaId,
      turmaId: cadastro.turmaId,
    });
  }

  function resumoFinalizacao() {
    const ctx = contextoLancamento();
    const completo = contextoCompleto(ctx);
    const finalizado = completo && lancamentoFinalizado(ctx);
    const roster = ctx.escolaId && ctx.turmaId ? alunosDoLancamento() : [];
    let salvos = 0;
    roster.forEach((aluno) => {
      if (indiceDoAlunoSalvo(aluno) >= 0) salvos += 1;
    });
    const faltam = Math.max(0, roster.length - salvos);
    return {
      ctx,
      completo,
      finalizado,
      total: roster.length,
      salvos,
      faltam,
      pronto: completo && roster.length > 0 && faltam === 0 && !finalizado,
    };
  }

  function textoFaltam(n) {
    return n === 1 ? "Falta 1 aluno para finalizar." : `Faltam ${n} alunos para finalizar.`;
  }

  function avisarLancamentoFechado() {
    alert("Lançamento finalizado. As respostas desta turma não podem mais ser alteradas.");
  }

  function situacaoAluno(student) {
    const s = student && student.situacao;
    return SITUACOES_ALUNO.includes(s) ? s : "";
  }

  function aplicarSituacao(valor, boxId) {
    const marca = SITUACOES_ALUNO.includes(valor) ? valor : "";
    const raiz = boxId || "crSituacao";
    document.querySelectorAll(`#${raiz} [data-sit]`).forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.sit === marca ? "true" : "false");
    });
  }

  function lerSituacaoDom(boxId) {
    const raiz = boxId || "crSituacao";
    const btn = document.querySelector(`#${raiz} [data-sit][aria-pressed="true"]`);
    return btn && SITUACOES_ALUNO.includes(btn.dataset.sit) ? btn.dataset.sit : "";
  }

  function alunosComNota(lista) {
    return (lista || []).filter((s) => !situacaoAluno(s));
  }

  function marcaSituacao(sit) {
    return sit ? ` <span class="corretor-sit-tag">${esc(sit)}</span>` : "";
  }

  function aplicarTravaLancamento(travadoClasse) {
    const jaSalvo = alunoJaSalvoNoLancamento();
    const travado = !!travadoClasse || jaSalvo;
    const salvarBtn = $("crSalvarAluno");
    if (salvarBtn) salvarBtn.disabled = !!travado;
    document.querySelectorAll("#crRespostas select").forEach((el) => {
      el.disabled = !!travado;
    });
    document.querySelectorAll("#crSituacao [data-sit]").forEach((el) => {
      el.disabled = !!travado;
    });
    const avisoAluno = $("crLancamentoTrava");
    if (avisoAluno) {
      if (jaSalvo && !travadoClasse) {
        avisoAluno.hidden = false;
        avisoAluno.textContent = "Este aluno já foi salvo. Para alterar o resultado, use Abrir o resultado em Eixo de avaliação.";
      } else {
        avisoAluno.hidden = true;
        avisoAluno.textContent = "";
      }
    }
    if (travado && ouvindo) pararVoz();
    ["crVozIniciar", "crVozPausar", "crVozParar"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (travado) el.disabled = true;
    });
    const voz = $("crVozTexto");
    if (travado) {
      if (voz) {
        voz.textContent = travadoClasse
          ? "Lançamento finalizado. O ditado está bloqueado nesta turma."
          : "Este aluno já foi salvo. O ditado está bloqueado. Altere em Eixo de avaliação, em Abrir o resultado.";
      }
      return;
    }
    if (!ouvindo) {
      const iniciar = $("crVozIniciar");
      const pausar = $("crVozPausar");
      const parar = $("crVozParar");
      if (iniciar) iniciar.disabled = false;
      if (pausar) {
        pausar.disabled = true;
        pausar.textContent = "Pausar";
      }
      if (parar) parar.disabled = true;
      if (voz && (voz.textContent.indexOf("Lançamento finalizado") === 0 || voz.textContent.indexOf("Este aluno já foi salvo") === 0)) {
        voz.textContent = "Diga “um 1”, “dois 3” ou “questão 1: 2”.";
      }
    }
  }

  function pintarFinalizacao() {
    const btn = $("crFinalizar");
    const texto = $("crFinalizarTexto");
    const aviso = $("crFinalizadoAviso");
    if (!btn) return;
    const r = resumoFinalizacao();
    if (r.finalizado && editIndex >= 0) {
      editIndex = -1;
      pintarAlunos();
    }
    if (r.finalizado) {
      btn.disabled = true;
      btn.textContent = "Lançamento finalizado";
      if (texto) {
        texto.hidden = true;
        texto.textContent = "";
      }
      if (aviso) aviso.hidden = false;
    } else {
      btn.textContent = "Finalizar lançamento";
      if (aviso) aviso.hidden = true;
      if (texto) texto.hidden = false;
      if (!r.completo) {
        btn.disabled = true;
        if (texto) texto.textContent = "Escolha a escola, o ano, a disciplina e a turma.";
      } else if (!r.total) {
        btn.disabled = true;
        if (texto) texto.textContent = "Nenhum aluno cadastrado nesta turma.";
      } else if (r.faltam > 0) {
        btn.disabled = true;
        if (texto) texto.textContent = textoFaltam(r.faltam);
      } else {
        btn.disabled = false;
        if (texto) texto.textContent = "Todos os alunos desta turma estão salvos.";
      }
    }
    aplicarTravaLancamento(r.finalizado && !alunoReabertoAgora());
  }

  function soltarEdicaoLancamento() {
    if (editIndex < 0) return;
    editIndex = -1;
    const btn = $("crSalvarAluno");
    if (btn) btn.textContent = "Salvar respostas do aluno";
  }

  function refrescarFechamentoNaTela() {
    soltarEdicaoLancamento();
    pintarAlunos();
    pintarFinalizacao();
  }

  function finalizarLancamento() {
    const antes = resumoFinalizacao();
    if (!antes.pronto) return;
    const info = identificacao();
    const segue = confirm(
      `Finalizar o lançamento de ${info.escola}, ${anoAtual} ano, ${info.disciplina}, turma ${info.turma}?\n\nDepois de confirmar, não dá para alterar as respostas, salvar de novo, apagar um aluno lançado nem incluir outro resultado nesta turma.`
    );
    if (!segue) return;
    const agora = resumoFinalizacao();
    if (!agora.pronto) return;
    mapaFechamentos()[chaveFechamento(agora.ctx)] = { quando: new Date().toISOString() };
    editIndex = -1;
    if (ouvindo) pararVoz();
    salvar();
    pintarRespostas();
    pintarAlunos();
    pintarFinalizacao();
  }

  function completarCadastro() {
    const rede = window.CORRETOR_REDE || {};
    const nominal = Array.isArray(window.CORRETOR_NOMINAL) ? window.CORRETOR_NOMINAL : [];
    let mudou = false;
    (rede.escolas || []).forEach((nome) => {
      const limpo = String(nome || "").replace(/\s+/g, " ").trim();
      if (!limpo) return;
      if (pack.escolas.some((e) => fold(e.nome) === fold(limpo))) return;
      pack.escolas.push({ id: idEstavel("e", fold(limpo)), nome: limpo, rede: true });
      mudou = true;
    });
    (rede.turmas || []).forEach((nome) => {
      const sigla = normalizarTurma(nome);
      if (!sigla) return;
      if ((pack.turmas || []).some((t) => normalizarTurma(t.nome) === sigla)) return;
      pack.turmas.push({ id: "t-" + sigla, nome: sigla, rede: true });
      mudou = true;
    });
    const escolaPorFold = new Map(pack.escolas.map((e) => [fold(e.nome), e.id]));
    const turmaPorSigla = new Map((pack.turmas || []).map((t) => [normalizarTurma(t.nome), t.id]));
    const porId = new Map((pack.alunos || []).map((aluno) => [aluno.id, aluno]));
    const porChave = new Set((pack.alunos || []).map((aluno) => [
      aluno.escolaId || "",
      aluno.ano || "",
      aluno.turmaId || "",
      fold(aluno.nome),
    ].join("|")));
    nominal.forEach((item) => {
      const nome = normalizarAluno(item.nome);
      const ano = ANOS.includes(item.ano) ? item.ano : "";
      const sigla = normalizarTurma(item.turma);
      const escolaId = escolaPorFold.get(fold(item.escola)) || "";
      const turmaId = turmaPorSigla.get(sigla) || "";
      if (!nome || !ano || !escolaId || !turmaId) return;
      const id = idEstavel("a", fold(item.escola) + "|" + ano + "|" + sigla + "|" + fold(nome));
      const chave = [escolaId, ano, turmaId, fold(nome)].join("|");
      const existente = porId.get(id);
      if (existente) {
        if (!existente.escolaId || !existente.ano || !existente.turmaId) {
          existente.escolaId = existente.escolaId || escolaId;
          existente.ano = existente.ano || ano;
          existente.turmaId = existente.turmaId || turmaId;
          existente.rede = true;
          mudou = true;
        }
        return;
      }
      if (porChave.has(chave)) return;
      const novo = { id, nome, escolaId, ano, turmaId, rede: true };
      pack.alunos.push(novo);
      porId.set(id, novo);
      porChave.add(chave);
      mudou = true;
    });
    pack.escolas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    pack.turmas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
    if (mudou) salvar();
  }

  function identificacao() {
    const a = atual();
    return {
      escola: nomeEscola(a.escolaId) || "Escola não escolhida",
      disciplina: nomeDisciplina(a.disciplinaId) || "Disciplina não escolhida",
      turma: nomeTurma(a.turmaId) || "Turma não escolhida",
    };
  }

  function opcoesTipo(tipo) {
    if (tipo === "2") return ["V", "F"];
    if (tipo === "5") return ["1", "2", "3", "4", "5"];
    return ["1", "2", "3", "4"];
  }

  function selectHtml(id, valor, opcoes, comBranco) {
    const lista = comBranco ? ["-", ...opcoes] : opcoes.slice();
    const atualValor = lista.includes(valor) ? valor : lista[0];
    const idAttr = id ? ` id="${id}"` : "";
    return `<select${idAttr}>${lista.map((op) => `<option value="${op}"${op === atualValor ? " selected" : ""}>${op === "-" ? "—" : op}</option>`).join("")}</select>`;
  }

  function lerEscalas() {
    return [...document.querySelectorAll("#crEscalas .corretor-escala")].map((row) => ({
      nome: row.querySelector(".cr-nome").value.trim(),
      min: Number(row.querySelector(".cr-min").value),
      max: Number(row.querySelector(".cr-max").value),
    }));
  }

  function descritoresAtuais() {
    const hab = window.HAB_NOMES;
    if (!hab) return null;
    const nome = nomeDisciplina(atual().disciplinaId);
    const mapa = hab[anoAtual + "|" + nome];
    if (!mapa || typeof mapa !== "object") return null;
    return mapa;
  }

  function textoDescritor(q) {
    const mapa = descritoresAtuais();
    if (q && q.descriptor && mapa && mapa[q.descriptor]) return mapa[q.descriptor];
    return (q && q.descriptorText) || "";
  }

  function lerDescritorDoCard(node) {
    const sel = node.querySelector(".cr-desc");
    const codigoLivre = node.querySelector(".cr-desc-codigo");
    const textoLivre = node.querySelector(".cr-desc-texto");
    const p = node.querySelector(".corretor-desc");
    if (sel && sel.value && sel.value !== "__outro__") {
      return {
        descriptor: sel.value,
        descriptorText: p ? p.textContent.trim() : "",
      };
    }
    const codigo = codigoLivre ? codigoLivre.value.trim().toUpperCase() : "";
    return {
      descriptor: codigo,
      descriptorText: textoLivre ? textoLivre.value.trim() : "",
    };
  }

  function htmlDescritor(q, i) {
    const mapa = descritoresAtuais();
    const cod = String((q && q.descriptor) || "").trim().toUpperCase();
    const textoSalvo = (q && q.descriptorText) || "";
    if (!mapa) {
      return `
        <span class="corretor-desc-rotulo">Descritor</span>
        <input class="cr-desc-codigo" type="text" value="${esc(cod)}" placeholder="Ex.: D04" aria-label="Código do descritor da questão ${i + 1}" />
        <textarea class="cr-desc-texto" rows="3" placeholder="O que este descritor cobra" aria-label="Texto do descritor da questão ${i + 1}" title="${esc(textoSalvo)}">${esc(textoSalvo)}</textarea>
      `;
    }
    const codes = Object.keys(mapa);
    const conhecido = codes.includes(cod);
    const outro = !!cod && !conhecido;
    const texto = conhecido ? mapa[cod] : "";
    const options = [`<option value="">Sem descritor</option>`]
      .concat(codes.map((c) => `<option value="${esc(c)}"${c === cod ? " selected" : ""}>${esc(c)}</option>`))
      .concat([`<option value="__outro__"${outro ? " selected" : ""}>Outro</option>`]);
    return `
      <span class="corretor-desc-rotulo">Descritor</span>
      <select class="cr-desc" aria-label="Descritor da questão ${i + 1}">${options.join("")}</select>
      <div class="cr-desc-livre"${outro ? "" : " hidden"}>
        <input class="cr-desc-codigo" type="text" value="${esc(outro ? cod : "")}" placeholder="Código" aria-label="Código livre da questão ${i + 1}" />
        <textarea class="cr-desc-texto" rows="3" placeholder="O que este descritor cobra" aria-label="Texto livre da questão ${i + 1}" title="${esc(outro ? textoSalvo : "")}">${esc(outro ? textoSalvo : "")}</textarea>
      </div>
      <p class="corretor-desc"${outro ? " hidden" : ""} title="${esc(texto)}">${esc(texto || "Escolha o descritor para ver a habilidade.")}</p>
    `;
  }

  function atualizarTextoDescritor(card) {
    if (!card) return;
    const sel = card.querySelector(".cr-desc");
    const livre = card.querySelector(".cr-desc-livre");
    const p = card.querySelector(".corretor-desc");
    const mapa = descritoresAtuais();
    if (!sel || !mapa) return;
    if (sel.value === "__outro__") {
      if (livre) livre.hidden = false;
      if (p) p.hidden = true;
      return;
    }
    if (livre) livre.hidden = true;
    if (p) p.hidden = false;
    const texto = sel.value ? (mapa[sel.value] || "") : "";
    if (p) {
      p.textContent = texto || "Escolha o descritor para ver a habilidade.";
      p.title = texto;
    }
  }

  function lerQuestoesDoDom() {
    const nodes = [...document.querySelectorAll("#crGabarito .corretor-q")];
    return nodes.map((node) => {
      const tipo = node.querySelector(".cr-tipo").value;
      const op = opcoesTipo(tipo);
      let correta = node.querySelector(".cr-correta").value;
      if (!op.includes(correta)) correta = op[0];
      const desc = lerDescritorDoCard(node);
      return { type: tipo, correct: correta, descriptor: desc.descriptor, descriptorText: desc.descriptorText };
    });
  }

  function gravarFormulario() {
    const a = atual();
    const escola = $("crEscola");
    if (escola) a.escolaId = escola.value;
    const turma = $("crTurma");
    if (turma) a.turmaId = turma.value;
    if ($("crNome")) a.nome = $("crNome").value.trim();
    if ($("crData")) a.data = $("crData").value;
    if ($("crMatriculados")) a.matriculados = $("crMatriculados").value;
    if (document.querySelector("#crEscalas .corretor-escala")) a.escalas = lerEscalas();
    const disciplina = $("crDisciplina");
    const nova = disciplina ? disciplina.value : (a.disciplinaId || "");
    if (nova !== (provaEmTela || "")) {
      definirDisciplina(nova);
      return;
    }
    if (provaEmTela && gabaritoDomDaProva === provaEmTela) {
      a.nQuestoes = lerNumeroQuestoesDoDom(a);
      if (document.querySelector("#crGabarito .corretor-q")) a.questions = lerQuestoesDoDom();
      gravarProva(a, provaEmTela);
    }
  }

  function nivelDe(p) {
    const xs = (atual().escalas || [])
      .filter((s) => s.nome && Number.isFinite(Number(s.min)) && Number.isFinite(Number(s.max)))
      .map((s) => ({ nome: s.nome, min: Number(s.min), max: Number(s.max) }))
      .sort((a, b) => a.min - b.min);
    const hit = xs.find((s) => p >= s.min && p <= s.max);
    if (hit) return hit.nome;
    let abaixo = null;
    xs.forEach((s) => { if (s.max < p) abaixo = s; });
    return abaixo ? abaixo.nome : "N/A";
  }

  function notaAluno(student) {
    const qs = atual().questions;
    if (!qs.length) return 0;
    let certos = 0;
    qs.forEach((q, i) => { if (student.answers[i] === q.correct) certos += 1; });
    return (100 * certos) / qs.length;
  }

  function pintarAbas() {
    const box = $("corretorAnos");
    box.innerHTML = ANOS.map((ano) => `
      <button type="button" role="tab" data-ano="${ano}" aria-selected="${ano === anoAtual ? "true" : "false"}">${ano} ano</button>
    `).join("");
  }

  function atualizarBotaoExcluirEscola() {
    const sel = $("crEscolasLista");
    const btn = $("crDelEscola");
    if (!btn) return;
    btn.disabled = !(sel && sel.value);
  }

  function pintarEscolas() {
    const menu = $("crEscolasLista");
    const antes = menu ? menu.value : "";
    if (menu) {
      if (!pack.escolas.length) {
        menu.innerHTML = `<option value="">Nenhuma escola cadastrada</option>`;
        menu.value = "";
      } else {
        menu.innerHTML = `<option value="">Selecione a escola</option>` + escolasParaMenu().map((e) => `
          <option value="${esc(e.id)}">${esc(e.nome)}</option>
        `).join("");
        menu.value = escolasParaMenu().some((e) => e.id === antes) ? antes : "";
      }
      atualizarBotaoExcluirEscola();
    }
    const sel = $("crEscola");
    const id = atual().escolaId;
    const escolas = escolasParaMenu();
    sel.innerHTML = `<option value="">Selecione a escola</option>` + escolas.map((e) => `
      <option value="${esc(e.id)}">${esc(e.nome)}</option>
    `).join("");
    sel.value = escolas.some((e) => e.id === id) ? id : "";
    if (escolaTravada() && escolas[0]) {
      sel.value = escolas[0].id;
      sel.disabled = true;
    } else {
      sel.disabled = false;
    }
    atual().escolaId = sel.value;
  }

  function atualizarBotaoExcluirDisciplina() {
    const sel = $("crDisciplinasLista");
    const btn = $("crDelDisciplina");
    if (!btn) return;
    btn.disabled = !(sel && sel.value);
  }

  function atualizarBotaoExcluirTurma() {
    const sel = $("crTurmasLista");
    const btn = $("crDelTurma");
    if (!btn) return;
    btn.disabled = !(sel && sel.value);
  }

  function pintarDisciplinas() {
    const menu = $("crDisciplinasLista");
    const antes = menu ? menu.value : "";
    if (menu) {
      if (!pack.disciplinas.length) {
        menu.innerHTML = `<option value="">Nenhuma disciplina cadastrada</option>`;
        menu.value = "";
      } else {
        menu.innerHTML = `<option value="">Selecione a disciplina</option>` + pack.disciplinas.map((d) => `
          <option value="${esc(d.id)}">${esc(d.nome)}</option>
        `).join("");
        menu.value = pack.disciplinas.some((d) => d.id === antes) ? antes : "";
      }
      atualizarBotaoExcluirDisciplina();
    }
    const sel = $("crDisciplina");
    const id = atual().disciplinaId;
    sel.innerHTML = `<option value="">Selecione a disciplina</option>` + pack.disciplinas.map((d) => `
      <option value="${esc(d.id)}">${esc(d.nome)}</option>
    `).join("");
    sel.value = pack.disciplinas.some((d) => d.id === id) ? id : "";
    atual().disciplinaId = sel.value;
  }

  function pintarTurmas() {
    const menu = $("crTurmasLista");
    const turmas = pack.turmas || [];
    const antes = menu ? menu.value : "";
    if (menu) {
      if (!turmas.length) {
        menu.innerHTML = `<option value="">Nenhuma turma cadastrada</option>`;
        menu.value = "";
      } else {
        menu.innerHTML = `<option value="">Selecione a turma</option>` + turmas.map((t) => `
          <option value="${esc(t.id)}">${esc(t.nome)}</option>
        `).join("");
        menu.value = turmas.some((t) => t.id === antes) ? antes : "";
      }
      atualizarBotaoExcluirTurma();
    }
    const sel = $("crTurma");
    const id = atual().turmaId || "";
    const visiveis = turmasDaAvaliacao(anoAtual, atual().escolaId, id);
    sel.innerHTML = `<option value="">Selecione a turma</option>` + visiveis.map((t) => `
      <option value="${esc(t.id)}">${esc(t.nome)}</option>
    `).join("");
    sel.value = visiveis.some((t) => t.id === id) ? id : "";
    atual().turmaId = sel.value;
  }

  function pintarCampos() {
    const a = atual();
    $("crNome").value = a.nome || "";
    $("crData").value = a.data || "";
    $("crMatriculados").value = a.matriculados || "";
    $("crNQuest").value = a.nQuestoes || a.questions.length || 10;
  }

  function pintarEscalas() {
    const box = $("crEscalas");
    const escalas = atual().escalas.length ? atual().escalas : anoVazio().escalas;
    box.innerHTML = escalas.map((s) => `
      <div class="corretor-escala">
        <input class="cr-nome" type="text" value="${esc(s.nome)}" placeholder="Nome do nível" />
        <input class="cr-min" type="number" min="0" max="100" value="${Number.isFinite(Number(s.min)) ? s.min : 0}" aria-label="Percentual mínimo" />
        <input class="cr-max" type="number" min="0" max="100" value="${Number.isFinite(Number(s.max)) ? s.max : 0}" aria-label="Percentual máximo" />
        <button type="button" class="btn-compare corretor-excluir cr-remover-escala">Excluir</button>
      </div>
    `).join("");
  }

  function pintarGabarito() {
    const box = $("crGabarito");
    const qs = atual().questions;
    box.innerHTML = qs.map((q, i) => {
      const tipo = q.type === "5" || q.type === "2" ? q.type : "4";
      const op = opcoesTipo(tipo);
      const correta = op.includes(q.correct) ? q.correct : op[0];
      return `
        <div class="corretor-q">
          <strong>Questão ${i + 1}</strong>
          ${selectHtml("", correta, op, false).replace("<select", '<select class="cr-correta" aria-label="Resposta da questão ' + (i + 1) + '"')}
          <select class="cr-tipo" aria-label="Tipo da questão ${i + 1}">
            <option value="4"${tipo === "4" ? " selected" : ""}>4 opções</option>
            <option value="5"${tipo === "5" ? " selected" : ""}>5 opções</option>
            <option value="2"${tipo === "2" ? " selected" : ""}>V/F</option>
          </select>
          ${htmlDescritor(q, i)}
        </div>
      `;
    }).join("");
    gabaritoDomDaProva = provaEmTela || "";
    $("crLancamento").hidden = false;
    const aviso = $("crSemGabarito");
    if (aviso) aviso.hidden = qs.length > 0;
    const respostas = document.querySelectorAll("#crRespostas .corretor-q").length;
    if (!qs.length) return;
    if (respostas === qs.length) {
      const atuais = qs.map((_, i) => {
        const el = $("crResp" + i);
        return el ? el.value : "-";
      });
      pintarRespostas(atuais);
    } else {
      pintarRespostas();
    }
  }

  function pintarRespostas(valores) {
    const qs = atual().questions;
    const box = $("crRespostas");
    box.innerHTML = qs.map((q, i) => {
      const op = opcoesTipo(q.type);
      const valor = valores && valores[i] ? valores[i] : "-";
      const texto = textoDescritor(q);
      const codigo = q.descriptor ? ` · ${esc(q.descriptor)}` : "";
      return `
        <div class="corretor-q">
          <strong>Q${i + 1}${codigo}</strong>
          <p class="corretor-desc" title="${esc(texto)}">${esc(texto)}</p>
          ${selectHtml("crResp" + i, valor, op, true)}
        </div>
      `;
    }).join("");
    aplicarTravaLancamento(turmaTravadaNoLancamento());
  }

  function pintarAlunos() {
    const daEscola = (s) => {
      if (!escolaTravada()) return true;
      const id = idEscolaTravada();
      if (s.alunoId) return (pack.alunos || []).some((aluno) => aluno.id === s.alunoId && aluno.escolaId === id);
      const nomes = new Set((pack.alunos || []).filter((aluno) => aluno.escolaId === id).map((aluno) => fold(aluno.nome)));
      return nomes.has(fold(s.name));
    };
    const alunos = (atual().students || [])
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => mesmaDisciplina(s) && daEscola(s));
    $("crListaBox").hidden = alunos.length === 0 && editIndex < 0;
    $("crQtdAlunos").textContent = String(alunos.length);
    const tituloBloqueio = "Aluno já salvo. Altere em Eixo de avaliação, em Abrir o resultado.";
    $("crLista").innerHTML = alunos.map(({ s, i }) => {
      const sit = situacaoAluno(s);
      return `
      <tr>
        <td>${esc(s.name)}${marcaSituacao(sit)}</td>
        <td>${esc((s.answers || []).join(" "))}</td>
        <td>
          <button type="button" class="btn-compare" data-edit-aluno="${i}" disabled title="${esc(tituloBloqueio)}">Editar</button>
          <button type="button" class="btn-compare corretor-excluir" data-del-aluno="${i}" disabled title="${esc(tituloBloqueio)}">Excluir</button>
        </td>
      </tr>`;
    }).join("");
    const btn = $("crSalvarAluno");
    btn.textContent = editIndex >= 0 ? "Atualizar aluno" : "Salvar respostas do aluno";
  }

  function pintar() {
    pintarAbas();
    pintarEscolas();
    pintarDisciplinas();
    pintarTurmas();
    pintarAlunosCadastro();
    pintarCampos();
    pintarEscalas();
    pintarGabarito();
    pintarAlunos();
    pintarLancamentoContexto();
    pintarFinalizacao();
    pintarAbrir();
    $("crResultados").hidden = true;
  }

  function querRealizar() {
    try {
      return new URLSearchParams(location.search).get("realizar") === "1";
    } catch (e) {
      return false;
    }
  }

  function marcarTela(realizar) {
    try {
      const u = new URL(location.href);
      if (realizar) u.searchParams.set("realizar", "1");
      else u.searchParams.delete("realizar");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) { /* o endereço acompanha a tela quando o navegador permite */ }
  }

  function preencherSelect(el, vazio, itens, idAtual) {
    if (!el) return;
    const lista = itens || [];
    el.innerHTML = `<option value="">${vazio}</option>` + lista.map((item) => `
      <option value="${esc(item.id)}">${esc(item.nome)}</option>
    `).join("");
    el.value = lista.some((item) => item.id === idAtual) ? idAtual : "";
  }

  function pintarSelectAlunos() {
    const sel = $("crAluno");
    if (!sel) return;
    const a = atual();
    const alunos = alunosDoLancamento();
    if (!a.escolaId || !a.turmaId) {
      sel.innerHTML = `<option value="">Escolha a escola e a turma</option>`;
    } else if (!alunos.length) {
      sel.innerHTML = `<option value="">Nenhum aluno nesta turma</option>`;
    } else {
      sel.innerHTML = `<option value="">Selecione o aluno</option>` + alunos.map((aluno) => `
        <option value="${esc(aluno.id)}" title="${esc(aluno.nome)}">${esc(aluno.nome)}</option>
      `).join("");
    }
    if (editIndex < 0) {
      sel.value = "";
      aplicarSituacao("");
      return;
    }
    const lancado = atual().students[editIndex];
    if (!lancado) {
      sel.value = "";
      aplicarSituacao("");
      return;
    }
    const porId = lancado.alunoId && alunos.some((aluno) => aluno.id === lancado.alunoId) ? lancado.alunoId : "";
    const porNome = alunos.find((aluno) => aluno.nome.localeCompare(lancado.name || "", "pt-BR", { sensitivity: "accent" }) === 0);
    let valor = porId || (porNome ? porNome.id : "");
    if (!valor && lancado.name) {
      const opt = document.createElement("option");
      opt.value = "legado:" + editIndex;
      opt.textContent = lancado.name;
      sel.appendChild(opt);
      valor = opt.value;
    }
    sel.value = valor;
    aplicarSituacao(situacaoAluno(lancado));
  }

  function sincronizarSituacaoDoAluno() {
    const escolhido = alunoDoSelect();
    if (!escolhido) {
      aplicarSituacao("");
      pintarRespostas();
      return;
    }
    const idx = indicePorEscolhido(escolhido);
    if (idx >= 0) {
      const salvo = atual().students[idx];
      pintarRespostas(salvo.answers);
      aplicarSituacao(situacaoAluno(salvo));
      aplicarTravaLancamento(turmaTravadaNoLancamento());
      return;
    }
    aplicarSituacao("");
    pintarRespostas();
  }

  function pintarLancamentoContexto() {
    const a = atual();
    const escolas = escolasParaMenu();
    preencherSelect($("crLancEscola"), "Selecione a escola", escolas, a.escolaId);
    const escolaMenu = $("crLancEscola");
    if (escolaMenu) {
      if (escolaTravada() && escolas[0]) {
        escolaMenu.value = escolas[0].id;
        escolaMenu.disabled = true;
        a.escolaId = escolas[0].id;
      } else {
        escolaMenu.disabled = false;
      }
    }
    const ano = $("crLancAno");
    if (ano) {
      ano.innerHTML = ANOS.map((item) => `<option value="${item}">${item} ano</option>`).join("");
      ano.value = anoAtual;
    }
    preencherSelect($("crLancDisciplina"), "Selecione a disciplina", pack.disciplinas, a.disciplinaId);
    preencherSelect($("crLancTurma"), "Selecione a turma", turmasDaAvaliacao(anoAtual, a.escolaId, a.turmaId), a.turmaId);
    pintarSelectAlunos();
  }

  function sincronizarLancamentoParaAno() {
    const a = atual();
    const escola = $("crLancEscola");
    const disciplina = $("crLancDisciplina");
    const turma = $("crLancTurma");
    if (escola) a.escolaId = escola.value;
    if (turma) a.turmaId = turma.value;
    if (disciplina && disciplina.value !== (provaEmTela || "")) definirDisciplina(disciplina.value);
    if ($("crEscola")) $("crEscola").value = a.escolaId || "";
    if ($("crDisciplina")) $("crDisciplina").value = a.disciplinaId || "";
    if ($("crTurma")) $("crTurma").value = a.turmaId || "";
  }

  function espelharContextoNoLancamento() {
    const a = atual();
    const marcar = (id, valor, ok) => {
      const el = $(id);
      if (!el) return;
      el.value = ok ? valor : "";
    };
    marcar("crLancEscola", a.escolaId, pack.escolas.some((e) => e.id === a.escolaId));
    marcar("crLancDisciplina", a.disciplinaId, pack.disciplinas.some((d) => d.id === a.disciplinaId));
    marcar("crLancTurma", a.turmaId, (pack.turmas || []).some((t) => t.id === a.turmaId));
    if ($("crLancAno") && ANOS.includes(anoAtual)) $("crLancAno").value = anoAtual;
  }

  function lancamentoVisivel() {
    const box = $("crAplicacao");
    return !!(box && !box.hidden);
  }

  function atualizarLegenda() {
    const sub = $("pageSubtitle");
    if (!sub) return;
    if (!sub.dataset.padrao) sub.dataset.padrao = sub.textContent;
    sub.textContent = escolaTravada() ? acessoRealizar.escola : sub.dataset.padrao;
  }

  function mostrarBanco() {
    pararVoz();
    $("crAplicacao").hidden = true;
    $("crBanco").hidden = false;
    marcarTela(false);
    atualizarLegenda();
    pintarAbrir();
  }

  function mostrarAplicacao(forcarRespostas) {
    const a = atual();
    aplicarEscolaTravada();
    if (lancamentoFinalizado()) editIndex = -1;
    $("crBanco").hidden = true;
    $("crAplicacao").hidden = false;
    $("crLancamento").hidden = false;
    pintarLancamentoContexto();
    const emEdicao = editIndex >= 0 ? a.students[editIndex] : null;
    const jaTem = document.querySelectorAll("#crRespostas .corretor-q").length;
    if (emEdicao) pintarRespostas(emEdicao.answers);
    else if (forcarRespostas || jaTem !== a.questions.length) pintarRespostas();
    pintarAlunos();
    const aviso = $("crSemGabarito");
    if (aviso) aviso.hidden = a.questions.length > 0;
    if (temRelatorioDaTurma()) gerarResultados(false);
    else $("crResultados").hidden = true;
    pintarFinalizacao();
    marcarTela(true);
    const voltar = $("crVoltarBanco");
    if (voltar) voltar.hidden = escolaTravada();
    atualizarLegenda();
    $("crAluno").focus();
  }

  function trocarAno(ano, permanecerLancamento) {
    if (!ANOS.includes(ano) || ano === anoAtual) return;
    if (permanecerLancamento || lancamentoVisivel()) sincronizarLancamentoParaAno();
    gravarFormulario();
    salvar();
    anoAtual = ano;
    editIndex = -1;
    provaEmTela = atual().disciplinaId || "";
    carregarProva(atual(), provaEmTela);
    gabaritoDomDaProva = "";
    pintar();
    if (permanecerLancamento) mostrarAplicacao(true);
    else mostrarBanco();
  }

  function adicionarEscola() {
    const nome = $("crNovaEscola").value.trim();
    if (!nome) {
      $("crNovaEscola").focus();
      return;
    }
    const repetida = pack.escolas.some((e) => e.nome.localeCompare(nome, "pt-BR", { sensitivity: "accent" }) === 0);
    if (repetida) {
      alert("Essa escola já está cadastrada.");
      return;
    }
    gravarFormulario();
    const id = "e" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
    pack.escolas.push({ id, nome });
    pack.escolas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    $("crNovaEscola").value = "";
    salvar();
    pintarEscolas();
    const menu = $("crEscolasLista");
    if (menu) menu.value = id;
    atualizarBotaoExcluirEscola();
    pintarLancamentoContexto();
    pintarAbrir();
  }

  function excluirEscola(id) {
    const escola = pack.escolas.find((e) => e.id === id);
    if (!escola) return;
    const uso = ANOS.filter((ano) => pack.anos[ano].escolaId === id);
    if (uso.length) {
      alert(`${escola.nome} está em uso na avaliação do ${uso.join(", ")}. Escolha outra escola nesses anos antes de excluir.`);
      return;
    }
    if (!confirm(`Excluir a escola ${escola.nome}?`)) return;
    gravarFormulario();
    pack.escolas = pack.escolas.filter((e) => e.id !== id);
    salvar();
    pintarEscolas();
    pintarLancamentoContexto();
    pintarAbrir();
  }

  function adicionarDisciplina() {
    const nome = $("crNovaDisciplina").value.trim();
    if (!nome) {
      $("crNovaDisciplina").focus();
      return;
    }
    const repetida = pack.disciplinas.some((d) => d.nome.localeCompare(nome, "pt-BR", { sensitivity: "accent" }) === 0);
    if (repetida) {
      alert("Essa disciplina já está cadastrada.");
      return;
    }
    gravarFormulario();
    const id = "d" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
    pack.disciplinas.push({ id, nome });
    pack.disciplinas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    $("crNovaDisciplina").value = "";
    salvar();
    pintarDisciplinas();
    const menu = $("crDisciplinasLista");
    if (menu) menu.value = id;
    atualizarBotaoExcluirDisciplina();
    pintarLancamentoContexto();
    pintarAbrir();
  }

  function excluirDisciplina(id) {
    const disciplina = pack.disciplinas.find((d) => d.id === id);
    if (!disciplina) return;
    const uso = ANOS.filter((ano) => pack.anos[ano].disciplinaId === id);
    if (uso.length) {
      alert(`${disciplina.nome} está em uso na avaliação do ${uso.join(", ")}. Escolha outra disciplina nesses anos antes de excluir.`);
      return;
    }
    if (!confirm(`Excluir a disciplina ${disciplina.nome}?`)) return;
    gravarFormulario();
    pack.disciplinas = pack.disciplinas.filter((d) => d.id !== id);
    salvar();
    pintarDisciplinas();
    pintarLancamentoContexto();
    pintarAbrir();
  }

  function adicionarTurma() {
    const nome = normalizarTurma($("crNovaTurma").value);
    if (!nome) {
      $("crNovaTurma").focus();
      return;
    }
    const repetida = pack.turmas.some((t) => t.nome.localeCompare(nome, "pt-BR", { sensitivity: "accent" }) === 0);
    if (repetida) {
      alert("Essa turma já está cadastrada.");
      return;
    }
    gravarFormulario();
    const id = "t" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
    pack.turmas.push({ id, nome });
    pack.turmas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
    $("crNovaTurma").value = "";
    salvar();
    pintarTurmas();
    const menu = $("crTurmasLista");
    if (menu) menu.value = id;
    atualizarBotaoExcluirTurma();
    pintarLancamentoContexto();
    pintarAbrir();
  }

  function excluirTurma(id) {
    const turma = pack.turmas.find((t) => t.id === id);
    if (!turma) return;
    const uso = ANOS.filter((ano) => pack.anos[ano].turmaId === id);
    if (uso.length) {
      const onde = uso.map((ano) => ano + " ano").join(", ");
      const segue = confirm(`${turma.nome} está escolhida no ${onde}. A seleção será limpa nesses anos. Alunos e gabarito permanecem. Excluir a turma?`);
      if (!segue) return;
    } else if (!confirm(`Excluir a turma ${turma.nome}?`)) {
      return;
    }
    gravarFormulario();
    uso.forEach((ano) => { pack.anos[ano].turmaId = ""; });
    pack.turmas = pack.turmas.filter((t) => t.id !== id);
    salvar();
    pintarTurmas();
    pintarLancamentoContexto();
    pintarAbrir();
  }

  function selecionarAno(ano) {
    trocarAno(ano, false);
  }

  function adicionarAlunoCadastro() {
    const nome = normalizarAluno($("crNovoAluno").value);
    if (!nome) {
      $("crNovoAluno").focus();
      return;
    }
    const a = atual();
    if (!a.escolaId || !a.turmaId) {
      alert("Escolha a escola e a turma deste ano antes de incluir o aluno.");
      return;
    }
    const repetido = (pack.alunos || []).some((aluno) => (
      aluno.ano === anoAtual &&
      aluno.escolaId === a.escolaId &&
      aluno.turmaId === a.turmaId &&
      fold(aluno.nome) === fold(nome)
    ));
    if (repetido) {
      alert("Esse aluno já está nesta turma.");
      return;
    }
    gravarFormulario();
    pack.alunos.push({
      id: "a" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
      nome,
      escolaId: a.escolaId,
      ano: anoAtual,
      turmaId: a.turmaId,
      rede: false,
    });
    $("crNovoAluno").value = "";
    salvar();
    pintarAlunosCadastro();
    pintarSelectAlunos();
  }

  function excluirAlunoCadastro(id) {
    const aluno = (pack.alunos || []).find((item) => item.id === id);
    if (!aluno) return;
    const uso = ANOS.filter((ano) => (pack.anos[ano].students || []).some((s) => s.alunoId === id || s.name === aluno.nome));
    if (uso.length) {
      const onde = uso.map((ano) => ano + " ano").join(", ");
      const segue = confirm(`${aluno.nome} já tem respostas no ${onde}. O nome sai do cadastro. As respostas lançadas permanecem. Excluir?`);
      if (!segue) return;
    }
    gravarFormulario();
    pack.alunos = pack.alunos.filter((item) => item.id !== id);
    salvar();
    pintarAlunosCadastro();
    pintarSelectAlunos();
  }

  function pintarAlunosCadastro() {
    const ul = $("crAlunosLista");
    if (!ul) return;
    const todos = pack.alunos || [];
    const manuais = todos.filter((aluno) => !aluno.rede);
    const rede = todos.length - manuais.length;
    if (!todos.length) {
      ul.innerHTML = "<li><span>Nenhum aluno cadastrado.</span></li>";
      return;
    }
    const resumo = rede
      ? `<li><span>${rede} alunos da rede. No lançamento, a lista é a da escola, do ano e da turma escolhidos.</span></li>`
      : "";
    ul.innerHTML = resumo + manuais.map((aluno) => `
      <li>
        <span>${esc(aluno.nome)}</span>
        <button type="button" class="btn-compare corretor-excluir" data-del-aluno-cadastro="${esc(aluno.id)}">Excluir</button>
      </li>
    `).join("");
  }

  function configurarQuestoes() {
    gravarFormulario();
    const n = Math.max(1, Math.min(60, Number($("crNQuest").value) || 0));
    if (!n) {
      alert("Informe o número de questões.");
      return;
    }
    const a = atual();
    if (!a.disciplinaId) {
      alert("Escolha a disciplina. O número de questões fica só nela.");
      $("crDisciplina").focus();
      return;
    }
    const daProva = (s) => {
      if (s && s.disciplinaId) return s.disciplinaId === a.disciplinaId;
      return a.disciplinaId && a.disciplinaId === (a.gabaritoLegadoEm || idPortuguesDe(pack.disciplinas));
    };
    if (a.students.some(daProva) && n !== a.questions.length) {
      const segue = confirm("O número de questões mudou. As respostas já lançadas desta disciplina serão ajustadas a esse tamanho. Continuar?");
      if (!segue) {
        $("crNQuest").value = a.questions.length || a.nQuestoes;
        return;
      }
    }
    const qs = a.questions.slice(0, n);
    while (qs.length < n) qs.push({ type: "4", correct: "1" });
    a.questions = qs;
    a.nQuestoes = n;
    gravarProva(a, provaEmTela || a.disciplinaId);
    a.students.forEach((s) => {
      if (!daProva(s)) return;
      const resp = (s.answers || []).slice(0, n);
      while (resp.length < n) resp.push("-");
      s.answers = resp;
    });
    salvar();
    pintarGabarito();
    pintarAlunos();
  }

  function salvarGabarito() {
    if (!document.querySelector("#crGabarito .corretor-q")) {
      alert("Configure as questões antes de salvar o gabarito.");
      return;
    }
    gravarFormulario();
    salvar();
    pintarRespostas();
    pintarAlunos();
  }

  function lerRespostasDom() {
    return atual().questions.map((_, i) => {
      const el = $("crResp" + i);
      return el ? el.value : "-";
    });
  }

  function alunoDoSelect() {
    const sel = $("crAluno");
    if (!sel || !sel.value) return null;
    const cadastro = (pack.alunos || []).find((aluno) => aluno.id === sel.value);
    if (cadastro) return { alunoId: cadastro.id, name: cadastro.nome };
    const texto = sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : "";
    if (!texto) return null;
    return { alunoId: "", name: texto };
  }

  function salvarAluno() {
    const escolhido = alunoDoSelect();
    if (!escolhido) {
      alert("Selecione o aluno.");
      $("crAluno").focus();
      return;
    }
    if (!atual().questions.length) {
      alert("Salve o gabarito antes de lançar alunos.");
      return;
    }
    if (lancamentoVisivel()) sincronizarLancamentoParaAno();
    gravarFormulario();
    const reaberto = alunoReabertoAgora(escolhido);
    if (lancamentoFinalizado() && !reaberto) {
      avisarLancamentoFechado();
      return;
    }
    const answers = lerRespostasDom();
    const situacao = lerSituacaoDom();
    const registro = {
      name: escolhido.name,
      alunoId: escolhido.alunoId,
      answers,
      situacao,
      disciplinaId: atual().disciplinaId || "",
    };
    const lista = atual().students;
    if (indicePorEscolhido(escolhido) >= 0) {
      alert("Este aluno já foi salvo. Para alterar o resultado, abra Eixo de avaliação e use Abrir o resultado.");
      sincronizarSituacaoDoAluno();
      return;
    }
    const abertos = listaReabertos(contextoLancamento());
    const marcaSalva = idReabertura(escolhido);
    const posReaberto = abertos.indexOf(marcaSalva);
    if (posReaberto >= 0) abertos.splice(posReaberto, 1);
    lista.push(registro);
    editIndex = -1;
    salvar();
    pintarSelectAlunos();
    pintarRespostas();
    pintarAlunos();
    pintarFinalizacao();
    pintarAbrir();
    $("crListaBox").hidden = false;
    $("crAluno").focus();
  }

  function editarAluno() {
    alert("Este aluno já foi salvo. Para alterar o resultado, abra Eixo de avaliação e use Abrir o resultado.");
  }

  function excluirAluno() {
    alert("Este aluno já foi salvo. Para alterar o resultado, abra Eixo de avaliação e use Abrir o resultado.");
  }

  function resultadosDoContexto() {
    const a = atual();
    if (!a.escolaId || !a.turmaId || !a.disciplinaId) return [];
    const roster = alunosDoLancamento();
    const ids = new Set(roster.map((aluno) => aluno.id));
    const nomes = new Set(roster.map((aluno) => aluno.nome));
    return (a.students || [])
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => {
        const daTurma = (s.alunoId && ids.has(s.alunoId)) || nomes.has(s.name);
        return daTurma && mesmaDisciplina(s);
      });
  }

  function limparPainelAbrir(mensagem) {
    const box = $("crAbrirRespostas");
    if (box) box.innerHTML = "";
    aplicarSituacao("", "crAbrirSituacao");
    document.querySelectorAll("#crAbrirSituacao [data-sit]").forEach((el) => { el.disabled = true; });
    const salvarBtn = $("crAbrirSalvar");
    if (salvarBtn) salvarBtn.disabled = true;
    const refazerBtn = $("crAbrirRefazer");
    if (refazerBtn) refazerBtn.disabled = true;
    const fechado = $("crAbrirFechado");
    if (fechado) fechado.hidden = true;
    const status = $("crAbrirStatus");
    if (status) status.textContent = mensagem || "";
  }

  function pintarRespostasAbrir(valores, travado) {
    const box = $("crAbrirRespostas");
    if (!box) return;
    const qs = atual().questions || [];
    if (!qs.length) {
      box.innerHTML = `<p class="hint">Este ano ainda não tem gabarito salvo.</p>`;
      return;
    }
    box.innerHTML = qs.map((q, i) => {
      const op = opcoesTipo(q.type);
      const valor = valores && valores[i] ? valores[i] : "-";
      const texto = textoDescritor(q);
      const codigo = q.descriptor ? ` · ${esc(q.descriptor)}` : "";
      return `
        <div class="corretor-q">
          <strong>Q${i + 1}${codigo}</strong>
          <p class="corretor-desc" title="${esc(texto)}">${esc(texto)}</p>
          ${selectHtml("crAbrirResp" + i, valor, op, true)}
        </div>
      `;
    }).join("");
    if (travado) box.querySelectorAll("select").forEach((el) => { el.disabled = true; });
  }

  function mostrarResultadoAbrir() {
    const sel = $("crAbrirAluno");
    const fechado = $("crAbrirFechado");
    const salvarBtn = $("crAbrirSalvar");
    if (!sel || sel.value === "") {
      limparPainelAbrir("");
      return;
    }
    const idx = Number(sel.value);
    const salvo = (atual().students || [])[idx];
    if (!salvo) {
      limparPainelAbrir("Não há resultado salvo para este aluno.");
      return;
    }
    const travado = lancamentoFinalizado();
    if (fechado) fechado.hidden = !travado;
    pintarRespostasAbrir(salvo.answers, travado);
    aplicarSituacao(situacaoAluno(salvo), "crAbrirSituacao");
    document.querySelectorAll("#crAbrirSituacao [data-sit]").forEach((el) => { el.disabled = !!travado; });
    if (salvarBtn) salvarBtn.disabled = !!travado || !(atual().questions || []).length;
    const refazerBtn = $("crAbrirRefazer");
    if (refazerBtn) refazerBtn.disabled = false;
    const status = $("crAbrirStatus");
    if (status) status.textContent = "";
  }

  function pintarAlunosAbrir() {
    const sel = $("crAbrirAluno");
    if (!sel) return;
    const antes = sel.value;
    const a = atual();
    if (!a.escolaId || !a.turmaId || !a.disciplinaId) {
      sel.innerHTML = `<option value="">Escolha escola, ano, disciplina e turma</option>`;
      limparPainelAbrir("");
      return;
    }
    const lista = resultadosDoContexto();
    if (!lista.length) {
      sel.innerHTML = `<option value="">Nenhum resultado salvo nesta turma</option>`;
      limparPainelAbrir("Nenhum resultado salvo para esta escola, ano, disciplina e turma.");
      return;
    }
    sel.innerHTML = `<option value="">Selecione o aluno</option>` + lista.map(({ s, index }) => {
      const sit = situacaoAluno(s);
      const rotulo = sit ? `${s.name} — ${sit}` : s.name;
      return `<option value="${index}">${esc(rotulo)}</option>`;
    }).join("");
    if (antes && lista.some(({ index }) => String(index) === String(antes))) sel.value = antes;
    else sel.value = "";
    mostrarResultadoAbrir();
  }

  function pintarAbrir() {
    if (!$("crAbrirEscola")) return;
    const a = atual();
    preencherSelect($("crAbrirEscola"), "Selecione a escola", escolasParaMenu(), a.escolaId);
    const ano = $("crAbrirAno");
    if (ano) {
      ano.innerHTML = ANOS.map((item) => `<option value="${item}">${item} ano</option>`).join("");
      ano.value = anoAtual;
    }
    preencherSelect($("crAbrirDisciplina"), "Selecione a disciplina", pack.disciplinas, a.disciplinaId);
    preencherSelect($("crAbrirTurma"), "Selecione a turma", turmasDaAvaliacao(anoAtual, a.escolaId, a.turmaId), a.turmaId);
    pintarAlunosAbrir();
  }

  function sincronizarAbrirNoAno(origem) {
    const a = atual();
    if (origem === "escola" && $("crAbrirEscola")) a.escolaId = $("crAbrirEscola").value;
    if (origem === "disciplina" && $("crAbrirDisciplina")) definirDisciplina($("crAbrirDisciplina").value);
    if (origem === "turma" && $("crAbrirTurma")) a.turmaId = $("crAbrirTurma").value;
    if ($("crAbrirAluno")) $("crAbrirAluno").value = "";
    if (origem === "escola") pintarTurmas();
    if ($("crEscola")) $("crEscola").value = a.escolaId || "";
    if ($("crDisciplina")) $("crDisciplina").value = a.disciplinaId || "";
    if ($("crTurma")) $("crTurma").value = a.turmaId || "";
    salvar();
    if (origem === "disciplina") atualizarTelaDaProva();
    else pintarAbrir();
  }

  function salvarAlteracaoResultado() {
    if (lancamentoFinalizado()) {
      avisarLancamentoFechado();
      const fechado = $("crAbrirFechado");
      if (fechado) fechado.hidden = false;
      return;
    }
    const sel = $("crAbrirAluno");
    const status = $("crAbrirStatus");
    if (!sel || sel.value === "") {
      if (status) status.textContent = "Selecione o aluno.";
      return;
    }
    const idx = Number(sel.value);
    const lista = atual().students || [];
    const atualSalvo = lista[idx];
    if (!atualSalvo) {
      if (status) status.textContent = "Não há resultado salvo para este aluno.";
      return;
    }
    if (!(atual().questions || []).length) {
      if (status) status.textContent = "Este ano ainda não tem gabarito salvo.";
      return;
    }
    const answers = atual().questions.map((_, i) => {
      const el = $("crAbrirResp" + i);
      return el ? el.value : ((atualSalvo.answers || [])[i] || "-");
    });
    lista[idx] = {
      ...atualSalvo,
      answers,
      situacao: lerSituacaoDom("crAbrirSituacao"),
      disciplinaId: atual().disciplinaId || atualSalvo.disciplinaId || "",
    };
    salvar();
    pintarAlunos();
    pintarAlunosAbrir();
    if ($("crAbrirAluno")) $("crAbrirAluno").value = String(idx);
    mostrarResultadoAbrir();
    if ($("crAbrirStatus")) $("crAbrirStatus").textContent = "Alteração salva.";
  }

  function refazerProva() {
    const sel = $("crAbrirAluno");
    const status = $("crAbrirStatus");
    if (!sel || sel.value === "") {
      if (status) status.textContent = "Selecione o aluno.";
      return;
    }
    const idx = Number(sel.value);
    const lista = atual().students || [];
    const salvo = lista[idx];
    if (!salvo || !mesmaDisciplina(salvo)) {
      if (status) status.textContent = "Não há resultado salvo para este aluno.";
      return;
    }
    const info = identificacao();
    const nome = salvo.name || "este aluno";
    const segue = confirm(
      `Refazer a prova de ${nome} em ${info.disciplina}?\n\nO resultado anterior deste aluno, nesta disciplina, será excluído: respostas, nota e situação (N.D, Falta ou Transferência). O cadastro do aluno, o gabarito e os outros alunos permanecem.`
    );
    if (!segue) return;
    const ainda = (atual().students || [])[idx];
    if (!ainda || ainda !== salvo) return;
    const ctx = contextoLancamento();
    if (lancamentoFinalizado(ctx)) {
      const abertos = listaReabertos(ctx);
      const marca = idReabertura(salvo);
      if (marca && !abertos.includes(marca)) abertos.push(marca);
    }
    atual().students.splice(idx, 1);
    salvar();
    pintarAlunos();
    pintarFinalizacao();
    if ($("crAbrirAluno")) $("crAbrirAluno").value = "";
    pintarAlunosAbrir();
    if ($("crAbrirStatus")) $("crAbrirStatus").textContent = "Resultado excluído. Este aluno pode fazer a prova de novo.";
  }

  function disciplinasDoRelatorio() {
    const lista = pack.disciplinas || [];
    const port = lista.find((d) => fold(d.nome) === "PORTUGUES") || { id: "d-portugues", nome: "Português" };
    const mat = lista.find((d) => fold(d.nome) === "MATEMATICA") || { id: "d-matematica", nome: "Matemática" };
    return [port, mat];
  }

  function provaDisciplina(disciplinaId) {
    const provas = garantirProvas(atual());
    const prova = provas[disciplinaId];
    const questions = prova && Array.isArray(prova.questions) ? prova.questions : [];
    return questions;
  }

  function alunoContaNaDisciplina(student, disciplinaId) {
    if (!student) return false;
    if (student.disciplinaId) return student.disciplinaId === disciplinaId;
    const legado = atual().gabaritoLegadoEm || idPortuguesDe(pack.disciplinas);
    return disciplinaId === legado;
  }

  function alunosDisciplinaRelatorio(disciplinaId) {
    const a = atual();
    if (!a.escolaId || !a.turmaId) return [];
    const roster = alunosDoLancamento();
    const ids = new Set(roster.map((aluno) => aluno.id));
    const nomes = new Set(roster.map((aluno) => aluno.nome));
    return (a.students || []).filter((s) => {
      const daTurma = (s.alunoId && ids.has(s.alunoId)) || nomes.has(s.name);
      return daTurma && alunoContaNaDisciplina(s, disciplinaId);
    });
  }

  function temRelatorioDaTurma() {
    const a = atual();
    if (!a.escolaId || !a.turmaId) return false;
    return disciplinasDoRelatorio().some((d) => provaDisciplina(d.id).length && alunosDisciplinaRelatorio(d.id).length);
  }

  function notaComQuestoes(student, qs) {
    if (!qs.length) return 0;
    let certos = 0;
    qs.forEach((q, i) => { if ((student.answers || [])[i] === q.correct) certos += 1; });
    return (100 * certos) / qs.length;
  }

  function mapaDescritoresDe(disciplinaId) {
    const hab = window.HAB_NOMES;
    if (!hab) return null;
    const mapa = hab[anoAtual + "|" + nomeDisciplina(disciplinaId)];
    if (!mapa || typeof mapa !== "object") return null;
    return mapa;
  }

  function textoDescritorDe(q, mapa) {
    if (q && q.descriptor && mapa && mapa[q.descriptor]) return mapa[q.descriptor];
    return (q && q.descriptorText) || "";
  }

  function textoResultadoAluno(student, qs) {
    if (!student) return "Sem lançamento";
    const sit = situacaoAluno(student);
    if (sit) return sit;
    if (!qs.length) return "Sem gabarito";
    const nota = notaComQuestoes(student, qs);
    return `${nota.toFixed(1)}% · ${nivelDe(nota)}`;
  }

  function idSeguro(id) {
    return String(id || "disc").replace(/[^A-Za-z0-9_-]/g, "");
  }

  function destruirGraficosRelatorio() {
    chartsRelatorio.forEach((grafico) => {
      try { grafico.destroy(); } catch (e) { /* gráfico já destruído */ }
    });
    chartsRelatorio = [];
  }

  function resumoDisciplina(disciplina) {
    const qs = provaDisciplina(disciplina.id);
    const alunos = alunosDisciplinaRelatorio(disciplina.id);
    const presentesLista = alunosComNota(alunos);
    const presentes = presentesLista.length;
    const aptos = Number(atual().matriculados) || 0;
    const ausencia = aptos > 0 ? ((aptos - presentes) / aptos) * 100 : 0;
    const notas = presentesLista.map((s) => notaComQuestoes(s, qs));
    const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
    const ordenadas = [...notas].sort((x, y) => x - y);
    const meio = Math.floor(ordenadas.length / 2);
    const mediana = notas.length ? (ordenadas.length % 2 ? ordenadas[meio] : (ordenadas[meio - 1] + ordenadas[meio]) / 2) : null;
    const variancia = notas.length ? notas.reduce((s, n) => s + (n - media) ** 2, 0) / notas.length : null;
    const desvio = variancia == null ? null : Math.sqrt(variancia);
    return { qs, alunos, presentesLista, presentes, ausencia, notas, media, mediana, desvio };
  }

  function htmlBlocoDisciplina(disciplina) {
    const qs = provaDisciplina(disciplina.id);
    const alunos = alunosDisciplinaRelatorio(disciplina.id);
    const titulo = `<h2>${esc(disciplina.nome)}</h2>`;
    if (!qs.length || !alunos.length) {
      let aviso = "Ainda não há lançamento desta disciplina.";
      if (!qs.length && alunos.length) aviso = "Ainda não há gabarito desta disciplina.";
      else if (qs.length) aviso = `${qs.length} questões. Ainda não há lançamento desta disciplina.`;
      return `<section class="corretor-relatorio-disc">${titulo}<p class="hint corretor-relatorio-vazio">${esc(aviso)}</p></section>`;
    }
    const r = resumoDisciplina(disciplina);
    const fmtPct = (n) => (n == null ? "—" : `${n.toFixed(1)}%`);
    const sid = idSeguro(disciplina.id);
    return `
      <section class="corretor-relatorio-disc" data-disc="${esc(disciplina.id)}">
        ${titulo}
        <p class="hint">${qs.length} questões</p>
        <div class="kpis">
          <div class="kpi"><span>Questões</span><strong>${qs.length}</strong></div>
          <div class="kpi"><span>Presentes</span><strong>${r.presentes}</strong></div>
          <div class="kpi"><span>Ausência</span><strong>${r.ausencia.toFixed(1)}%</strong></div>
          <div class="kpi"><span>Média</span><strong>${fmtPct(r.media)}</strong></div>
          <div class="kpi"><span>Nível</span><strong>${r.media == null ? "—" : esc(nivelDe(r.media))}</strong></div>
          <div class="kpi"><span>Mediana</span><strong>${fmtPct(r.mediana)}</strong></div>
          <div class="kpi"><span>Desvio</span><strong>${r.desvio == null ? "—" : r.desvio.toFixed(2)}</strong></div>
        </div>
        <div class="grid-2">
          <article class="card"><canvas id="crChartQ_${sid}"></canvas></article>
          <article class="card"><canvas id="crChartP_${sid}"></canvas></article>
        </div>
        <article class="card">
          <h2>Matriz de desempenho</h2>
          <div class="table-wrap"><table class="corretor-matriz">${htmlMatriz(qs, alunos, mapaDescritoresDe(disciplina.id))}</table></div>
        </article>
      </section>
    `;
  }

  function htmlResultadoPorAluno(disciplinas) {
    const porDisc = disciplinas.map((d) => ({
      d,
      qs: provaDisciplina(d.id),
      alunos: alunosDisciplinaRelatorio(d.id),
    }));
    const unicos = new Map();
    porDisc.forEach(({ alunos }) => {
      alunos.forEach((s) => {
        const chave = s.alunoId ? "id:" + s.alunoId : "nome:" + fold(s.name || "");
        if (!unicos.has(chave)) unicos.set(chave, s.name || "");
      });
    });
    const linhas = [...unicos.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    const head = `<thead><tr><th>Aluno</th>${disciplinas.map((d) => `<th>${esc(d.nome)}</th>`).join("")}</tr></thead>`;
    if (!linhas.length) {
      return `
        <article class="card" id="crRelatorioAlunos">
          <h2>Resultado por aluno</h2>
          <p class="hint">Nenhum aluno lançado nesta turma.</p>
        </article>
      `;
    }
    const body = linhas.map(([chave, nome]) => {
      const cols = porDisc.map(({ qs, alunos }) => {
        const student = alunos.find((s) => (s.alunoId ? "id:" + s.alunoId : "nome:" + fold(s.name || "")) === chave);
        return `<td>${esc(textoResultadoAluno(student, qs))}</td>`;
      }).join("");
      return `<tr><td>${esc(nome)}</td>${cols}</tr>`;
    }).join("");
    return `
      <article class="card" id="crRelatorioAlunos">
        <h2>Resultado por aluno</h2>
        <div class="table-wrap"><table class="corretor-matriz">${head}<tbody>${body}</tbody></table></div>
      </article>
    `;
  }

  function gerarResultados(rolar) {
    gravarFormulario();
    salvar();
    const a = atual();
    if (!a.escolaId || !a.turmaId) {
      if (rolar) alert("Escolha a escola e a turma antes de gerar o relatório.");
      $("crResultados").hidden = true;
      return;
    }
    const disciplinas = disciplinasDoRelatorio();
    const info = identificacao();
    $("crTituloResultado").textContent = `Resultado — ${anoAtual} ano — ${info.escola} — ${info.turma} — Português e Matemática`;
    $("crMetaResultado").textContent = `${info.escola} · ${info.turma} · Português e Matemática · ${a.nome || "Avaliação sem nome"}${a.data ? " · " + a.data : ""}`;
    destruirGraficosRelatorio();
    $("crRelatorioDisciplinas").innerHTML = disciplinas.map(htmlBlocoDisciplina).join("") + htmlResultadoPorAluno(disciplinas);
    $("crResultados").hidden = false;
    pintarGraficosRelatorio(disciplinas);
    if (rolar) $("crResultados").scrollIntoView({ behavior: "smooth" });
  }

  function htmlMatriz(qs, alunosOrigem, mapa) {
    const alunos = [...alunosOrigem].sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
    const acertosQ = new Array(qs.length).fill(0);
    const marcas = ["1", "2", "3", "4"];
    if (qs.some((q) => q.type === "5")) marcas.push("5");
    if (qs.some((q) => q.type === "2")) marcas.push("V", "F");
    marcas.push("-");
    const freq = qs.map(() => Object.fromEntries(marcas.map((m) => [m, 0])));

    let head = "<thead><tr><th>Estudante</th>";
    qs.forEach((_, i) => { head += `<th>${i + 1}</th>`; });
    head += "<th>Acertos</th><th>%</th><th>Nível</th></tr><tr><th>Descritor</th>";
    qs.forEach((q) => {
      const cod = q.descriptor ? esc(q.descriptor) : "—";
      const texto = textoDescritorDe(q, mapa);
      head += `<th title="${esc(texto)}">${cod}${texto ? `<span class="cr-th-desc">${esc(texto)}</span>` : ""}</th>`;
    });
    head += "<th></th><th></th><th></th></tr></thead>";

    let body = "<tbody>";
    alunos.forEach((aluno) => {
      const sit = situacaoAluno(aluno);
      if (sit) {
        let row = `<tr><td>${esc(aluno.name)} — ${esc(sit)}</td>`;
        qs.forEach(() => { row += "<td>—</td>"; });
        row += `<td>—</td><td>—</td><td>${esc(sit)}</td></tr>`;
        body += row;
        return;
      }
      let certos = 0;
      let row = `<tr><td>${esc(aluno.name)}</td>`;
      qs.forEach((q, i) => {
        const resp = (aluno.answers || [])[i] || "-";
        if (freq[i][resp] == null) freq[i][resp] = 0;
        freq[i][resp] += 1;
        if (resp === q.correct) {
          certos += 1;
          acertosQ[i] += 1;
          row += '<td class="ok">✓</td>';
        } else {
          row += `<td class="erro">${esc(resp)} (X)</td>`;
        }
      });
      const perc = qs.length ? Math.round((100 * certos) / qs.length) : 0;
      const classe = perc === 100 ? "alta" : (perc >= 50 ? "media" : "baixa");
      row += `<td>${certos}</td><td class="${classe}">${perc}</td><td>${esc(nivelDe(perc))}</td></tr>`;
      body += row;
    });
    body += "</tbody>";

    const comNota = alunos.filter((aluno) => !situacaoAluno(aluno));
    let foot = `<tfoot><tr><td>Acertos da turma</td>`;
    acertosQ.forEach((n) => { foot += `<td>${n}</td>`; });
    foot += "<td></td><td></td><td></td></tr><tr><td>% de acerto</td>";
    const percQ = acertosQ.map((n) => (comNota.length ? Math.round((100 * n) / comNota.length) : null));
    percQ.forEach((p) => {
      if (p == null) {
        foot += "<td>—</td>";
        return;
      }
      const classe = p >= 70 ? "ok" : (p <= 30 ? "erro" : "");
      foot += `<td class="${classe}">${p}%</td>`;
    });
    foot += "<td></td><td></td><td></td></tr><tr><td>Nível da questão</td>";
    percQ.forEach((p) => { foot += `<td>${p == null ? "—" : esc(nivelDe(p))}</td>`; });
    foot += "<td></td><td></td><td></td></tr>";
    marcas.forEach((marca) => {
      foot += `<tr><td>Marcaram ${marca === "-" ? "em branco" : marca}</td>`;
      freq.forEach((f, i) => {
        const certa = qs[i].correct === marca;
        foot += `<td${certa ? ' class="ok"' : ""}>${f[marca] || 0}</td>`;
      });
      foot += "<td></td><td></td><td></td></tr>";
    });
    foot += "</tfoot>";
    return head + body + foot;
  }

  function pintarGraficosRelatorio(disciplinas) {
    if (!window.Chart) return;
    const plugin = window.ChartDataLabels ? [ChartDataLabels] : [];
    disciplinas.forEach((disciplina) => {
      const qs = provaDisciplina(disciplina.id);
      const avaliados = alunosComNota(alunosDisciplinaRelatorio(disciplina.id));
      if (!qs.length || !avaliados.length) return;
      const sid = idSeguro(disciplina.id);
      const canvasQ = $("crChartQ_" + sid);
      const canvasP = $("crChartP_" + sid);
      if (!canvasQ || !canvasP) return;
      const acertos = qs.map((q, i) => avaliados.filter((s) => (s.answers || [])[i] === q.correct).length);
      const perc = acertos.map((n) => (avaliados.length ? (100 * n) / avaliados.length : null));
      chartsRelatorio.push(new Chart(canvasQ, {
        type: "bar",
        plugins: plugin,
        data: {
          labels: qs.map((q, i) => "Q" + (i + 1) + (q.descriptor ? " " + q.descriptor : "")),
          datasets: [{ label: "% de acerto", data: perc, backgroundColor: "#2ec4b6", borderRadius: 4 }],
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: "Acertos por questão" },
            legend: { display: false },
            datalabels: { color: "#062027", font: { weight: "bold" }, formatter: (v) => (v == null ? "" : Math.round(v) + "%") },
          },
          scales: { y: { beginAtZero: true, max: 100 } },
        },
      }));
      const faixas = {};
      (atual().escalas || []).forEach((s) => { if (s.nome) faixas[s.nome] = 0; });
      avaliados.forEach((s) => {
        const nivel = nivelDe(notaComQuestoes(s, qs));
        if (faixas[nivel] == null) faixas[nivel] = 0;
        faixas[nivel] += 1;
      });
      chartsRelatorio.push(new Chart(canvasP, {
        type: "doughnut",
        plugins: plugin,
        data: {
          labels: Object.keys(faixas),
          datasets: [{
            data: Object.values(faixas),
            backgroundColor: ["#e53935", "#ffbf69", "#7bd389", "#5eb8d6", "#c4a574"],
          }],
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: "Alunos por nível" },
            datalabels: {
              color: "#062027",
              font: { weight: "bold" },
              formatter: (v, ctx) => {
                const total = ctx.dataset.data.reduce((s, n) => s + n, 0);
                return v > 0 && total ? Math.round((100 * v) / total) + "%" : "";
              },
            },
          },
        },
      }));
    });
  }

  async function exportarPdf() {
    if ($("crResultados").hidden) {
      alert("Gere o relatório antes de exportar.");
      return;
    }
    const btn = $("crPdf");
    const texto = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Gerando PDF...";
    try {
      window.scrollTo(0, 0);
      const blocos = [...document.querySelectorAll("#crRelatorioDisciplinas > section, #crRelatorioAlunos")];
      const imagens = [];
      for (const bloco of blocos) {
        imagens.push(await html2canvas(bloco, { scale: 2, backgroundColor: "#ffffff", useCORS: true }));
      }
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("l", "pt", "a4");
      const largura = pdf.internal.pageSize.getWidth();
      const altura = pdf.internal.pageSize.getHeight();
      const a = atual();
      const info = identificacao();
      pdf.setFontSize(16);
      const tituloPdf = pdf.splitTextToSize(`Corretor — ${anoAtual} ano — ${info.escola} — ${info.turma} — Português e Matemática`, largura - 48);
      pdf.text(tituloPdf, 24, 28);
      pdf.setFontSize(11);
      const subPdf = pdf.splitTextToSize(`${info.escola}  ·  ${info.turma}  ·  Português e Matemática  ·  ${a.nome || "Avaliação sem nome"}`, largura - 48);
      const ySub = 28 + tituloPdf.length * 18;
      pdf.text(subPdf, 24, ySub);
      let yLivre = ySub + subPdf.length * 14 + 12;
      imagens.forEach((img) => {
        const h = ((largura - 48) * img.height) / img.width;
        const cabe = yLivre + h <= altura - 18;
        if (!cabe) {
          const altPagina = Math.max(altura, h + 36);
          pdf.addPage([largura, altPagina], "l");
          yLivre = 18;
        }
        pdf.addImage(img.toDataURL("image/png"), "PNG", 24, yLivre, largura - 48, h);
        yLivre += h + 16;
      });
      const arquivo = `Corretor_${anoAtual.replace("º", "ano")}_${info.escola}_${info.turma}_Portugues_e_Matematica`.replace(/[^\w\-]+/g, "_");
      pdf.save(arquivo + ".pdf");
    } catch (e) {
      alert("Não foi possível gerar o PDF neste navegador.");
    } finally {
      btn.disabled = false;
      btn.textContent = texto;
    }
  }

  function aplicarFala(texto) {
    if (turmaTravadaNoLancamento() || alunoJaSalvoNoLancamento()) return;
    let fala = texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/\b(PARAR|FINALIZAR)\b/.test(fala)) {
      pararVoz();
      return;
    }
    fala = fala.replace(/\bQUESTAO\b/g, "Q");
    Object.entries(NUM_FALA).forEach(([palavra, n]) => {
      fala = fala.replace(new RegExp("\\b" + palavra + "\\b", "g"), String(n));
    });
    const padroes = [
      /Q\s*(\d{1,2})\s*[:\-]?\s*([1-5]|V|F)\b/g,
      /(\d{1,2})\s*[:\-]\s*([1-5]|V|F)\b/g,
      /(\d{1,2})\s+([1-5]|V|F)\b/g,
    ];
    padroes.forEach((re) => {
      let match = re.exec(fala);
      while (match) {
        const indice = Number(match[1]) - 1;
        const resp = match[2];
        const q = atual().questions[indice];
        const campo = $("crResp" + indice);
        if (q && campo && !campo.disabled && (resp === "-" || opcoesTipo(q.type).includes(resp))) campo.value = resp;
        match = re.exec(fala);
      }
    });
  }

  function prepararVoz() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        if (ev.results[i].isFinal) aplicarFala(ev.results[i][0].transcript);
      }
      $("crVozTexto").textContent = "Ditado aplicado nos campos numéricos.";
    };
  }

  function iniciarVoz() {
    if (turmaTravadaNoLancamento() || alunoJaSalvoNoLancamento()) return;
    if (!recognition) {
      $("crVozTexto").textContent = "Este navegador não oferece ditado. Use Chrome.";
      return;
    }
    recognition.start();
    ouvindo = true;
    $("crVozIniciar").disabled = true;
    $("crVozPausar").disabled = false;
    $("crVozParar").disabled = false;
    $("crVozTexto").textContent = "Pode falar: “um 1”, “dois 3” ou “questão 1: 2”.";
  }

  function pausarVoz() {
    if (!recognition) return;
    if (ouvindo) {
      recognition.stop();
      ouvindo = false;
      $("crVozPausar").textContent = "Continuar";
    } else {
      recognition.start();
      ouvindo = true;
      $("crVozPausar").textContent = "Pausar";
    }
  }

  function pararVoz() {
    if (recognition) recognition.stop();
    ouvindo = false;
    $("crVozIniciar").disabled = false;
    $("crVozPausar").disabled = true;
    $("crVozParar").disabled = true;
    $("crVozPausar").textContent = "Pausar";
  }

  function rotrHash(x, n) {
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
        const s0 = rotrHash(w[t - 15], 7) ^ rotrHash(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotrHash(w[t - 2], 17) ^ rotrHash(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let t = 0; t < 64; t++) {
        const s1 = rotrHash(e, 6) ^ rotrHash(e, 11) ^ rotrHash(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
        const s0 = rotrHash(a, 2) ^ rotrHash(a, 13) ^ rotrHash(a, 22);
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

  function catalogoAcesso() {
    return Array.isArray(window.ACESSO_ESCOLAS) ? window.ACESSO_ESCOLAS : [];
  }

  function buscarLogin(login) {
    const chave = String(login || "").trim().toLowerCase();
    if (!chave) return null;
    return catalogoAcesso().find((item) => String(item.login || "").toLowerCase() === chave) || null;
  }

  function lerSessaoRealizar() {
    try {
      const bruto = JSON.parse(sessionStorage.getItem("avalie-realizar") || "null");
      const item = buscarLogin(bruto && bruto.login);
      if (!item) return null;
      if (item.mestre) return { login: item.login, mestre: true };
      return { login: item.login, escola: item.escola || "" };
    } catch (e) {
      return null;
    }
  }

  function escolaTravada() {
    return !!(querRealizar() && acessoRealizar && !acessoRealizar.mestre && acessoRealizar.escola);
  }

  function escolasParaMenu() {
    if (!escolaTravada()) return pack.escolas || [];
    const alvo = fold(acessoRealizar.escola);
    return (pack.escolas || []).filter((e) => fold(e.nome) === alvo);
  }

  function idEscolaTravada() {
    const lista = escolasParaMenu();
    return lista[0] ? lista[0].id : "";
  }

  function aplicarEscolaTravada() {
    if (!escolaTravada()) return;
    const id = idEscolaTravada();
    if (!id) return;
    const a = atual();
    if (a.escolaId !== id) a.escolaId = id;
  }

  function mostrarTelaLogin() {
    acessoRealizar = null;
    document.documentElement.classList.add("realizar-login");
    document.documentElement.classList.remove("realizar-ok");
    const erro = $("realizarErro");
    if (erro) erro.textContent = "";
    const campo = $("realizarLoginCampo");
    if (campo) campo.focus();
  }

  function entrarNoLancamento() {
    acessoRealizar = lerSessaoRealizar();
    if (!acessoRealizar) {
      mostrarTelaLogin();
      return;
    }
    document.documentElement.classList.add("realizar-login", "realizar-ok");
    aplicarEscolaTravada();
    pintar();
    mostrarAplicacao();
  }

  async function entrarRealizar(ev) {
    ev.preventDefault();
    const loginEl = $("realizarLoginCampo");
    const senhaEl = $("realizarSenhaCampo");
    const erro = $("realizarErro");
    const botao = ev.currentTarget.querySelector("button[type='submit']");
    const login = loginEl ? loginEl.value.trim() : "";
    const senha = senhaEl ? senhaEl.value.trim() : "";
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
      const sessao = item.mestre
        ? { login: item.login, mestre: true }
        : { login: item.login, escola: item.escola };
      if (item.mestre && window.gravarSessaoMestre) window.gravarSessaoMestre(item.login);
      else sessionStorage.setItem("avalie-realizar", JSON.stringify(sessao));
      if (senhaEl) senhaEl.value = "";
      acessoRealizar = sessao;
      if (!iniciado) iniciar();
      else entrarNoLancamento();
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  function sairRealizar() {
    if (acessoRealizar && acessoRealizar.mestre && window.sairSessaoMestre) window.sairSessaoMestre();
    else {
      try { sessionStorage.removeItem("avalie-realizar"); } catch (e) { /* volta ao login */ }
    }
    const senhaEl = $("realizarSenhaCampo");
    const loginEl = $("realizarLoginCampo");
    if (senhaEl) senhaEl.value = "";
    if (loginEl) loginEl.value = "";
    try {
      const u = new URL(location.href);
      u.searchParams.set("realizar", "1");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) { /* permanece nesta janela */ }
    mostrarTelaLogin();
  }

  const CHAVE_AVALIACOES = "avalie-cadastro-avaliacoes";
  const CHAVE_LIBERACAO = "avalie-resultado-liberacao";

  function lerAvaliacoes() {
    try {
      const bruto = JSON.parse(localStorage.getItem(CHAVE_AVALIACOES) || "[]");
      if (!Array.isArray(bruto)) return [];
      return bruto
        .map((item) => String(item && item.nome || "").trim())
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function gravarAvaliacoes(lista) {
    const gravada = lista.map((nome) => ({ nome }));
    localStorage.setItem(CHAVE_AVALIACOES, JSON.stringify(gravada));
  }

  function lerLiberacao() {
    try {
      const bruto = JSON.parse(localStorage.getItem(CHAVE_LIBERACAO) || "{}");
      return bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto : {};
    } catch (e) {
      return {};
    }
  }

  function gravarLiberacao(mapa) {
    const limpo = {};
    Object.keys(mapa || {}).forEach((nome) => {
      const chave = String(nome || "").trim();
      if (chave) limpo[chave] = mapa[nome] === true;
    });
    localStorage.setItem(CHAVE_LIBERACAO, JSON.stringify(limpo));
  }

  function sessaoMestraAberta() {
    if (window.lerSessaoMestre && window.lerSessaoMestre()) return true;
    try {
      const pai = window.opener;
      if (pai && !pai.closed && pai.lerSessaoMestre && pai.lerSessaoMestre()) return true;
    } catch (e) { /* a capa pode estar em outra janela */ }
    return false;
  }

  function pintarAvaliacoes() {
    const listaEl = $("crAvaliacoesLista");
    if (!listaEl) return;
    const lista = lerAvaliacoes();
    const flags = lerLiberacao();
    listaEl.replaceChildren();
    if (!lista.length) {
      const vazio = document.createElement("li");
      vazio.textContent = "Nenhuma avaliação cadastrada.";
      listaEl.appendChild(vazio);
      return;
    }
    lista.forEach((nome) => {
      const item = document.createElement("li");
      const texto = document.createElement("span");
      const titulo = document.createElement("strong");
      titulo.textContent = nome;
      const estado = document.createElement("small");
      const liberado = flags[nome] === true;
      estado.textContent = liberado ? "Resultado liberado" : "Em lançamento";
      texto.append(titulo, estado);
      item.appendChild(texto);
      if (!liberado) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "btn-compare";
        botao.textContent = "Liberar resultado";
        botao.addEventListener("click", () => liberarResultado(nome));
        item.appendChild(botao);
      }
      listaEl.appendChild(item);
    });
  }

  function liberarResultado(nome) {
    const erro = $("crAvaliacaoErro");
    if (erro) erro.textContent = "";
    if (!sessaoMestraAberta()) {
      if (erro) erro.textContent = "Somente a chave mestra pode liberar o resultado.";
      return;
    }
    const flags = lerLiberacao();
    flags[nome] = true;
    gravarLiberacao(flags);
    pintarAvaliacoes();
  }

  function cadastrarAvaliacao() {
    const campo = $("crNovaAvaliacao");
    const erro = $("crAvaliacaoErro");
    const nome = campo ? campo.value.trim() : "";
    if (erro) erro.textContent = "";
    if (!nome) {
      if (erro) erro.textContent = "Informe o nome da avaliação.";
      if (campo) campo.focus();
      return;
    }
    const lista = lerAvaliacoes();
    lista.push(nome);
    gravarAvaliacoes(lista);
    const flags = lerLiberacao();
    if (flags[nome] !== true) flags[nome] = false;
    gravarLiberacao(flags);
    if (campo) campo.value = "";
    pintarAvaliacoes();
  }

  function iniciar() {
    if (iniciado) return;
    if (!Array.isArray(window.CORRETOR_NOMINAL)) {
      if (iniciando) return;
      iniciando = true;
      const script = document.createElement("script");
      script.src = "dados_nominal.js?v=nomes1";
      script.onload = () => { iniciando = false; iniciar(); };
      script.onerror = () => {
        window.CORRETOR_NOMINAL = [];
        iniciando = false;
        iniciar();
      };
      document.head.appendChild(script);
      return;
    }
    iniciado = true;
    soltarRotulosGlobais();
    pack = carregar();
    provaEmTela = atual().disciplinaId || "";
    completarCadastro();
    prepararVoz();
    const addAvaliacao = $("crAddAvaliacao");
    const novaAvaliacao = $("crNovaAvaliacao");
    if (addAvaliacao) addAvaliacao.addEventListener("click", cadastrarAvaliacao);
    if (novaAvaliacao) {
      novaAvaliacao.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") cadastrarAvaliacao();
      });
    }
    pintarAvaliacoes();
    $("crAddEscola").addEventListener("click", adicionarEscola);
    $("crNovaEscola").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") adicionarEscola();
    });
    $("crEscolasLista").addEventListener("change", atualizarBotaoExcluirEscola);
    $("crDelEscola").addEventListener("click", () => {
      const id = $("crEscolasLista").value;
      if (id) excluirEscola(id);
    });
    $("crAddDisciplina").addEventListener("click", adicionarDisciplina);
    $("crNovaDisciplina").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") adicionarDisciplina();
    });
    $("crDisciplinasLista").addEventListener("change", atualizarBotaoExcluirDisciplina);
    $("crDelDisciplina").addEventListener("click", () => {
      const id = $("crDisciplinasLista").value;
      if (id) excluirDisciplina(id);
    });
    $("crAddTurma").addEventListener("click", adicionarTurma);
    $("crNovaTurma").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") adicionarTurma();
    });
    $("crTurmasLista").addEventListener("change", atualizarBotaoExcluirTurma);
    $("crDelTurma").addEventListener("click", () => {
      const id = $("crTurmasLista").value;
      if (id) excluirTurma(id);
    });
    $("crAddAlunoCadastro").addEventListener("click", adicionarAlunoCadastro);
    $("crNovoAluno").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") adicionarAlunoCadastro();
    });
    $("crAlunosLista").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-del-aluno-cadastro]");
      if (btn) excluirAlunoCadastro(btn.dataset.delAlunoCadastro);
    });
    $("corretorAnos").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-ano]");
      if (btn) selecionarAno(btn.dataset.ano);
    });
    $("crEscola").addEventListener("change", () => {
      gravarFormulario();
      pintarTurmas();
      pintarLancamentoContexto();
      gravarFormulario();
      salvar();
      refrescarFechamentoNaTela();
    });
    $("crDisciplina").addEventListener("change", () => {
      definirDisciplina($("crDisciplina").value);
      atualizarTelaDaProva();
      salvar();
      espelharContextoNoLancamento();
      refrescarFechamentoNaTela();
    });
    $("crTurma").addEventListener("change", () => {
      gravarFormulario();
      salvar();
      espelharContextoNoLancamento();
      pintarSelectAlunos();
      refrescarFechamentoNaTela();
    });
    ["crNome", "crData", "crMatriculados", "crNQuest"].forEach((id) => {
      $(id).addEventListener("change", () => { gravarFormulario(); salvar(); });
    });
    $("crAddEscala").addEventListener("click", () => {
      gravarFormulario();
      atual().escalas.push({ nome: "", min: 0, max: 0 });
      pintarEscalas();
    });
    $("crEscalas").addEventListener("click", (ev) => {
      if (!ev.target.closest(".cr-remover-escala")) return;
      gravarFormulario();
      const linhas = [...document.querySelectorAll("#crEscalas .corretor-escala")];
      const idx = linhas.indexOf(ev.target.closest(".corretor-escala"));
      if (idx >= 0) atual().escalas.splice(idx, 1);
      salvar();
      pintarEscalas();
    });
    $("crEscalas").addEventListener("change", () => { gravarFormulario(); salvar(); });
    $("crConfigurar").addEventListener("click", configurarQuestoes);
    $("crGabarito").addEventListener("change", (ev) => {
      if (ev.target.classList.contains("cr-tipo")) {
        const card = ev.target.closest(".corretor-q");
        const correta = card.querySelector(".cr-correta");
        const op = opcoesTipo(ev.target.value);
        const valor = op.includes(correta.value) ? correta.value : op[0];
        correta.innerHTML = op.map((item) => `<option value="${item}">${item}</option>`).join("");
        correta.value = valor;
      }
      if (ev.target.classList.contains("cr-desc")) atualizarTextoDescritor(ev.target.closest(".corretor-q"));
      gravarFormulario();
      salvar();
      if (ev.target.classList.contains("cr-desc") || ev.target.classList.contains("cr-desc-codigo") || ev.target.classList.contains("cr-desc-texto")) {
        const atuais = atual().questions.map((_, i) => {
          const el = $("crResp" + i);
          return el ? el.value : "-";
        });
        pintarRespostas(atuais);
      }
    });
    $("crSalvarGabarito").addEventListener("click", salvarGabarito);
    $("crVoltarBanco").addEventListener("click", () => {
      if (escolaTravada()) return;
      mostrarBanco();
    });
    $("crSalvarAluno").addEventListener("click", salvarAluno);
    $("crFinalizar").addEventListener("click", finalizarLancamento);
    $("crLancEscola").addEventListener("change", () => {
      sincronizarLancamentoParaAno();
      pintarTurmas();
      pintarLancamentoContexto();
      gravarFormulario();
      salvar();
      refrescarFechamentoNaTela();
    });
    $("crLancDisciplina").addEventListener("change", () => {
      definirDisciplina($("crLancDisciplina").value);
      atualizarTelaDaProva();
      salvar();
      espelharContextoNoLancamento();
      refrescarFechamentoNaTela();
    });
    $("crLancTurma").addEventListener("change", () => {
      sincronizarLancamentoParaAno();
      gravarFormulario();
      pintarSelectAlunos();
      salvar();
      refrescarFechamentoNaTela();
    });
    $("crLancAno").addEventListener("change", () => trocarAno($("crLancAno").value, true));
    $("crLista").addEventListener("click", (ev) => {
      const ed = ev.target.closest("[data-edit-aluno]");
      const del = ev.target.closest("[data-del-aluno]");
      if (ed) editarAluno(Number(ed.dataset.editAluno));
      if (del) excluirAluno(Number(del.dataset.delAluno));
    });
    $("crGerar").addEventListener("click", () => gerarResultados(true));
    $("crPdf").addEventListener("click", exportarPdf);
    $("crAluno").addEventListener("change", sincronizarSituacaoDoAluno);
    const boxSit = $("crSituacao");
    if (boxSit) {
      boxSit.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-sit]");
        if (!btn || btn.disabled) return;
        if (turmaTravadaNoLancamento()) {
          avisarLancamentoFechado();
          return;
        }
        if (alunoJaSalvoNoLancamento()) return;
        const ligado = btn.getAttribute("aria-pressed") === "true";
        aplicarSituacao(ligado ? "" : btn.dataset.sit);
      });
    }
    $("crVozIniciar").addEventListener("click", iniciarVoz);
    $("crAbrirEscola").addEventListener("change", () => sincronizarAbrirNoAno("escola"));
    $("crAbrirDisciplina").addEventListener("change", () => sincronizarAbrirNoAno("disciplina"));
    $("crAbrirTurma").addEventListener("change", () => sincronizarAbrirNoAno("turma"));
    $("crAbrirAno").addEventListener("change", () => {
      const ano = $("crAbrirAno").value;
      if (ANOS.includes(ano) && ano !== anoAtual) trocarAno(ano, false);
    });
    $("crAbrirAluno").addEventListener("change", mostrarResultadoAbrir);
    $("crAbrirSalvar").addEventListener("click", salvarAlteracaoResultado);
    $("crAbrirRefazer").addEventListener("click", refazerProva);
    const boxAbrirSit = $("crAbrirSituacao");
    if (boxAbrirSit) {
      boxAbrirSit.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-sit]");
        if (!btn || btn.disabled) return;
        if (lancamentoFinalizado()) {
          avisarLancamentoFechado();
          return;
        }
        const ligado = btn.getAttribute("aria-pressed") === "true";
        aplicarSituacao(ligado ? "" : btn.dataset.sit, "crAbrirSituacao");
      });
    }
    $("crVozPausar").addEventListener("click", pausarVoz);
    $("crVozParar").addEventListener("click", pararVoz);
    pintar();
    if (querRealizar()) {
      acessoRealizar = lerSessaoRealizar();
      if (!acessoRealizar) mostrarTelaLogin();
      else entrarNoLancamento();
    } else {
      document.documentElement.classList.remove("realizar-login", "realizar-ok");
      mostrarBanco();
    }
  }

  window.CORRETOR_VER = "eixo26";
  window.corretorIrPara = function corretorIrPara(realizar) {
    if (realizar) {
      try {
        const u = new URL(location.href);
        u.searchParams.set("realizar", "1");
        history.replaceState(null, "", u.pathname + u.search + u.hash);
      } catch (e) { /* o endereço acompanha a tela quando o navegador permite */ }
    } else {
      marcarTela(false);
    }
    iniciar();
    if (!iniciado) return;
    if (realizar) {
      acessoRealizar = lerSessaoRealizar();
      if (!acessoRealizar) mostrarTelaLogin();
      else entrarNoLancamento();
      return;
    }
    acessoRealizar = null;
    document.documentElement.classList.remove("realizar-login", "realizar-ok");
    mostrarBanco();
  };

  window.corretorAoAbrir = function corretorAoAbrir() {
    iniciar();
  };

  const formRealizar = document.getElementById("realizarForm");
  if (formRealizar) formRealizar.addEventListener("submit", entrarRealizar);
  const btnSairRealizar = document.getElementById("realizarSair");
  if (btnSairRealizar) btnSairRealizar.addEventListener("click", sairRealizar);

  if (document.getElementById("crAddEscola")) {
    const subir = document.body.classList.contains("corretor-solo") ? window.corretorAoAbrir : iniciar;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", subir);
    else subir();
  }
})();
