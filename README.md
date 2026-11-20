# Treino Diário

App web (PWA) para garantir **pelo menos 1h30 de exercício por dia**, em qualquer horário.

- Anel de progresso da meta do dia
- Cronômetro (continua contando mesmo se fechar a página) ou registro manual
- Histórico dos últimos 7 dias e sequência (🔥) de dias com meta batida
- Meta configurável e lembrete se a meta não foi batida até um horário
- Funciona offline e pode ser instalado na tela inicial do celular

Os dados ficam salvos no próprio navegador (localStorage).

## Rodar localmente

```bash
python3 -m http.server 8000
```

Abra http://localhost:8000.

## Publicar

Ative o GitHub Pages no repositório (Settings → Pages → branch `main`, pasta `/`).
