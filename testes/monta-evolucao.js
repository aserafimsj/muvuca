// Bancada da Evolucao Diaria: 30 dias de comentarios de duas redes, com dias
// parados, comentarios sem sentimento, sem data e na lixeira — tudo que pode
// fazer a conta mentir.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1]
  .replace(/ReactDOM\.createRoot\(document\.getElementById\('root'\)\)\.render\(<App\/>\);/, '');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const CFG = {
  sentimentos:[{id:1,nome:'Positivo'},{id:2,nome:'Negativo'},{id:3,nome:'Neutro'},{id:4,nome:'Dúvida'}],
  redes:[{id:1,nome:'Instagram'},{id:2,nome:'Facebook'}],
  produtos:[{id:1,nome:'Selic'}],
  editorias:[{id:1,nome:'Educativo'}],
};
const INSTA = {id:1, nome:'Instagram'};
const CLIENTE = {id:1, nome:'Tesouro Direto'};

const hoje = new Date();
const dia = n => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const COMENTARIOS = [];
let id = 1;
const DIAS_PARADOS = [7, 8];
// 27 dias com movimento dentro dos ultimos 27; quantidade varia.
for(let atras = 26; atras >= 0; atras--){
  if(DIAS_PARADOS.includes(atras)) continue;
  const quantos = (atras % 5 === 0) ? 3 : (atras % 3 === 0 ? 2 : 1);
  for(let k = 0; k < quantos; k++){
    COMENTARIOS.push({
      id: id, rede_id: 1, triagem: 'Pendente', autor: 'user'+(id%7),
      texto: 'comentario numero ' + id,
      // Um a cada 6 fica SEM sentimento: tem que virar balde proprio na pilha,
      // nao sumir. Se sumisse, a barra ficaria menor que o numero em cima.
      sentimento_id: (id % 6 === 0) ? null : ((id % 4) + 1),
      data_publicacao: dia(atras), link_conteudo: null,
      ia_em: null, ia_triagem: null, ia_juridico: false, resposta: '',
    });
    id++;
  }
}
const SEM_SENTIMENTO = COMENTARIOS.filter(c => !c.sentimento_id).length;

// Do Facebook: nao pode aparecer no grafico do Instagram.
COMENTARIOS.push({id:id++, rede_id:2, triagem:'Pendente', autor:'doface',
  texto:'do facebook', sentimento_id:1, data_publicacao:dia(3),
  link_conteudo:null, ia_em:null, ia_triagem:null, ia_juridico:false, resposta:''});
// Sem data: so em "Todo o periodo".
COMENTARIOS.push({id:id++, rede_id:1, triagem:'Pendente', autor:'semdata',
  texto:'sem data nenhuma', sentimento_id:1, data_publicacao:null,
  link_conteudo:null, ia_em:null, ia_triagem:null, ia_juridico:false, resposta:''});
COMENTARIOS.push({id:id++, rede_id:1, triagem:'Pendente', autor:'semdata2',
  texto:'sem data tambem', sentimento_id:2, data_publicacao:null,
  link_conteudo:null, ia_em:null, ia_triagem:null, ia_juridico:false, resposta:''});
// Na lixeira: nao entra em conta nenhuma.
COMENTARIOS.push({id:id++, rede_id:1, triagem:'Lixeira', autor:'lixo',
  texto:'jogado fora', sentimento_id:2, data_publicacao:dia(2),
  link_conteudo:null, ia_em:null, ia_triagem:null, ia_juridico:false, resposta:''});

const VIVOS_INSTA_COM_DATA = COMENTARIOS.filter(
  c => c.rede_id === 1 && c.triagem !== 'Lixeira' && c.data_publicacao).length;

const pagina = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${css}</style>
<script src="./node_modules/react/umd/react.development.js"></script>
<script src="./node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="./node_modules/@babel/standalone/babel.min.js"></script>
<script>window.supabase = { createClient: () => ({ from: () => ({}), auth: {} }) };</script>
</head>
<body style="padding:20px;background:#F6F6F3">
<div id="root"></div>
<script type="text/babel">
${src}
const CFG = ${JSON.stringify(CFG)};
const COMENTARIOS = ${JSON.stringify(COMENTARIOS)};
window.__vivosComData = ${VIVOS_INSTA_COM_DATA};
window.__semSentimento = ${SEM_SENTIMENTO};
window.__diasParados = ${JSON.stringify(DIAS_PARADOS)};
ReactDOM.createRoot(document.getElementById('root')).render(
  <EvolucaoDiaria cfg={CFG} interacoes={COMENTARIOS}
    cliente={${JSON.stringify(CLIENTE)}} rede={${JSON.stringify(INSTA)}} />);
</script></body></html>`;

fs.writeFileSync(path.join(__dirname, 'evolucao.html'), pagina);
console.log(`evolucao.html montada (${VIVOS_INSTA_COM_DATA} comentarios do Instagram com data, ${SEM_SENTIMENTO} sem sentimento)`);
