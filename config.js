/* NEMESIS · configuração
   Cole aqui os dados do SEU projeto Supabase (Project Settings > API):
   - SUPABASE_URL: o "Project URL"
   - SUPABASE_ANON_KEY: a chave "anon public" (ou "publishable")
   Essa chave é pública por natureza. Quem protege os dados são as regras
   de segurança (RLS) do arquivo supabase/schema.sql.
   Com os dois campos vazios, o app abre em MODO DEMONSTRAÇÃO.
   - ASSINATURA: o que aparece no rodapé do card de Stories do relatório (ex.: o seu @).
   - LEGAL: seus dados de responsável pelos dados (LGPD), usados nos termos que as alunas aceitam. */
window.NEMESIS_CONFIG = {
  SUPABASE_URL: "https://ycndwyjvddrmlzunnhvv.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_5yvQMMuri_LUlS3l8OFLbg_L-ot_kcM",
  ASSINATURA: "@luizvcoach",
  // LGPD: quem responde pelos dados das alunas. Aparece na Política de Privacidade e nos Termos de Uso.
  LEGAL: {
    controlador: "Luiz Victor Gomes de Araujo",   // obrigatório: seu nome completo ou o nome da empresa
    documento: "",                                 // opcional: CNPJ (ex.: "CNPJ 00.000.000/0001-00"). Não use CPF: este arquivo é público
    email: "lvgomesaraujo.24@gmail.com",           // obrigatório: e-mail para assuntos de privacidade
    cref: "",                                      // opcional: ex.: "CREF 000000-G/SP"
    cidade: "São Paulo/SP"
  }
};
