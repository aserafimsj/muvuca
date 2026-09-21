# Módulo de Aprovação de Conteúdo — levantamento antes de construir

Feito antes de escrever código, como manda a regra da casa: investigar
primeiro. O que está aqui é o que eu **encontrei no MUVUCA de hoje**, não o
que eu imagino que exista.

---

## 1. O que já existe e dá para reaproveitar

| O que a especificação pede | O que existe hoje | Veredito |
|---|---|---|
| Multi-cliente, nada preso ao Tesouro Direto | `cliente_id` em **todas** as tabelas, login e RLS | **Reaproveitar inteiro.** A regra já é essa. |
| Rede social | tabela `redes`, por cliente | **Reaproveitar.** |
| Produto / campanha | tabela `produtos`, por cliente | **Reaproveitar.** |
| Editoria | tabela `editorias`, por cliente | **Reaproveitar.** |
| Formato (Reels, Carrossel, Stories…) | campo de texto livre em `publicacoes` | Reaproveitar a ideia, com lista fixa. |
| Filtros por período, rede, formato, status | o padrão já existe no Community e nos Relatórios | **Reaproveitar o jeito**, não copiar o código. |
| Responsável | tabela `perfis` (quem está logado) | **Reaproveitar.** |

## 2. O que NÃO existe — e precisa nascer

| O que a especificação pede | Situação real |
|---|---|
| Conteúdo **antes** de publicar | Não existe. Nada no MUVUCA hoje representa uma peça planejada. |
| Arquivos (imagem, vídeo, arte) | **Não existe nenhum tipo de arquivo no sistema.** O único campo de arquivo que existe lê a planilha dentro do navegador e não sobe nada para lugar nenhum. |
| Status de aprovação | Não existe. |
| Versionamento | Não existe. |
| Comentários de aprovação | Não existe. Cuidado: a tabela `interacoes` é comentário **do público nas redes** — outra coisa completamente. |
| Prévia da rede social | Não existe. O que existe é incorporação de post **já publicado** via `iframe` do Instagram. |
| Portal externo do cliente | Não existe. Hoje **tudo** exige login no painel. |

## 3. Três descobertas que mudam o plano

### 3.1 Não existe calendário editorial no MUVUCA

A seção 24 da especificação manda **não criar um segundo calendário** se já
houver um. Fui atrás: **não há.** Existe até um ícone de calendário no
código, mas ele nunca foi ligado a nada.

**Consequência boa:** não há risco de duplicar registro, porque não há o que
duplicar. O calendário do módulo de Aprovação **passa a ser** o calendário
editorial do MUVUCA. Um só, desde o começo.

### 3.2 "Conteúdos" hoje é outra coisa

A tela **Conteúdos** que existe hoje mostra **posts já publicados**, com
curtidas, alcance e comentários, importados da planilha. Ela é uma tela de
*relatório*, não de *planejamento*.

O módulo novo trata do que ainda **não** foi publicado.

São duas entidades diferentes, e a seção 25 da sua especificação avisa
exatamente sobre isso: não misturar planejado com publicado. Então:

- tabela nova `conteudos` = a peça planejada, com aprovação e versões;
- tabela existente `publicacoes` = o post no ar, com números;
- ligação **opcional** entre as duas, preenchida **depois** de publicar.

Assim o mesmo conteúdo pode aparecer no calendário e na aprovação sem
duplicar registro, e o relatório sempre sabe dizer se está falando de algo
planejado ou de algo que foi ao ar.

### 3.3 O MUVUCA nunca guardou um arquivo

Isto é o maior buraco entre o que existe e o que a especificação pede, e é
onde eu preciso da sua decisão (seção 5 deste documento).

---

## 4. Como eu proponho construir — oito etapas testáveis

Cada uma funciona sozinha e dá para você conferir na tela antes da próxima,
como foi com a Manhã e com o Community.

| # | Etapa | O que você consegue fazer ao fim dela |
|---|---|---|
| 1 | **Fundação** — as tabelas e a tela interna | Cadastrar uma peça com data, rede, formato, editoria, produto, legenda, hashtags e observações. Ainda sem arquivo e sem prévia. |
| 2 | **Arquivos** | Anexar imagens e vídeos a uma peça, várias por peça, e ordenar os cards do carrossel. |
| 3 | **Prévia do Instagram Feed** | Ver a peça como ela ficará: avatar, perfil, imagem, legenda, hashtags — e o **carrossel navegável de verdade**. |
| 4 | **Vídeo, Reels e Stories** | Assistir ao vídeo na prévia, ver o Reel em vertical e navegar pelos Stories na sequência. |
| 5 | **Fluxo de aprovação interno** | Enviar para aprovação, aprovar, solicitar ajuste, comentar e criar versão nova sem apagar a anterior. |
| 6 | **Portal do cliente** | Mandar um link para o cliente. Ele abre, vê só o que é dele, aprova ou pede ajuste — sem entrar no painel. |
| 7 | **Visão do mês e painel** | Calendário, lista e grade do mês; o resumo de quantos aprovados, aguardando e em ajuste; os filtros. |
| 8 | **Ligação com os relatórios** | Quantos conteúdos foram produzidos, aprovados e ajustados — separado do que foi publicado. |

---

## 5. Duas decisões que eu não tomo sozinho

> **DECIDIDO em 21/09/2026 pelo Adilson:**
> - **Arquivos:** caminho 1 — sobem para dentro do MUVUCA (Supabase Storage),
>   com limite de tamanho por arquivo e aviso de espaço acabando.
> - **Acesso do cliente:** caminho 1 — link secreto sem senha, revogável e
>   com prazo de validade.
> - **Ordem:** começar pela Etapa 1 (Fundação), uma etapa de cada vez.

### Decisão A — onde os arquivos vão ficar

A prévia fiel que a especificação pede (seções 6 a 9) depende de o MUVUCA
conseguir **mostrar** a imagem e **tocar** o vídeo. Há dois caminhos:

**Caminho 1 — subir o arquivo para dentro do MUVUCA.**
O Supabase, que já é o banco do MUVUCA, tem uma área de arquivos. Você
arrasta a arte e ela fica lá.
- A prévia fica perfeita: imagem e vídeo tocam direto.
- O plano gratuito do Supabase dá **1 GB de espaço**. Um mês de artes cabe
  folgado; um mês de **vídeos** pode estourar — um Reel de 30 segundos em boa
  qualidade tem uns 20 a 40 MB.
- Estourando, o plano pago do Supabase custa por volta de US$ 25/mês.

**Caminho 2 — colar o link do Drive / Dropbox.**
- Custo zero, nada para configurar.
- **A prévia fica capenga:** o Google Drive não deixa a imagem aparecer
  dentro de outro site, e vídeo do Drive não toca embutido. Na prática o
  cliente veria um botão "abrir no Drive" — ou seja, voltaríamos ao problema
  que o módulo existe para resolver.

**O que eu recomendo:** caminho 1, com um limite de tamanho por arquivo e um
aviso na tela quando o espaço estiver acabando. Se o vídeo pesar demais, dá
para aceitar link externo **só para vídeo** como exceção.

### Decisão B — como o cliente entra na página de aprovação

**Caminho 1 — link secreto, sem senha.**
`muvuca.../aprovacao/k7f2m9x4b1` — quem tem o link, entra.
- O cliente não cria conta, não decora senha, abre no celular e aprova.
- Quem receber o link encaminhado também entra. Para aprovação de conteúdo
  de marketing, isso costuma ser aceitável; para material sob embargo, não.

**Caminho 2 — link secreto + uma senha curta** que você combina com o
cliente e manda por outro canal.
- Um passo a mais para ele, bem mais seguro.

**Caminho 3 — o cliente cria conta e faz login.**
- O mais seguro e o mais chato. Na prática é o que faz cliente não aprovar.

**O que eu recomendo:** caminho 1 na etapa 6, com o link podendo ser
**revogado** e com **prazo de validade**, e a senha (caminho 2) como um
acréscimo simples depois, se você sentir falta.

Em qualquer um dos três, a regra da seção 20 é cumprida do mesmo jeito: a
página do cliente é servida por uma função separada que só entrega **aquela
aprovação**. Ela não tem como enxergar outro cliente, nem o Community, nem
os dashboards — não por permissão, mas porque o caminho não existe.

---

## 6. Uma coisa que eu vou fazer e é bom você saber

A especificação diz, com razão, para não prometer fidelidade impossível
(seção 18). Toda prévia vai levar, visível, a frase:

> **Simulação de publicação.** A rede social pode exibir com tipografia,
> espaçamento e cortes de texto diferentes.

Isso não é rodapé jurídico: é o que evita a conversa "mas no MUVUCA estava
assim" depois que o post entra no ar.

---

## 7. Um custo técnico que vale registrar

O `index.html` tem hoje 3.235 linhas e 160 KB, tudo num arquivo só, e é
compilado no navegador a cada abertura. Este módulo é o maior de todos até
agora. Não quebra nada, mas a página vai demorar um pouco mais para abrir.

Se incomodar, a saída é separar o módulo num segundo arquivo. Só que isso
**quebra a bancada de teste**, que abre as páginas direto do disco. Então
fica registrado como decisão futura, não como problema de agora.
