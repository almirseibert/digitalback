/**
 * Catálogo de serviços que a Studio Mythos pode oferecer a um lead.
 * Fonte única de verdade — usada para destacar opções ao vendedor no funil
 * e (futuramente) montar propostas.
 */
const SERVICOS = [
  { id: 'site',        label: 'Site institucional',      icon: 'globe',        valor_base: 1500 },
  { id: 'landing',     label: 'Landing page',            icon: 'layout',       valor_base: 900 },
  { id: 'loja',        label: 'Loja virtual / E-commerce', icon: 'shopping-bag', valor_base: 3500 },
  { id: 'sistema',     label: 'Sistema / App sob medida', icon: 'cpu',         valor_base: 6000 },
  { id: 'seo',         label: 'SEO / Otimização',        icon: 'search',       valor_base: 800 },
  { id: 'gmn',         label: 'Google Meu Negócio',      icon: 'map-pin',      valor_base: 600 },
  { id: 'trafego',     label: 'Tráfego pago (Ads)',      icon: 'megaphone',    valor_base: 1200 },
  { id: 'redes',       label: 'Gestão de redes sociais', icon: 'instagram',    valor_base: 1000 },
  { id: 'identidade',  label: 'Identidade visual / Logo', icon: 'palette',     valor_base: 1200 },
  { id: 'manutencao',  label: 'Hospedagem & Manutenção', icon: 'server',       valor_base: 250 },
];

module.exports = { SERVICOS };
