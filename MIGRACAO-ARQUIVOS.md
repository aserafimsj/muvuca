# Migração — o lugar onde as artes e os vídeos vão morar

**Por que isto existe:** até agora o MUVUCA nunca guardou um arquivo. Este
guia cria a **área de arquivos** do Supabase onde as artes, as fotos e os
vídeos das peças vão ficar.

**É seguro.** Só cria coisa nova. Não encosta em tabela nenhuma das que já
existem, e não apaga nada. Rodar duas vezes não faz mal.

**Antes de começar:** rode o `MIGRACAO-APROVACAO.md` primeiro, se ainda não
rodou. Este guia depende das tabelas que aquele cria.

---

## Uma decisão que já está tomada, para você saber

A área de arquivos vai nascer **fechada**. Quer dizer: mesmo que alguém
descubra o endereço de uma arte, não consegue abrir.

Quem está logado no MUVUCA vê normalmente, porque o sistema pede uma
"chave de visita" temporária a cada vez, que vale uma hora e depois morre.

Isso importa porque **arte não publicada é material sob embargo**. Uma peça
de campanha vazando antes da hora é problema de verdade — e a alternativa
(deixar a área aberta) significaria que qualquer pessoa com o endereço veria
tudo.

---

## Passo 1 — Confirmar que você está no projeto certo

1. Entre em **https://supabase.com** e faça login.
2. Clique no projeto do **MUVUCA**.
3. **Olhe o endereço na barra do navegador.** Ele precisa conter
   **`fkhbjpyoajkadpfjexkb`**.
   - **Tem?** Siga.
   - **É outro código?** **Pare.** Você está no projeto errado.

---

## Passo 2 — Abrir o editor de SQL

1. No **menu da esquerda**, clique em **`SQL Editor`**.
2. Clique em **`New query`**, no alto.

---

## Passo 3 — Colar e rodar

Copie o bloco abaixo **inteiro**, cole na caixa e clique em **`Run`**.

> O Supabase vai mostrar de novo aquele aviso de "operações destrutivas",
> por causa das linhas com `drop policy`. É o mesmo caso de antes: `policy`
> é **regra de acesso**, não arquivo nem dado. Pode clicar em
> **`Executar consulta`**.

```sql
-- ============================================================
-- A ÁREA DE ARQUIVOS
-- "public: false" é o que deixa ela fechada. Nada aqui é aberto
-- para a internet: o MUVUCA pede uma chave temporária a cada vez.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conteudos', 'conteudos', false,
  52428800,   -- 50 MB por arquivo
  array['image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- QUEM PODE MEXER
-- Só quem está logado no MUVUCA. Visitante não entra.
-- ============================================================
drop policy if exists conteudos_arq_ver      on storage.objects;
drop policy if exists conteudos_arq_subir    on storage.objects;
drop policy if exists conteudos_arq_trocar   on storage.objects;
drop policy if exists conteudos_arq_apagar   on storage.objects;

create policy conteudos_arq_ver on storage.objects
  for select to authenticated using (bucket_id = 'conteudos');

create policy conteudos_arq_subir on storage.objects
  for insert to authenticated with check (bucket_id = 'conteudos');

create policy conteudos_arq_trocar on storage.objects
  for update to authenticated using (bucket_id = 'conteudos');

create policy conteudos_arq_apagar on storage.objects
  for delete to authenticated using (bucket_id = 'conteudos');

-- ============================================================
-- A CONFERÊNCIA
-- ============================================================
select
  id                                    as area_criada,
  case when public then 'ABERTA (errado)' else 'fechada (certo)' end as acesso,
  (file_size_limit / 1048576) || ' MB'  as limite_por_arquivo,
  array_length(allowed_mime_types, 1)   as tipos_permitidos
from storage.buckets
where id = 'conteudos';
```

**O que tem que aparecer:** uma tabela com **uma linha só**:

| area_criada | acesso | limite_por_arquivo | tipos_permitidos |
|---|---|---|---|
| conteudos | fechada (certo) | 50 MB | 7 |

**Se `acesso` disser `ABERTA (errado)`:** me avise antes de subir qualquer
arte. Quer dizer que a área ficou pública.

### Se algo diferente aparecer

- **Tabela vazia:** a área não foi criada. Tire um print e me mande.
- **Faixa vermelha falando em `storage.buckets`:** o Storage pode não estar
  ligado nesse projeto. Print, por favor.
- **Faixa vermelha falando em `permission denied`:** você não está rodando
  como dono do projeto. Print.

---

## Passo 4 — Conferir pelo outro lado

1. No **menu da esquerda**, clique em **`Storage`**.
2. Você tem que ver uma área chamada **`conteudos`** na lista, vazia.

Se ela estiver lá, está pronto.

---

## Sobre o espaço

O plano gratuito do Supabase dá **1 GB**. Para você ter noção:

| O quê | Tamanho típico | Quantos cabem em 1 GB |
|---|---|---|
| Arte de feed (JPG) | 300 KB a 1 MB | uns 1.500 |
| Card de carrossel | 300 KB a 1 MB | idem |
| Reel de 30 segundos | 20 a 40 MB | uns 30 |

Ou seja: **arte cabe de sobra; vídeo é que pesa.**

O MUVUCA vai mostrar quanto espaço você já usou, e avisar quando passar de
**80%**. Aí a gente conversa: dá para apagar vídeo de campanha antiga, ou
subir para o plano pago do Supabase (uns US$ 25 por mês).

**Arquivo acima de 50 MB é recusado** com uma mensagem explicando — não
falha em silêncio.
