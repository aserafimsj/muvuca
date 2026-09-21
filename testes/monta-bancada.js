// Monta uma pagina de teste que renderiza SO o cartao do comentario, com dados
// de mentira e um Supabase falso. Assim da para abrir num navegador de verdade
// sem login e sem tocar no banco.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1]
  // a bancada monta so o cartao; o App inteiro tentaria a mesma div #root
  .replace(/ReactDOM\.createRoot\(document\.getElementById\('root'\)\)\.render\(<App\/>\);/, '');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const COMENTARIOS = [
  {id:1, autor:'valdirene.goncalves', texto:'Como faço para investir?', origem:'Feed',
   rede_id:1, produto_id:null, editoria_id:null, sentimento_id:4, triagem:'Pendente',
   resposta:'Oi, @valdirene! 💙 Para começar é preciso CPF ativo e conta numa instituição habilitada.',
   link_conteudo:'https://instagram.com/p/abc', data_coment:'2026-09-15',
   ia_em:'2026-09-20T23:00:00Z', ia_triagem:'responder', ia_motivo:'duvida de iniciante', ia_juridico:false},
  {id:2, autor:null, texto:'GANHE DINHEIRO FACIL clique no link', origem:'DM',
   rede_id:1, produto_id:null, editoria_id:null, sentimento_id:5, triagem:'Ignorar',
   resposta:'', link_conteudo:null, data_coment:null,
   ia_em:'2026-09-20T23:00:00Z', ia_triagem:'nao_responder', ia_motivo:'spam', ia_juridico:false},
  {id:3, autor:'jose.silva', texto:'Isso aqui é melhor que aposta?', origem:'Feed',
   rede_id:1, produto_id:1, editoria_id:1, sentimento_id:2, triagem:'Pendente',
   resposta:'', link_conteudo:null, data_coment:null,
   ia_em:'2026-09-20T23:00:00Z', ia_triagem:'responder', ia_motivo:'tema sensivel', ia_juridico:true},
  // Comentario NUNCA analisado pela IA: nao deve mostrar etiqueta nenhuma.
  {id:4, autor:'maria', texto:'Boa noite', origem:'Feed', rede_id:null, produto_id:null,
   editoria_id:null, sentimento_id:null, triagem:'Pendente', resposta:'',
   link_conteudo:null, data_coment:null, ia_em:null},
];

const CFG = {
  sentimentos:[{id:1,nome:'Positivo'},{id:2,nome:'Negativo'},{id:3,nome:'Neutro'},{id:4,nome:'Dúvida'},{id:5,nome:'Bot'}],
  redes:[{id:1,nome:'Instagram'},{id:2,nome:'Facebook'}],
  produtos:[{id:1,nome:'Selic'},{id:2,nome:'IPCA+'}],
  editorias:[{id:1,nome:'Educativo'}],
};

const bancada = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${css}</style>
<script src="./node_modules/react/umd/react.development.js"></script>
<script src="./node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="./node_modules/@babel/standalone/babel.min.js"></script>
<script>
  // Supabase de mentira: registra o que seria gravado, sem rede nenhuma.
  window.__gravacoes = [];
  window.supabase = { createClient: () => ({
    from: () => ({
      update: (v) => ({ eq: (_c, id) => { window.__gravacoes.push({id, ...v}); return Promise.resolve({error:null}); } }),
      select: () => ({ eq: () => ({ order: () => Promise.resolve({data:[],error:null}) }) }),
    }),
    auth: { getSession: () => Promise.resolve({data:{session:null}}), onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}) },
  })};
  // fetch de mentira para o "Gerar de novo".
  window.fetch = async () => ({ ok:true, status:200, json: async () => ({
    results:[{i:3, sentimento:'negativo', triagem:'responder', produto:'nenhum',
              needsLegal:true, rascunho:'Rascunho novinho gerado pela IA.', motivo:'gerado no teste'}],
    uso:{input_tokens:10, output_tokens:5} }) });
</script>
</head>
<body style="padding:20px;background:#F6F6F3">
<div id="root"></div>
<script type="text/babel">
${src}

const COMENTARIOS = ${JSON.stringify(COMENTARIOS)};
const CFG = ${JSON.stringify(CFG)};

function Bancada(){
  const [itens, setItens] = useState(COMENTARIOS);
  const onCampo = async (id, campo, valor) => {
    window.__gravacoes.push({id, [campo]: valor});
    setItens(p => p.map(x => x.id===id ? {...x, [campo]:valor} : x));
  };
  const onGerarResposta = async (it) => {
    const nova = 'Rascunho novinho gerado pela IA.';
    window.__gravacoes.push({id:it.id, resposta:nova});
    setItens(p => p.map(x => x.id===it.id ? {...x, resposta:nova, ia_motivo:'gerado no teste'} : x));
    return {ok:true};
  };
  return <div>{itens.map(it => <Linha key={it.id} it={it} cfg={CFG} onCampo={onCampo} onGerarResposta={onGerarResposta} />)}</div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<Bancada/>);
</script></body></html>`;

fs.writeFileSync(__dirname + '/bancada.html', bancada);
console.log('bancada.html montada');
