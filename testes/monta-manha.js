// Monta uma pagina que renderiza SO a tela Manha, com um Supabase de mentira.
// Assim da para abrir num navegador de verdade, sem login e sem tocar no banco.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1]
  .replace(/ReactDOM\.createRoot\(document\.getElementById\('root'\)\)\.render\(<App\/>\);/, '');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

/* Os itens da bancada. Cada um existe para provar uma coisa:
     1  comentario normal, com sugestao -> tem textarea e botao Copiar
     2  DM escalada por tema politico   -> mostra o motivo, NAO mostra resposta
     3  DM normal                        -> conta como DM na fila
     4  escalada por linguagem proibida  -> o motivo cita a palavra barrada
     5  ja respondido                    -> fora da fila, nao conta no aviso
     6  ignorado                         -> idem
     7  sem link                         -> nao mostra "abrir no Instagram" */
const ITENS = [
  {id:1, cliente_id:1, source:'feed', external_id:'c1', author:'valdirene.goncalves',
   text:'Como faço para começar a investir?', url:'https://www.instagram.com/p/ABC/c/123/',
   received_at:'2026-09-21T08:14:00Z', created_at:'2026-09-21T09:00:00Z',
   label:{sentimento:'duvida', triagem:'responder', produto:'nenhum', needsLegal:false, motivo:'duvida de iniciante'},
   reply:'Oi, @valdirene! 💙 Para começar você precisa de CPF ativo e conta em uma instituição habilitada.',
   escalate:false, escalate_reason:null, status:'pendente'},

  {id:2, cliente_id:1, source:'dm', external_id:'d1', author:'ze.politico',
   text:'O que vocês acham do governo atual?', url:'https://www.instagram.com/direct/t/1',
   received_at:'2026-09-21T08:20:00Z', created_at:'2026-09-21T08:55:00Z',
   label:{sentimento:'politico', triagem:'nao_responder', needsLegal:true, motivo:'tema politico'},
   reply:null, escalate:true, escalate_reason:'tema político, eleitoral ou de governo', status:'pendente'},

  {id:3, cliente_id:1, source:'dm', external_id:'d2', author:'joao.silva',
   text:'Dá para resgatar antes do vencimento?', url:'https://www.instagram.com/direct/t/2',
   received_at:'2026-09-21T08:31:00Z', created_at:'2026-09-21T08:50:00Z',
   label:{sentimento:'duvida', triagem:'responder', produto:'selic', needsLegal:false, motivo:'liquidez'},
   reply:'Oi, @joao! Dá, sim. O Tesouro recompra pelo preço do dia.',
   escalate:false, escalate_reason:null, status:'pendente'},

  {id:4, cliente_id:1, source:'feed', external_id:'c2', author:'curioso',
   text:'É verdade que não tem como perder dinheiro?', url:'https://www.instagram.com/p/DEF/c/456/',
   received_at:'2026-09-21T08:40:00Z', created_at:'2026-09-21T08:45:00Z',
   label:{sentimento:'duvida', triagem:'responder', needsLegal:false, motivo:'promessa de retorno'},
   reply:null, escalate:true,
   escalate_reason:'linguagem proibida — nega o risco ("sem risco")', status:'pendente'},

  {id:5, cliente_id:1, source:'feed', external_id:'c3', author:'ana',
   text:'Amo o conteúdo de vocês!', url:null,
   received_at:'2026-09-20T10:00:00Z', created_at:'2026-09-20T10:30:00Z',
   label:{sentimento:'positivo', triagem:'curtir', needsLegal:false, motivo:'elogio'},
   reply:'Que bom ler isso, @ana! 💙', escalate:false, escalate_reason:null, status:'respondido'},

  {id:6, cliente_id:1, source:'feed', external_id:'c4', author:'bot123',
   text:'segue de volta, ganhe dinheiro fácil', url:null,
   received_at:'2026-09-20T11:00:00Z', created_at:'2026-09-20T11:30:00Z',
   label:{sentimento:'bot', triagem:'nao_responder', needsLegal:false, motivo:'spam'},
   reply:null, escalate:true, escalate_reason:'spam, não responder', status:'ignorado'},

  {id:7, cliente_id:1, source:'feed', external_id:'c5', author:null,
   text:'Boa noite', url:null,
   received_at:'2026-09-21T07:00:00Z', created_at:'2026-09-21T07:30:00Z',
   label:null, reply:'Boa noite! 💙', escalate:false, escalate_reason:null, status:'pendente'},
];

// Uma tabela vazia, para o estado "Nada novo hoje". A bancada troca entre as
// duas por um botao — o estado vazio e tao importante quanto o cheio.
const bancada = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${css}</style>
<script src="./node_modules/react/umd/react.development.js"></script>
<script src="./node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="./node_modules/@babel/standalone/babel.min.js"></script>
<script>
  window.__itens = ${JSON.stringify(ITENS)};
  window.__gravacoes = [];
  window.__vazio = false;
  window.__erro = null;
  // Supabase de mentira: devolve a lista de cima e registra o que seria
  // gravado, sem rede nenhuma.
  window.supabase = { createClient: () => ({
    from: (tabela) => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve(
        window.__erro ? {data:null, error:{message: window.__erro}}
                      : {data: window.__vazio ? [] : window.__itens, error:null}) }) }),
      update: (v) => ({ eq: (_c, id) => { window.__gravacoes.push({tabela, id, ...v}); return Promise.resolve({error:null}); } }),
    }),
    auth: { getSession: () => Promise.resolve({data:{session:null}}), onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}) },
  })};
  // Area de transferencia de mentira, para conferir o que foi copiado.
  // Precisa de defineProperty: navigator.clipboard e um getter so de leitura,
  // e a atribuicao simples falhava em silencio — o teste entao media a
  // area de transferencia DE VERDADE, que em file:// nem existe.
  window.__copiado = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (t) => { window.__copiado.push(t); } },
  });
</script>
</head>
<body style="padding:20px;background:#F6F6F3">
<div id="root"></div>
<script type="text/babel">
${src}

function BancadaManha(){
  // A chave muda quando a bancada troca de cenario, para o componente
  // recarregar do "banco" como faria numa navegacao de verdade.
  const [cenario, setCenario] = useState('cheio');
  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <button className="btn" id="b-cheio" onClick={()=>{window.__vazio=false; window.__erro=null; setCenario('cheio');}}>cheio</button>
        <button className="btn" id="b-vazio" onClick={()=>{window.__vazio=true; window.__erro=null; setCenario('vazio');}}>vazio</button>
        <button className="btn" id="b-erro"  onClick={()=>{window.__erro='relation "public.manha_items" does not exist'; setCenario('erro');}}>erro</button>
      </div>
      <Manha key={cenario} clienteId={1} clienteNome="Tesouro Direto" />
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<BancadaManha/>);
</script></body></html>`;

fs.writeFileSync(__dirname + '/manha.html', bancada);
console.log('manha.html montada');
