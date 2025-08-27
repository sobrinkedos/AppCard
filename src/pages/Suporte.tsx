import React, { useState, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import SupabaseError from '../components/SupabaseError';
import { ChamadoSuporte } from '../types';

const Suporte: React.FC = () => {
  const [activeTab, setActiveTab] = useState('chamados');
  const [chamados, setChamados] = useState<ChamadoSuporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [faqs] = useState([
    { id: '1', pergunta: 'Como emitir um novo cartão?', resposta: 'Vá para a seção "Cartões" e clique em "Novo Cartão". Preencha os dados do cliente e o limite desejado.' },
    { id: '2', pergunta: 'Como bloquear um cartão perdido?', resposta: 'Na página de "Detalhes do Cliente", encontre o cartão e use a opção "Bloquear".' },
    { id: '3', pergunta: 'Onde vejo os relatórios de vendas?', resposta: 'Acesse a página "Relatórios" no menu lateral para visualizar gráficos e exportar dados de vendas.' },
  ]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  useEffect(() => {
    if (supabaseError || activeTab !== 'chamados') {
      setLoading(false);
      return;
    }

    const fetchChamados = async () => {
      setLoading(true);
      const { data, error } = await supabase!
        .from('chamados_suporte')
        .select('*, membros_equipe(nome)')
        .order('data_abertura', { ascending: false });

      if (error) console.error('Erro ao buscar chamados:', error);
      else if (data) setChamados(data as any);
      setLoading(false);
    };

    fetchChamados();
  }, [activeTab]);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Ajuda e Suporte</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200"><nav className="flex space-x-8 px-6"><button onClick={() => setActiveTab('chamados')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'chamados' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Abrir Chamado</button><button onClick={() => setActiveTab('faq')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'faq' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Perguntas Frequentes (FAQ)</button></nav></div>
        <div className="p-6">
          {activeTab === 'chamados' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1"><h3 className="text-lg font-semibold text-gray-900 mb-4">Novo Chamado</h3><form className="space-y-4"><div><label className="block text-sm font-medium text-gray-700">Assunto</label><input type="text" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" /></div><div><label className="block text-sm font-medium text-gray-700">Categoria</label><select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"><option>Dúvida</option><option>Problema Técnico</option><option>Sugestão</option></select></div><div><label className="block text-sm font-medium text-gray-700">Descrição</label><textarea rows={5} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"></textarea></div><button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center"><Send className="w-4 h-4 mr-2" /> Enviar</button></form></div>
              <div className="lg:col-span-2"><h3 className="text-lg font-semibold text-gray-900 mb-4">Meus Chamados</h3><div className="space-y-3">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : chamados.map(chamado => (<div key={chamado.id} className="border border-gray-200 rounded-lg p-4"><div className="flex justify-between items-center"><div><p className="font-medium text-gray-800">{chamado.assunto}</p><p className="text-sm text-gray-500">Protocolo: {chamado.protocolo} - Abertura: {new Date(chamado.data_abertura).toLocaleDateString('pt-BR')}</p></div><span className={`px-2 py-1 text-xs font-medium rounded-full ${chamado.status === 'Resolvido' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{chamado.status}</span></div></div>))}
              </div></div>
            </div>
          )}
          {activeTab === 'faq' && (<div className="space-y-4">{faqs.map(faq => (<div key={faq.id} className="border-b border-gray-200 pb-4"><button onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)} className="w-full flex justify-between items-center text-left"><h4 className="font-medium text-gray-900">{faq.pergunta}</h4>{openFaq === faq.id ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}</button>{openFaq === faq.id && (<div className="mt-2 text-gray-600">{faq.resposta}</div>)}</div>))}</div>)}
        </div>
      </div>
    </div>
  );
};

export default Suporte;
