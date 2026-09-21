const { chromium } = require('playwright');
const path = require('path');

// Remonta sempre: rodar contra um aprovacao.html velho da falso alarme nos
// dois sentidos — acusa defeito ja corrigido, ou deixa passar um novo.
require('./monta-aprovacao.js');

/* Os dados estao em monta-aprovacao.js, e os numeros esperados saem de la,
   nao de chute. Em setembro/2026, fora do arquivado:
     total 9 · aprovados 2 · com o cliente 3 · em ajuste 2 · internos 2
   Mais: 1 arquivado (fora de tudo), 1 em outubro, 1 sem data. */

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1150, height:1700} });
  const erros = [];
  page.on('console', m => { if(m.type()==='error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + path.join(__dirname, 'aprovacao.html'));
  await page.waitForSelector('.mesbar', { timeout: 15000 });

  const r = [];
  const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
  const linhas = () => page.locator('.row').count();
  const chip = n => page.locator('.chip', { hasText: n }).first();
  const clicar = async loc => { await loc.click(); await page.waitForTimeout(260); };
  const cartao = n => page.locator('.card', {hasText:n}).first();
  const mesAtual = async () => (await page.locator('.mesnome').textContent()).trim();

  // A bancada usa setembro/2026. Anda ate la a partir do mes de hoje.
  console.log('--- andar de mes ---');
  const inicio = await mesAtual();
  check('abre no mes de hoje', /^[A-ZÀ-Ú][a-zà-ú]+ de \d{4}$/.test(inicio), inicio);
  await clicar(page.locator('.mesbar .btn').first());
  const anterior = await mesAtual();
  check('o "‹" anda um mes para tras', anterior !== inicio, `${inicio} -> ${anterior}`);
  // Fora do mes de hoje aparece o atalho "hoje". Dentro dele, nao — seria um
  // botao que nao faz nada. Este teste so vale com a tela FORA do mes atual,
  // e agora ela esta no mes anterior.
  check('fora do mês de hoje aparece o atalho "hoje"',
    await page.getByRole('button', {name:'hoje'}).count() === 1);
  await clicar(page.getByRole('button', {name:'hoje'}));
  check('e o atalho volta para o mês de hoje', await mesAtual() === inicio, await mesAtual());
  check('dentro do mês de hoje o atalho some',
    await page.getByRole('button', {name:'hoje'}).count() === 0);

  await clicar(page.locator('.mesbar .btn').nth(1));
  await clicar(page.locator('.mesbar .btn').first());
  check('o "›" e o "‹" se desfazem', await mesAtual() === inicio, await mesAtual());

  // Vai para setembro de 2026 clicando no "‹" ou "›" ate chegar. A bancada
  // usa um mes fixo para as contagens nao mudarem com o passar do tempo real.
  const alvo = 'Setembro de 2026';
  for(let i = 0; i < 60 && await mesAtual() !== alvo; i++){
    const paraFrente = new Date() < new Date(2026, 8, 1);
    await page.locator('.mesbar .btn').nth(paraFrente ? 1 : 0).click();
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  check('chega em Setembro de 2026', await mesAtual() === alvo, await mesAtual());

  console.log('\n--- o painel do mes ---');
  check('Conteúdos no mês = 9', (await cartao('Conteúdos no mês').textContent()).includes('9'),
    await cartao('Conteúdos no mês').textContent());
  check('Aprovados = 2',      (await cartao('Aprovados').textContent()).includes('2'));
  // Tres estados diferentes contam como "com o cliente". Contar so "enviado"
  // mostraria 1 e esconderia duas pecas paradas.
  check('Com o cliente = 3',  (await cartao('Com o cliente').textContent()).includes('3'),
    await cartao('Com o cliente').textContent());
  check('Em ajuste = 2',      (await cartao('Em ajuste').textContent()).includes('2'));
  check('Ainda internos = 2', (await cartao('Ainda internos').textContent()).includes('2'));

  const pct = await page.locator('.progresso .pctxt').textContent();
  check('a barra diz 22% (2 de 9)', /22%/.test(pct) && /2 de 9/.test(pct), pct);
  const largura = await page.locator('.progresso .cheio').evaluate(el => el.style.width);
  check('e a barra desenhada acompanha', largura === '22%', largura);

  check('avisa quantos estao com o cliente',
    await page.getByText(/3 conteúdo\(s\) aguardando resposta do cliente/).count() === 1);
  check('avisa quantos estao em ajuste',
    await page.getByText(/2 conteúdo\(s\) com ajuste pedido/).count() === 1);

  console.log('\n--- a lista do mes ---');
  check('mostra os 9 nao arquivados', await linhas() === 9, String(await linhas()));
  const texto = await page.locator('.main, body').first().innerText();
  check('a peça arquivada NAO aparece', !texto.includes('Peça arquivada'));
  check('a peça de outubro NAO aparece', !texto.includes('Peça de outubro'));
  check('a peça sem data NAO aparece na lista do mês', !texto.includes('Peça sem data marcada'));
  // Peca sem data some de todo mes. Se a tela nao avisar, ninguem descobre
  // que ela existe — foi por isso que o aviso virou obrigatorio.
  check('MAS a tela avisa que ela existe',
    await page.getByText(/1 conteúdo\(s\) sem data prevista/).count() === 1);

  console.log('\n--- o cartão ---');
  const carrossel = page.locator('.row', {hasText:'5 coisas que você precisa saber'}).first();
  check('mostra a data',       (await carrossel.locator('.who').textContent()).includes('set'));
  check('mostra a hora',       await carrossel.getByText('18:30').count() === 1);
  check('mostra o status',     await carrossel.locator('.pill', {hasText:'Enviado para aprovação'}).count() === 1);
  check('mostra rede, formato, produto e editoria',
    (await carrossel.innerText()).includes('Instagram · Carrossel · Selic · Educativo'));
  check('mostra a legenda',    (await carrossel.innerText()).includes('Você já conhece o Tesouro Selic?'));
  check('mostra as hashtags',  (await carrossel.innerText()).includes('#TesouroDireto #Investimentos'));
  check('mostra a observação interna',
    (await carrossel.innerText()).includes('Conferir o número da taxa'));
  check('peça na versão 3 mostra "versão 3"',
    await page.locator('.row', {hasText:'Post sobre IPCA+'}).first().getByText('versão 3').count() === 1);
  check('peça na versão 1 NÃO mostra número de versão',
    await carrossel.getByText(/^versão /).count() === 0);
  check('peça sem título diz "sem título"', await page.getByText('sem título').count() === 1);

  console.log('\n--- o histórico de estados ---');
  await clicar(carrossel.getByRole('button', {name:'Histórico'}));
  check('abre o histórico', await carrossel.locator('.historico').count() === 1);
  check('mostra as três mudanças', await carrossel.locator('.hev').count() === 3,
    String(await carrossel.locator('.hev').count()));
  const hist = await carrossel.locator('.historico').innerText();
  check('em português, não em código', hist.includes('Em revisão interna → Enviado para aprovação'), hist.replace(/\n/g,' | '));
  check('e diz quem fez', hist.includes('Ana') && hist.includes('Bruno'));
  await clicar(carrossel.getByRole('button', {name:'Fechar histórico'}));
  check('fecha de novo', await carrossel.locator('.historico').count() === 0);

  console.log('\n--- os arquivos da peca ---');
  // A peca 3 (o carrossel) tem 3 cards; a 7 (o video) tem 1.
  check('o botão mostra quantos arquivos a peça tem',
    (await carrossel.getByRole('button', {name:/^Arquivos/}).textContent()).includes('3'),
    await carrossel.getByRole('button', {name:/^Arquivos/}).textContent());
  await clicar(carrossel.getByRole('button', {name:/^Arquivos/}));
  check('abre o painel de arquivos', await carrossel.locator('.arquivos').count() === 1);
  check('mostra as três artes', await carrossel.locator('.tira').count() === 3,
    String(await carrossel.locator('.tira').count()));
  check('na ordem do carrossel',
    (await carrossel.locator('.tira .nome').allTextContents()).join(',') === 'card-01.jpg,card-02.jpg,card-03.jpg',
    (await carrossel.locator('.tira .nome').allTextContents()).join(','));
  check('numerados 1, 2, 3',
    (await carrossel.locator('.tira .numero').allTextContents()).join(',') === '1,2,3');
  check('com o peso de cada um', (await carrossel.locator('.tira .peso').first().textContent()).includes('KB'));

  /* A area e FECHADA: nenhum arquivo tem endereco fixo. Se a tela deixasse
     de pedir a chave de visita, a arte simplesmente nao apareceria — e um
     teste que so conta <img> nao pegaria isso. */
  const assinou = await page.evaluate(() => window.__storage.filter(s => s.acao === 'assinar'));
  check('pediu chave de visita para as artes', assinou.length >= 1, JSON.stringify(assinou[0] || {}));
  check('e a chave tem prazo de validade', (assinou[0] || {}).validade === 3600, String((assinou[0]||{}).validade));
  check('as três miniaturas desenham', await carrossel.locator('.tira .mini img').count() === 3);

  console.log('\n--- reordenar o carrossel ---');
  const nomes = async () => (await carrossel.locator('.tira .nome').allTextContents()).join(',');
  // Sem isto, clicar em "subir" no primeiro tiraria o card da lista.
  check('o primeiro não pode subir',
    await carrossel.locator('.tira').first().getByRole('button', {name:'↑'}).isDisabled());
  check('o último não pode descer',
    await carrossel.locator('.tira').last().getByRole('button', {name:'↓'}).isDisabled());

  await clicar(carrossel.locator('.tira').nth(1).getByRole('button', {name:'↑'}));
  check('subir o segundo troca com o primeiro', await nomes() === 'card-02.jpg,card-01.jpg,card-03.jpg', await nomes());
  check('e a numeração acompanha',
    (await carrossel.locator('.tira .numero').allTextContents()).join(',') === '1,2,3');
  const ordens = await page.evaluate(() => window.__gravacoes
    .filter(g => g.tabela === 'conteudo_arquivos' && g.valores && 'ordem' in g.valores));
  check('grava a ordem nova no banco', ordens.length >= 2, JSON.stringify(ordens));
  // Gravar o que nao mudou e escrita a toa no banco a cada clique.
  check('e não grava o que não mudou', ordens.length === 2, String(ordens.length));

  console.log('\n--- subir arquivo novo ---');
  const antesUp = await page.evaluate(() => window.__storage.filter(s => s.acao === 'upload').length);
  await carrossel.locator('.subir input[type=file]').setInputFiles({
    name:'card-04.jpg', mimeType:'image/jpeg', buffer: Buffer.from('conteudo falso da arte'),
  });
  await page.waitForTimeout(700);
  const up = await page.evaluate(() => window.__storage.filter(s => s.acao === 'upload'));
  check('subiu o arquivo', up.length === antesUp + 1, String(up.length));
  check('para a área certa', up[up.length-1].balde === 'conteudos');
  // O caminho comeca pelo cliente e pela peca: nunca misturar o material de
  // dois clientes na mesma pasta.
  check('num caminho separado por cliente e peça',
    /^1\/3\//.test(up[up.length-1].caminho), up[up.length-1].caminho);
  check('aparece como o quarto card', await carrossel.locator('.tira').count() === 4);
  check('e entra no FIM do carrossel, sem embaralhar o resto',
    (await nomes()).endsWith('card-04.jpg'), await nomes());
  const fichas = await page.evaluate(() => window.__gravacoes
    .filter(g => g.tabela === 'conteudo_arquivos' && g.acao === 'insert'));
  check('gravou a ficha do arquivo', fichas.length === 1, JSON.stringify(fichas.length));
  check('com o tipo, o nome e o tamanho',
    fichas[0].linhas[0].tipo === 'imagem' && fichas[0].linhas[0].nome === 'card-04.jpg'
      && fichas[0].linhas[0].tamanho > 0, JSON.stringify(fichas[0].linhas[0]));
  console.log('\n--- arquivo recusado explica o porque ---');
  await carrossel.locator('.subir input[type=file]').setInputFiles({
    name:'briefing.pdf', mimeType:'application/pdf', buffer: Buffer.from('nao e imagem'),
  });
  await page.waitForTimeout(600);
  check('PDF é recusado', await carrossel.locator('.tira').count() === 4, String(await carrossel.locator('.tira').count()));
  // Recusar em silencio e o mesmo que falhar em silencio.
  check('e a tela diz por quê', await carrossel.getByText(/briefing\.pdf/).count() === 1);
  check('dizendo o que serve', await carrossel.getByText(/JPG, PNG/).count() >= 1);
  check('e nada foi enviado para a área de arquivos',
    (await page.evaluate(() => window.__storage.filter(s => s.acao === 'upload').length)) === up.length);

  console.log('\n--- remover arquivo ---');
  await clicar(carrossel.locator('.tira').first().getByRole('button', {name:'×'}));
  check('pede confirmação', await carrossel.locator('.tira').first().getByRole('button', {name:'Apagar'}).count() === 1);
  const antesDel = await page.evaluate(() => window.__gravacoes.filter(g => g.acao === 'delete').length);
  await clicar(carrossel.locator('.tira').first().getByRole('button', {name:'Não'}));
  check('desistir não apaga nada',
    (await page.evaluate(() => window.__gravacoes.filter(g => g.acao === 'delete').length)) === antesDel);
  check('e os 4 continuam lá', await carrossel.locator('.tira').count() === 4);

  await clicar(carrossel.locator('.tira').first().getByRole('button', {name:'×'}));
  await clicar(carrossel.locator('.tira').first().getByRole('button', {name:'Apagar'}));
  await page.waitForTimeout(500);
  check('confirmar remove da lista', await carrossel.locator('.tira').count() === 3,
    String(await carrossel.locator('.tira').count()));
  check('apaga a ficha no banco',
    (await page.evaluate(() => window.__gravacoes.filter(g => g.tabela==='conteudo_arquivos' && g.acao==='delete').length)) === 1);
  // Apagar so a ficha deixaria o arquivo ocupando espaco para sempre, sem
  // ninguem conseguir ver nem apagar.
  check('E apaga o arquivo de verdade',
    (await page.evaluate(() => window.__storage.filter(s => s.acao === 'remove').length)) === 1);
  check('e a numeração fecha o buraco',
    (await carrossel.locator('.tira .numero').allTextContents()).join(',') === '1,2,3');

  await clicar(carrossel.getByRole('button', {name:'Fechar arquivos'}));
  check('fecha o painel', await carrossel.locator('.arquivos').count() === 0);
  // Comecou com 3, subiu 1, apagou 1: o contador tem que acompanhar as duas.
  check('e o contador do botão acompanhou',
    (await carrossel.getByRole('button', {name:/^Arquivos/}).textContent()).includes('3'),
    await carrossel.getByRole('button', {name:/^Arquivos/}).textContent());

  console.log('\n--- peca sem arquivo nenhum ---');
  const semArq = page.locator('.row', {hasText:'Stories da semana'}).first();
  check('o botão não mostra número', !(await semArq.getByRole('button', {name:/^Arquivos/}).textContent()).match(/\d/));
  await clicar(semArq.getByRole('button', {name:/^Arquivos/}));
  check('e o painel convida a subir', await semArq.getByText(/Nenhum arquivo ainda/).count() === 1);
  await clicar(semArq.getByRole('button', {name:'Fechar arquivos'}));

  console.log('\n--- mover o status ---');
  const antesGrav = await page.evaluate(() => window.__gravacoes.length);
  await clicar(carrossel.getByRole('button', {name:'O cliente aprovou'}));
  const grav = await page.evaluate(() => window.__gravacoes.slice(-2));
  check('grava o novo status na peça',
    grav[0].tabela === 'conteudos' && grav[0].valores.status === 'aprovado', JSON.stringify(grav[0]));
  // A gravacao do historico nao e opcional: e ela que responde "quem
  // aprovou isso, e quando?".
  check('E grava uma linha no histórico',
    grav[1].tabela === 'conteudo_eventos' &&
    grav[1].linhas[0].de === 'enviado' && grav[1].linhas[0].para === 'aprovado',
    JSON.stringify(grav[1]));
  check('com o nome de quem fez', grav[1].linhas[0].quem === 'Adilson');
  check('duas gravações, nem mais nem menos',
    (await page.evaluate(() => window.__gravacoes.length)) === antesGrav + 2);
  check('o painel acompanha na hora: aprovados vira 3',
    (await cartao('Aprovados').textContent()).includes('3'));
  check('e "com o cliente" cai para 2',
    (await cartao('Com o cliente').textContent()).includes('2'));
  check('a barra recalcula para 33%', /33%/.test(await page.locator('.progresso .pctxt').textContent()));

  // Voltar atras precisa existir: clique errado acontece.
  const reabrir = carrossel.getByRole('button', {name:'Reabrir para alteração'});
  check('de "aprovado" ainda dá para voltar', await reabrir.count() === 1);
  // Mas voltar NAO e a rotina. O verde diz "e por aqui que se segue"; verde
  // em "Reabrir" convidaria a desfazer uma aprovacao pronta.
  check('e "Reabrir" NÃO sai em verde',
    !((await reabrir.getAttribute('class')) || '').includes('ok'),
    await reabrir.getAttribute('class'));
  check('peça aprovada não tem nenhum botão em verde',
    await carrossel.locator('.btn.ok').count() === 0,
    String(await carrossel.locator('.btn.ok').count()));
  // Ja a peca que ainda anda tem exatamente um verde, e e o proximo passo.
  const emAjuste = page.locator('.row', {hasText:'Card de taxas'}).first();
  check('peça em ajuste tem um verde só', await emAjuste.locator('.btn.ok').count() === 1);
  check('e ele é o próximo passo',
    (await emAjuste.locator('.btn.ok').textContent()).includes('Começar a alteração'),
    await emAjuste.locator('.btn.ok').textContent());

  console.log('\n--- os filtros ---');
  check('a pastilha "Todos" conta 9', (await chip('Todos').textContent()).includes('9'));
  await clicar(chip('Aprovado'));
  check('filtrar por Aprovado deixa 3', await linhas() === 3, String(await linhas()));
  await clicar(chip('Todos'));
  check('voltar para Todos devolve 9', await linhas() === 9);

  await page.locator('.filters select').first().selectOption({label:'Facebook'});
  await page.waitForTimeout(260);
  check('filtrar por Facebook deixa 1', await linhas() === 1, String(await linhas()));
  check('e é o cartão de taxas', (await page.locator('.row').first().innerText()).includes('Card de taxas'));

  // Somados com E, nao com OU: Facebook + Reels nao existe na bancada.
  await page.locator('.filters select').nth(1).selectOption({label:'Reels'});
  await page.waitForTimeout(260);
  check('Facebook E Reels não existe — lista vazia', await linhas() === 0, String(await linhas()));
  check('e explica que foi o filtro',
    await page.getByText(/Nenhum conteúdo corresponde ao que você filtrou/).count() === 1);
  check('e NÃO diz que o mês está vazio',
    await page.getByText(/Nenhum conteúdo planejado/).count() === 0);
  await clicar(page.getByRole('button', {name:'Limpar filtros'}));
  check('limpar devolve os 9', await linhas() === 9, String(await linhas()));

  await page.locator('.filters input').first().fill('tesouro selic');
  await page.waitForTimeout(300);
  check('busca na legenda acha 1', await linhas() === 1, String(await linhas()));
  await page.locator('.filters input').first().fill('voce ja conhece');
  await page.waitForTimeout(300);
  check('busca sem acento acha o mesmo', await linhas() === 1, String(await linhas()));
  await clicar(page.getByRole('button', {name:'Limpar filtros'}));

  console.log('\n--- sem data e arquivados ---');
  await clicar(page.getByRole('button', {name:'ver esses'}));
  check('mostra só a peça sem data', await linhas() === 1, String(await linhas()));
  check('e ela diz "sem data"', (await page.locator('.row').first().innerText()).includes('sem data'));
  await clicar(page.getByRole('button', {name:/voltar para Setembro/}));
  check('volta para o mês', await linhas() === 9, String(await linhas()));

  await clicar(chip('Arquivados'));
  check('Arquivados mostra 1', await linhas() === 1, String(await linhas()));
  check('e é a peça arquivada', (await page.locator('.row').first().innerText()).includes('Peça arquivada'));
  check('arquivada não oferece mover status',
    await page.locator('.row').first().getByRole('button', {name:/cliente|revisão/}).count() === 0);
  check('mas oferece desarquivar',
    await page.locator('.row').first().getByRole('button', {name:'↩ Desarquivar'}).count() === 1);
  await clicar(chip('Arquivados'));

  console.log('\n--- arquivar pede confirmação e não apaga ---');
  const primeira = page.locator('.row').first();
  await clicar(primeira.getByRole('button', {name:'Arquivar'}).first());
  check('avisa que nada é apagado',
    await page.getByText(/Arquivar tira da lista do mês. Nada é apagado/).count() === 1);
  const antesCancel = await page.evaluate(() => window.__gravacoes.length);
  await clicar(page.getByRole('button', {name:'Cancelar'}).first());
  check('cancelar não grava nada',
    (await page.evaluate(() => window.__gravacoes.length)) === antesCancel);
  check('e os 9 continuam lá', await linhas() === 9, String(await linhas()));

  console.log('\n--- criar e duplicar ---');
  await clicar(page.getByRole('button', {name:'+ Novo conteúdo'}));
  check('abre o formulário', await page.locator('.addwrap').count() === 1);
  const antesSalvar = await page.evaluate(() => window.__gravacoes.length);
  await clicar(page.locator('.addwrap').getByRole('button', {name:'Salvar'}));
  // Sem data a peca nao entra em mes nenhum e some da vista. Por isso a data
  // e o unico campo obrigatorio.
  check('salvar sem data é recusado com explicação',
    await page.getByText(/Informe a data prevista/).count() === 1);
  check('e nada foi gravado',
    (await page.evaluate(() => window.__gravacoes.length)) === antesSalvar);

  await page.locator('.addwrap input[type=date]').fill('2026-09-20');
  await page.locator('.addwrap input').first().fill('Peça criada no teste');
  await clicar(page.locator('.addwrap').getByRole('button', {name:'Salvar'}));
  const novos = await page.evaluate(() => window.__gravacoes.slice(-2));
  check('grava a peça', novos[0].tabela === 'conteudos' && novos[0].acao === 'insert',
    JSON.stringify(novos[0]).slice(0,120));
  check('já nasce como rascunho', novos[0].linhas[0].status === 'rascunho');
  check('amarrada ao cliente certo', novos[0].linhas[0].cliente_id === 1);
  // Campo vazio na tela tem que virar null, nao "". Um "" numa coluna de
  // numero quebra o insert sem dizer por que.
  check('campos vazios viram null, não string vazia',
    novos[0].linhas[0].rede_id === null && novos[0].linhas[0].legenda === null,
    JSON.stringify({rede:novos[0].linhas[0].rede_id, leg:novos[0].linhas[0].legenda}));
  check('e o nascimento entra no histórico',
    novos[1].tabela === 'conteudo_eventos' && novos[1].linhas[0].para === 'rascunho');
  check('a lista passa a ter 10', await linhas() === 10, String(await linhas()));
  check('o formulário fecha sozinho', await page.locator('.addwrap').count() === 0);

  await clicar(page.locator('.row', {hasText:'Peça criada no teste'}).first()
    .getByRole('button', {name:'Duplicar'}));
  check('duplicar cria uma cópia', await linhas() === 11, String(await linhas()));
  check('com "(cópia)" no nome', await page.getByText('Peça criada no teste (cópia)').count() === 1);
  const dup = await page.evaluate(() => window.__gravacoes.slice(-2)[0]);
  check('e a cópia nasce como rascunho, não herda o status',
    dup.linhas[0].status === 'rascunho', dup.linhas[0].status);

  console.log('\n--- mês vazio e erro de tabela ---');
  await clicar(page.locator('.mesbar .btn').nth(1));   // outubro
  check('outubro tem só a peça de outubro', await linhas() === 1, String(await linhas()));
  await clicar(page.locator('.mesbar .btn').nth(1));   // novembro
  check('novembro está vazio e diz isso',
    await page.getByText(/Nenhum conteúdo planejado para Novembro de 2026/).count() === 1);
  check('e convida a criar', await page.getByText(/Clique em/).count() === 1);
  /* Num mes vazio nao ha painel, nem barra, nem filtros. Cinco cartoes
     escritos "0" e cinco seletores de nada so atrapalhariam a unica coisa
     que importa ali: o botao de criar a primeira peca. */
  check('mês vazio não mostra cartões de zero', await page.locator('.cards').count() === 0);
  check('nem barra de progresso',              await page.locator('.progresso').count() === 0);
  check('nem filtros para filtrar nada',       await page.locator('.filtros').count() === 0);
  check('mas o botão de criar continua lá',
    await page.getByRole('button', {name:'+ Novo conteúdo'}).count() === 1);

  await clicar(page.locator('#b-erro'));
  await page.waitForTimeout(350);
  check('tabela faltando vira aviso em português',
    await page.getByText(/MIGRACAO-APROVACAO\.md/).count() === 1);
  check('e não finge que o mês está vazio',
    await page.getByText(/Nenhum conteúdo planejado/).count() === 0);

  await clicar(page.locator('#b-cheio'));
  await page.waitForTimeout(350);

  console.log('\n--- celular ---');
  await page.setViewportSize({width:375, height:900});
  await page.waitForTimeout(450);
  const larg = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth, tela: window.innerWidth }));
  check('não rola para o lado no celular', larg.doc <= larg.tela + 1, `${larg.doc} > ${larg.tela}`);
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll('.row .btn, .chip, .mesbar .btn')]
      .filter(b => b.getBoundingClientRect().height < 34).length);
  check('nenhum botão menor que o dedo', pequenos === 0, String(pequenos));
  await page.screenshot({ path: path.join(__dirname,'celular-aprovacao.png'), fullPage: false });

  await page.setViewportSize({width:1150, height:1700});
  await page.waitForTimeout(300);
  check('nenhum erro de execução no console', erros.length === 0, erros.slice(0,2).join(' | '));

  await page.screenshot({ path: path.join(__dirname,'aprovacao.png'), fullPage: true });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
