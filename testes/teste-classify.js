// Testa a função SEM rede: troca o fetch global por respostas de mentira.
const handler = require(require("path").join(__dirname,"..","api","classify.js"));

process.env.ANTHROPIC_API_KEY = "sk-ant-faketestkey";

function fakeRes() {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

const LOTE = [
  { id: 1, autor: "@ana", texto: "como invisto?" },
  { id: 2, autor: "@bob", texto: "adorei!" },
];

function respostaDaIA({ texto, stop_reason = "end_turn", ok = true, status = 200, corpo }) {
  global.fetch = async () => ({
    ok,
    status,
    json: async () =>
      corpo || {
        content: [{ type: "text", text: texto }],
        stop_reason,
        usage: { input_tokens: 100, output_tokens: 50 },
      },
  });
}

async function cenario(nome, preparar, esperado) {
  preparar();
  const res = fakeRes();
  await handler({ method: "POST", body: { cliente: "Tesouro Direto", batch: LOTE } }, res);
  const passou = res.code === esperado;
  console.log(
    (passou ? "  OK  " : " FALHA") + ` | ${nome}\n         esperava ${esperado}, veio ${res.code}` +
    `\n         -> ${JSON.stringify(res.body).slice(0, 150)}\n`
  );
  return passou;
}

(async () => {
  const bom = '[{"i":1,"sentimento":"duvida","triagem":"responder","produto":"selic","needsLegal":false,"rascunho":"Oi!","motivo":"duvida"},{"i":2,"sentimento":"positivo","triagem":"curtir","produto":"nenhum","needsLegal":false,"rascunho":"Obrigado!","motivo":"elogio"}]';
  // Exatamente o que acontecia antes: JSON cortado, SEM o "]" final.
  const cortado = '[{"i":1,"sentimento":"duvida","triagem":"responder","produto":"sel';

  const r = [];
  r.push(await cenario("resposta boa -> 200 com resultados", () => respostaDaIA({ texto: bom }), 200));
  r.push(await cenario("CORTADA por tamanho -> 502 explicito (antes: 200 vazio)", () => respostaDaIA({ texto: cortado, stop_reason: "max_tokens" }), 502));
  r.push(await cenario("cortada sem aviso de stop_reason -> 502", () => respostaDaIA({ texto: cortado }), 502));
  r.push(await cenario("IA recusou -> 502 explicito", () => respostaDaIA({ texto: "", stop_reason: "refusal" }), 502));
  r.push(await cenario("IA tagarela sem JSON -> 502 explicito", () => respostaDaIA({ texto: "Claro! Vou classificar." }), 502));
  r.push(await cenario("JSON mal formado -> 502 explicito", () => respostaDaIA({ texto: '[{"i":1,,}]' }), 502));
  r.push(await cenario("erro da Anthropic -> 502", () => respostaDaIA({ corpo: { error: { message: "credito insuficiente" } } }), 502));
  r.push(await cenario("gateway quebrado sem JSON de erro -> 502", () => respostaDaIA({ ok: false, status: 503, corpo: {} }), 502));

  // O lote grande continua barrado antes de gastar dinheiro.
  const res = fakeRes();
  await handler({ method: "POST", body: { batch: new Array(41).fill({ id: 1, texto: "x" }) } }, res);
  console.log((res.code === 400 ? "  OK  " : " FALHA") + ` | lote de 41 barrado antes de chamar a IA -> ${res.code}`);
  r.push(res.code === 400);

  // O endereço de conferência no navegador continua funcionando.
  const res2 = fakeRes();
  await handler({ method: "GET" }, res2);
  const temVersao = res2.code === 200 && res2.body.versao && res2.body.chave_encontrada === true;
  console.log((temVersao ? "  OK  " : " FALHA") + ` | pagina de conferencia (GET) -> versao ${res2.body.versao}`);
  r.push(temVersao);

  console.log(`\n${r.filter(Boolean).length}/${r.length} cenarios passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
